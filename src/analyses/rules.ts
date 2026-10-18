// Deterministic compatibility rules. Pure functions: no I/O, no randomness.
export type RuleStatus = "pass" | "fail" | "warn" | "unknown";
export interface RuleResult {
  id: string;
  label: string;
  status: RuleStatus;
  detail: string;
  source?: string;
}
export type Verdict = "compatible" | "conditional" | "incompatible";
export interface CatalogComponent {
  name: string;
  category: string;
  specifications: string;
  source: string;
  datasheetUrl?: string | null;
}
export interface RuleInput {
  equipment: { brand: string; model: string; board: string };
  category: string;
  reference: string;
  specifications: string;
  catalog?: CatalogComponent | null;
}
const USER_SOURCE = "Datos ingresados por el usuario";
const EQUIPMENT_SOURCE = "Datos del equipo registrado";
const DESKTOP_CHIPSETS: Record<string, string> = {};
for (const [socket, chipsets] of Object.entries({
  LGA1700: "Z790 Z690 B760 B660 H770 H670 H610",
  LGA1851: "Z890 B860 H810",
  LGA1200: "Z590 B560 H570 H510 Z490 B460 H470 H410",
  LGA1151: "Z390 Z370 B365 B360 H370 H310",
  AM4: "X570 B550 A520 X470 B450 X370 B350 A320",
  AM5: "X870E X870 B850 B840 X670E X670 B650E B650 A620",
}))
  for (const chipset of chipsets.split(" ")) DESKTOP_CHIPSETS[chipset] = socket;
const CHIPSET_RE = new RegExp(
  `(?<![A-Z0-9])(${Object.keys(DESKTOP_CHIPSETS)
    .sort((a, b) => b.length - a.length)
    .join("|")})(?:M|I)?(?![0-9A-Z])`,
  "i",
);
function equipmentText(input: RuleInput) {
  const e = input.equipment;
  return `${e.brand} ${e.model} ${e.board}`;
}
function userComponentText(input: RuleInput) {
  return `${input.reference} ${input.specifications}`;
}
function catalogSource(catalog: CatalogComponent) {
  return `Ficha del catálogo: ${catalog.name}${catalog.datasheetUrl ? ` (${catalog.datasheetUrl})` : ""}`;
}
// A fact about the component: the catalog spec sheet wins over typed data.
function componentFact<T>(
  input: RuleInput,
  extract: (text: string) => T | null,
): { value: T; source: string } | null {
  if (input.catalog) {
    const value = extract(input.catalog.specifications);
    if (value !== null) return { value, source: catalogSource(input.catalog) };
  }
  const value = extract(userComponentText(input));
  return value === null ? null : { value, source: USER_SOURCE };
}
function num(raw: string) {
  return Number(raw.replace(",", "."));
}
export function ramGenerations(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?<![A-Z])DDR\s?([345])(?!\d)/gi))
    found.add(`DDR${m[1]}`);
  return [...found];
}
function ramGeneration(text: string) {
  const found = ramGenerations(text);
  return found.length === 1 ? found[0] : null;
}
export function formFactor(text: string): "SO-DIMM" | "DIMM" | null {
  if (/SO-?\s?DIMM/i.test(text)) return "SO-DIMM";
  if (/(?<![A-Z-])(U|R)?DIMM\b/i.test(text)) return "DIMM";
  return null;
}
// Compact desktops (mini-ITX, Micro, NUC, Tiny, SFF) often use SO-DIMM.
const COMPACT_RE =
  /DeskMini|mini-?ITX|\bITX\b|\bmini\b|\bmicro\b|\bNUC\b|\bTiny\b|\bU?SFF\b/i;
export function equipmentType(text: string): "laptop" | "desktop" | null {
  const laptop =
    /laptop|port[aá]til|notebook|ultrabook|chromebook/i.test(text) ||
    formFactor(text) === "SO-DIMM";
  if (!laptop && COMPACT_RE.test(text) && !formFactor(text)) return null;
  const desktop =
    /escritorio|desktop|torre|\b(micro-?|mini-?|e-?)?ATX\b|\bITX\b/i.test(
      text,
    ) ||
    CHIPSET_RE.test(text) ||
    formFactor(text) === "DIMM";
  if (laptop === desktop) return null;
  return laptop ? "laptop" : "desktop";
}
const SOCKET = "(AM[45]|LGA\\s?-?(1700|1851|1200|1151))";
const socketName = (m: RegExpMatchArray) =>
  m[2] ? `LGA${m[2]}` : m[1].toUpperCase();
// One socket only: an explicit "socket X" wins; several mentions are unknown.
export function socketOf(text: string): string | null {
  const declared = text.match(new RegExp(`socket\\s*:?\\s*${SOCKET}\\b`, "i"));
  if (declared) return socketName(declared);
  const found = new Set<string>();
  for (const m of text.matchAll(new RegExp(`\\b${SOCKET}\\b`, "gi")))
    found.add(socketName(m));
  if (!found.size)
    for (const m of text.matchAll(new RegExp(CHIPSET_RE.source, "gi")))
      found.add(DESKTOP_CHIPSETS[m[1].toUpperCase()]);
  return found.size === 1 ? [...found][0] : null;
}
function wattsAfter(keywords: string, text: string) {
  const m = text.match(
    new RegExp(`(?:${keywords})[^,;\\n]*?\\b(\\d{2,4})\\s?W\\b`, "i"),
  );
  return m ? { watts: Number(m[1]), match: m[0] } : null;
}
const CPU_KEYWORDS =
  "CPU|procesador|Ryzen|Core\\s?i\\d|Core Ultra|Xeon|Pentium|Celeron|Athlon";
const GPU_KEYWORDS = "GPU|gr[aá]fica|RTX|GTX|Radeon|GeForce|\\bRX\\b|\\bArc\\b";
export function systemLoad(text: string) {
  return {
    cpu: wattsAfter(CPU_KEYWORDS, text),
    gpu: wattsAfter(GPU_KEYWORDS, text),
  };
}
function firstWatts(text: string, min = 1) {
  for (const m of text.matchAll(/\b(\d{2,4})\s?W\b/gi))
    if (Number(m[1]) >= min) return Number(m[1]);
  return null;
}
export function voltage(text: string) {
  const m = text.match(/\b(\d{1,2}(?:[.,]\d{1,2})?)\s?V\b/i);
  return m ? num(m[1]) : null;
}
// Equipment voltage only after a context keyword; several values are unknown.
function voltageAfter(keywords: string, text: string) {
  const found = new Set<number>();
  const re = new RegExp(
    `(?:${keywords})[^,;\\n]*?\\b(\\d{1,2}(?:[.,]\\d{1,2})?)\\s?V\\b`,
    "gi",
  );
  for (const m of text.matchAll(re)) found.add(num(m[1]));
  return found.size === 1 ? [...found][0] : null;
}
const CHARGER_KEYWORDS = "cargador|adaptador|charger|adapter|entrada DC|DC-?in";
const BATTERY_KEYWORDS = "bater[ií]a|battery";
export interface Plug {
  kind: "USB-C" | "barrel";
  outer?: number;
  inner?: number;
}
function usbC(text: string) {
  for (const m of text.matchAll(
    /USB[\s-]?C|Type-?C|tipo\s?C|Power Delivery|\bPD\b/gi,
  ))
    if (!/\b(sin|no|without)\s+$/i.test(text.slice(0, m.index))) return true;
  return false;
}
// Every connector option mentioned, including tip adapters in the box.
export function connectors(text: string): Plug[] {
  const plugs: Plug[] = usbC(text) ? [{ kind: "USB-C" }] : [];
  const barrel = /\b(\d(?:[.,]\d)?)\s?(?:x|×)\s?(\d(?:[.,]\d)?)\s?mm\b/gi;
  for (const m of text.matchAll(barrel))
    plugs.push({ kind: "barrel", outer: num(m[1]), inner: num(m[2]) });
  const rest = text.replace(barrel, " ");
  for (const m of rest.matchAll(
    /(?:punta|barrel|jack|conector)[^,;\n]*?\b(\d(?:[.,]\d)?)\s?mm\b/gi,
  ))
    plugs.push({ kind: "barrel", outer: num(m[1]) });
  return plugs;
}
export function plugLabel(p: Plug) {
  return p.kind === "USB-C"
    ? "USB-C"
    : `punta ${p.outer}${p.inner ? ` x ${p.inner}` : ""} mm`;
}
// "exact" when everything known matches, "partial" when an inner size is missing.
function plugMatch(a: Plug, b: Plug): "exact" | "partial" | null {
  if (a.kind !== b.kind) return null;
  if (a.kind === "USB-C") return "exact";
  if (a.outer !== b.outer) return null;
  if (a.inner && b.inner) return a.inner === b.inner ? "exact" : null;
  return a.inner || b.inner ? "partial" : "exact";
}
function bestPlugMatch(plugs: Plug[], sockets: Plug[]) {
  let best: "exact" | "partial" | null = null;
  for (const p of plugs)
    for (const s of sockets) {
      const m = plugMatch(p, s);
      if (m === "exact") return m;
      best ??= m;
    }
  return best;
}
function wattHours(text: string) {
  const m = text.match(/\b(\d{2,3}(?:[.,]\d)?)\s?Wh\b/i);
  return m ? num(m[1]) : null;
}
function cells(text: string) {
  const m = text.match(/\b(\d{1,2})\s?-?\s?(?:celdas?|cells?)\b/i);
  return m ? Number(m[1]) : null;
}
function rule(
  id: string,
  label: string,
  status: RuleStatus,
  detail: string,
  source?: string,
): RuleResult {
  return source
    ? { id, label, status, detail, source }
    : { id, label, status, detail };
}
function close(a: number, b: number, tolerance = 0.05) {
  return Math.abs(a - b) <= Math.max(a, b) * tolerance;
}
function ramRules(input: RuleInput): RuleResult[] {
  const eq = equipmentText(input);
  const module = componentFact(input, ramGeneration);
  const boardGens = ramGenerations(input.equipment.board);
  let generation: RuleResult;
  if (!module || !boardGens.length)
    generation = rule(
      "ram-generation",
      "Generación de memoria",
      "unknown",
      `No se pudo determinar la generación ${module ? "que admite el equipo" : "del módulo"}. Indique DDR3, DDR4 o DDR5.`,
      module?.source,
    );
  else if (!boardGens.includes(module.value))
    generation = rule(
      "ram-generation",
      "Generación de memoria",
      "fail",
      `El módulo es ${module.value} y el equipo admite ${boardGens.join("/")}. Las generaciones no son intercambiables.`,
      module.source,
    );
  else if (boardGens.length > 1)
    generation = rule(
      "ram-generation",
      "Generación de memoria",
      "warn",
      `El equipo menciona ${boardGens.join(" y ")}. Confirme qué variante de placa tiene antes de comprar ${module.value}.`,
      module.source,
    );
  else
    generation = rule(
      "ram-generation",
      "Generación de memoria",
      "pass",
      `El módulo ${module.value} coincide con la generación del equipo.`,
      module.source,
    );
  const ff = componentFact(input, formFactor);
  const slot = formFactor(eq);
  const type = equipmentType(eq);
  // Only a slot type stated for the equipment itself justifies a hard fail.
  const expected = slot ?? (type === "laptop" ? "SO-DIMM" : type && "DIMM");
  let shape: RuleResult;
  if (!ff || !expected)
    shape = rule(
      "ram-form-factor",
      "Formato del módulo",
      "unknown",
      ff
        ? "No se pudo determinar qué tipo de ranura usa el equipo. Indique DIMM o SO-DIMM en los datos del equipo."
        : "No se indicó si el módulo es DIMM (escritorio) o SO-DIMM (portátil).",
      ff?.source,
    );
  else if (ff.value === expected)
    shape = rule(
      "ram-form-factor",
      "Formato del módulo",
      "pass",
      slot
        ? `El módulo ${ff.value} coincide con la ranura ${slot} del equipo.`
        : `${ff.value} corresponde a un equipo ${type === "laptop" ? "portátil" : "de escritorio"}.`,
      ff.source,
    );
  else
    shape = slot
      ? rule(
          "ram-form-factor",
          "Formato del módulo",
          "fail",
          `El módulo es ${ff.value}, pero el equipo usa ranuras ${slot}. No encaja físicamente.`,
          ff.source,
        )
      : rule(
          "ram-form-factor",
          "Formato del módulo",
          "warn",
          `El módulo es ${ff.value} y el equipo parece ${type === "laptop" ? "portátil" : "de escritorio"}, que suele usar ${expected}. Confirme el tipo de ranura en el manual antes de comprar.`,
          ff.source,
        );
  return [generation, shape];
}
function cpuRules(input: RuleInput): RuleResult[] {
  const cpu = componentFact(input, socketOf);
  const board = socketOf(input.equipment.board);
  if (!cpu || !board)
    return [
      rule(
        "cpu-socket",
        "Socket del procesador",
        "unknown",
        `No se pudo determinar el socket ${cpu ? "de la placa (indique socket o chipset)" : "del procesador"}.`,
        cpu?.source,
      ),
    ];
  return [
    cpu.value === board
      ? rule(
          "cpu-socket",
          "Socket del procesador",
          "pass",
          `El procesador y la placa usan ${board}. Confirme además la versión de BIOS mínima.`,
          cpu.source,
        )
      : rule(
          "cpu-socket",
          "Socket del procesador",
          "fail",
          `El procesador usa ${cpu.value} y la placa ${board}. Los sockets no son compatibles.`,
          cpu.source,
        ),
  ];
}
// "Required System Power (W)" from the official NVIDIA spec pages.
const NVIDIA_4060 =
  "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4060-4060ti/";
const GPU_SYSTEM_POWER = [
  {
    re: /RTX\s?4090/i,
    name: "NVIDIA GeForce RTX 4090",
    watts: 850,
    url: "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/",
  },
  {
    re: /RTX\s?4060\s?Ti/i,
    name: "NVIDIA GeForce RTX 4060 Ti",
    watts: 550,
    url: NVIDIA_4060,
  },
  {
    re: /RTX\s?4060(?!\s?Ti)(?![0-9A-Z])/i,
    name: "NVIDIA GeForce RTX 4060",
    watts: 550,
    url: NVIDIA_4060,
  },
];
// "fuente recomendada 850 W", "recommended PSU 850W", "850 W system power",
// "Required System Power (W) 850", "550W Minimum system power".
const RECOMMENDED_PSU = [
  /(?:fuente|PSU|power supply)(?:\s+de\s+poder)?\s+(?:recomendada|m[ií]nima|requerida|recommended|minimum|required)\s*:?\s*(?:de\s+)?(\d{3,4})\s?W\b/i,
  /(?:recommended|minimum|required)\s+(?:system\s+power|PSU|power\s+supply)\s*(?:\(W\))?\s*:?\s*(\d{3,4})(?:\s?W)?\b/i,
  /\b(\d{3,4})\s?W\s+(?:(?:minimum|recommended|required)\s+(?:system\s+power|PSU|power\s+supply)|system\s+power)\b/i,
];
function withoutRecommendations(text: string) {
  return RECOMMENDED_PSU.reduce(
    (acc, re) => acc.replace(new RegExp(re.source, "gi"), " "),
    text,
  );
}
interface PsuRecommendation {
  watts: number;
  label: string;
  source: string;
}
// A wattage stated in the data wins; otherwise a known GPU's official figure.
function recommendedPsu(input: RuleInput): PsuRecommendation | null {
  for (const [text, source, who] of [
    [input.equipment.board, EQUIPMENT_SOURCE, "los datos del equipo"],
    [input.specifications, USER_SOURCE, "los datos ingresados"],
  ])
    for (const re of RECOMMENDED_PSU) {
      const m = text.match(re);
      if (m)
        return {
          watts: Number(m[1]),
          label: `la fuente recomendada que indican ${who}`,
          source,
        };
    }
  const text = `${input.equipment.board}; ${input.specifications}`;
  const known = GPU_SYSTEM_POWER.filter((g) => g.re.test(text));
  if (known.length !== 1) return null;
  const gpu = known[0];
  return {
    watts: gpu.watts,
    label: `la potencia de sistema que exige NVIDIA para la ${gpu.name}`,
    source: `Especificaciones oficiales ${gpu.name} (${gpu.url})`,
  };
}
function psuRules(input: RuleInput): RuleResult[] {
  const rec = recommendedPsu(input);
  const load = systemLoad(
    withoutRecommendations(
      `${input.equipment.board}; ${input.specifications}`,
    ),
  );
  // Exclude CPU/GPU TDP fragments so the PSU rating is not confused with them.
  const strip = (text: string) =>
    [load.cpu?.match, load.gpu?.match].reduce<string>(
      (acc, part) => (part ? acc.replace(part, " ") : acc),
      withoutRecommendations(text),
    );
  const psu = componentFact(input, (text) => firstWatts(strip(text), 150));
  const label = "Capacidad de la fuente";
  const belowRecommendation = (value: number, extra = "") =>
    rule(
      "psu-capacity",
      label,
      "fail",
      `La fuente de ${value} W está por debajo de los ${rec!.watts} W de ${rec!.label}.${extra}`,
      `${rec!.source} · ${psu!.source}`,
    );
  if (!psu || (!load.cpu && !load.gpu)) {
    if (psu && rec && psu.value < rec.watts)
      return [belowRecommendation(psu.value)];
    if (psu && rec)
      return [
        rule(
          "psu-capacity",
          label,
          "warn",
          `La fuente de ${psu.value} W cumple los ${rec.watts} W de ${rec.label}, pero falta el TDP del procesador y de la tarjeta gráfica para estimar el consumo.`,
          `${rec.source} · ${psu.source}`,
        ),
      ];
    return [
      rule(
        "psu-capacity",
        label,
        "unknown",
        psu
          ? `La fuente entrega ${psu.value} W, pero falta el TDP del procesador y de la tarjeta gráfica para estimar el consumo.`
          : "No se indicó la potencia de la fuente en vatios.",
        psu?.source,
      ),
    ];
  }
  const cpu = load.cpu?.watts ?? 0;
  const gpu = load.gpu?.watts ?? 0;
  const raw = cpu + gpu + 100;
  const required = Math.ceil(raw * 1.3);
  const estimate = `CPU ${load.cpu ? `${cpu} W` : "sin dato"} + GPU ${load.gpu ? `${gpu} W` : "sin dato"} + 100 W base = ${raw} W; recomendado con 30 % de margen: ${required} W`;
  const meets = rec ? ` Cumple los ${rec.watts} W de ${rec.label}.` : "";
  const source = rec ? `${rec.source} · ${psu.source}` : psu.source;
  // Below the raw sum is a clear failure; inside the margin only a warning.
  if (psu.value < raw)
    return [
      rule(
        "psu-capacity",
        label,
        "fail",
        `La fuente de ${psu.value} W no alcanza el consumo estimado (${estimate}).`,
        psu.source,
      ),
    ];
  // The GPU maker's figure already includes the rest of a typical system.
  if (rec && psu.value < rec.watts)
    return [
      belowRecommendation(psu.value, ` Consumo estimado: ${estimate}.`),
    ];
  if (psu.value < required)
    return [
      rule(
        "psu-capacity",
        label,
        "warn",
        `La fuente de ${psu.value} W cubre el consumo estimado, pero sin el margen recomendado (${estimate}). Bajo picos de carga puede apagarse.${meets}`,
        source,
      ),
    ];
  return [
    rule(
      "psu-capacity",
      label,
      load.cpu && load.gpu ? "pass" : "warn",
      `La fuente de ${psu.value} W cubre el consumo estimado (${estimate}).${meets}${load.cpu && load.gpu ? "" : " Falta un dato de TDP; confirme el consumo total."}`,
      source,
    ),
  ];
}
// No keyword, no requirement: a bare "28W" is usually the CPU TDP.
function requiredWatts(text: string) {
  return (
    wattsAfter(
      "cargador|adaptador|charger|adapter|alimentaci[oó]n|requiere|potencia",
      text,
    )?.watts ?? null
  );
}
function chargerRules(input: RuleInput): RuleResult[] {
  const eq = equipmentText(input);
  const watts = componentFact(input, (t) => firstWatts(t));
  const need = requiredWatts(eq);
  const power =
    !watts || !need
      ? rule(
          "charger-power",
          "Potencia del cargador",
          "unknown",
          `Falta la potencia ${watts ? "que requiere el equipo" : "del cargador"} en vatios.`,
          watts?.source,
        )
      : watts.value < need
        ? rule(
            "charger-power",
            "Potencia del cargador",
            "fail",
            `El cargador entrega ${watts.value} W y el equipo requiere ${need} W. Cargará lento o no encenderá bajo carga.`,
            watts.source,
          )
        : rule(
            "charger-power",
            "Potencia del cargador",
            "pass",
            `El cargador entrega ${watts.value} W y el equipo requiere ${need} W.`,
            watts.source,
          );
  const plug = componentFact(input, (t) => {
    const found = connectors(t);
    return found.length ? found : null;
  });
  const sockets = connectors(eq);
  const match =
    plug && sockets.length ? bestPlugMatch(plug.value, sockets) : null;
  const plugText = plug?.value.map(plugLabel).join(" o ");
  const socketText = sockets.map(plugLabel).join(" o ");
  const plugRule =
    !plug || !sockets.length
      ? rule(
          "charger-connector",
          "Conector",
          "unknown",
          "Indique el conector del cargador y del equipo (USB-C o punta y diámetro en mm).",
          plug?.source,
        )
      : rule(
          "charger-connector",
          "Conector",
          match === "exact" ? "pass" : match ? "warn" : "fail",
          match === "exact"
            ? `El conector coincide (${socketText}).`
            : match
              ? `El diámetro exterior coincide (${socketText}), pero falta el diámetro interior de uno de los dos. Confírmelo antes de conectar.`
              : `El cargador usa ${plugText} y el equipo ${socketText}. El conector no coincide.`,
          plug.source,
        );
  let volts: RuleResult;
  const v = componentFact(input, voltage);
  const needV = voltageAfter(CHARGER_KEYWORDS, eq);
  const usbBoth =
    plug?.value.some((p) => p.kind === "USB-C") &&
    sockets.some((p) => p.kind === "USB-C");
  if (plug && usbBoth)
    volts = rule(
      "charger-voltage",
      "Voltaje",
      "pass",
      "USB-C Power Delivery negocia el voltaje automáticamente.",
      plug.source,
    );
  else if (!v || !needV)
    volts = rule(
      "charger-voltage",
      "Voltaje",
      "unknown",
      "Falta el voltaje de salida del cargador o el que requiere el equipo.",
      v?.source,
    );
  else
    volts = rule(
      "charger-voltage",
      "Voltaje",
      close(v.value, needV) ? "pass" : "fail",
      close(v.value, needV)
        ? `El voltaje ${v.value} V es adecuado para ${needV} V.`
        : `El cargador entrega ${v.value} V y el equipo requiere ${needV} V. Puede dañar el equipo.`,
      v.source,
    );
  return [power, plugRule, volts];
}
function batteryRules(input: RuleInput): RuleResult[] {
  const eq = equipmentText(input);
  const rules: RuleResult[] = [];
  const v = componentFact(input, voltage);
  const needV = voltageAfter(BATTERY_KEYWORDS, eq);
  rules.push(
    !v || !needV
      ? rule(
          "battery-voltage",
          "Voltaje de la batería",
          "unknown",
          "Falta el voltaje nominal de la batería o del equipo.",
          v?.source,
        )
      : rule(
          "battery-voltage",
          "Voltaje de la batería",
          close(v.value, needV) ? "pass" : "fail",
          close(v.value, needV)
            ? `La batería de ${v.value} V coincide con ${needV} V.`
            : `La batería es de ${v.value} V y el equipo usa ${needV} V.`,
          v.source,
        ),
  );
  const wh = componentFact(input, wattHours);
  const needWh = wattHours(eq);
  if (wh && needWh)
    rules.push(
      rule(
        "battery-capacity",
        "Capacidad (Wh)",
        close(wh.value, needWh, 0.1) ? "pass" : "warn",
        close(wh.value, needWh, 0.1)
          ? `La capacidad de ${wh.value} Wh coincide con la original.`
          : `La batería tiene ${wh.value} Wh y la original ${needWh} Wh. Una capacidad distinta suele indicar otro modelo de batería, con otro tamaño y conector. Verifique el número de parte y el formato en la lista de partes del fabricante del equipo antes de comprar.`,
        wh.source,
      ),
    );
  const c = componentFact(input, cells);
  const needCells = cells(eq);
  if (c && needCells)
    rules.push(
      rule(
        "battery-cells",
        "Número de celdas",
        c.value === needCells ? "pass" : "fail",
        c.value === needCells
          ? `Ambas tienen ${needCells} celdas.`
          : `La batería tiene ${c.value} celdas y la original ${needCells}. No es intercambiable.`,
        c.source,
      ),
    );
  const part = eq.match(
    /\b(?:P\/N|n[uú]mero de parte|parte|part(?:\s?number)?)\b\s*:?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
  );
  if (part) {
    const target = normalize(part[1]);
    const text = normalize(
      `${userComponentText(input)} ${input.catalog?.specifications ?? ""} ${input.catalog?.name ?? ""}`,
    );
    rules.push(
      rule(
        "battery-part",
        "Número de parte",
        text.includes(target) ? "pass" : "warn",
        text.includes(target)
          ? `La batería menciona el número de parte ${part[1]}.`
          : `La batería no menciona el número de parte ${part[1]}. Verifique la lista de partes compatibles del fabricante.`,
        EQUIPMENT_SOURCE,
      ),
    );
  }
  return rules;
}
// Storage: interface, M.2 key and form factor against the equipment's slot.
export type DriveInterface = "SATA" | "NVMe";
export type DriveForm =
  | { kind: "M.2"; length: number | null }
  | { kind: "2.5" | "3.5" };
type M2Key = "M" | "B" | "B+M";
// "M.2" with the dot; a bare "M2" only before a length (Apple M2 is a chip).
const M2_RE = /\bM\.2(?!\d)|\bM2(?=[\s-]?22(?:30|42|60|80|110)\b)/i;
const M2_LENGTH_RE = /\b22(?:30|42|60|80|110)\b/g;
const BAY_RE = /\b([23])[.,]5\s?(?:"|”|″|''|pulgadas|inch|in\b)/gi;
function interfacesOf(text: string) {
  const found = new Set<DriveInterface>();
  if (/NVMe|PCI-?e|PCI Express/i.test(text)) found.add("NVMe");
  if (/\bSATA/i.test(text)) found.add("SATA");
  return found;
}
export function driveInterface(text: string): DriveInterface | null {
  const found = interfacesOf(text);
  return found.size === 1 ? [...found][0] : null;
}
export function driveForm(text: string): DriveForm | null {
  const bays = new Set([...text.matchAll(BAY_RE)].map((m) => m[1]));
  const m2 = M2_RE.test(text);
  if (Number(m2) + bays.size !== 1) return null;
  if (!m2) return { kind: bays.has("2") ? "2.5" : "3.5" };
  const lengths = new Set(text.match(M2_LENGTH_RE) ?? []);
  return {
    kind: "M.2",
    length: lengths.size === 1 ? Number([...lengths][0]) : null,
  };
}
function keyOf(text: string): M2Key | null {
  if (/\bB\s?(?:\+|&|\/)\s?M\b|\bM\s?(?:\+|&|\/)\s?B\b/.test(text))
    return "B+M";
  const m = text.match(
    /\b(?:key|clave|llave)\s?-?\s?([BM])\b|\b([BM])[\s-]?key\b/i,
  );
  return m ? ((m[1] ?? m[2]).toUpperCase() as M2Key) : null;
}
// An NVMe M.2 drive (PCIe x4) always uses the M key.
function driveKey(text: string): M2Key | null {
  const key = keyOf(text);
  if (key) return key;
  return M2_RE.test(text) && driveInterface(text) === "NVMe" ? "M" : null;
}
interface StorageSlots {
  m2: boolean;
  lengths: number[];
  interfaces: Set<DriveInterface>;
  key: M2Key | null;
  bays: Set<string>;
  sata: boolean;
}
// Only what the equipment states: M.2 segments (Wi-Fi Key E slots excluded),
// drive bays and SATA ports elsewhere.
function storageSlots(board: string): StorageSlots {
  const segments = board.split(/[;\n]|,\s/);
  const m2 = segments.filter(
    (s) =>
      M2_RE.test(s) &&
      !/\b(?:key|clave)\s?-?\s?E\b|\bE[\s-]?key\b|wi-?fi|wlan/i.test(s),
  );
  const rest = segments.filter((s) => !m2.includes(s)).join("; ");
  const m2Text = m2.join("; ");
  const keys = new Set(m2.map(keyOf).filter((k) => k !== null));
  return {
    m2: m2.length > 0,
    lengths: [...new Set(m2Text.match(M2_LENGTH_RE) ?? [])].map(Number),
    interfaces: interfacesOf(m2Text),
    key: keys.size === 1 ? [...keys][0] : null,
    bays: new Set([...rest.matchAll(BAY_RE)].map((m) => `${m[1]}.5`)),
    sata: /\bSATA/i.test(rest),
  };
}
const formLabel = (f: DriveForm) =>
  f.kind === "M.2"
    ? `M.2${f.length ? ` ${f.length}` : ""}`
    : `de ${f.kind} pulgadas`;
function storageRules(input: RuleInput): RuleResult[] {
  const eq = equipmentText(input);
  const slots = storageSlots(input.equipment.board);
  const type = equipmentType(eq);
  const form = componentFact(input, driveForm);
  const iface = componentFact(input, driveInterface);
  const shapeLabel = "Formato de la unidad";
  let shape: RuleResult;
  if (!form)
    shape = rule(
      "storage-form-factor",
      shapeLabel,
      "unknown",
      "No se indicó el formato de la unidad: M.2 (2230, 2242 o 2280) o 2.5/3.5 pulgadas.",
    );
  else if (form.value.kind === "M.2") {
    const length = form.value.length;
    const lengths = slots.lengths.map((l) => `M.2 ${l}`).join("/");
    if (!slots.m2)
      shape = rule(
        "storage-form-factor",
        shapeLabel,
        "unknown",
        "Los datos del equipo no indican ranuras M.2. Indique la ranura y las longitudes que admite (por ejemplo, M.2 2242/2280).",
        form.source,
      );
    else if (!length)
      shape = rule(
        "storage-form-factor",
        shapeLabel,
        "unknown",
        "No se indicó la longitud del módulo M.2 (2230, 2242 o 2280).",
        form.source,
      );
    else if (!slots.lengths.length)
      shape = rule(
        "storage-form-factor",
        shapeLabel,
        "warn",
        `El equipo tiene ranura M.2, pero no indica qué longitudes admite. Confirme en el manual que acepta M.2 ${length}.`,
        form.source,
      );
    else
      shape = slots.lengths.includes(length)
        ? rule(
            "storage-form-factor",
            shapeLabel,
            "pass",
            `La unidad M.2 ${length} cabe en la ranura ${lengths} del equipo.`,
            form.source,
          )
        : rule(
            "storage-form-factor",
            shapeLabel,
            "fail",
            `La unidad es M.2 ${length} y la ranura del equipo admite ${lengths}. No encaja físicamente.`,
            form.source,
          );
  } else {
    const size = form.value.kind;
    shape = slots.bays.has(size)
      ? rule(
          "storage-form-factor",
          shapeLabel,
          "pass",
          `El equipo indica bahías de ${size} pulgadas.`,
          form.source,
        )
      : rule(
          "storage-form-factor",
          shapeLabel,
          type ? "warn" : "unknown",
          type === "laptop" && size === "3.5"
            ? "Una unidad de 3.5 pulgadas no suele caber en un portátil. Confirme en el manual qué unidades admite."
            : `Los datos del equipo no indican bahías de ${size} pulgadas. Confirme que tenga una libre antes de comprar.`,
          form.source,
        );
  }
  const ifaceLabel = "Interfaz de la unidad";
  let link: RuleResult;
  const name = (i: DriveInterface) => (i === "NVMe" ? "NVMe (PCIe)" : "SATA");
  if (!iface)
    link = rule(
      "storage-interface",
      ifaceLabel,
      "unknown",
      "No se indicó la interfaz de la unidad (SATA o NVMe/PCIe).",
    );
  else if (form?.value.kind === "M.2" || (!form && slots.m2)) {
    const offered = [...slots.interfaces];
    link = !offered.length
      ? rule(
          "storage-interface",
          ifaceLabel,
          "unknown",
          "Los datos del equipo no indican si su ranura M.2 es SATA o NVMe/PCIe.",
          iface.source,
        )
      : slots.interfaces.has(iface.value)
        ? rule(
            "storage-interface",
            ifaceLabel,
            "pass",
            `La unidad ${name(iface.value)} coincide con la ranura M.2 ${offered.map(name).join("/")} del equipo.`,
            iface.source,
          )
        : rule(
            "storage-interface",
            ifaceLabel,
            "fail",
            `La unidad es ${name(iface.value)} y la ranura M.2 del equipo es ${offered.map(name).join("/")}. No funcionará en esa ranura.`,
            iface.source,
          );
  } else
    link =
      iface.value === "SATA" && slots.sata
        ? rule(
            "storage-interface",
            ifaceLabel,
            "pass",
            "El equipo indica puertos SATA para la unidad.",
            iface.source,
          )
        : rule(
            "storage-interface",
            ifaceLabel,
            "unknown",
            `Los datos del equipo no indican puertos ${name(iface.value)}${form ? ` para una unidad ${formLabel(form.value)}` : ""}. Confírmelo en el manual.`,
            iface.source,
          );
  const rules = [shape, link];
  // The key is checked only when the equipment states it.
  const key = componentFact(input, driveKey);
  if (form?.value.kind === "M.2" && slots.key && key) {
    const fits =
      key.value === "B+M" || slots.key === "B+M" || key.value === slots.key;
    rules.push(
      rule(
        "storage-key",
        "Clave del conector M.2",
        fits ? "pass" : "fail",
        fits
          ? `El conector M.2 clave ${key.value} encaja en la ranura clave ${slots.key}.`
          : `La unidad usa conector M.2 clave ${key.value} y la ranura del equipo es clave ${slots.key}. No encaja.`,
        key.source,
      ),
    );
  }
  return rules;
}
export function evaluateRules(input: RuleInput): RuleResult[] {
  switch (input.category) {
    case "RAM":
      return ramRules(input);
    case "Procesador":
      return cpuRules(input);
    case "Fuente de poder":
      return psuRules(input);
    case "Cargador":
      return chargerRules(input);
    case "Batería":
      return batteryRules(input);
    case "Almacenamiento":
      return storageRules(input);
    default:
      return [];
  }
}
export function rulesVerdict(rules: RuleResult[]): Verdict {
  if (rules.some((r) => r.status === "fail")) return "incompatible";
  if (rules.length && rules.every((r) => r.status === "pass"))
    return "compatible";
  return "conditional";
}
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
// Part numbers look like KF432C16BB1/8 or CT1000MX500SSD1: letters and digits.
function partNumbers(name: string) {
  return name
    .split(/\s+/)
    .map(normalize)
    .filter((t) => t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t));
}
export function matchCatalog<T extends CatalogComponent>(
  rows: T[],
  reference: string,
): T | null {
  const ref = normalize(reference);
  if (ref.length < 3) return null;
  const real = rows.filter((r) => !/^DEMOSTRACI[OÓ]N/i.test(r.source));
  // Only confident matches bind a spec sheet; ambiguity falls back to user data.
  const exact = real.filter((r) => normalize(r.name) === ref);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  // A row token must be a whole word of the reference, and must not be a
  // fragment of a longer, different model code typed by the user
  // (e.g. "MX500" inside "CT500MX500SSD1" is not the 1TB "CT1000MX500SSD1").
  const words = reference.split(/\s+/).map(normalize).filter(Boolean);
  const codes = partNumbers(reference);
  const byPart = real.filter((r) => {
    const tokens = partNumbers(r.name);
    const hits = tokens.filter((t) => words.includes(t));
    return (
      hits.length > 0 &&
      !codes.some(
        (c) =>
          !tokens.includes(c) && hits.some((h) => c !== h && c.includes(h)),
      )
    );
  });
  return byPart.length === 1 ? byPart[0] : null;
}
// Spanish warnings when the typed data contradicts the matched spec sheet.
export function catalogWarnings(input: RuleInput): string[] {
  const catalog = input.catalog;
  if (!catalog) return [];
  const typed = userComponentText(input);
  const sheet = catalog.specifications;
  const intro = `La referencia coincide con «${catalog.name}» del catálogo, cuya ficha indica`;
  const warnings: string[] = [];
  const compare = (
    label: string,
    a: string | number | null,
    b: string | number | null,
  ) => {
    if (a !== null && b !== null && a !== b)
      warnings.push(
        `${intro} ${label} ${a}, pero usted indicó ${b}. Verifique la etiqueta del componente antes de continuar.`,
      );
  };
  if (catalog.category !== input.category)
    warnings.push(
      `${intro} la categoría ${catalog.category}, pero usted eligió ${input.category}.`,
    );
  compare("la generación", ramGeneration(sheet), ramGeneration(typed));
  compare("el formato", formFactor(sheet), formFactor(typed));
  compare("el socket", socketOf(sheet), socketOf(typed));
  const sheetPlugs = connectors(sheet);
  const typedPlugs = connectors(typed);
  if (
    sheetPlugs.length &&
    typedPlugs.length &&
    !bestPlugMatch(sheetPlugs, typedPlugs)
  )
    warnings.push(
      `${intro} el conector ${sheetPlugs.map(plugLabel).join(" o ")}, pero usted indicó ${typedPlugs.map(plugLabel).join(" o ")}. Verifique la etiqueta del componente antes de continuar.`,
    );
  if (["Fuente de poder", "Cargador"].includes(input.category))
    compare("la potencia (W)", firstWatts(sheet), firstWatts(typed));
  if (["Cargador", "Batería"].includes(input.category))
    compare("el voltaje (V)", voltage(sheet), voltage(typed));
  return warnings;
}
