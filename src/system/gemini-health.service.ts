import { Injectable, Logger } from "@nestjs/common";
import {
  geminiModel,
  geminiStatusMessage,
  maskSecrets,
} from "../analyses/gemini.service";
export interface GeminiHealth {
  status: "ok" | "unavailable" | "unconfigured";
  checkedAt: string;
  detail?: string;
}
const OK_TTL = 5 * 60 * 1000;
const FAILURE_TTL = 60 * 1000;
// Cached metadata check (GET models/{model}); it never generates content.
@Injectable()
export class GeminiHealthService {
  private readonly logger = new Logger("GeminiHealth");
  private cached?: { value: GeminiHealth; expires: number; key: string };
  private pending?: Promise<GeminiHealth>;
  // Overridable in tests so they never reach the network.
  fetcher: typeof fetch = (...args) => fetch(...args);
  now = () => Date.now();
  async check(): Promise<GeminiHealth> {
    const key = process.env.GEMINI_API_KEY;
    if (!key)
      return {
        status: "unconfigured",
        checkedAt: new Date(this.now()).toISOString(),
        detail: "Falta GEMINI_API_KEY en el servidor.",
      };
    const cacheKey = `${geminiModel()}:${key.length}`;
    if (
      this.cached &&
      this.cached.key === cacheKey &&
      this.cached.expires > this.now()
    )
      return this.cached.value;
    this.pending ??= this.probe(key).finally(() => (this.pending = undefined));
    const value = await this.pending;
    this.cached = {
      value,
      key: cacheKey,
      expires: this.now() + (value.status === "ok" ? OK_TTL : FAILURE_TTL),
    };
    return value;
  }
  private async probe(key: string): Promise<GeminiHealth> {
    const checkedAt = () => new Date(this.now()).toISOString();
    const model = geminiModel();
    try {
      const response = await this.fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
        {
          method: "GET",
          headers: { "x-goog-api-key": key },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (response.ok) return { status: "ok", checkedAt: checkedAt() };
      const body = await response.text().catch(() => "");
      this.logger.error(
        `Verificación de Gemini HTTP ${response.status} (modelo ${model}): ${maskSecrets(body)}`,
      );
      return {
        status: "unavailable",
        checkedAt: checkedAt(),
        detail: geminiStatusMessage(response.status),
      };
    } catch (error) {
      this.logger.error(
        `Verificación de Gemini sin respuesta (modelo ${model}): ${maskSecrets(String(error), 300)}`,
      );
      return {
        status: "unavailable",
        checkedAt: checkedAt(),
        detail:
          "No se pudo contactar a Gemini desde el servidor (sin respuesta en 5 segundos o error de red). El administrador debe revisar la conectividad saliente.",
      };
    }
  }
}
