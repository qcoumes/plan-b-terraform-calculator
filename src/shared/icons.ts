// data.json names icons by path, which Vite can't see, so every PNG is
// registered here and mapped to its built (hashed) URL.
const ICON_URLS = import.meta.glob<string>("../assets/icons/*.png", { eager: true, query: "?url", import: "default" });

export function iconUrl(icon?: string | null): string | null {
  return icon ? (ICON_URLS[`../assets/${icon}`] ?? null) : null;
}
