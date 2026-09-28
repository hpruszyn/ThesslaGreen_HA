/**
 * ThesslaGreen Card — custom Lovelace card for the ThesslaGreen_HA integration
 * (https://github.com/aLAN-LDZ/ThesslaGreen_HA)
 *
 * Adapted from the card developed in https://github.com/bwojtyca/ThesslaGreen_HA
 * for this fork's entity model (4208 select, writable 4230/4233/4239 and packed filter dates).
 *
 * A control panel in the style of the ThesslaGreen Air++ / AirS screen:
 *   - a minimalist heat-exchanger airflow diagram (live temps, m³/h, bypass),
 *   - a single unified mode selector (Auto / Manual / special functions),
 *   - season, bypass, efficiency / thermal balance / benefit index, filter + fault status.
 *
 * Single file, no build step. This fork bundles and auto-registers it from the
 * integration's www/ directory.
 *
 * NOTE: strings passed to select entities (e.g. "Wietrzenie", "Zima",
 * "Brak trybu") are the exact option values expected by the integration and
 * MUST stay in Polish. Only their on-screen labels are localized.
 */

const TG_VERSION = "3.2.1-hp1";

// ---------------------------------------------------------------------------
//  Entity handling. The card auto-detects the ThesslaGreen entities at runtime
//  (by platform + entity_id suffix); the defaults below (with the device-name
//  prefix HA adds) are only a fallback. Everything is overridable via config.
// ---------------------------------------------------------------------------
const DEV = "rekuperator_thessla_";

const DEFAULT_ENTITIES = {
  power: `switch.${DEV}rekuperator_on_off`,
  operation_mode: `select.${DEV}rekuperator_tryb_pracy`, // 4208: Automatyczny / Manualny / Chwilowy
  speed: `number.${DEV}rekuperator_predkosc`, // manual intensity % (reg 4210)
  special: `select.${DEV}rekuperator_tryb`, // Brak trybu / Wietrzenie / Pusty Dom / Kominek / Okna
  season: `select.${DEV}rekuperator_sezon`, // Lato / Zima
  comfort: `select.${DEV}rekuperator_eco_komfort`,
  erv: `select.${DEV}rekuperator_erv_tryb`,
  bypass: `switch.${DEV}rekuperator_bypass`, // reg 4320: enable/disable bypass FUNCTION
  bypass_open: `binary_sensor.${DEV}rekuperator_silownik_bypassu`, // coil 9: actuator = open now
  temp_intake: `sensor.${DEV}rekuperator_temperatura_czerpnia`,
  temp_supply: `sensor.${DEV}rekuperator_temperatura_nawiew`,
  temp_extract: `sensor.${DEV}rekuperator_temperatura_wywiew`,
  temp_fpx: `sensor.${DEV}rekuperator_temperatura_za_fpx`,
  temp_ambient: `sensor.${DEV}rekuperator_temperatura_otoczenia`, // reg 22: ambient (TO) probe
  flow_supply: `sensor.${DEV}rekuperator_strumien_nawiew`,
  flow_extract: `sensor.${DEV}rekuperator_strumien_wywiew`,
  efficiency: `sensor.${DEV}rekuperator_sprawnosc`,
  recovery_power: `sensor.${DEV}rekuperator_moc_odzysku`,
  cop: `sensor.${DEV}rekuperator_cop`,
  filter_change: `binary_sensor.${DEV}rekuperator_wymiana_filtrow`, // E252 (8444)
  alarm: `binary_sensor.${DEV}rekuperator_alarm`, // 8192: any "E" warning
  error: `binary_sensor.${DEV}rekuperator_error`, // 8193: any "S" (blocking) error
  // --- optional entities from the fork (v0.3.0+); card falls back if absent ---
  fan_supply_pct: `sensor.${DEV}rekuperator_wydajnosc_nawiew`, // dac 1280 → control-signal % (fallback)
  fan_extract_pct: `sensor.${DEV}rekuperator_wydajnosc_wywiew`, // dac 1281 → control-signal % (fallback)
  eff_sup: `sensor.${DEV}rekuperator_cf_intensywnosc_nawiew`, // 272 → requested/CF supply intensity %
  eff_ext: `sensor.${DEV}rekuperator_cf_intensywnosc_wywiew`, // 273 → requested/CF exhaust intensity %
  nom_sup: `sensor.${DEV}rekuperator_strumien_nominalny_nawiew`, // 4354 → max supply flow (m³/h)
  nom_ext: `sensor.${DEV}rekuperator_strumien_nominalny_wywiew`, // 4355 → max exhaust flow (m³/h)
  bypass_status: `sensor.${DEV}rekuperator_status_bypass`, // 4330: true bypass status
  alarm_code: `sensor.${DEV}rekuperator_kod_alarmu`, // 4384: blocking S-alarm number
  filter_date_sup: `sensor.${DEV}rekuperator_filtr_nawiew_data_wymiany`, // 4660: packed replacement date
  filter_date_ext: `sensor.${DEV}rekuperator_filtr_wywiew_data_wymiany`, // 4662: packed replacement date
  filter_wear_sup: `sensor.${DEV}rekuperator_filtr_nawiew_zuzycie`, // 4482: supply filter wear %
  filter_wear_ext: `sensor.${DEV}rekuperator_filtr_wywiew_zuzycie`, // 4483: exhaust filter wear %
  target_temp: `sensor.${DEV}rekuperator_temperatura_zadana`, // 4212: target supply temp
  bypass_cool: `sensor.${DEV}rekuperator_bypass_prog_chlodzenie`, // 4323: free-cooling activation °C
  bypass_heat: `sensor.${DEV}rekuperator_bypass_prog_grzanie`, // 4322: free-heating activation °C
  bypass_min: `sensor.${DEV}rekuperator_bypass_prog_min`, // 4321: min outdoor temp for bypass °C
  temp_comfort: `sensor.${DEV}rekuperator_temperatura_komfort`, // 8190: KOMFORT setpoint (bypass ref)
  heater_pct: `sensor.${DEV}rekuperator_nagrzewnica`, // 1282: secondary/duct heater output %
  cooler_pct: `sensor.${DEV}rekuperator_chlodnica`, // 1283: duct cooler output %
  schedule: `sensor.${DEV}rekuperator_harmonogram`, // parsed weekly Auto schedule (attrs)
  // per-mode configured intensities/durations (shown on the mode tiles)
  airing_pct: `number.${DEV}rekuperator_wietrzenie_intensywnosc`, // 4230
  airing_time: `number.${DEV}rekuperator_wietrzenie_czas`, // 4233
  away_pct: `sensor.${DEV}rekuperator_pusty_dom_intensywnosc`, // 4232
  window_pct: `number.${DEV}rekuperator_otwarte_okna_intensywnosc_wywiewu`, // 4239
  fireplace_pct: `sensor.${DEV}rekuperator_kominek_intensywnosc`, // 4228
  fireplace_time: `sensor.${DEV}rekuperator_kominek_czas`, // 4237
  speed_temp: `number.${DEV}rekuperator_predkosc_chwilowa`, // 4401: temporary-mode intensity
};

const ENTITY_RULES = {
  power: { domain: "switch", suffix: "rekuperator_on_off" },
  operation_mode: { domain: "select", suffix: "rekuperator_tryb_pracy" },
  bypass: { domain: "switch", suffix: "rekuperator_bypass" },
  bypass_open: { domain: "binary_sensor", suffix: "silownik_bypassu" },
  speed: { domain: "number", suffix: "predkosc" },
  special: { domain: "select", suffix: "rekuperator_tryb" },
  season: { domain: "select", suffix: "sezon" },
  comfort: { domain: "select", suffix: "eco_komfort" },
  erv: { domain: "select", suffix: "erv_tryb" },
  temp_intake: { domain: "sensor", suffix: "temperatura_czerpnia" },
  temp_supply: { domain: "sensor", suffix: "temperatura_nawiew" },
  temp_extract: { domain: "sensor", suffix: "temperatura_wywiew" },
  temp_fpx: { domain: "sensor", suffix: "temperatura_za_fpx" },
  temp_ambient: { domain: "sensor", suffix: ["temperatura_otoczenia", "temperatura_pcb"] },
  flow_supply: { domain: "sensor", suffix: "strumien_nawiew" },
  flow_extract: { domain: "sensor", suffix: "strumien_wywiew" },
  efficiency: { domain: "sensor", suffix: "sprawnosc" },
  // v3.2: renamed to "Bilans termiczny" / "Wskaźnik korzyści termicznej" — match
  // the new slug first, keep the legacy one so existing installs still resolve.
  recovery_power: { domain: "sensor", suffix: ["bilans_termiczny", "moc_odzysku"] },
  cop: { domain: "sensor", suffix: ["wskaznik_korzysci_termicznej", "rekuperator_cop"] },
  filter_change: { domain: "binary_sensor", suffix: "wymiana_filtrow" },
  alarm: { domain: "binary_sensor", suffix: "rekuperator_alarm" },
  error: { domain: "binary_sensor", suffix: "rekuperator_error" },
  fan_supply_pct: { domain: "sensor", suffix: "wydajnosc_nawiew" },
  fan_extract_pct: { domain: "sensor", suffix: "wydajnosc_wywiew" },
  eff_sup: { domain: "sensor", suffix: ["cf_intensywnosc_nawiew", "wydajnosc_rzeczywista_nawiew"] },
  eff_ext: { domain: "sensor", suffix: ["cf_intensywnosc_wywiew", "wydajnosc_rzeczywista_wywiew"] },
  nom_sup: { domain: "sensor", suffix: "strumien_nominalny_nawiew" },
  nom_ext: { domain: "sensor", suffix: "strumien_nominalny_wywiew" },
  bypass_status: { domain: "sensor", suffix: "status_bypass" },
  alarm_code: { domain: "sensor", suffix: "kod_alarmu" },
  filter_date_sup: { domain: "sensor", suffix: ["filtr_nawiew_data_wymiany", "filtr_nawiew_dni"] },
  filter_date_ext: { domain: "sensor", suffix: ["filtr_wywiew_data_wymiany", "filtr_wywiew_dni"] },
  filter_wear_sup: { domain: "sensor", suffix: "filtr_nawiew_zuzycie" },
  filter_wear_ext: { domain: "sensor", suffix: "filtr_wywiew_zuzycie" },
  target_temp: { domain: "sensor", suffix: "temperatura_zadana" },
  bypass_cool: { domain: "sensor", suffix: "bypass_prog_chlodzenie" },
  bypass_heat: { domain: "sensor", suffix: "bypass_prog_grzanie" },
  bypass_min: { domain: "sensor", suffix: "bypass_prog_min" },
  temp_comfort: { domain: "sensor", suffix: "temperatura_komfort" },
  heater_pct: { domain: "sensor", suffix: "nagrzewnica" },
  cooler_pct: { domain: "sensor", suffix: "chlodnica" },
  schedule: { domain: "sensor", suffix: "harmonogram" },
  airing_pct: { domain: "number", suffix: "wietrzenie_intensywnosc" },
  airing_time: { domain: "number", suffix: "wietrzenie_czas" },
  away_pct: { domain: "sensor", suffix: "pusty_dom_intensywnosc" },
  window_pct: { domain: "number", suffix: ["otwarte_okna_intensywnosc_wywiewu", "okno_intensywnosc"] },
  fireplace_pct: { domain: "sensor", suffix: "kominek_intensywnosc" },
  fireplace_time: { domain: "sensor", suffix: "kominek_czas" },
  speed_temp: { domain: "number", suffix: "predkosc_chwilowa" },
};

function findThesslaEntities(hass) {
  if (!hass) return { ids: [], viaRegistry: false };
  const reg = hass.entities;
  if (reg) {
    let ids = Object.keys(reg).filter((id) => reg[id] && reg[id].platform === "thessla_green");
    if (ids.length) return { ids, viaRegistry: true };
    if (hass.devices) {
      const dev = Object.keys(hass.devices).find((d) => {
        const x = hass.devices[d] || {};
        return x.manufacturer === "Thessla Green" || /thessla/i.test(x.name || x.name_by_user || "");
      });
      if (dev) {
        ids = Object.keys(reg).filter((id) => reg[id] && reg[id].device_id === dev);
        if (ids.length) return { ids, viaRegistry: true };
      }
    }
  }
  const ids = Object.keys(hass.states || {}).filter((id) => id.includes("rekuperator") || id.includes("thessla"));
  return { ids, viaRegistry: false };
}

function resolveEntities(hass, overrides = {}) {
  const { ids, viaRegistry } = findThesslaEntities(hass);
  const map = { ...DEFAULT_ENTITIES };
  for (const [role, rule] of Object.entries(ENTITY_RULES)) {
    if (overrides[role]) {
      map[role] = overrides[role];
      continue;
    }
    const suffixes = Array.isArray(rule.suffix) ? rule.suffix : [rule.suffix];
    const found = ids.find((id) => id.startsWith(rule.domain + ".") && suffixes.some((s) => id.endsWith(s)));
    if (found) map[role] = found;
  }
  for (const k of Object.keys(overrides)) if (overrides[k]) map[k] = overrides[k];
  return { map, viaRegistry };
}

// Special functions. `option` = integration select value (Polish); `key` = i18n label.
const SPECIAL_FUNCTIONS = [
  { option: "Wietrzenie", key: "fn_airing", icon: "M14.5,17A2.5,2.5 0 0,1 12,19.5A2.5,2.5 0 0,1 9.5,17H11A1.5,1.5 0 0,0 12.5,18.5A1.5,1.5 0 0,0 14,17A1.5,1.5 0 0,0 12.5,15.5H2V14H12.5A3,3 0 0,1 15.5,17M18,10.5A3.5,3.5 0 0,0 21.5,7A3.5,3.5 0 0,0 18,3.5A3.5,3.5 0 0,0 14.5,7H16A2,2 0 0,1 18,5A2,2 0 0,1 20,7A2,2 0 0,1 18,9H2V10.5H18M18.5,12H2V13.5H18.5A2,2 0 0,1 20.5,15.5A2,2 0 0,1 18.5,17.5H17V19H18.5A3.5,3.5 0 0,0 22,15.5A3.5,3.5 0 0,0 18.5,12Z", pct: "airing_pct", time: "airing_time", max: 150 },
  { option: "Pusty Dom", key: "fn_away", icon: "m24 13l-4 4v-3h-9v-2h9V9zM4 20v-8H1l10-9l7 6.3v.7h-2.21L11 5.69l-5 4.5V18h10v-2h2v4z", pct: "away_pct", max: 50 },
  { option: "Okna", key: "fn_window", icon: "M21 20V2H3v18H1v3h22v-3M19 4v7h-2V4M5 4h2v7H5m0 9v-7h2v7m2 0V4h6v16m2 0v-7h2v7Z", pct: "window_pct", max: 100 },
  { option: "Kominek", key: "fn_fireplace", icon: "M22 22H2v-2h20zm0-16H2V3h20zm-2 1v12h-3v-8s-2.5-1-5-1s-5 1-5 1v8H4V7zm-5.5 7.67h-.03l.34.55l.06.12c.42 1.01.13 2.16-.66 2.9c-.71.66-1.71.83-2.63.71c-.87-.11-1.68-.66-2.13-1.42c-.15-.23-.26-.5-.32-.76L9 16.11c-.04-.96.34-1.97 1.06-2.57c-.33.72-.25 1.62.24 2.25l.06.08c.08.07.19.1.28.05c.09-.03.16-.12.16-.22l-.04-.14c-.53-1.39-.08-3.01 1.03-3.93c.31-.25.71-.48 1.08-.58c-.41.82-.26 1.88.38 2.52l.89.73zm-1.39 2.77c.26-.24.42-.64.39-1v-.19c-.12-.6-.65-.79-1-1.25l-.24-.45c-.13.3-.14.58-.09.91c.06.34.2.63.12.98c-.09.39-.39.78-.92.91c.3.29.78.52 1.27.36z", pct: "fireplace_pct", time: "fireplace_time", max: 100 },
];
const SPECIAL_NONE = "Brak trybu";

// Read-only stats shown in the bottom section. Each is individually toggleable
// via the `metrics` config (a list of keys; omitted = all). `filters` is a richer
// cell that folds together days-to-change + wear %. All open more-info on tap.
const STATS = [
  { key: "efficiency", mref: "efficiency", label: "efficiency" },
  // recovery + benefit labels are overridden per season at update time.
  { key: "recovery", mref: "recovery_power", label: "recovery" },
  { key: "cop", mref: "cop", label: "benefit" },
  { key: "filters", mref: "filter_change", label: "filters" },
];

// Base-mode tiles (register 4208). Temporary is read-only (integration can't set it).
const MODE_ICONS = {
  auto: "M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H9.67C9.24,18.09 9,17.07 9,16A7,7 0 0,1 16,9C17.07,9 18.09,9.24 19,9.67V8M5,21C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H6V1H8V3H16V1H18V3H19A2,2 0 0,1 21,5V11.1C22.24,12.36 23,14.09 23,16A7,7 0 0,1 16,23C14.09,23 12.36,22.24 11.1,21H5M16,11.15A4.85,4.85 0 0,0 11.15,16C11.15,18.68 13.32,20.85 16,20.85A4.85,4.85 0 0,0 20.85,16C20.85,13.32 18.68,11.15 16,11.15Z",
  manual: "M13 24c-3.26 0-6.19-2-7.4-5l-3.03-7.63a1 1 0 0 1 1.24-1.32l.79.26c.56.19 1.02.61 1.24 1.16L7.25 15H8V3.25a1.25 1.25 0 0 1 2.5 0V12h1V1.25a1.25 1.25 0 0 1 2.5 0V12h1V2.75a1.25 1.25 0 0 1 2.5 0V12h1V5.75a1.25 1.25 0 0 1 2.5 0V16c0 4.42-3.58 8-8 8",
  temporary: "M6,2V8H6V8L10,12L6,16V16H6V22H18V16H18V16L14,12L18,8V8H18V2H6M16,16.5V20H8V16.5L12,12.5L16,16.5M12,11.5L8,7.5V4H16V7.5L12,11.5Z",
};

const ICONS = {
  power: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  snow: "M20.79,13.95L18.46,14.57L16.46,13.44V10.56L18.46,9.43L20.79,10.05L21.31,8.12L19.54,7.65L20,5.88L18.07,5.36L17.45,7.69L15.45,8.82L13,7.38V5.12L14.71,3.41L13.29,2L12,3.29L10.71,2L9.29,3.41L11,5.12V7.38L8.5,8.82L6.5,7.69L5.88,5.36L3.95,5.88L4.41,7.65L2.64,8.12L3.16,10.05L5.5,9.43L7.5,10.56V13.44L5.5,14.57L3.16,13.95L2.64,15.88L4.41,16.35L3.95,18.12L5.88,18.64L6.5,16.31L8.5,15.18L11,16.62V18.88L9.29,20.59L10.71,22L12,20.71L13.29,22L14.71,20.59L13,18.88V16.62L15.5,15.18L17.45,16.31L18.07,18.64L20,18.12L19.54,16.35L21.31,15.88L20.79,13.95M9.5,10.56L12,9.11L14.5,10.56V13.44L12,14.89L9.5,13.44V10.56Z",
  sun: "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
  filter: "M12,3A9,9 0 0,0 3,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12H21A9,9 0 0,0 12,3M12,7A5,5 0 0,0 7,12H9A3,3 0 0,1 12,9A3,3 0 0,1 15,12H17A5,5 0 0,0 12,7M11,13V19H13V13H11M11,20V22H13V20H11Z",
  bypass: "M12 14a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2m11.46-5.14l-1.59 6.89L15 14.16l3.8-2.38A7.97 7.97 0 0 0 12 8c-3.95 0-7.23 2.86-7.88 6.63l-1.97-.35C2.96 9.58 7.06 6 12 6c3.58 0 6.73 1.89 8.5 4.72z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
};

// Airflow stream colours (semantic — always shown, in both palettes).
const FLOW = {
  intake: "#2E8FD8", // outdoor air in — cool blue
  extract: "#E1614E", // from rooms — warm red
  supply: "#E24E8E", // to rooms — magenta
  exhaust: "#E0A63C", // to outside — amber
};

const I18N = {
  en: {
    name: "Recuperator", power: "Power", season: "Season", winter: "Winter", summer: "Summer",
    intensity: "Intensity", auto: "Auto", manual: "Manual", temporary: "Temporary",
    fn_airing: "Airing", fn_away: "Away", fn_window: "Open window", fn_fireplace: "Fireplace",
    bypass: "Bypass", enabled: "Enabled", disabled: "Disabled", open: "Open", closed: "Closed", device: "Device",
    bypass_hint_off: "Bypass function disabled",
    bypass_hint_closed: "Function enabled — bypass closed (opens automatically when conditions allow)",
    bypass_hint_open: "Bypass open (active)",
    filters: "Filters", replace: "Replace", ok: "OK",
    efficiency: "Efficiency", recovery: "Recovery", cop: "COP",
    recovery_heat: "Heat recovery", recovery_cool: "Cool recovery", benefit: "Benefit",
    intake: "INTAKE", extract: "EXTRACT", exhaust: "EXHAUST", supply: "SUPPLY",
    warning: "Warning", error: "Error", schedule: "schedule", active: "active", off: "Off", target: "target",
    cfg_comfort: "comf", cfg_min: "min", cfg_wear: "wear",
    bpr_cold: "too cold outside", bpr_band: "room temp in range", bpr_nosupply: "supply fan stopped",
    bpr_cold_short: "too cold", bpr_band_short: "in range", bpr_nosupply_short: "no supply",
    schedule_title: "Schedule", now: "now",
  },
  pl: {
    name: "Rekuperator", power: "Zasilanie", season: "Sezon", winter: "Zima", summer: "Lato",
    intensity: "Intensywność", auto: "Auto", manual: "Ręczny", temporary: "Chwilowy",
    fn_airing: "Wietrzenie", fn_away: "Pusty dom", fn_window: "Otwarte okno", fn_fireplace: "Kominek",
    bypass: "Bypass", enabled: "Włączony", disabled: "Wyłączony", open: "Otwarty", closed: "Zamknięty", device: "Urządzenie",
    bypass_hint_off: "Funkcja bypass wyłączona",
    bypass_hint_closed: "Funkcja włączona — bypass zamknięty (uaktywni się, gdy warunki będą sprzyjające)",
    bypass_hint_open: "Bypass otwarty (aktywny)",
    filters: "Filtry", replace: "Wymień", ok: "OK",
    efficiency: "Sprawność", recovery: "Odzysk", cop: "COP",
    recovery_heat: "Odzysk ciepła", recovery_cool: "Odzysk chłodu", benefit: "Korzyść",
    intake: "CZERPNIA", extract: "WYWIEW", exhaust: "WYRZUTNIA", supply: "NAWIEW",
    warning: "Ostrzeżenie", error: "Błąd", schedule: "harmonogram", active: "aktywne", off: "Wyłączony", target: "cel",
    cfg_comfort: "komf", cfg_min: "min", cfg_wear: "zużycie",
    bpr_cold: "za zimno na zewnątrz", bpr_band: "temperatura w normie", bpr_nosupply: "nawiew zatrzymany",
    bpr_cold_short: "za zimno", bpr_band_short: "w normie", bpr_nosupply_short: "nawiew stop",
    schedule_title: "Harmonogram", now: "teraz",
  },
};

function pickLang(hass) {
  const l = (hass?.language || hass?.locale?.language || "en").toLowerCase();
  return l.startsWith("pl") ? "pl" : "en";
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Schedule times come straight from the "Harmonogram" sensor attributes.
// "HH:MM" -> minutes since midnight; null for anything unusable, so a partial
// or malformed attribute can never throw out of the render.
function minutesOfDay(value) {
  if (typeof value !== "string") return null;
  const [h, m] = value.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

// Cubic-bezier easing (CSS-style): control points P1(x1,y1) P2(x2,y2), with
// P0=(0,0) P3=(1,1). Returns f(x)∈[0,1] (Newton-solve x→t, then y). Used for the
// diagram flow-speed curve so it can be tuned with 4 numbers via `flow_curve`.
const cubicBezier = (x1, y1, x2, y2) => {
  const bx = (t) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const by = (t) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  return (x) => {
    let t = clamp(x, 0, 1);
    for (let i = 0; i < 14; i++) {
      const e = bx(t) - x; if (Math.abs(e) < 1e-4) break;
      const d = (bx(t + 1e-4) - bx(t - 1e-4)) / 2e-4; if (Math.abs(d) < 1e-9) break;
      t = clamp(t - e / d, 0, 1);
    }
    return by(t);
  };
};
const FLOW_SPEED_MIN = 0.1, FLOW_SPEED_MAX = 6;   // seconds per pulse at 100% / 0% work
const FLOW_CURVE_DEFAULT = [0.01, 0.8, 0.3, 0.85]; // ease-out: steep 0-10%, ~2.6s@10%, fast top

// Optimistic-state locking (Modbus writes + a refresh can take a few seconds).
const PENDING_TIMEOUT = 15000;
// Manual-intensity slider: coalesce dragging into a single write. The modbus
// request fires only after the user has been quiet this long (ms).
const SPEED_DEBOUNCE = 900;
const SCOPE_ALL = ["power", "season", "intensity", "modes", "bypass"];

class ThesslaGreenCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._e = {};
    this._speedTarget = null; // optimistic manual-intensity value while debouncing
    this._speedTimer = null;  // pending debounced write
  }

  // ---- Lovelace API --------------------------------------------------------
  setConfig(config) {
    if (!config) throw new Error("Missing configuration");
    this._config = {
      name: config.name,
      show_metrics: config.show_metrics !== false,
      show_diagram: config.show_diagram !== false,
      show_bypass: config.show_bypass !== false,
      show_schedule: config.show_schedule !== false,   // mini schedule chart (under Auto)
      show_calendar: config.show_calendar === true,     // weekly schedule calendar (opt-in)
      // Tunable flow-animation speed curve (cubic-bezier control points, CSS-style).
      flow_curve: Array.isArray(config.flow_curve) && config.flow_curve.length === 4
        && config.flow_curve.every((n) => typeof n === "number") ? config.flow_curve : FLOW_CURVE_DEFAULT,
      functions: Array.isArray(config.functions) ? config.functions : null,
      metrics: Array.isArray(config.metrics) ? config.metrics : null,
      accent: config.accent === "thessla" ? "thessla" : "theme",
      entities: { ...(config.entities || {}) },
    };
    this._speedEase = cubicBezier(...this._config.flow_curve);  // built once per config
    this._entities = null;
    this._resolvedViaRegistry = false;
    this._built = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 10;
  }

  static getStubConfig() {
    return { type: "custom:thessla-green-card" };
  }

  static getConfigElement() {
    return document.createElement("thessla-green-card-editor");
  }

  // ---- Helpers -------------------------------------------------------------
  _stateObj(id) {
    return id && this._hass ? this._hass.states[id] : undefined;
  }
  _state(id) {
    const s = this._stateObj(id);
    return s ? s.state : undefined;
  }
  _num(id) {
    const v = parseFloat(this._state(id));
    return Number.isFinite(v) ? v : null;
  }
  _attr(id, name) {
    const s = this._stateObj(id);
    return s && s.attributes ? s.attributes[name] : undefined;
  }
  _isOn(id) {
    return this._state(id) === "on";
  }
  _temp(id) {
    const v = this._num(id);
    return v === null ? "—" : `${v.toFixed(1)}°C`;
  }
  _flow(id) {
    const v = this._num(id);
    return v === null ? "" : `${Math.round(v)} m³/h`;
  }
  // Colour a benefit stat (thermal balance / benefit index) by the sensor's
  // `status` attribute and expose the human `status_opis` as a tooltip.
  // beneficial → accent, unfavourable → red, neutral/unknown → muted.
  _applyBenefit(statEl, valEl, id) {
    const status = this._attr(id, "status"); // korzystna | neutralna | niekorzystna
    if (statEl) {
      statEl.classList.toggle("good", status === "korzystna");
      statEl.classList.toggle("bad", status === "niekorzystna");
      statEl.classList.toggle("neutral", status === "neutralna");
    }
    if (valEl) valEl.title = this._attr(id, "status_opis") || "";
  }
  // Effective fan output % from the fork's dac sensors (avg of supply+extract).
  // null when the fork entities aren't present → callers fall back.
  _effPct() {
    // Prefer the true ventilation % (CF regs 272/273); fall back to the DAC
    // control-signal % (1280/1281), which runs higher than the actual airflow.
    const s = this._num(this._entities.eff_sup) ?? this._num(this._entities.fan_supply_pct);
    const e = this._num(this._entities.eff_ext) ?? this._num(this._entities.fan_extract_pct);
    if (s === null && e === null) return null;
    if (s !== null && e !== null) return Math.round((s + e) / 2);
    return Math.round(s ?? e);
  }
  // Per-fan animation % = average of (a) airflow % (flow ÷ nominal, else the true
  // % 272/273) and (b) fan drive % (DAC signal). Blending both means a fan maxed
  // out but only moving e.g. 550 m³/h still animates fast (not "slow").
  _fanAnimPct(flowRole, nomRole, effRole, driveRole) {
    // Airflow %: prefer the device's true % (272/273) — stable and matching the
    // on-diagram readout — over the instantaneous flow (256/257), which briefly
    // reads 0 during spin-up. Fall back to measured flow ÷ nominal.
    let flowP = this._num(this._entities[effRole]);
    if (flowP === null) {
      const f = this._num(this._entities[flowRole]), n = this._num(this._entities[nomRole]);
      if (f !== null && n) flowP = (f / n) * 100;
    }
    if (flowP !== null) flowP = clamp(flowP, 0, 100);
    // Fan drive % (DAC) so a maxed fan moving only modest air still animates fast.
    const dv = this._num(this._entities[driveRole]);
    const driveP = dv !== null ? clamp(dv, 0, 100) : null;
    if (flowP !== null && driveP !== null) return (flowP + driveP) / 2;
    return flowP != null ? flowP : driveP;
  }
  // Config summary shown under each mode tile (intensity %, + duration for timed
  // modes; the manual/temporary setpoints stay visible on any mode).
  _tileSub(kind, val, en) {
    const pct = (id) => { const v = this._num(id); return v === null ? null : `${Math.round(v)}%`; };
    const mins = (id) => { const v = this._num(id); return v === null ? null : `${Math.round(v)} min`; };
    if (kind === "mode" && val === "manual") return pct(en.speed) || "";
    if (kind === "mode" && val === "auto") return ""; // schedule-driven — no fixed setpoint
    if (kind === "temp") return pct(en.speed_temp) || "";
    if (kind === "special") {
      const fn = SPECIAL_FUNCTIONS.find((f) => f.option === val);
      if (!fn) return "";
      // Open-window stops the supply fan and has no set duration → always "0% · auto".
      if (fn.option === "Okna") return `0% · ${this._t("auto").toLowerCase()}`;
      let pctStr = null;
      if (fn.pct) {
        const p = this._num(en[fn.pct]);
        if (p !== null) pctStr = p <= (fn.max || 150) ? `${Math.round(p)}%` : null;
      }
      return [pctStr, fn.time && mins(en[fn.time])].filter(Boolean).join(" · ");
    }
    return "";
  }
  // Clip the solid filter copy from the top so its visible height = % of filter
  // life still left (100 − wear). Full when the wear sensor is absent.
  // Box spans y 59–81 (cy 70 ± 11).
  _setFilterWear(rect, wear) {
    if (!rect) return;
    const H = 22, B = 81;
    const avail = wear === null ? 100 : 100 - Math.max(0, Math.min(100, wear));
    const ah = (H * avail) / 100;
    rect.setAttribute("y", B - ah);
    rect.setAttribute("height", ah);
  }
  _t(key) {
    const lang = pickLang(this._hass);
    return (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
  }

  _call(domain, service, data) {
    if (this._hass) this._hass.callService(domain, service, data);
  }
  _toggleSwitch(id, on) {
    if (id) this._call("switch", on ? "turn_on" : "turn_off", { entity_id: id });
  }
  _selectOption(id, option) {
    if (id) this._call("select", "select_option", { entity_id: id, option });
  }
  _setNumber(id, value) {
    if (id) this._call("number", "set_value", { entity_id: id, value });
  }
  _moreInfo(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }
  // Registry device_id of the ThesslaGreen device (from any resolved entity).
  _deviceId() {
    const reg = this._hass && this._hass.entities;
    if (!reg) return null;
    const en = this._entities || {};
    for (const role of ["power", "speed", "temp_supply", "operation_mode", "special"]) {
      const id = en[role];
      if (id && reg[id] && reg[id].device_id) return reg[id].device_id;
    }
    const k = Object.keys(reg).find((x) => reg[x] && reg[x].platform === "thessla_green" && reg[x].device_id);
    return k ? reg[k].device_id : null;
  }
  // Navigate to the device page (all entities); fall back to power more-info.
  _openDevice() {
    const id = this._deviceId();
    if (!id) {
      this._moreInfo(this._entities && this._entities.power);
      return;
    }
    history.pushState(null, "", `/config/devices/device/${id}`);
    const ev = new Event("location-changed", { bubbles: true, composed: true });
    ev.detail = { replace: false };
    window.dispatchEvent(ev);
  }
  _icon(path, cls = "") {
    return `<svg class="ic ${cls}" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
  }

  // Current operating mode: 0=Auto, 1=Manual, 2=Temporary (null if unknown).
  _mode() {
    const state = this._state(this._entities.operation_mode);
    if (state === "Automatyczny") return 0;
    if (state === "Manualny") return 1;
    if (state === "Chwilowy") return 2;
    if (state == null || state === "unknown" || state === "unavailable") return null;
    const numeric = Number(state);
    return Number.isFinite(numeric) ? numeric : null;
  }
  // Active special function option (or null when none / "Brak trybu").
  _activeSpecial() {
    const s = this._state(this._entities.special);
    return s != null && s !== SPECIAL_NONE ? s : null;
  }
  // Raw specialMode register code (4224), exposed by the integration as an
  // attribute. Lets us distinguish schedule/sensor-triggered airing (3-6/8/9)
  // from a panel-selected function (7/2/10/11). null when unavailable.
  _specialCode() {
    const o = this._stateObj(this._entities.special);
    const c = o && o.attributes ? o.attributes.special_code : null;
    return c === null || c === undefined ? null : Number(c);
  }
  // Why is the bypass closed while its function is enabled? Returns only reasons
  // we can actually derive from live values against the documented logic (regs
  // 4321 min outdoor temp / 4322 free-heating TP< / 4323 free-cooling TP>).
  // Empty when we can't explain it — we show nothing rather than guess.
  _bypassReasons() {
    const en = this._entities;
    const t = (k) => this._t(k);
    const intake = this._num(en.temp_intake); // TZ1 — outdoor air drawn in
    const room = this._num(en.temp_extract);  // TP — extracted room air (proxy)
    const bmin = this._num(en.bypass_min);     // 4321 min outdoor temp
    const heat = this._num(en.bypass_heat);    // 4322 free-heating threshold (TP below → open)
    const cool = this._num(en.bypass_cool);    // 4323 free-cooling threshold (TP above → open)
    const sup = this._num(en.eff_sup);         // 272 true supply %; 0 = supply fan stopped
    const reasons = [];
    // Supply fan stopped (e.g. open-window) → nothing to bypass; it stays shut.
    // This overrides the temperature reasons, so list it first.
    if (sup === 0) {
      reasons.push({ key: "nosupply", label: t("bpr_nosupply"), short: t("bpr_nosupply_short") });
    }
    // Outdoor colder than the configured minimum → bypass held shut.
    if (intake !== null && bmin !== null && intake < bmin) {
      reasons.push({ key: "cold", label: t("bpr_cold"), short: t("bpr_cold_short"), detail: `${Math.round(intake)}° < ${Math.round(bmin)}°` });
    }
    // Room temp between the heating and cooling thresholds → no free-heat/cool demand.
    if (room !== null && heat !== null && cool !== null && room >= heat && room <= cool) {
      reasons.push({ key: "band", label: t("bpr_band"), short: t("bpr_band_short"), detail: `${Math.round(room)}°` });
    }
    return reasons;
  }

  // ---- Weekly Auto schedule (from the "Harmonogram" sensor attributes) -----
  _schedule() {
    const o = this._stateObj(this._entities.schedule);
    const a = o && o.attributes;
    return a && (a.summer || a.winter) ? a : null;
  }
  // The week for the active season — only when it is a full 7 days, so every
  // consumer below can index it by weekday without checking.
  _scheduleDays(sched) {
    const days = sched[sched.season] || sched.summer;
    return Array.isArray(days) && days.length === 7 ? days : null;
  }
  // HA locale preferences.
  _firstWeekday() { // 0=Mon .. 6=Sun (schedule order)
    const m = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
    const fw = this._hass && this._hass.locale && this._hass.locale.first_weekday;
    if (fw && m[fw] != null) return m[fw];
    try {
      const li = new Intl.Locale((this._hass && this._hass.locale && this._hass.locale.language) || "en");
      const wi = li.weekInfo || (li.getWeekInfo && li.getWeekInfo());
      if (wi && wi.firstDay) return (wi.firstDay - 1) % 7; // Intl 1=Mon..7=Sun
    } catch (e) { /* ignore */ }
    return 0;
  }
  _use12h() {
    const tf = this._hass && this._hass.locale && this._hass.locale.time_format;
    if (tf === "12") return true;
    if (tf === "24") return false;
    try { return !!new Intl.DateTimeFormat((this._hass.locale && this._hass.locale.language) || "en", { hour: "numeric" }).resolvedOptions().hour12; }
    catch (e) { return false; }
  }
  _fmtHour(h) {
    if (this._use12h()) { let x = h % 12; if (x === 0) x = 12; return `${x}${h < 12 ? "a" : "p"}`; }
    return String(h).padStart(2, "0");
  }
  _dayNames() { // localized short names, index 0=Mon
    const lang = (this._hass && this._hass.locale && this._hass.locale.language) || "en";
    const f = new Intl.DateTimeFormat(lang, { weekday: "short" });
    return [...Array(7)].map((_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 2024-01-01 = Monday
  }
  _weekOrder() { const fw = this._firstWeekday(); return [...Array(7)].map((_, i) => (fw + i) % 7); }

  _slotsSorted(day) {
    return ((day && day.slots) || [])
      .map((s) => ({ m: minutesOfDay(s && s.start), i: s && s.i }))
      .filter((s) => s.m !== null)
      .sort((a, b) => a.m - b.m);
  }
  // Base intensity active at Date d (falls back to the previous day's last slot).
  _baseAt(days, d) {
    const dow = (d.getDay() + 6) % 7;
    const mins = d.getHours() * 60 + d.getMinutes();
    let a = null;
    for (const s of this._slotsSorted(days[dow])) if (s.m <= mins) a = s;
    if (!a) { const p = this._slotsSorted(days[(dow + 6) % 7]); a = p[p.length - 1]; }
    return a ? a.i : null;
  }
  // Step segments of base intensity across [start,end] (ms).
  _baseSegments(days, start, end) {
    const bounds = [start, end];
    const day = new Date(start); day.setHours(0, 0, 0, 0);
    for (; +day <= end; day.setDate(day.getDate() + 1)) {
      const dow = (day.getDay() + 6) % 7;
      for (const s of this._slotsSorted(days[dow])) {
        const t = new Date(day); t.setMinutes(s.m);
        if (+t > start && +t < end) bounds.push(+t);
      }
    }
    const u = [...new Set(bounds)].sort((a, b) => a - b);
    const segs = [];
    for (let i = 0; i < u.length - 1; i++) segs.push({ t0: u[i], t1: u[i + 1], i: this._baseAt(days, new Date((u[i] + u[i + 1]) / 2)) });
    return segs.filter((s) => s.i != null);
  }
  // Effective intensity segments = base schedule with airing windows overriding
  // (airing shows up as a 100% peak in the line, not a separate bar).
  _effSegments(days, sched, start, end) {
    const base = this._baseSegments(days, start, end);
    const airs = this._airingWindows(days, sched, start, end);
    if (!airs.length) return base;
    const pts = new Set([start, end]);
    base.forEach((s) => { pts.add(s.t0); pts.add(s.t1); });
    airs.forEach((a) => { pts.add(Math.max(start, a.t0)); pts.add(Math.min(end, a.t1)); });
    const u = [...pts].filter((t) => t >= start && t <= end).sort((a, b) => a - b);
    const at = (t) => {
      for (const a of airs) if (t >= a.t0 && t < a.t1) return a.i;
      for (const s of base) if (t >= s.t0 && t < s.t1) return s.i;
      return null;
    };
    const segs = [];
    for (let i = 0; i < u.length - 1; i++) { const v = at((u[i] + u[i + 1]) / 2); if (v != null) segs.push({ t0: u[i], t1: u[i + 1], i: v }); }
    return segs;
  }
  _airingWindows(days, sched, start, end) {
    const dur = sched.airing_duration || 20, inten = sched.airing_intensity || 100, out = [];
    const day = new Date(start); day.setHours(0, 0, 0, 0);
    for (; +day <= end; day.setDate(day.getDate() + 1)) {
      const start = minutesOfDay((days[(day.getDay() + 6) % 7] || {}).airing);
      if (start === null) continue;
      const t0 = new Date(day); t0.setHours(0, start, 0, 0);
      const t1 = +t0 + dur * 60000;
      if (t1 > start && +t0 < end) out.push({ t0: +t0, t1, i: inten });
    }
    return out;
  }
  _dateForDayHour(di, h) {
    const now = new Date(), cur = (now.getDay() + 6) % 7, d = new Date(now);
    d.setDate(now.getDate() + (di - cur)); d.setHours(h, 30, 0, 0); return d;
  }
  // Sunrise/sunset hours-of-day (local, fractional) from the sun.sun entity — used
  // to shade night. null when unavailable.
  _sunTimes() {
    const s = this._hass && this._hass.states && this._hass.states["sun.sun"];
    if (!s || !s.attributes) return null;
    const hh = (iso) => { const d = new Date(iso); return isNaN(+d) ? null : d.getHours() + d.getMinutes() / 60; };
    const rise = hh(s.attributes.next_rising), set = hh(s.attributes.next_setting);
    return rise == null || set == null ? null : { rise, set };
  }
  // Intensity (base, or airing if a window covers t) at timestamp t — for the tooltip.
  _miniValueAt(t) {
    const sched = this._schedule(); if (!sched) return null;
    const days = sched[sched.season] || sched.summer;
    const day = days[(new Date(t).getDay() + 6) % 7] || {};
    const airing = minutesOfDay(day.airing);
    if (airing !== null) {
      const a0 = new Date(t); a0.setHours(0, airing, 0, 0);
      if (t >= +a0 && t < +a0 + (sched.airing_duration || 20) * 60000)
        return { i: sched.airing_intensity || 100, air: true };
    }
    return { i: this._baseAt(days, new Date(t)), air: false };
  }

  // Mini chart: base intensity over now-12h .. now+24h — filled area + step line,
  // night shading, airing spikes (accent), date at midnight, "now" marker.
  _renderScheduleMini() {
    const sched = this._schedule(); if (!sched) return "";
    const days = this._scheduleDays(sched); if (!days) return "";
    const now = new Date(), start = +now - 12 * 3600e3, end = +now + 24 * 3600e3, span = end - start;
    const segs = this._effSegments(days, sched, start, end); if (!segs.length) return null;
    this._miniWin = { start, end };
    // Plot fills a slider-like box (the box rounds/clips + supplies the background);
    // the day/hour labels + "now" dot sit in a separate axis row below the box.
    // 100% sits at the very top so an airing spike reaches the box edge.
    const W = 360, PH = 24, yTop = 1, yBot = PH;
    const xt = (t) => ((t - start) / span) * W;
    const yv = (v) => yBot - (clamp(v, 0, 100) / 100) * (yBot - yTop);
    // Night: one continuous band per night (merged across midnight) = complement of
    // the day intervals; the edges that hit the window boundary are pushed off-canvas
    // (blur hidden by the box) so ONLY real sunrise/sunset feather.
    const sun = this._sunTimes();
    let night = "";
    if (sun) {
      const dayIvs = [];
      const d0 = new Date(start); d0.setHours(0, 0, 0, 0);
      for (; +d0 <= end + 24 * 3600e3; d0.setDate(d0.getDate() + 1)) dayIvs.push([+d0 + sun.rise * 3600e3, +d0 + sun.set * 3600e3]);
      const nights = []; let cur = -Infinity;
      for (const [ds, de] of dayIvs) { nights.push([cur, ds]); cur = de; }
      nights.push([cur, Infinity]);
      for (const [ns, ne] of nights) {
        if (ne <= start || ns >= end) continue;
        const xA = ns <= start ? -20 : xt(ns);
        const xB = ne >= end ? W + 20 : xt(ne);
        night += `<rect class="sch-night" x="${xA.toFixed(1)}" y="0" width="${(xB - xA).toFixed(1)}" height="${PH}"/>`;
      }
    }
    let line = "";
    segs.forEach((s, i) => { const y = yv(s.i).toFixed(1); line += `${i ? "L" : "M"}${xt(s.t0).toFixed(1)},${y}L${xt(s.t1).toFixed(1)},${y}`; });
    const area = `M${xt(segs[0].t0).toFixed(1)},${PH}` +
      segs.map((s) => { const y = yv(s.i).toFixed(1); return `L${xt(s.t0).toFixed(1)},${y}L${xt(s.t1).toFixed(1)},${y}`; }).join("") +
      `L${xt(segs[segs.length - 1].t1).toFixed(1)},${PH}Z`;
    let grid = "", labels = "";
    const dfmt = new Intl.DateTimeFormat((this._hass.locale && this._hass.locale.language) || "en", { day: "2-digit", month: "2-digit" });
    const th = new Date(start); th.setMinutes(0, 0, 0);
    for (; +th <= end; th.setHours(th.getHours() + 1)) {
      const h = th.getHours(); if (+th < start) continue;
      const x = xt(+th).toFixed(1);
      if (h === 0) { grid += `<line class="sch-mid" x1="${x}" y1="0" x2="${x}" y2="${PH}"/>`; labels += `<text class="sch-tick sch-date" x="${x}" y="9" text-anchor="middle">${dfmt.format(th)}</text>`; }
      else if (h % 6 === 0) { grid += `<line class="sch-grid" x1="${x}" y1="0" x2="${x}" y2="${PH}"/>`; labels += `<text class="sch-tick" x="${x}" y="9" text-anchor="middle">${this._fmtHour(h)}</text>`; }
    }
    const xn = xt(+now).toFixed(1);
    const plot = `<svg viewBox="0 0 ${W} ${PH}" class="sch-svg" preserveAspectRatio="none" role="img" aria-label="${this._t("schedule_title")}">
        <defs><filter id="schnight" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="3 0"/></filter></defs>
        <g filter="url(#schnight)">${night}</g>${grid}
        <path class="sch-area" d="${area}"/><path class="sch-line" d="${line}"/>
        <line class="sch-now" x1="${xn}" y1="0" x2="${xn}" y2="${PH}"/>
      </svg>`;
    const axis = `<svg viewBox="0 0 ${W} 12" class="sch-axis-svg">
        <circle class="sch-now-d" cx="${xn}" cy="2.5" r="2"/>${labels}
      </svg>`;
    return { plot, axis };
  }

  // Weekly calendar: rows = days (locale first-weekday order), cols = 00–24h.
  // Intensity as bar HEIGHT; night shaded; airing marked in the accent colour.
  _renderCalendar() {
    const sched = this._schedule(); if (!sched) return "";
    const days = this._scheduleDays(sched); if (!days) return "";
    const names = this._dayNames(), order = this._weekOrder(), sun = this._sunTimes();
    const W = 360, labelW = 30, top = 12, rowH = 16, H = top + 7 * rowH + 2;
    const gx = labelW, gw = W - labelW - 4, cw = gw / 24;
    const xcol = (h) => gx + h * cw;
    let xl = "", yl = "", night = "", bars = "", air = "";
    for (let h = 0; h <= 24; h += 6) xl += `<text class="cal-h" x="${xcol(h).toFixed(1)}" y="8" text-anchor="middle">${this._fmtHour(h % 24)}</text>`;
    order.forEach((di, row) => {
      const y = top + row * rowH, iTop = y + 1, iBot = y + rowH - 1, ih = iBot - iTop;
      yl += `<text class="cal-d" x="2" y="${(y + rowH / 2 + 3).toFixed(1)}">${names[di]}</text>`;
      // Night: early-morning [0,sunrise] and evening [sunset,24]. Push the edge at
      // the grid boundary (0 / 24) off the grid so only sunrise/sunset feather
      // (the calclip clips the pushed edges).
      if (sun) {
        if (sun.rise > 0) night += `<rect class="cal-night" x="${(gx - 12).toFixed(1)}" y="${iTop}" width="${(xcol(sun.rise) - (gx - 12)).toFixed(1)}" height="${ih}"/>`;
        if (sun.set < 24) night += `<rect class="cal-night" x="${xcol(sun.set).toFixed(1)}" y="${iTop}" width="${(xcol(24) + 12 - xcol(sun.set)).toFixed(1)}" height="${ih}"/>`;
      }
      for (let h = 0; h < 24; h++) {
        const iv = this._baseAt(days, this._dateForDayHour(di, h)); if (iv == null) continue;
        const bh = (clamp(iv, 0, 100) / 100) * ih;
        bars += `<rect class="cal-bar" x="${(xcol(h) + 0.3).toFixed(1)}" y="${(iBot - bh).toFixed(1)}" width="${(cw - 0.6).toFixed(2)}" height="${bh.toFixed(1)}"><title>${names[di]} ${this._fmtHour(h)} · ${iv}%</title></rect>`;
      }
      const a = (days[di] || {}).airing;
      const aMin = minutesOfDay(a);
      if (aMin !== null) { const x = xcol(aMin / 60); const w = Math.max(1.5, ((sched.airing_duration || 20) / 60) * cw); air += `<rect class="cal-air" x="${x.toFixed(1)}" y="${iTop}" width="${w.toFixed(1)}" height="${ih}"><title>${this._t("fn_airing")} ${a}</title></rect>`; }
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="cal-svg" role="img" aria-label="${this._t("schedule_title")}">
      <defs>
        <filter id="calnight" x="-10%" y="-5%" width="120%" height="110%"><feGaussianBlur stdDeviation="2 0"/></filter>
        <clipPath id="calclip"><rect x="${gx}" y="${top}" width="${(xcol(24) - gx).toFixed(1)}" height="${7 * rowH}"/></clipPath>
      </defs>
      <g clip-path="url(#calclip)"><g filter="url(#calnight)">${night}</g></g>${xl}${yl}${bars}${air}</svg>`;
  }

  // ---- Render --------------------------------------------------------------
  _render() {
    if (!this._hass) return;
    if (!this._entities || !this._resolvedViaRegistry) {
      const r = resolveEntities(this._hass, this._config.entities);
      this._entities = r.map;
      this._resolvedViaRegistry = r.viaRegistry;
    }
    if (!this._built) this._build();
    this._update();
  }

  _build() {
    const c = this._config;
    const t = (k) => this._t(k);
    const fns = SPECIAL_FUNCTIONS.filter((f) => !c.functions || c.functions.includes(f.option));

    // Unified mode tiles: Auto, Manual, visible specials, and (read-only) Temporary.
    const tile = (kind, val, icon, label, extra = "") =>
      `<button class="mtile ${extra}" data-kind="${kind}" data-val="${val}" title="${label}">
         ${this._icon(icon)}<span>${label}</span><small class="msub" data-el="msub"></small></button>`;
    const modeTiles =
      tile("mode", "auto", MODE_ICONS.auto, t("auto")) +
      tile("mode", "manual", MODE_ICONS.manual, t("manual")) +
      fns.map((f) => tile("special", f.option, f.icon, t(f.key))).join("") +
      tile("temp", "temporary", MODE_ICONS.temporary, t("temporary"), "ro");

    // Stats section (borderless, configurable). `filters` gets an extra sub-line.
    const statKeys = c.metrics || STATS.map((s) => s.key);
    const stats = STATS.filter((s) => statKeys.includes(s.key));
    const statIds = { efficiency: "st-eff", recovery: "st-pow", cop: "st-cop" };
    // Label on top, value(s) below. Only the value(s) are clickable — not the box.
    // Filters carries three: days-to-change + supply/exhaust wear, each its own link.
    const statCell = (s) =>
      s.key === "filters"
        ? `<div class="stat stat-filters" data-el="stat-filters">
             <span class="sl">${t(s.label)}</span>
             <span class="svrow">
               <button class="fv" data-el="st-filter" data-mref="filter_date_sup">—</button>
               <span class="ss-sep">·</span>
               <button class="fv" data-el="st-wear-sup" data-mref="filter_wear_sup">—</button>
               <span class="ss-sep">/</span>
               <button class="fv" data-el="st-wear-ext" data-mref="filter_wear_ext">—</button>
             </span>
           </div>`
        : `<div class="stat" data-el="stat-${s.key}">
             <span class="sl" data-el="sl-${s.key}">${t(s.label)}</span>
             <button class="sv" data-el="${statIds[s.key]}" data-mref="${s.mref}">—</button>
           </div>`;
    const statsHtml =
      c.show_metrics && stats.length
        ? `<div class="stats" data-el="stats">${stats.map(statCell).join("")}</div>`
        : "";

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap" data-off="false" data-accent="${c.accent}">
          <header>
            <button class="dev" data-el="power" title="${t("power")}">${this._icon(ICONS.power)}</button>
            <span class="title" data-el="title" title="${t("device")}">${c.name || t("name")}</span>
            <div class="head-right">
              <button class="warn" data-el="warn" hidden>${this._icon(ICONS.alert)}</button>
              <button class="season-pill" data-el="season" title="${t("season")}">
                <span data-el="season-ic"></span><span data-el="season-txt">—</span>
              </button>
            </div>
          </header>

          ${c.show_diagram ? this._diagram() : ""}

          <div class="status" data-el="status"></div>

          <div class="modes" data-el="modes">${modeTiles}</div>

          <!-- Intensity: only shown/editable in Manual mode. Native range input
               (drag-friendly); gradient fill via --pct, caption overlaid. -->
          <div class="speed-row" data-el="speed-row">
            <div class="speed-track" data-el="speed-track">
              <input class="speed-input" data-el="speed-input" type="range" min="10" max="100" step="1" value="10"
                     aria-label="${t("intensity")}" />
              <span class="speed-cap" data-el="speed-cap">${t("intensity")}</span>
            </div>
          </div>

          <!-- Mini schedule chart: shown under the tiles when Auto is active -->
          <div class="sched-mini" data-el="sched-mini" hidden>
            <div class="sch-box"><div class="sch-plot" data-el="sched-plot"></div></div>
            <div class="sch-axis" data-el="sched-axis"></div>
            <div class="sch-tip" data-el="sched-tip"></div>
          </div>

          <!-- Bypass: its own section — toggle (enable/disable the function) plus
               readable state (open / closed / disabled) and its config. -->
          <button class="bypass" data-el="bypass"${c.show_bypass ? "" : " hidden"}>
            <span class="bypass-ic">${this._icon(ICONS.bypass)}</span>
            <span class="bypass-info">
              <span class="bypass-row">
                <span class="bypass-title">${t("bypass")}</span>
                <span class="bypass-cfg" data-el="bypass-cfg"></span>
              </span>
              <span class="bypass-row">
                <span class="bypass-state" data-el="bypass-txt">—</span>
                <span class="bypass-reason" data-el="bypass-reason"></span>
              </span>
            </span>
            <span class="bypass-sw" aria-hidden="true"><i></i></span>
          </button>

          ${statsHtml}

          <!-- Weekly schedule calendar (optional section) -->
          <div class="sched-cal" data-el="sched-cal" hidden></div>
        </div>
      </ha-card>
    `;

    const q = (name) => this.shadowRoot.querySelector(`[data-el="${name}"]`);
    this._e = {
      wrap: this.shadowRoot.querySelector(".wrap"),
      power: q("power"),
      title: q("title"),
      warn: q("warn"),
      season: q("season"),
      seasonIc: q("season-ic"),
      seasonTxt: q("season-txt"),
      status: q("status"),
      speedRow: q("speed-row"),
      speedTrack: q("speed-track"),
      speedInput: q("speed-input"),
      speedCap: q("speed-cap"),
      schedMini: q("sched-mini"),
      schedPlot: q("sched-plot"),
      schedAxis: q("sched-axis"),
      schedTip: q("sched-tip"),
      schedCal: q("sched-cal"),
      modes: q("modes"),
      stEff: q("st-eff"),
      stPow: q("st-pow"),
      stCop: q("st-cop"),
      slPow: q("sl-recovery"),
      slCop: q("sl-cop"),
      statPow: q("stat-recovery"),
      statCop: q("stat-cop"),
      stFilter: q("st-filter"),
      stWearSup: q("st-wear-sup"),
      stWearExt: q("st-wear-ext"),
      statFilters: q("stat-filters"),
      bypass: q("bypass"),
      bypassTxt: q("bypass-txt"),
      bypassReason: q("bypass-reason"),
      bypassCfg: q("bypass-cfg"),
      dIntake: q("d-intake"),
      dExtract: q("d-extract"),
      dSupply: q("d-supply"),
      dTarget: q("d-target"),
      dFpx: q("d-fpx"),
      dFlowSup: q("d-flow-sup"),
      dFlowExt: q("d-flow-ext"),
      dPctSup: q("d-pct-sup"),
      dPctExt: q("d-pct-ext"),
      cond: q("cond"),
      condCoil: q("cond-coil"),
      dCond: q("d-cond"),
      filtFillSup: q("fmask-sup"),
      filtFillExt: q("fmask-ext"),
      dAmbient: q("d-ambient"),
      probe: q("probe"),
      bp: q("bp"),
      bpThr: q("bp-thr"),
      bpThrT: q("bp-thr-t"),
      hx: q("hx"),
      hex: this.shadowRoot.querySelector(".hex"),
      flows: this.shadowRoot.querySelectorAll(".flow"),
    };
    this._e.modeTiles = Array.from(this._e.modes.querySelectorAll(".mtile"));

    this._wire();
    this._built = true;
  }

  // Minimalist ThesslaGreen-style airflow schematic (viewBox 0 0 480 200).
  //  left = outdoor side, right = house side. Ducts run edge-to-edge (no inner
  //  padding). Values carry data-mref → tap opens more-info (with history).
  _diagram() {
    const bg = "var(--tg-card-bg)";
    // Fan icon only (no background mask, no group — the caller wraps it with its
    // readouts in one interactive group, and the duct mask is a separate layer).
    const fanIcon = (cx, cy, color, dir) => {
      const tri =
        dir === "r"
          ? `${cx - 5},${cy - 7} ${cx + 7},${cy} ${cx - 5},${cy + 7}`
          : `${cx + 5},${cy - 7} ${cx - 7},${cy} ${cx + 5},${cy + 7}`;
      return `<circle class="fan-c" cx="${cx}" cy="${cy}" r="14" style="stroke:${color}"/>`
           + `<polygon class="fan-t" points="${tri}" style="fill:${color}"/>`;
    };
    // Air filter: a hatched box straddling the duct (before the fan). Drawn twice —
    // a faint "ghost" (whole filter) and a solid copy clipped from the top in
    // _update so its visible height = % of filter life STILL left. Clickable.
    const fbox = (L, cx, R, T, cy, B) =>
      `<rect class="filt-b" x="${L}" y="${T}" width="${R - L}" height="${B - T}"/>`
      + `<line class="filt-b" x1="${L}" y1="${cy}" x2="${cx}" y2="${T}"/>`
      + `<line class="filt-b" x1="${L}" y1="${B}" x2="${R}" y2="${T}"/>`
      + `<line class="filt-b" x1="${cx}" y1="${B}" x2="${R}" y2="${cy}"/>`;
    // Filter layers only (no background mask, no group). Caller wraps in an
    // interactive .filt-grp; the duct mask is a separate always-opaque layer.
    const filterLayers = (cx, cy, clipId, clipEl) => {
      const w = 5, h = 11, L = cx - w, R = cx + w, T = cy - h, B = cy + h;
      const box = fbox(L, cx, R, T, cy, B);
      return `<clipPath id="${clipId}"><rect data-el="${clipEl}" x="${L - 1}" y="${T}" width="${2 * w + 2}" height="${2 * h}"/></clipPath>`
        + `<g class="filt-ghost">${box}</g>`
        + `<g class="filt-live" clip-path="url(#${clipId})">${box}</g>`;
    };
    // Arrow centered on (x,y): a short shaft + chevron head (like "→"), always
    // solid so the duct shows a line through the arrow even between flow dashes.
    // Rotated `a`° to follow the flow (SVG rotate is clockwise; y-axis points down).
    const arrow = (x, y, a, color) =>
      `<path class="ah" d="M${x - 6},${y}L${x + 2},${y}M${x - 2},${y - 5}L${x + 6},${y}L${x - 2},${y + 5}" transform="rotate(${a} ${x} ${y})" style="stroke:${color}"/>`;
    const F = FLOW;
    // Rounded-corner path from a point list. Closed → every corner rounded;
    // open → the two endpoints stay sharp, inner corners rounded (radius r).
    const roundPath = (pts, r, close) => {
      const n = pts.length, seg = [];
      const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const unit = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y, L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
      for (let i = 0; i < n; i++) {
        const c = pts[i];
        if (!close && (i === 0 || i === n - 1)) {
          seg.push(`${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`);
          continue;
        }
        const p = pts[(i - 1 + n) % n], q = pts[(i + 1) % n];
        const rr = Math.min(r, D(p, c) / 2, D(q, c) / 2); // clamp so short edges don't overlap
        const [ax, ay] = unit(p, c), [bx, by] = unit(q, c);
        seg.push(`${i === 0 ? "M" : "L"}${(c.x + ax * rr).toFixed(1)},${(c.y + ay * rr).toFixed(1)}`);
        seg.push(`Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${(c.x + bx * rr).toFixed(1)},${(c.y + by * rr).toFixed(1)}`);
      }
      return seg.join(" ") + (close ? " Z" : "");
    };
    // Flat-top hexagon, lightly rounded.
    const hexPath = roundPath(
      [{x:216,y:70},{x:264,y:70},{x:288,y:112},{x:264,y:154},{x:216,y:154},{x:192,y:112}], 5, true);
    // Counter-flow core: 7 horizontal lines (top/bottom-edge width) whose left ends
    // run parallel to the upper-left edge down to the lower-left edge, and right
    // ends parallel to the lower-right edge up to the upper-right edge.
    let corePath = "";
    // Ys chosen so the VISIBLE gaps are equal: top border inner edge (70 + 3/2) →
    // 7 lines (stroke 1) → bottom inner edge (154 − 3/2), split into 8 equal gaps.
    // gap = ((152.5 − 71.5) − 7·1) / 8 = 9.25 → first line 81.25, step 10.25.
    for (let k = 1; k <= 7; k++) {
      const Y = 81.25 + (k - 1) * 10.25;
      const sx = 216 - (2 / 7) * (154 - Y), sy = (Y + 154) / 2;
      const ex = 264 + (2 / 7) * (Y - 70), ey = (Y + 70) / 2;
      corePath += roundPath([{x:sx,y:sy},{x:216,y:Y},{x:264,y:Y},{x:ex,y:ey}], 3, false) + " ";
    }
    corePath = corePath.trim();
    // Bypass ribbon: intake→supply, thin at the ends (diagonals at 60°, parallel
    // to the hexagon's side edges), swelling into a labelled bar across the middle.
    const RIBBON = roundPath([
      { x: 205.3, y: 90.3 }, { x: 216, y: 104 }, { x: 264, y: 104 }, { x: 277.3, y: 132.3 },
      { x: 274.7, y: 133.7 }, { x: 264, y: 120 }, { x: 216, y: 120 }, { x: 202.7, y: 91.7 },
    ], 3, true);
    // Ducts: horizontal run + a rounded kink into the exchanger's slanted face.
    const DUCTS = [
      [F.intake, [[6, 70], [192, 70], [204, 91]], "intake"],
      [F.extract, [[474, 70], [288, 70], [276, 91]], "extract"],
      [F.exhaust, [[204, 133], [192, 154], [6, 154]], "exhaust"],
      [F.supply, [[276, 133], [288, 154], [474, 154]], "supply"],
    ];
    const ductD = (p) => roundPath(p.map(([x, y]) => ({ x, y })), 5, false);
    // Flat spiral ("ślimak") heating-coil icon, like the product's element.
    const spiral = (cx, cy, rMax, turns) => {
      const steps = Math.ceil(turns * 22);
      let d = "";
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, a = t * turns * 2 * Math.PI, r = rMax * t;
        d += (i === 0 ? "M" : "L") + `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      }
      return d;
    };
    const condSpiral = spiral(362, 154, 7.5, 2.5); // on the supply duct, aligned with the extract filter
    return `
      <div class="diagram">
        <svg viewBox="0 44 480 147" class="diag" role="img" aria-label="Airflow diagram">
          <defs>
            <linearGradient id="bpgrad" gradientUnits="userSpaceOnUse" x1="210" y1="112" x2="270" y2="112">
              <stop offset="0" stop-color="${F.intake}"/><stop offset="1" stop-color="${F.supply}"/>
            </linearGradient>
            <mask id="bpk" maskUnits="userSpaceOnUse" x="198" y="84" width="86" height="56">
              <rect x="198" y="84" width="86" height="56" fill="#fff"/>
              <text class="bp-cut" x="240" y="115" text-anchor="middle" fill="#000">BYPASS</text>
            </mask>
          </defs>
          <!-- Duct base tracks: horizontal run level with the exchanger's flat
               top/bottom, then a rounded 60° kink along its slanted face into it -->
          ${DUCTS.map((d) => `<path class="track" d="${ductD(d[1])}" style="stroke:${d[0]}"/>`).join("\n          ")}

          <!-- Animated flow pulses (point order = airflow direction) -->
          ${DUCTS.map((d) => `<path class="flow" data-flow="${d[2]}" d="${ductD(d[1])}" style="stroke:${d[0]}"/>`).join("\n          ")}

          <!-- Two arrows per duct: one mid-slant by the exchanger, one at the duct end -->
          ${arrow(198, 80.5, 60, F.intake)}   ${arrow(12, 70, 0, F.intake)}
          ${arrow(282, 80.5, 120, F.extract)} ${arrow(468, 70, 180, F.extract)}
          ${arrow(198, 143.5, 120, F.exhaust)} ${arrow(12, 154, 180, F.exhaust)}
          ${arrow(282, 143.5, 60, F.supply)}  ${arrow(468, 154, 0, F.supply)}

          <!-- Counter-flow core pattern (heat-exchanger symbol), drawn UNDER the
               outline; fades out when the bypass is actually open — set in _update -->
          <path class="hx-core" data-el="hx" d="${corePath}"/>
          <!-- Bypass route (intake → supply, skipping the core): drawn under the
               outline but over the pattern; grey when closed, gradient when open -->
          <g class="bp" data-el="bp">
            <path class="bp-mask" d="${RIBBON}"/>
            <path class="bp-band" d="${RIBBON}" mask="url(#bpk)"/>
            <g class="bp-thr" data-el="bp-thr">
              <rect class="bp-thr-bg" x="204" y="124.5" width="72" height="13" rx="3"/>
              <text class="bp-thr-t" data-el="bp-thr-t" x="240" y="134" text-anchor="middle"></text>
            </g>
          </g>
          <!-- Heat exchanger: flat-top hexagon (near-regular, lightly rounded) -->
          <path class="hex" d="${hexPath}"/>

          <!-- Ambient (TO) sensor: a probe hanging under the exchanger -->
          <g data-el="probe">
            <path class="probe" d="M220,154 V170 q0,5 4,5 q4,0 4,-5 q0,-3 3,-3 H262"/>
            <text class="temp" data-el="d-ambient" data-mref="temp_ambient" x="258" y="184" text-anchor="middle">—</text>
          </g>

          <!-- Line masks: keep the duct + its animation from showing under the
               icons. Always opaque, non-interactive (never dimmed on hover). -->
          <circle cx="160" cy="70" r="14" fill="${bg}"/>
          <circle cx="320" cy="70" r="14" fill="${bg}"/>
          <rect x="92" y="58" width="31" height="24" fill="${bg}"/>
          <rect x="356" y="58" width="12" height="24" fill="${bg}"/>

          <!-- Intake duct (czerpnia): filter + FPX pre-heater grouped, then supply fan -->
          <g data-mref="filter_wear_sup" class="filt-grp">${filterLayers(98, 70, "fclip-sup", "fmask-sup")}<rect class="hitbox" x="92" y="57" width="12" height="26"/></g>
          <g data-mref="temp_fpx" class="grp">
            <polyline class="coil" points="116,59 122,64 110,70 122,76 116,81"/>
            <text class="tag" x="107" y="53" text-anchor="middle">FPX</text>
            <text class="sub" data-el="d-fpx" x="107" y="97" text-anchor="middle"></text>
            <rect class="hitbox" x="104" y="46" width="24" height="54"/>
          </g>
          <g data-mref="flow_supply" class="grp">
            ${fanIcon(160, 70, F.intake, "r")}
            <text class="sub" data-el="d-pct-sup"  x="160" y="97"  text-anchor="middle"></text>
            <text class="sub" data-el="d-flow-sup" x="160" y="108" text-anchor="middle"></text>
            <rect class="hitbox" x="142" y="54" width="36" height="62"/>
          </g>

          <!-- Extract duct (wywiew): filter, then extract fan -->
          <g data-mref="filter_wear_ext" class="filt-grp">${filterLayers(362, 70, "fclip-ext", "fmask-ext")}<rect class="hitbox" x="356" y="57" width="12" height="26"/></g>
          <g data-mref="flow_extract" class="grp">
            ${fanIcon(320, 70, F.extract, "l")}
            <text class="sub" data-el="d-pct-ext"  x="320" y="97"  text-anchor="middle"></text>
            <text class="sub" data-el="d-flow-ext" x="320" y="108" text-anchor="middle"></text>
            <rect class="hitbox" x="302" y="54" width="36" height="62"/>
          </g>

          <!-- Secondary heater / cooler on the supply (nawiew) duct, after the
               exchanger. Lights warm when heating, cool when cooling, dim when idle.
               Hidden entirely when the unit has neither. -->
          <g data-mref="heater_pct" class="grp" data-el="cond">
            <rect x="352" y="143" width="20" height="22" fill="${bg}"/>
            <path class="cond-coil" data-el="cond-coil" d="${condSpiral}"/>
            <text class="sub" data-el="d-cond" x="362" y="172" text-anchor="middle"></text>
            <rect class="hitbox" x="352" y="142" width="20" height="32"/>
          </g>

          <!-- Stream names -->
          <text class="fname" x="5"   y="58"  style="fill:${F.intake}"  text-anchor="start">${this._t("intake")}</text>
          <text class="fname" x="475" y="58"  style="fill:${F.extract}" text-anchor="end">${this._t("extract")}</text>
          <text class="fname" x="5"   y="176" style="fill:${F.exhaust}" text-anchor="start">${this._t("exhaust")}</text>
          <text class="fname" x="475" y="176" style="fill:${F.supply}"  text-anchor="end">${this._t("supply")}</text>

          <!-- Temperatures: intake/extract below the top ducts, supply above the
               bottom-right duct (clickable → history) -->
          <text class="temp" data-el="d-intake"  data-mref="temp_intake"  x="45"  y="89"  text-anchor="middle">—</text>
          <text class="temp" data-el="d-extract" data-mref="temp_extract" x="435" y="89"  text-anchor="middle">—</text>
          <text class="temp" data-el="d-supply"  data-mref="temp_supply"  x="435" y="146" text-anchor="middle">—</text>
          <text class="sub"  data-el="d-target"  data-mref="target_temp"  x="435" y="134" text-anchor="middle"></text>
        </svg>
      </div>`;
  }

  _lock(scopes, spinEl, check) {
    if (check()) return;
    this._pending = { scopes: new Set(scopes), spin: spinEl, check, until: Date.now() + PENDING_TIMEOUT };
    clearTimeout(this._pendTimer);
    this._pendTimer = setTimeout(() => {
      this._pending = null;
      this._update();
    }, PENDING_TIMEOUT + 250);
    this._update();
  }

  _wire() {
    const en = () => this._entities;

    this._e.power.onclick = () => {
      const want = !this._isOn(en().power);
      this._toggleSwitch(en().power, want);
      this._lock(SCOPE_ALL, this._e.power, () => this._isOn(en().power) === want);
    };

    this._e.warn.onclick = () => this._moreInfo(this._warnTarget);
    this._e.title.onclick = () => this._openDevice();

    this._e.season.onclick = () => {
      const next = this._state(en().season) === "Zima" ? "Lato" : "Zima";
      this._selectOption(en().season, next);
      this._lock(["season"], this._e.season, () => this._state(en().season) === next);
    };

    // Base the next step on the pending (optimistic) value while debouncing, so
    // Native range slider. Dragging fires `input` continuously → we paint the
    // fill optimistically and (re)arm a debounce; the modbus write goes out only
    // after SPEED_DEBOUNCE ms of no further movement, so one drag = one request.
    const input = this._e.speedInput;
    const paint = (v) => {
      input.style.setProperty("--pct", v);
      this._e.speedCap.textContent = `${this._t("intensity")} · ${v}%`;
    };
    input.oninput = () => {
      const v = clamp(Math.round(Number(input.value)), 10, 100);
      this._speedTarget = v;
      paint(v);
      clearTimeout(this._speedTimer);
      this._speedTimer = setTimeout(() => {
        this._speedTimer = null;
        const target = this._speedTarget;
        this._setNumber(en().speed, target);
        // Spinner on the track while the write is confirmed by the device.
        this._lock(["intensity"], this._e.speedTrack, () => {
          const n = this._num(en().speed);
          return n !== null && Math.round(n) === target;
        });
      }, SPEED_DEBOUNCE);
    };

    this._e.modeTiles.forEach((tl) => {
      if (tl.dataset.kind === "temp") return; // read-only indicator
      tl.onclick = () => {
        const kind = tl.dataset.kind;
        const val = tl.dataset.val;
        if (kind === "mode") {
          const wantMode = val === "auto" ? 0 : 1;
          const wantOption = wantMode === 0 ? "Automatyczny" : "Manualny";
          this._selectOption(en().operation_mode, wantOption);
          const hadSpecial = this._activeSpecial() !== null;
          if (hadSpecial) this._selectOption(en().special, SPECIAL_NONE); // base mode cancels specials
          this._lock(
            ["modes", "intensity"],
            tl,
            () => this._mode() === wantMode && this._activeSpecial() === null
          );
        } else {
          const want = this._state(en().special) === val ? SPECIAL_NONE : val;
          this._selectOption(en().special, want);
          this._lock(["modes", "intensity"], tl, () => (this._state(en().special) ?? SPECIAL_NONE) === want);
        }
      };
    });

    this._e.bypass.onclick = () => {
      const want = !this._isOn(en().bypass);
      this._toggleSwitch(en().bypass, want);
      this._lock(["bypass"], this._e.bypass, () => this._isOn(en().bypass) === want);
    };

    this.shadowRoot.querySelectorAll("[data-mref]").forEach((el) => {
      el.onclick = () => this._moreInfo(en()[el.dataset.mref]);
    });

    // Mini-schedule hover tooltip (time · intensity at the cursor).
    if (this._e.schedMini && this._e.schedTip) {
      const mini = this._e.schedMini, tip = this._e.schedTip;
      mini.onpointermove = (ev) => {
        const win = this._miniWin; if (!win) { tip.style.display = "none"; return; }
        const r = mini.getBoundingClientRect();
        const frac = clamp((ev.clientX - r.left) / r.width, 0, 1);
        const t = win.start + frac * (win.end - win.start);
        const v = this._miniValueAt(t);
        if (!v || v.i == null) { tip.style.display = "none"; return; }
        const tf = new Intl.DateTimeFormat((this._hass.locale && this._hass.locale.language) || "en",
          { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: this._use12h() });
        tip.textContent = `${tf.format(new Date(t))} · ${v.i}%${v.air ? " · " + this._t("fn_airing") : ""}`;
        tip.style.left = `${(ev.clientX - r.left).toFixed(0)}px`;
        tip.style.display = "block";
      };
      mini.onpointerleave = () => { tip.style.display = "none"; };
    }
  }

  _applyPending() {
    const p = this._pending;
    const groups = p ? p.scopes : null;
    const apply = (el, group) => {
      if (!el) return;
      const blocked = !!groups && groups.has(group);
      const isSpin = blocked && p && el === p.spin;
      el.classList.toggle("pending", isSpin);
      el.classList.toggle("blocked", blocked && !isSpin);
      if ("disabled" in el) el.disabled = blocked;
      else el.style.pointerEvents = blocked ? "none" : "";
    };
    apply(this._e.power, "power");
    apply(this._e.season, "season");
    apply(this._e.speedTrack, "intensity");
    this._e.modeTiles.forEach((tl) => tl.dataset.kind !== "temp" && apply(tl, "modes"));
    apply(this._e.bypass, "bypass");
  }

  _update() {
    const en = this._entities;
    const e = this._e;
    const t = (k) => this._t(k);

    if (this._pending && (this._pending.check() || Date.now() > this._pending.until)) {
      this._pending = null;
      clearTimeout(this._pendTimer);
    }

    // Power (header device icon).
    const powerOn = this._isOn(en.power);
    const powerAvail = this._stateObj(en.power) !== undefined;
    e.wrap.dataset.off = powerAvail && !powerOn ? "true" : "false";
    e.power.classList.toggle("on", powerOn);

    // Faults: error = blocking "S" group (red); alarm = "E" warning (amber).
    // (Filter change has its own chip, so it is not duplicated here.)
    const errOn = this._isOn(en.error);
    const almOn = this._isOn(en.alarm);
    const showWarn = errOn || almOn;
    e.warn.hidden = !showWarn;
    e.warn.classList.toggle("critical", errOn);
    this._warnTarget = errOn ? en.error : en.alarm;
    const acode = this._num(en.alarm_code); // fork: blocking S-alarm number (4384)
    e.warn.title = errOn ? `${t("error")}${acode ? ` (${acode})` : ""}` : t("warning");

    // Season.
    const season = this._state(en.season);
    const winter = season === "Zima";
    e.seasonTxt.textContent = season === "Zima" ? t("winter") : season === "Lato" ? t("summer") : "—";
    e.seasonIc.innerHTML = this._icon(winter ? ICONS.snow : ICONS.sun);
    e.season.dataset.season = winter ? "winter" : "summer";

    // Mode + active special.
    const mode = this._mode();
    const special = this._activeSpecial();
    const specialActive = special !== null;
    // Schedule/sensor-triggered specials (airing variants 3-6/8/9) run *inside*
    // the base mode — the unit is still in Auto/Manual, so keep that tile lit and
    // show the function as automatic info. Panel-selected functions (7/2/10/11)
    // are a deliberate override and replace the base mode as before.
    const autoTrig = specialActive && [3, 4, 5, 6, 8, 9].includes(this._specialCode());

    // Manual intensity (register 4210) — meaningful only in Manual mode.
    // While a debounce/confirm is in flight, show the optimistic target; once the
    // device confirms it (and nothing is pending), drop back to the entity value.
    const intensityPending = this._speedTimer !== null || (this._pending && this._pending.scopes.has("intensity"));
    const speedRaw = this._num(en.speed);
    // Once nothing is in flight (debounce done, lock resolved or timed out), drop
    // the optimistic value and show the entity truth.
    if (this._speedTarget !== null && !intensityPending && speedRaw !== null) this._speedTarget = null;
    const speed = this._speedTarget !== null ? this._speedTarget : speedRaw;
    const speedPct = Math.round(clamp(speed ?? 0, 0, 100));
    // Don't yank the thumb from under the user's finger: only sync the input's
    // value from state when nothing is pending. Always keep the fill (--pct) in sync.
    if (!intensityPending) e.speedInput.value = String(speedPct);
    e.speedInput.style.setProperty("--pct", speedPct);
    e.speedCap.textContent = speed === null ? t("intensity") : `${t("intensity")} · ${speedPct}%`;

    // Real current airflow (registers 256/257) — truthful in every mode.
    const flowSup = this._num(en.flow_supply);
    const flowExt = this._num(en.flow_extract);
    const airflow = flowSup ?? flowExt;
    const m3 = airflow === null ? "" : ` · ${Math.round(airflow)} m³/h`;
    // Effective fan output % (fork dac sensors) — real intensity in any mode.
    const effPct = this._effPct();
    const pctStr = effPct === null ? "" : ` · ${effPct}%`;

    // Intensity slider only when Manual, powered, no special override.
    const manualEditable = powerOn && !specialActive && mode === 1;
    if (e.speedRow) e.speedRow.hidden = !manualEditable;

    // Mode tiles: highlight the active one; show Temporary only when active.
    e.modeTiles.forEach((tl) => {
      const kind = tl.dataset.kind;
      const val = tl.dataset.val;
      let active = false;
      if (kind === "special") {
        const on = special === val;
        active = on && !autoTrig;                          // filled only when user-selected
        tl.classList.toggle("auto-trig", on && autoTrig);  // outlined "automatic" style
      } else if (kind === "mode") {
        const baseOn = (val === "auto" && mode === 0) || (val === "manual" && mode === 1);
        active = baseOn && !(specialActive && !autoTrig);  // stays lit under auto-triggered specials
      } else if (kind === "temp") {
        active = !(specialActive && !autoTrig) && mode === 2;
        tl.hidden = !active;
      }
      tl.classList.toggle("active", active);
      const sub = tl.querySelector(".msub");
      if (sub) {
        if (kind === "mode" && val === "auto") {
          // Auto is schedule-driven: surface what it's doing — the active
          // auto-triggered special (e.g. "Wietrzenie") or just "harmonogram".
          if (mode === 0 && autoTrig) {
            const fn = SPECIAL_FUNCTIONS.find((f) => f.option === special);
            sub.textContent = fn ? t(fn.key) : special;
          } else {
            sub.textContent = mode === 0 ? t("schedule") : "";
          }
        } else {
          sub.textContent = this._tileSub(kind, val, en);
        }
      }
    });

    // Status line: what currently controls the airflow (effective % + m³/h).
    const info = `${pctStr}${m3}`;
    let status;
    if (!powerAvail) status = "";
    else if (!powerOn) status = t("off");
    else if (specialActive) {
      const fn = SPECIAL_FUNCTIONS.find((f) => f.option === special);
      const fnLabel = fn ? t(fn.key) : special;
      // Auto-triggered airing keeps the base mode in front: "Auto · Wietrzenie · …".
      const base = autoTrig ? (mode === 0 ? `${t("auto")} · ` : mode === 1 ? `${t("manual")} · ` : "") : "";
      status = `${base}${fnLabel}${info}`;
    } else if (mode === 1) {
      // Manual: prefer the effective %, else the manual setpoint from the slider.
      const man = effPct !== null ? info : speed === null ? "" : ` · ${Math.round(speedPct)}%`;
      status = `${t("manual")}${man}`;
    } else if (mode === 0) status = `${t("auto")} · ${t("schedule")}${info}`;
    else if (mode === 2) status = `${t("temporary")}${info}`;
    else status = info.replace(/^ · /, "");
    e.status.textContent = status;
    e.status.hidden = !status;

    // Airflow animation — per-duct speed from each fan's flow ÷ nominal (%),
    // scaled linearly: 0% → 5s (slow crawl), 100% → 0.25s. Intake follows the
    // supply fan, extract the exhaust fan; supply/exhaust ducts blend both
    // (75/25 and 25/75) since after the exchanger the streams mix.
    const spPct = this._fanAnimPct("flow_supply", "nom_sup", "eff_sup", "fan_supply_pct");
    const epPct = this._fanAnimPct("flow_extract", "nom_ext", "eff_ext", "fan_extract_pct");
    // Smooth speed curve via the tunable cubic-bezier ease (default S-curve: slow
    // ramp at low work, then a rapid speed-up). Maps 0%→6s … 100%→0.1s.
    const durOf = (p) => FLOW_SPEED_MAX + (FLOW_SPEED_MIN - FLOW_SPEED_MAX) * clamp(this._speedEase(clamp(p, 0, 100) / 100), 0, 1);
    const mix = (wa, wb) => (spPct == null || epPct == null ? (spPct ?? epPct) : wa * spPct + wb * epPct);
    const flowPct = { intake: spPct, extract: epPct, supply: mix(0.75, 0.25), exhaust: mix(0.25, 0.75) };
    e.flows.forEach((f) => {
      const p = flowPct[f.dataset.flow];
      const on = powerOn && p != null;
      f.style.animationDuration = `${durOf(p ?? 0).toFixed(2)}s`;
      f.style.animationPlayState = on ? "running" : "paused";
    });

    // Diagram values.
    if (this._config.show_diagram) {
      e.dIntake.textContent = this._temp(en.temp_intake);
      e.dExtract.textContent = this._temp(en.temp_extract);
      e.dSupply.textContent = this._temp(en.temp_supply);
      e.dFpx.textContent = this._temp(en.temp_fpx);
      e.dFlowSup.textContent = this._flow(en.flow_supply);
      e.dFlowExt.textContent = this._flow(en.flow_extract);
      const ps = this._num(en.eff_sup) ?? this._num(en.fan_supply_pct); // true % (272), else dac
      const pe = this._num(en.eff_ext) ?? this._num(en.fan_extract_pct);
      e.dPctSup.textContent = ps === null ? "" : `${Math.round(ps)}%`;
      e.dPctExt.textContent = pe === null ? "" : `${Math.round(pe)}%`;
      this._setFilterWear(e.filtFillSup, this._num(en.filter_wear_sup));
      this._setFilterWear(e.filtFillExt, this._num(en.filter_wear_ext));
      const amb = this._num(en.temp_ambient); // reg 22: ambient (TO) probe
      if (e.probe) e.probe.style.display = amb === null ? "none" : "";
      if (e.dAmbient) e.dAmbient.textContent = amb === null ? "" : `${amb.toFixed(1)}°C`;
      const tt = this._num(en.target_temp); // fork: target supply temp (4212)
      e.dTarget.textContent = tt === null ? "" : `${t("target")} ${tt.toFixed(1)}°C`;
      // Secondary heater (1282) / cooler (1283) on the supply duct. Show the coil
      // whenever the unit has either; warm when heating, cool when cooling, dim idle.
      if (e.cond) {
        const hp = this._num(en.heater_pct);
        const cp = this._num(en.cooler_pct);
        const present = hp !== null || cp !== null;
        e.cond.style.display = present ? "" : "none";
        if (present) {
          const heating = (hp ?? 0) > 0;
          const cooling = !heating && (cp ?? 0) > 0;
          e.condCoil.classList.toggle("heat", heating);
          e.condCoil.classList.toggle("cool", cooling);
          e.dCond.textContent = heating ? `${Math.round(hp)}%` : cooling ? `${Math.round(cp)}%` : "";
          e.dCond.style.fill = heating ? "var(--tg-warn)" : cooling ? "var(--tg-winter)" : "";
        }
      }
    }

    // Bypass: chip = function enable (reg 4320); badge = actuator open now (coil 9).
    const bypassEnabled = this._isOn(en.bypass);
    // Prefer the true bypass status (fork reg 4330: 0=inactive, 1/2=active);
    // fall back to the actuator coil (9) when the fork sensor isn't present.
    const bypStatus = this._num(en.bypass_status);
    const bypassOpen = bypStatus !== null ? bypStatus !== 0 : this._isOn(en.bypass_open);
    // Reasons the bypass is held shut — only those we can actually derive from
    // live values (empty when unexplained). Gates the diagram note + highlight.
    const bypassReasons = bypassEnabled && !bypassOpen ? this._bypassReasons() : [];
    // Show the bypass route when the function is armed; add "open" (colour
    // gradient) when the damper is actually open, else it stays grey (closed).
    if (e.bp) {
      e.bp.classList.toggle("show", bypassEnabled);
      e.bp.classList.toggle("open", bypassOpen);
    }
    // Core pattern fades out when the exchanger is actually bypassed.
    if (e.hx) e.hx.style.opacity = bypassOpen ? "0.1" : "0.5";
    // Note in the hexagon centre — ONLY when we can explain why it's shut.
    if (e.bpThr) {
      const show = bypassReasons.length > 0;
      e.bpThr.style.display = show ? "" : "none";
      if (e.bpThrT) e.bpThrT.textContent = show ? bypassReasons[0].short : "";
    }
    // Bypass section: the toggle reflects the function enable (reg 4320); the
    // state text shows open / closed / disabled; the derived reason (if any) is
    // highlighted below. Clicking the section toggles the function.
    e.bypass.classList.toggle("on", bypassEnabled);
    e.bypass.classList.toggle("open", bypassEnabled && bypassOpen);
    e.bypassTxt.textContent = !bypassEnabled
      ? t("disabled")
      : bypassOpen ? t("open") : t("closed");
    e.bypass.title = !bypassEnabled
      ? t("bypass_hint_off")
      : bypassOpen ? t("bypass_hint_open") : t("bypass_hint_closed");
    if (e.bypassReason) {
      e.bypassReason.textContent = bypassReasons
        .map((r) => (r.detail ? `${r.label} · ${r.detail}` : r.label))
        .join(" · ");
    }
    if (e.bypassCfg) {
      const comf = this._num(en.temp_comfort);
      const bmin = this._num(en.bypass_min);
      e.bypassCfg.textContent = bypassEnabled
        ? [comf !== null ? `${t("cfg_comfort")} ${Math.round(comf)}°` : null,
           bmin !== null ? `${t("cfg_min")} ${Math.round(bmin)}°` : null].filter(Boolean).join(" · ")
        : "";
    }

    // Stats section (borderless; only the cells enabled in config are present).
    if (e.stEff) { const v = this._num(en.efficiency); e.stEff.textContent = v === null ? "—" : `${Math.round(v)}%`; }
    // Thermal balance (kW) + benefit index: season-aware label, sign-aware colour
    // and a status tooltip — all sourced from the sensor so card + integration agree.
    const heatGoal = this._state(en.season) === "Zima";
    if (e.slPow) e.slPow.textContent = heatGoal ? t("recovery_heat") : t("recovery_cool");
    if (e.stPow) {
      const v = this._num(en.recovery_power);
      e.stPow.textContent = v === null ? "—" : `${v.toFixed(2)} kW`;
      this._applyBenefit(e.statPow, e.stPow, en.recovery_power);
    }
    if (e.slCop) e.slCop.textContent = t("benefit");
    if (e.stCop) {
      const v = this._num(en.cop);
      e.stCop.textContent = v === null ? "—" : v.toFixed(1);
      this._applyBenefit(e.statCop, e.stCop, en.cop);
    }
    if (e.stFilter) {
      const filterAlarm = this._isOn(en.filter_change);
      if (e.statFilters) e.statFilters.classList.toggle("warn", filterAlarm);
      const fs = this._state(en.filter_date_sup);
      const fe = this._state(en.filter_date_ext);
      const validDate = (v) => v && v !== "unknown" && v !== "unavailable";
      const dates = [fs, fe].filter(validDate);
      const dateText = dates.length === 2 && dates[0] !== dates[1]
        ? `${dates[0]} / ${dates[1]}`
        : dates[0] || t("ok");
      e.stFilter.textContent = filterAlarm ? t("replace") : dateText;
      const ws = this._num(en.filter_wear_sup), we = this._num(en.filter_wear_ext); // 4482 / 4483 wear %
      if (e.stWearSup) e.stWearSup.textContent = ws === null ? "—" : `${Math.round(ws)}%`;
      if (e.stWearExt) e.stWearExt.textContent = we === null ? "—" : `${Math.round(we)}%`;
    }

    // Weekly schedule sections (from the Harmonogram sensor attributes).
    if (e.schedMini && e.schedPlot) {
      // Show only when the Auto tile is the active mode (base Auto and no
      // panel-selected special overriding it) — hidden in Manual/Temporary/specials.
      const autoActive = mode === 0 && !(specialActive && !autoTrig);
      const r = this._config.show_schedule && autoActive ? this._renderScheduleMini() : null;
      e.schedPlot.innerHTML = r ? r.plot : "";
      if (e.schedAxis) e.schedAxis.innerHTML = r ? r.axis : "";
      e.schedMini.hidden = !r;
    }
    if (e.schedCal) {
      const html = this._config.show_calendar ? this._renderCalendar() : "";
      e.schedCal.innerHTML = html;
      e.schedCal.hidden = !html;
    }

    this._applyPending();
  }

  // ---- Style ---------------------------------------------------------------
  _css() {
    return `
      :host {
        --tg-accent: var(--primary-color);
        --tg-accent-d: var(--primary-color);
        --tg-on-accent: var(--text-primary-color, #fff);
        --tg-hex: var(--primary-color);
        --tg-winter:#3E9BD6; --tg-summer:#F2A93B; --tg-warn:#E8A33D; --tg-crit:#DB4B3C;
        --tg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
      }
      .wrap[data-accent="thessla"] {
        --tg-accent:#7DB93B; --tg-accent-d:#57811F; --tg-on-accent:#fff; --tg-hex:#15C0DE;
      }
      ha-card { padding:16px; }
      .ic { width:22px; height:22px; fill:currentColor; display:block; }
      .wrap { display:flex; flex-direction:column; gap:14px;
              color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family,inherit); }
      .wrap[data-off="true"] .diagram,
      .wrap[data-off="true"] .speed-row,
      .wrap[data-off="true"] .bypass,
      .wrap[data-off="true"] .stats,
      .wrap[data-off="true"] .modes { opacity:.42; filter:grayscale(.55); }

      /* Header */
      header { display:flex; align-items:center; gap:11px; }
      .title { flex:1; font-size:1.15rem; font-weight:600; letter-spacing:.2px; min-width:0;
               overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
      .title:hover { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
      button { font:inherit; color:inherit; cursor:pointer; border:none; background:none;
               -webkit-tap-highlight-color:transparent; }
      .dev { width:38px; height:38px; flex:0 0 auto; border-radius:50%; display:grid; place-items:center;
             background:var(--secondary-background-color); border:1px solid var(--divider-color);
             color:var(--secondary-text-color); transition:.2s; }
      .dev .ic { width:20px; height:20px; }
      .dev.on { background:var(--tg-accent); color:var(--tg-on-accent); border-color:var(--tg-accent); }
      .head-right { display:flex; align-items:center; gap:8px; }
      .warn { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; color:var(--tg-warn); }
      .warn .ic { width:22px; height:22px; fill:currentColor; }
      .warn.critical { color:var(--tg-crit); }
      .warn[hidden] { display:none; }
      .season-pill { display:flex; align-items:center; gap:5px; padding:5px 11px 5px 8px; border-radius:999px;
                     font-size:.82rem; font-weight:600; background:var(--secondary-background-color);
                     border:1px solid var(--divider-color); }
      .season-pill .ic { width:18px; height:18px; }
      .season-pill[data-season="winter"] { color:var(--tg-winter); }
      .season-pill[data-season="summer"] { color:var(--tg-summer); }

      /* Airflow diagram — fills the full card width, no inner padding */
      .diagram { line-height:0; }
      .diag { width:100%; height:auto; display:block; }
      .diag [data-mref] { cursor:pointer; }
      .diag [data-mref]:hover { opacity:.6; }
      .diag .hex { fill:none; stroke:var(--tg-hex); stroke-width:3; stroke-linejoin:round; transition:.3s; }
      .diag .hx-core { fill:none; stroke:var(--secondary-text-color); stroke-width:1; stroke-linecap:round; stroke-linejoin:round; opacity:.5; transition:opacity .3s; }
      .diag .bp { display:none; }
      .diag .bp.show { display:inline; }
      .diag .ah { fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
      .diag .track { fill:none; stroke-width:2.2; opacity:.3; stroke-linecap:round; stroke-linejoin:round; }
      .diag .coil { fill:none; stroke:var(--secondary-text-color); stroke-width:2; stroke-linejoin:round; opacity:.7; }
      .diag .cond-coil { fill:none; stroke:var(--secondary-text-color); stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; opacity:.5; transition:.3s; }
      .diag .cond-coil.heat { stroke:var(--tg-warn); opacity:1; }
      .diag .cond-coil.cool { stroke:var(--tg-winter); opacity:1; }
      .diag .filt-b { fill:none; stroke:var(--secondary-text-color); stroke-width:1.4; stroke-linecap:round; }
      .diag .filt-ghost { opacity:.25; }
      .diag .filt-live { opacity:1; }
      /* Invisible hit target: makes the whole icon area (not just its strokes) hoverable/clickable */
      .diag .hitbox { fill:transparent; pointer-events:all; }
      .diag .probe { fill:none; stroke:var(--secondary-text-color); stroke-width:1.6; opacity:.5; stroke-linecap:round; stroke-linejoin:round; }
      .diag .fan-c { fill:none; stroke-width:2.5; }
      .diag .bp-mask { fill:var(--tg-card-bg); }
      .diag .bp-band { fill:var(--secondary-text-color); opacity:.5; }
      .diag .bp.open .bp-band { fill:url(#bpgrad); opacity:1; }
      .diag .bp-cut { font-size:9px; font-weight:800; letter-spacing:.4px; }
      .diag .bp-thr-bg { fill:var(--tg-card-bg); }
      .diag .bp-thr-t { fill:var(--secondary-text-color); font-size:10px; font-weight:700; }
      .diag .fname { font-size:12px; font-weight:500; letter-spacing:.3px; }
      .diag .temp { fill:var(--primary-text-color); font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; }
      .diag .sub { fill:var(--secondary-text-color); font-size:10px; font-weight:600; font-variant-numeric:tabular-nums; }
      .diag .tag { fill:var(--secondary-text-color); font-size:9px; font-weight:700; letter-spacing:.5px; }
      .flow { fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:12 14; animation:dash 1.6s linear infinite; }
      @keyframes dash { to { stroke-dashoffset:-26; } }  /* = dash+gap → seamless loop */

      /* Status line */
      .status { text-align:center; font-size:.82rem; font-weight:600; color:var(--secondary-text-color);
                font-variant-numeric:tabular-nums; }
      .status[hidden] { display:none; }

      /* Unified mode tiles — always one row; columns adapt to width */
      /* Equal columns: minmax(0,1fr) lets a long single word (e.g. "Wietrzenie")
         shrink/wrap instead of stretching its column wider than the rest. */
      .modes { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0,1fr); gap:8px; }
      .mtile { display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
               gap:6px; padding:12px 3px; border-radius:14px; background:var(--secondary-background-color);
               border:1px solid var(--divider-color); color:var(--secondary-text-color); min-width:0;
               font-size:.72rem; font-weight:600; line-height:1.15; text-align:center; transition:.15s;
               overflow-wrap:anywhere; hyphens:auto; }
      .mtile .ic { width:24px; height:24px; }
      .mtile .msub { font-size:.62rem; font-weight:600; opacity:.65; font-variant-numeric:tabular-nums; }
      .mtile .msub:empty { display:none; }
      .mtile.active .msub { opacity:.9; }
      .mtile:hover { border-color:var(--tg-accent); }
      .mtile.active { background:var(--tg-accent); color:var(--tg-on-accent); border-color:var(--tg-accent); }
      .mtile.active .ic { fill:var(--tg-on-accent); }
      /* Automatically-triggered special (e.g. scheduled airing): active but not
         user-selected — outlined accent instead of filled, base mode stays lit. */
      .mtile.auto-trig { background:transparent; color:var(--tg-accent); border-color:var(--tg-accent); border-style:dashed; }
      .mtile.auto-trig .ic { fill:var(--tg-accent); }
      .mtile.auto-trig .msub { opacity:.9; }
      .mtile.ro { pointer-events:none; background:transparent; border-color:var(--tg-summer); color:var(--tg-summer); }
      .mtile.ro.active { background:transparent; }
      .mtile.ro.active .ic { fill:var(--tg-summer); }
      .mtile[hidden] { display:none; }

      /* Intensity — native range slider styled as a filled bar with a handle */
      .speed-row { display:flex; align-items:center; gap:12px; }
      .speed-row[hidden] { display:none; }
      .speed-track { position:relative; flex:1; height:34px; }
      .speed-input { -webkit-appearance:none; appearance:none; width:100%; height:34px; margin:0;
                     border-radius:10px; border:1px solid var(--divider-color); cursor:pointer; outline:none;
                     background:
                       linear-gradient(90deg,var(--tg-accent-d),var(--tg-accent)) 0 0 / calc(var(--pct,0) * 1%) 100% no-repeat,
                       var(--secondary-background-color); }
      .speed-input:focus-visible { border-color:var(--tg-accent); }
      /* Handle hidden: the blue fill alone shows the selection. The thumb stays
         present (transparent) so dragging still has a grab region. */
      .speed-input::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:6px; height:34px;
                     border:none; background:transparent; box-shadow:none; cursor:pointer; }
      .speed-input::-moz-range-thumb { width:6px; height:34px; border:none; background:transparent;
                     box-shadow:none; cursor:pointer; }
      .speed-input::-moz-range-track { background:transparent; border:none; }
      .speed-cap { position:absolute; inset:0; display:grid; place-items:center; font-size:.78rem; font-weight:600;
                   color:var(--primary-text-color); text-shadow:0 1px 2px rgba(0,0,0,.18); pointer-events:none; }
      .speed-track.pending .speed-cap { visibility:hidden; }  /* spinner takes the centre */

      /* Bypass — borderless row: icon + 2 lines (title·cfg / state·reason) + toggle.
         No box, so it doesn't cost the extra vertical padding; subtle hover only. */
      .bypass { display:flex; align-items:center; gap:12px; width:100%; text-align:left;
                padding:2px 2px; border-radius:10px; background:none; transition:.15s; }
      .bypass:hover { background:var(--secondary-background-color); }
      .bypass[hidden] { display:none; }
      .bypass-ic { flex:0 0 auto; color:var(--secondary-text-color); display:grid; place-items:center; }
      .bypass-ic .ic { width:24px; height:24px; fill:currentColor; }
      .bypass-info { display:flex; flex-direction:column; gap:1px; flex:1; min-width:0; }
      .bypass-row { display:flex; align-items:baseline; gap:8px; min-width:0; }
      .bypass-title { font-size:.95rem; font-weight:600; color:var(--primary-text-color); flex:0 0 auto; }
      .bypass-state { font-size:.78rem; color:var(--secondary-text-color); flex:0 0 auto; }
      .bypass-cfg { font-size:.68rem; color:var(--secondary-text-color); opacity:.8;
                    font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .bypass-cfg:empty { display:none; }
      /* Derived reason the bypass is held shut (highlighted). */
      .bypass-reason { font-size:.72rem; font-weight:600; color:var(--tg-warn);
                       white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
      .bypass-reason:empty { display:none; }
      .bypass.open .bypass-reason { display:none; }
      .bypass-sw { flex:0 0 auto; width:42px; height:24px; border-radius:999px;
                   background:var(--divider-color); position:relative; transition:.2s; }
      .bypass-sw i { position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%;
                     background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.25); transition:.2s; }
      .bypass.on .bypass-sw { background:var(--tg-accent); }
      .bypass.on .bypass-sw i { left:20px; }
      .bypass.on .bypass-ic { color:var(--tg-accent); }
      .bypass.open .bypass-state { color:var(--tg-accent); font-weight:600; }

      /* Weekly schedule — mini chart (boxed like the intensity slider) + calendar */
      .sched-mini { position:relative; }
      .sched-mini[hidden], .sched-cal[hidden] { display:none; }
      /* Chart box: same look + height as the manual-intensity slider track. */
      .sch-box { position:relative; height:34px; border-radius:10px; overflow:hidden;
                 border:1px solid var(--divider-color); background:var(--secondary-background-color); }
      .sch-plot { position:absolute; inset:0; line-height:0; }
      .sch-svg { width:100%; height:100%; display:block; }        /* fills the box (stretched) */
      .sch-axis { line-height:0; margin-top:1px; }
      .sch-axis-svg, .cal-svg { width:100%; height:auto; display:block; }
      .sch-area { fill:var(--tg-accent); opacity:.18; stroke:none; }
      .sch-line { fill:none; stroke:var(--tg-accent); stroke-width:1.6; stroke-linejoin:round; stroke-linecap:round; vector-effect:non-scaling-stroke; }
      .sch-air { fill:var(--tg-accent-d); opacity:.9; }           /* airing = same palette, at 100% */
      .sch-grid { stroke:var(--divider-color); stroke-width:1; opacity:.5; vector-effect:non-scaling-stroke; }
      .sch-mid { stroke:var(--secondary-text-color); stroke-width:1; opacity:.7; vector-effect:non-scaling-stroke; }
      .sch-night, .cal-night { fill:#000; opacity:.4; }           /* translucent black, feathered */
      .sch-tick, .cal-h, .cal-d { fill:var(--secondary-text-color); }
      .sch-tick { font-size:8px; }
      .sch-date { font-weight:700; }
      .cal-h { font-size:8px; }
      .cal-d { font-size:9px; }
      .sch-now { stroke:var(--primary-text-color); stroke-width:1; stroke-dasharray:2 2; opacity:.65; vector-effect:non-scaling-stroke; }
      .sch-now-d { fill:var(--primary-text-color); }
      .cal-bar { fill:var(--tg-accent); }
      .cal-air { fill:var(--tg-accent); }              /* airing = a 100% column, same palette */
      .sch-tip { position:absolute; bottom:100%; transform:translateX(-50%); margin-bottom:2px;
                 pointer-events:none; display:none; white-space:nowrap; z-index:3;
                 background:var(--secondary-background-color); color:var(--primary-text-color);
                 border:1px solid var(--divider-color); border-radius:6px; padding:2px 6px;
                 font-size:.66rem; font-variant-numeric:tabular-nums; box-shadow:0 2px 6px rgba(0,0,0,.25); }

      /* Stats — light, borderless readouts (hairline-separated). Label on top;
         only the value(s) are clickable, not the whole box. */
      .stats { display:flex; align-items:stretch; }
      .stat { flex:1 1 0; min-width:0; display:flex; flex-direction:column; align-items:center;
              justify-content:flex-start; gap:2px; padding:2px 6px; }
      .stat + .stat { border-left:1px solid var(--divider-color); }
      .stat .sl { font-size:.62rem; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.5px; }
      .stat .sv { font-size:1.2rem; font-weight:700; color:var(--tg-accent-d);
                  font-variant-numeric:tabular-nums; line-height:1.1; cursor:pointer; transition:.15s; }
      .stat .sv:hover { opacity:.6; }
      /* Filters pack days + both wear values side-by-side (equal weight). */
      .stat .svrow { display:flex; align-items:baseline; gap:4px; }
      .stat .fv { font-size:.95rem; font-weight:700; color:var(--tg-accent-d);
                  font-variant-numeric:tabular-nums; line-height:1.1; cursor:pointer; transition:.15s; }
      .stat .fv:hover { opacity:.6; }
      .stat .ss-sep { color:var(--secondary-text-color); opacity:.45; font-size:.8rem; }
      .stat.warn .sv, .stat.warn .fv:first-of-type { color:var(--tg-crit); }
      /* Benefit status: green helps the goal, red works against it, muted = neutral. */
      .stat.good .sv { color:var(--tg-accent-d); }
      .stat.bad .sv { color:var(--tg-crit); }
      .stat.neutral .sv { color:var(--secondary-text-color); }

      /* Optimistic-state locking */
      .blocked { opacity:.4 !important; pointer-events:none; }
      .pending { position:relative; pointer-events:none; opacity:.7; }
      .pending::after { content:""; position:absolute; top:50%; left:50%; width:16px; height:16px;
                        margin:-8px 0 0 -8px; border:2px solid currentColor; border-right-color:transparent;
                        border-radius:50%; animation:tgspin .7s linear infinite; }
      @keyframes tgspin { to { transform:rotate(360deg); } }

      button:focus-visible { outline:2px solid var(--tg-accent); outline-offset:2px; }
      @media (prefers-reduced-motion:reduce) { .flow { animation:none !important; } .pending::after { animation:none; } }
    `;
  }
}

// Registration is deferred to the bottom of this file — see registerCard().

// ---------------------------------------------------------------------------
//  Visual editor (native <ha-form>, localized)
// ---------------------------------------------------------------------------
const EDITOR_ROLES = [
  "power", "operation_mode", "speed", "special", "season",
  "bypass", "bypass_open", "temp_intake", "temp_supply", "temp_extract", "temp_fpx",
  "flow_supply", "flow_extract", "efficiency", "recovery_power", "cop",
  "filter_change", "alarm", "error", "comfort", "erv",
];

const EDITOR_I18N = {
  en: {
    name: "Name", show_diagram: "Airflow diagram",
    show_bypass: "Bypass section", show_metrics: "Statistics section", functions: "Special functions shown", metrics: "Statistics shown",
    show_schedule: "Schedule chart (under Auto)", show_calendar: "Schedule calendar",
    accent: "Colours", accent_theme: "Home Assistant theme", accent_thessla: "ThesslaGreen",
    entities: "Entities (override auto-detection)",
    power: "Power (switch)", operation_mode: "Operating mode (select)",
    speed: "Intensity (number)", special: "Special functions (select)", season: "Season (select)",
    bypass: "Bypass enable (switch)", bypass_open: "Bypass open — actuator (binary_sensor)",
    temp_intake: "Temperature — intake", temp_supply: "Temperature — supply",
    temp_extract: "Temperature — extract", temp_fpx: "Temperature — after FPX",
    flow_supply: "Airflow — supply", flow_extract: "Airflow — extract",
    efficiency: "Efficiency", recovery_power: "Thermal balance", cop: "Thermal benefit index",
    filter_change: "Filter change", alarm: "Warning (E group)", error: "Error (S, blocking)",
    comfort: "ECO/Comfort", erv: "ERV mode",
  },
  pl: {
    name: "Nazwa", show_diagram: "Schemat przepływu",
    show_bypass: "Sekcja bypass", show_metrics: "Sekcja statystyk", functions: "Widoczne funkcje specjalne", metrics: "Widoczne statystyki",
    show_schedule: "Wykres harmonogramu (przy Auto)", show_calendar: "Kalendarz harmonogramu",
    accent: "Kolory", accent_theme: "Motyw Home Assistant", accent_thessla: "ThesslaGreen",
    entities: "Encje (nadpisanie auto-wykrywania)",
    power: "Zasilanie (switch)", operation_mode: "Tryb pracy (select)",
    speed: "Intensywność (number)", special: "Funkcje specjalne (select)", season: "Sezon (select)",
    bypass: "Bypass — włączenie (switch)", bypass_open: "Bypass otwarty — siłownik (binary_sensor)",
    temp_intake: "Temperatura — czerpnia", temp_supply: "Temperatura — nawiew",
    temp_extract: "Temperatura — wywiew", temp_fpx: "Temperatura — za FPX",
    flow_supply: "Strumień — nawiew", flow_extract: "Strumień — wywiew",
    efficiency: "Sprawność", recovery_power: "Bilans termiczny", cop: "Wskaźnik korzyści termicznej",
    filter_change: "Wymiana filtrów", alarm: "Ostrzeżenie (grupa E)", error: "Błąd (S, blokujący)",
    comfort: "EKO/Komfort", erv: "Tryb ERV",
  },
};

class ThesslaGreenCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _ed(key) {
    const lang = pickLang(this._hass);
    return (EDITOR_I18N[lang] && EDITOR_I18N[lang][key]) ?? EDITOR_I18N.en[key] ?? key;
  }

  async _ensureForm() {
    if (customElements.get("ha-form")) return;
    try {
      const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
      if (helpers) {
        const el = await helpers.createCardElement({ type: "entities", entities: [] });
        if (el && el.constructor && el.constructor.getConfigElement) await el.constructor.getConfigElement();
      }
    } catch (e) {
      /* ignore */
    }
    if (!customElements.get("ha-form")) await customElements.whenDefined("ha-form").catch(() => {});
  }

  _schema() {
    const lang = pickLang(this._hass);
    const t = (k) => this._ed(k);
    return [
      { name: "name", selector: { text: {} } },
      { name: "show_diagram", selector: { boolean: {} } },
      { name: "show_bypass", selector: { boolean: {} } },
      { name: "show_metrics", selector: { boolean: {} } },
      { name: "show_schedule", selector: { boolean: {} } },
      { name: "show_calendar", selector: { boolean: {} } },
      {
        name: "accent",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "theme", label: t("accent_theme") },
              { value: "thessla", label: t("accent_thessla") },
            ],
          },
        },
      },
      {
        name: "functions",
        selector: {
          select: {
            multiple: true,
            mode: "list",
            options: SPECIAL_FUNCTIONS.map((f) => ({ value: f.option, label: I18N[lang][f.key] })),
          },
        },
      },
      {
        name: "metrics",
        selector: {
          select: {
            multiple: true,
            mode: "list",
            options: STATS.map((s) => ({ value: s.key, label: I18N[lang][s.label] })),
          },
        },
      },
      {
        type: "expandable",
        name: "",
        title: t("entities"),
        icon: "mdi:tune-variant",
        schema: EDITOR_ROLES.map((role) => ({
          name: role,
          selector: { entity: { integration: "thessla_green", domain: ENTITY_RULES[role].domain } },
        })),
      },
    ];
  }

  _data() {
    const c = this._config || {};
    return {
      name: c.name ?? "",
      show_diagram: c.show_diagram !== false,
      show_bypass: c.show_bypass !== false,
      show_metrics: c.show_metrics !== false,
      show_schedule: c.show_schedule !== false,
      show_calendar: c.show_calendar === true,
      accent: c.accent === "thessla" ? "thessla" : "theme",
      functions: Array.isArray(c.functions) ? c.functions : SPECIAL_FUNCTIONS.map((f) => f.option),
      metrics: Array.isArray(c.metrics) ? c.metrics : STATS.map((s) => s.key),
      ...(c.entities || {}),
    };
  }

  async _render() {
    if (!this._config || !this._hass) return;
    if (!this._formReady) this._formReady = this._createForm();
    await this._formReady;
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = this._data();
  }

  async _createForm() {
    await this._ensureForm();
    const form = document.createElement("ha-form");
    form.computeLabel = (s) => this._ed(s.name) || s.name;
    form.computeHelper = (s) => {
      if (ENTITY_RULES[s.name] && this._hass) {
        const auto = resolveEntities(this._hass, {}).map[s.name];
        return auto ? `Auto: ${auto}` : undefined;
      }
      return undefined;
    };
    form.addEventListener("value-changed", (ev) => this._valueChanged(ev));
    // Populate BEFORE attaching so ha-form's first render never sees an
    // undefined schema (ha-form does schema.map() with no guard).
    form.hass = this._hass;
    form.schema = this._schema();
    form.data = this._data();
    this._form = form;
    this.shadowRoot.appendChild(form);
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    const value = ev.detail.value || {};
    const entities = {};
    for (const role of EDITOR_ROLES) if (value[role]) entities[role] = value[role];

    const out = { type: this._config.type || "custom:thessla-green-card" };
    if (value.name) out.name = value.name;
    if (value.show_diagram === false) out.show_diagram = false;
    if (value.show_bypass === false) out.show_bypass = false;
    if (value.show_metrics === false) out.show_metrics = false;
    if (value.show_schedule === false) out.show_schedule = false;
    if (value.show_calendar === true) out.show_calendar = true;
    // Advanced (YAML-only) flow-speed curve — preserve it across visual edits.
    if (Array.isArray(this._config.flow_curve)) out.flow_curve = this._config.flow_curve;
    if (value.accent === "thessla") out.accent = "thessla";
    const allFns = SPECIAL_FUNCTIONS.map((f) => f.option);
    if (Array.isArray(value.functions) && value.functions.length && value.functions.length < allFns.length) {
      out.functions = value.functions;
    }
    const allStats = STATS.map((s) => s.key);
    if (Array.isArray(value.metrics) && value.metrics.length && value.metrics.length < allStats.length) {
      out.metrics = value.metrics;
    }
    if (Object.keys(entities).length) out.entities = entities;

    this._config = out;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: out }, bubbles: true, composed: true }));
  }
}


// ---------------------------------------------------------------------------
//  Registration — wait for the frontend's custom element registry
// ---------------------------------------------------------------------------
// The integration auto-loads this file from index.html (frontend.add_extra_js_url),
// so it runs in parallel with the frontend's own bundle instead of after it. Early
// in its boot, app.js installs the scoped custom element registry polyfill, which
// REPLACES window.customElements with a fresh, empty registry:
//
//     Object.defineProperty(window, "customElements", { value: new CustomElementRegistry, ... })
//
// A tag registered before that swap stays in the native registry only. Lovelace
// looks the card up with `customElements.get("thessla-green-card")` on the NEW
// registry, misses it, and renders the "Configuration error" card instead — and it
// never recovers, because the retry it arms (`customElements.whenDefined`) queries
// that same new registry and never fires. Which side of the swap we land on is a
// pure timing race: a warm browser cache makes this file win it, and lose the card.
// That is the "card sometimes fails to load until I reload a few times" bug.
//
// Registering LATE is harmless (Lovelace rebuilds the card as soon as the tag is
// defined), registering EARLY is fatal — so wait for the real registry first.
const REGISTRY_POLL_MS = 20;
const REGISTRY_WAIT_MS = 10000; // safety net: register anyway rather than never

function defineElement(tag, ctor) {
  if (window.customElements.get(tag)) return;
  try {
    window.customElements.define(tag, ctor);
  } catch (e) {
    console.error(`[thessla-green-card] could not register <${tag}>`, e);
  }
}

function registerCard() {
  defineElement("thessla-green-card", ThesslaGreenCard);
  defineElement("thessla-green-card-editor", ThesslaGreenCardEditor);
}

// True once window.customElements is the registry the frontend actually uses:
// either it has already been swapped for the polyfilled one, or the frontend
// booted before us (e.g. this file loaded as a Lovelace resource) and its own
// elements are in the current registry.
function frontendRegistryReady(initialRegistry) {
  return window.customElements !== initialRegistry || !!window.customElements.get("home-assistant");
}

(function registerWhenRegistryIsReady() {
  const initialRegistry = window.customElements;
  const deadline = Date.now() + REGISTRY_WAIT_MS;
  const attempt = () => {
    if (frontendRegistryReady(initialRegistry) || Date.now() > deadline) registerCard();
    else setTimeout(attempt, REGISTRY_POLL_MS);
  };
  attempt();
})();

window.customCards = window.customCards || [];
window.customCards.push({
  type: "thessla-green-card",
  name: "ThesslaGreen Card",
  description: "ThesslaGreen recuperator control panel with airflow diagram.",
  preview: true,
});

console.info(
  `%c THESSLA-GREEN-CARD %c v${TG_VERSION} `,
  "background:#7DB93B;color:#fff;border-radius:3px 0 0 3px;padding:2px 4px;font-weight:700",
  "background:#333;color:#fff;border-radius:0 3px 3px 0;padding:2px 4px"
);
