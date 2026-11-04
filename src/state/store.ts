import { computed, reactive, watch } from "vue";

import { Choice, GameData, RAW, Recipe } from "../engine/engine";
import { GROUP_ORDER, LANGUAGES, MessageKey, groupLabel, message } from "../i18n/messages";
import { storageGet, storageSet } from "./storage";

export type MainTab = "need" | "recipes";

export type ResultTab = "graph" | "tree" | "items" | "buildings";

export type NeedMode = "rate" | "total";

export type Theme = "light" | "dark";

export interface StoreState {
  data: GameData | null;
  loadError: string | null;
  lang: string;
  tab: MainTab;
  resultTab: ResultTab;
  needMode: NeedMode;
  /** As typed: an empty field gives "". */
  extractionLevel: number | string;
  /** Tree view: bumped by "expand all" (positive) and "collapse all" (negative). */
  treeGeneration: number;
  /** Only where it differs from the default. */
  choices: { [itemKey: string]: Choice };
  /** Follows the system until the user picks one with setTheme(). */
  theme: Theme;
}

export interface ItemGroup {
  key: string;
  label: string;
  items: string[];
}

const THEME_KEY = "planb.theme";
const SYSTEM_DARK = window.matchMedia("(prefers-color-scheme: dark)");

function systemTheme(): Theme {
  return SYSTEM_DARK.matches ? "dark" : "light";
}

function savedTheme(): Theme | null {
  const saved = storageGet<unknown>(THEME_KEY, null);
  return saved === "light" || saved === "dark" ? saved : null;
}

// Also falls back to "need" for tabs that have been removed.
function savedTab(): MainTab {
  const saved = storageGet<unknown>("planb.tab", "need");
  return saved === "recipes" ? "recipes" : "need";
}

function detectLanguage(): string {
  const wanted = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LANGUAGES.some((l) => l.code === wanted) ? wanted : "en";
}

export const store = reactive<StoreState>({
  data: null,
  loadError: null,
  lang: storageGet("planb.lang", detectLanguage()),
  tab: savedTab(),
  resultTab: storageGet<ResultTab>("planb.resultTab", "graph"),
  needMode: storageGet<NeedMode>("planb.need.mode", "rate"),
  extractionLevel: storageGet<number | string>("planb.extractionLevel", 0),
  treeGeneration: 0,
  choices: storageGet<{ [itemKey: string]: Choice }>("planb.choices", {}),
  theme: savedTheme() ?? systemTheme(),
});

export function intlLocale(): string {
  return LANGUAGES.find((l) => l.code === store.lang)?.locale ?? "en";
}

watch(
  () => store.lang,
  (lang) => {
    storageSet("planb.lang", lang);
    document.documentElement.lang = intlLocale();
  },
  { immediate: true },
);
watch(() => store.tab, (tab) => { storageSet("planb.tab", tab); });
watch(() => store.resultTab, (tab) => { storageSet("planb.resultTab", tab); });
watch(() => store.needMode, (mode) => { storageSet("planb.need.mode", mode); });
watch(() => store.extractionLevel, (level) => { storageSet("planb.extractionLevel", level); });
watch(() => store.choices, (choices) => { storageSet("planb.choices", choices); }, { deep: true });

// index.html sets the same theme before the app loads, so there's no flash.
watch(
  () => store.theme,
  (theme) => {
    document.documentElement.dataset.theme = theme;
  },
  { immediate: true },
);

// Until the user picks a theme, follow the system's, live.
SYSTEM_DARK.addEventListener("change", () => {
  if (savedTheme() == null) store.theme = systemTheme();
});

// Once picked, the theme no longer follows the system.
export function setTheme(theme: Theme): void {
  store.theme = theme;
  storageSet(THEME_KEY, theme);
}

// The app renders nothing that needs it before it's loaded.
export function gameData(): GameData {
  if (!store.data) throw new Error("Game data is not loaded yet");
  return store.data;
}

export function extractionLevel(): number {
  const level = Number(store.extractionLevel);
  return Number.isNaN(level) ? 0 : Math.max(0, Math.floor(level));
}

export function t(key: MessageKey, params: { [name: string]: string | number } = {}): string {
  let text = message(store.lang, key);
  for (const [name, value] of Object.entries(params)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

export function itemName(key: string): string {
  const item = store.data?.items[key];
  return item ? item.names[store.lang] || item.names.en : key;
}

export function itemGroup(key: string): string {
  return store.data?.items[key]?.group ?? "other";
}

export function fmt(n: number, digits = 2): string {
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: digits }).format(n);
}

// A string from the game's localization file, with {0}, {1}, ... filled in.
export function gameText(key: string, ...args: Array<string | number>): string {
  const entry = store.data?.ui[key];
  let text = entry ? entry[store.lang] || entry.en : key;
  for (const [index, value] of args.entries()) {
    text = text.replace(`{${index}}`, String(value));
  }
  return text;
}

// "60 / year", worded like the game (TECH_POINTS_REVENUE is "+{0} / year").
export function perYear(n: number): string {
  return gameText("TECH_POINTS_REVENUE", fmt(n)).replace(/^\+/, "");
}

// Just the unit: "/ year", "/ an"...
export function yearUnit(): string {
  return gameText("TECH_POINTS_REVENUE", "").replace(/^\+/, "").trim();
}

// "10 days": the game's "Process duration: {0} days" without the label.
export function shortDays(days: number): string {
  return gameText("UI_Selection_Progress", fmt(days)).split(/:\s*/).pop() ?? "";
}

export function recipe(id: number): Recipe {
  const found = gameData().recipeById[id];
  if (!found) throw new Error(`Unknown recipe ${id}`);
  return found;
}

export function defaultChoice(item: string): Choice {
  return gameData().defaults[item] ?? RAW;
}

export function currentChoice(item: string): Choice {
  return store.choices[item] ?? defaultChoice(item);
}

// Picking the default forgets the choice.
export function setChoice(item: string, value: Choice): void {
  if (value === defaultChoice(item)) {
    delete store.choices[item];
  } else {
    store.choices[item] = value;
  }
}

// For search: lower case, no accents.
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function itemGroupLabel(group: string): string {
  return groupLabel(store.lang, group);
}

// Unknown groups go last.
function groupRank(group: string): number {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length : index;
}

export const groupedItems = computed((): ItemGroup[] => {
  if (!store.data) return [];
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(store.data.items)) {
    const group = itemGroup(key);
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  const collator = new Intl.Collator(intlLocale());
  return [...groups]
    .sort(([a], [b]) => groupRank(a) - groupRank(b))
    .map(([key, items]) => ({
      key,
      label: itemGroupLabel(key),
      items: items.sort((a, b) => collator.compare(itemName(a), itemName(b))),
    }));
});
