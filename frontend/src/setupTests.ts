import "@testing-library/jest-dom";

/**
 * jsdom di environment ini menyediakan `sessionStorage` tetapi TIDAK
 * `localStorage`. Beberapa modul (Zustand `persist` di WidgetWorkspaceProvider)
 * membaca `localStorage` saat MODULE LOAD — jadi polyfill ini harus hidup di
 * setupFiles, yang dieksekusi SEBELUM test module di-import.
 *
 * Catatan: menaruh polyfill di dalam file test TIDAK bekerja, karena ES module
 * imports di-hoist ke atas file sehingga modul yang membutuhkan storage sudah
 * ter-import lebih dulu.
 */
if (typeof globalThis.localStorage === "undefined") {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v));
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    clear: () => {
      mem.clear();
    },
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    get length() {
      return mem.size;
    },
  } as unknown as Storage;

  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

// jsdom tidak mengimplementasikan layout scrolling yang dipakai panel chat.
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}