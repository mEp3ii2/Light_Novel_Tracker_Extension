// content/storage.js
(() => {
  const STORAGE_KEY = "lnTracker.library";

  const registry = [];

  function normalizeHost(host) {
    return host.replace(/^www\./, "").toLowerCase();
  }

  function registerSite({ id, matchesHost, handler }) {
    registry.push({ id, matchesHost, handler });
  }

  function findHandlerForHost(hostname) {
    const host = normalizeHost(hostname);
    return registry.find(r => r.matchesHost(host)) || null;
  }

  async function getLibraryEntry(source, novelKey) {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const library =
      data &&
      data[STORAGE_KEY] &&
      typeof data[STORAGE_KEY] === "object" &&
      !Array.isArray(data[STORAGE_KEY])
        ? data[STORAGE_KEY]
        : {};

    const id = `${source}:${novelKey}`;
    return library[id] || null;
  }

  async function upsertLibraryEntry(entry) {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const library =
      data &&
      data[STORAGE_KEY] &&
      typeof data[STORAGE_KEY] === "object" &&
      !Array.isArray(data[STORAGE_KEY])
        ? data[STORAGE_KEY]
        : {};

    const id = `${entry.source}:${entry.novel_key}`;
    const existing = library[id] || null;

    const status =
      existing && typeof existing.status === "string" && existing.status.trim()
        ? existing.status
        : "current";

    library[id] = {
      id,
      source: entry.source,
      novel_key: entry.novel_key,

      novel_name: entry.novel_name || (existing?.novel_name ?? null),

      novel_url: entry.novel_url ?? (existing?.novel_url ?? null),

      cover_url: entry.cover_url ?? (existing?.cover_url ?? null),
      genres: Array.isArray(entry.genres)
        ? entry.genres
        : (Array.isArray(existing?.genres) ? existing.genres : []),

      chapter_label: entry.chapter_label ?? (existing?.chapter_label ?? null),
      chapter_title: entry.chapter_title ?? (existing?.chapter_title ?? null),

      link: entry.link,
      status,

      updated_at: new Date().toISOString()
    };

    await chrome.storage.local.set({ [STORAGE_KEY]: library });
    console.log("[LN Tracker] Updated:", library[id]);
  }

  window.LNTracker = {
    STORAGE_KEY,
    registerSite,
    findHandlerForHost,
    getLibraryEntry,
    upsertLibraryEntry
  };
})();
