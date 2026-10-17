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
    .join("|")})(?![0-9])`,
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
export function equipmentType(text: string): "laptop" | "desktop" | null {
  const laptop =
    /laptop|port[aá]til|notebook|ultrabook|chromebook/i.test(text) ||
    formFactor(text) === "SO-DIMM";
  const desktop =
    /escritorio|desktop|torre|\b(micro-?|mini-?|e-?)?ATX\b|\bITX\b/i.test(
      text,
    ) ||
    CHIPSET_RE.test(text) ||
    formFactor(text) === "DIMM";
  if (laptop === desktop) return null;
  return laptop ? "laptop" : "desktop";
}
export function socketOf(text: string): string | null {
  const explicit = text.match(/\b(AM[45]|LGA\s?-?(1700|1851|1200|1151))\b/i);
  if (explicit)
    return explicit[2] ? `LGA${explicit[2]}` : explicit[1].toUpperCase();
  const chipset = text.match(CHIPSET_RE);
  return chipset ? DESKTOP_CHIPSETS[chipset[1].toUpperCase()] : null;
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
export function connector(text: string): string | null {
  if (/USB[\s-]?C|Type-?C|tipo\s?C|Power Delivery|\bPD\b/i.test(text))
    return "USB-C";
  const barrel = text.match(
    /\b(\d(?:[.,]\d)?)\s?(?:x|×)\s?(\d(?:[.,]\d)?)\s?mm\b/i,
  );
  if (barrel) return `${num(barrel[1])} mm`;
  const tip = text.match(
    /(?:punta|barrel|jack|conector)[^,;\n]*?\b(\d(?:[.,]\d)?)\s?mm\b/i,
  );
  return tip ? `${num(tip[1])} mm` : null;
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
  const type = equipmentType(eq);
  let shape: RuleResult;
  if (!ff || !type)
    shape = rule(
      "ram-form-factor",
      "Formato del módulo",
      "unknown",
      ff
        ? "No se pudo determinar si el equipo es portátil o de escritorio."
        : "No se indicó si el módulo es DIMM (escritorio) o SO-DIMM (portátil).",
      ff?.source,
    );
  else {
    const expected = type === "laptop" ? "SO-DIMM" : "DIMM";
    shape =
      ff.value === expected
        ? rule(
            "ram-form-factor",
            "Formato del módulo",
            "pass",
            `${ff.value} corresponde a un equipo ${type === "laptop" ? "portátil" : "de escritorio"}.`,
            ff.source,
          )
        : rule(
            "ram-form-factor",
            "Formato del módulo",
            "fail",
            `El módulo es ${ff.value}, pero un equipo ${type === "laptop" ? "portátil" : "de escritorio"} usa ${expected}. No encaja físicamente.`,
            ff.source,
          );
  }
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
function psuRules(input: RuleInput): RuleResult[] {
  const load = systemLoad(`${input.equipment.board} ${input.specifications}`);
  // Exclude CPU/GPU TDP fragments so the PSU rating is not confused with them.
  const strip = (text: string) =>
    [load.cpu?.match, load.gpu?.match].reduce<string>(
      (acc, part) => (part ? acc.replace(part, " ") : acc),
      text,
    );
  const psu = componentFact(input, (text) => firstWatts(strip(text), 150));
  if (!psu || (!load.cpu && !load.gpu))
    return [
      rule(
        "psu-capacity",
        "Capacidad de la fuente",
        "unknown",
        psu
          ? `La fuente entrega ${psu.value} W, pero falta el TDP del procesador y de la tarjeta gráfica para estimar el consumo.`
          : "No se indicó la potencia de la fuente en vatios.",
        psu?.source,
      ),
    ];
  const cpu = load.cpu?.watts ?? 0;
  const gpu = load.gpu?.watts ?? 0;
  const required = Math.ceil((cpu + gpu + 100) * 1.3);
  const estimate = `CPU ${load.cpu ? `${cpu} W` : "sin dato"} + GPU ${load.gpu ? `${gpu} W` : "sin dato"} + 100 W base, con 30 % de margen = ${required} W`;
  if (psu.value < required)
    return [
      rule(
        "psu-capacity",
        "Capacidad de la fuente",
        "fail",
        `La fuente de ${psu.value} W no alcanza el consumo estimado (${estimate}).`,
        psu.source,
      ),
    ];
  return [
    rule(
      "psu-capacity",
      "Capacidad de la fuente",
      load.cpu && load.gpu ? "pass" : "warn",
      `La fuente de ${psu.value} W cubre el consumo estimado (${estimate}).${load.cpu && load.gpu ? "" : " Falta un dato de TDP; confirme el consumo total."}`,
      psu.source,
    ),
  ];
}
function requiredWatts(text: string) {
  return (
    wattsAfter(
      "cargador|adaptador|charger|adapter|alimentaci[oó]n|requiere|potencia",
      text,
    )?.watts ?? firstWatts(text)
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
  const plug = componentFact(input, connector);
  const socket = connector(eq);
  const plugRule =
    !plug || !socket
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
          plug.value === socket ? "pass" : "fail",
          plug.value === socket
            ? `Ambos usan conector ${socket}.`
            : `El cargador usa ${plug.value} y el equipo ${socket}. El conector no coincide.`,
          plug.source,
        );
  let volts: RuleResult;
  const v = componentFact(input, voltage);
  const needV = voltage(eq);
  if (plug?.value === "USB-C" && socket === "USB-C")
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
  const needV = voltage(eq);
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
          : `La batería tiene ${wh.value} Wh y la original ${needWh} Wh. Una capacidad distinta suele implicar otro tamaño físico.`,
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
    /(?:P\/N|n[uú]mero de parte|parte|part(?:\s?number)?)\s*:?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
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
  return (
    real.find((r) => normalize(r.name) === ref) ??
    real.find((r) => partNumbers(r.name).some((p) => ref.includes(p))) ??
    (ref.length >= 8
      ? real.find((r) => normalize(r.name).includes(ref))
      : undefined) ??
    null
  );
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
  compare("el conector", connector(sheet), connector(typed));
  if (["Fuente de poder", "Cargador"].includes(input.category))
    compare("la potencia (W)", firstWatts(sheet), firstWatts(typed));
  if (["Cargador", "Batería"].includes(input.category))
    compare("el voltaje (V)", voltage(sheet), voltage(typed));
  return warnings;
}
