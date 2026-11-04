export function storageGet<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    // Only storageSet() writes "planb." keys, with the same type.
    return value == null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}

export function storageSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode, quota exceeded or storage blocked: settings just aren't remembered.
  }
}
