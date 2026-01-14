const STORAGE_KEY = "lnTracker.library";

const CANON_STATUSES = [
  { key: "all", label: "All" },
  { key: "reading", label: "Reading" },
  { key: "on-hold", label: "On hold" },
  { key: "dropped", label: "Dropped" },
  { key: "finished", label: "Finished" },
];

let ALL_ENTRIES = {};
let UI_STATE = {
  q: "",
  status: "all",
  sort: "updated_desc",
};

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "current") return "reading";
  if (s === "completed" || s === "complete") return "finished";
  if (s === "onhold" || s === "hold") return "on-hold";
  if (s === "reading") return "reading";
  if (s === "on-hold") return "on-hold";
  if (s === "dropped") return "dropped";
  if (s === "finished") return "finished";
  return "reading";
}

function getTitle(e) {
  return e?.novel_name || e?.novel_key || "(unknown novel)";
}

function getUpdatedISO(e) {
  return e?.updated_at || "";
}

function formatUpdated(iso) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "unknown";
  return d.toLocaleString();
}

function getGenresString(e) {
  if (Array.isArray(e?.genres) && e.genres.length) return e.genres.join(", ");
  if (typeof e?.genres === "string" && e.genres.trim()) return e.genres.trim();
  return "";
}

function computeCounts(entriesObj) {
  const counts = { all: 0, reading: 0, "on-hold": 0, dropped: 0, finished: 0 };
  for (const e of Object.values(entriesObj || {})) {
    if (!e || typeof e !== "object") continue;
    counts.all++;
    const st = normalizeStatus(e.status);
    if (counts[st] !== undefined) counts[st]++;
  }
  return counts;
}

function ensureMigratedStatuses(entriesObj) {
  let changed = false;
  for (const e of Object.values(entriesObj || {})) {
    if (!e || typeof e !== "object") continue;
    const before = e.status;
    const after = normalizeStatus(before);
    if (before !== after) {
      e.status = after;
      changed = true;
    }
  }
  return changed;
}

function buildStatusPills(counts) {
  const wrap = document.getElementById("statusPills");
  if (!wrap) return;

  wrap.innerHTML = CANON_STATUSES.map(s => {
    const pressed = UI_STATE.status === s.key ? "true" : "false";
    const c = counts[s.key] ?? 0;
    return `
      <button class="pill" type="button" data-status="${escapeHtml(s.key)}" aria-pressed="${pressed}">
        <span>${escapeHtml(s.label)}</span>
        <span class="badge">${c}</span>
      </button>
    `;
  }).join("");
}

function matchesQuery(e, q) {
  if (!q) return true;
  const parts = [
    e.novel_name,
    e.novel_key,
    e.source,
    e.chapter_label,
    e.chapter_title,
    getGenresString(e),
  ].filter(Boolean).join(" ").toLowerCase();
  return parts.includes(q);
}

function getFilteredArray() {
  const q = (UI_STATE.q || "").trim().toLowerCase();
  const status = UI_STATE.status || "all";

  const arr = Object.entries(ALL_ENTRIES || {})
    .filter(([_, e]) => e && typeof e === "object")
    .filter(([_, e]) => {
      if (status !== "all" && normalizeStatus(e.status) !== status) return false;
      if (!matchesQuery(e, q)) return false;
      return true;
    });

  const sort = UI_STATE.sort || "updated_desc";
  if (sort === "updated_desc") {
    arr.sort((a, b) => (getUpdatedISO(b[1]) || "").localeCompare(getUpdatedISO(a[1]) || ""));
  } else if (sort === "updated_asc") {
    arr.sort((a, b) => (getUpdatedISO(a[1]) || "").localeCompare(getUpdatedISO(b[1]) || ""));
  } else if (sort === "title_asc") {
    arr.sort((a, b) => getTitle(a[1]).localeCompare(getTitle(b[1]), undefined, { sensitivity: "base" }));
  } else if (sort === "title_desc") {
    arr.sort((a, b) => getTitle(b[1]).localeCompare(getTitle(a[1]), undefined, { sensitivity: "base" }));
  }

  return arr;
}

function render() {
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const headerCountEl = document.getElementById("headerCount");
  const emptyEl = document.getElementById("empty");
  if (!listEl) return;

  const filtered = getFilteredArray();
  const total = Object.keys(ALL_ENTRIES || {}).length;

  if (countEl) countEl.textContent = `${filtered.length} of ${total}`;
  if (headerCountEl) headerCountEl.textContent = `${total} saved`;

  if (!filtered.length) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "block";
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";

  listEl.innerHTML = filtered.map(([id, e]) => {
    const title = getTitle(e);
    const source = e.source || "unknown";
    const chapter = e.chapter_label || "?";
    const chapterTitle = e.chapter_title ? ` — ${e.chapter_title}` : "";
    const updated = formatUpdated(e.updated_at);
    const cover = e.cover_url || "";
    const genres = getGenresString(e);
    const status = normalizeStatus(e.status);

    const openUrl = e.link || "";
    const novelUrl = e.novel_url || "";

    const initials = title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join("");

    const coverHtml = cover
      ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)} cover" loading="lazy" />`
      : `<div class="fallback" aria-hidden="true">${escapeHtml(initials || "LN")}</div>`;

    return `
      <article class="card" data-id="${escapeHtml(id)}">
        <div class="cover">${coverHtml}</div>
        <div class="content">
          <div class="title-row">
            <h2 class="title" title="${escapeHtml(title)}">${escapeHtml(title)}</h2>
            <div class="small" title="Last updated">${escapeHtml(updated)}</div>
          </div>

          <div class="kv">
            <div class="line"><b>Source:</b> ${escapeHtml(source)}</div>
            <div class="line"><b>Chapter:</b> ${escapeHtml(chapter)}${escapeHtml(chapterTitle)}</div>
            ${genres ? `<div class="line"><b>Genres:</b> ${escapeHtml(genres)}</div>` : ""}
          </div>

          <div class="actions">
            <div class="status" aria-label="Status">
              <span>Status</span>
              <select class="statusSelect" aria-label="Set status">
                <option value="reading" ${status === "reading" ? "selected" : ""}>Reading</option>
                <option value="on-hold" ${status === "on-hold" ? "selected" : ""}>On hold</option>
                <option value="dropped" ${status === "dropped" ? "selected" : ""}>Dropped</option>
                <option value="finished" ${status === "finished" ? "selected" : ""}>Finished</option>
              </select>
            </div>

            <div class="btns">
              ${openUrl ? `<a class="btn" href="${escapeHtml(openUrl)}" target="_blank" rel="noreferrer">Open</a>` : ""}
              ${novelUrl ? `<a class="btn" href="${escapeHtml(novelUrl)}" target="_blank" rel="noreferrer">Novel page</a>` : ""}
              <button class="btn danger" type="button" data-action="delete">Delete</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function saveAllEntries() {
  await chrome.storage.local.set({ [STORAGE_KEY]: ALL_ENTRIES });
}

async function loadLibrary() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const lib = data?.[STORAGE_KEY];

  if (!lib || typeof lib !== "object") {
    ALL_ENTRIES = {};
    return;
  }

  ALL_ENTRIES = lib;

  const changed = ensureMigratedStatuses(ALL_ENTRIES);
  if (changed) await saveAllEntries();
}

async function loadAndRender() {
  await loadLibrary();
  const counts = computeCounts(ALL_ENTRIES);
  buildStatusPills(counts);
  render();
}

function wireUI() {
  const search = document.getElementById("search");
  const sort = document.getElementById("sortSelect");
  const pillWrap = document.getElementById("statusPills");
  const listEl = document.getElementById("list");

  if (search) {
    search.addEventListener("input", () => {
      UI_STATE.q = search.value || "";
      render();
    });
  }

  if (sort) {
    sort.addEventListener("change", () => {
      UI_STATE.sort = sort.value || "updated_desc";
      render();
    });
  }

  if (pillWrap) {
    pillWrap.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-status]");
      if (!btn) return;
      UI_STATE.status = btn.getAttribute("data-status") || "all";

      for (const b of pillWrap.querySelectorAll("button[data-status]")) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      }
      render();
    });
  }

  if (listEl) {
    listEl.addEventListener("change", async (ev) => {
      const sel = ev.target?.closest?.("select.statusSelect");
      if (!sel) return;

      const card = sel.closest("article.card");
      const id = card?.getAttribute("data-id");
      if (!id || !ALL_ENTRIES[id]) return;

      ALL_ENTRIES[id].status = normalizeStatus(sel.value);
      ALL_ENTRIES[id].updated_at = new Date().toISOString();
      await saveAllEntries();

      const counts = computeCounts(ALL_ENTRIES);
      buildStatusPills(counts);
      render();
    });

    listEl.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const card = btn.closest("article.card");
      const id = card?.getAttribute("data-id");
      if (!id) return;

      if (action === "delete") {
        const title = getTitle(ALL_ENTRIES[id] || {});
        if (!confirm(`Delete entry: ${title}?`)) return;

        delete ALL_ENTRIES[id];
        await saveAllEntries();

        const counts = computeCounts(ALL_ENTRIES);
        buildStatusPills(counts);
        render();
      }
    });
  }
}

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes[STORAGE_KEY]) return;
    loadAndRender();
  });
}

// ---------- Export / Import ----------
const EXPORT_META = {
  app: "lnTracker",
  version: 1
};

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function parseIsoTime(iso) {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function chooseByUpdatedAt(existing, incoming) {
  // Prefer the entry with the newer updated_at.
  // If either timestamp is invalid/missing, incoming wins (so imports apply).
  const te = parseIsoTime(existing?.updated_at);
  const ti = parseIsoTime(incoming?.updated_at);

  if (Number.isFinite(te) && Number.isFinite(ti)) {
    return ti >= te ? incoming : existing;
  }
  return incoming;
}

function mergeLibraries(existingObj, incomingObj) {
  const existing = (existingObj && typeof existingObj === "object") ? existingObj : {};
  const incoming = (incomingObj && typeof incomingObj === "object") ? incomingObj : {};

  const out = { ...existing };

  for (const [id, incEntry] of Object.entries(incoming)) {
    if (!incEntry || typeof incEntry !== "object") continue;

    const exEntry = out[id];
    if (!exEntry || typeof exEntry !== "object") {
      out[id] = incEntry;
      continue;
    }

    // Pick winner based on updated_at, but keep a few always-safe fields merged
    const winner = chooseByUpdatedAt(exEntry, incEntry);

    // Merge with slight preference to winner, but avoid losing arrays like genres
    out[id] = {
      ...exEntry,
      ...incEntry,
      ...winner,
      genres: Array.isArray(incEntry.genres)
        ? incEntry.genres
        : (Array.isArray(exEntry.genres) ? exEntry.genres : [])
    };
  }

  // Normalize statuses into the canonical set the UI expects
  ensureMigratedStatuses(out);

  return out;
}

async function exportLibraryToFile() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const lib = data?.[STORAGE_KEY];
  const library = (lib && typeof lib === "object" && !Array.isArray(lib)) ? lib : {};

  const payload = {
    ...EXPORT_META,
    exportedAt: new Date().toISOString(),
    data: library
  };

  const filename = `lnTracker-export-${new Date().toISOString().slice(0, 10)}.json`;
  downloadJson(filename, payload);
}

async function importLibraryFromPayload(payload, { mode = "merge" } = {}) {
  // Accept either wrapped export format or raw library object
  let incomingLibrary = null;

  if (payload && typeof payload === "object" && payload.app === "lnTracker" && payload.data) {
    incomingLibrary = payload.data;
  } else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    // raw object map import (power user)
    incomingLibrary = payload;
  }

  if (!incomingLibrary || typeof incomingLibrary !== "object" || Array.isArray(incomingLibrary)) {
    throw new Error("Import file format not recognized.");
  }

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const existing = stored?.[STORAGE_KEY];

  let next;
  if (mode === "replace") {
    next = incomingLibrary;
    ensureMigratedStatuses(next);
  } else {
    next = mergeLibraries(existing, incomingLibrary);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  ALL_ENTRIES = next; // keep UI in sync immediately

  const counts = computeCounts(ALL_ENTRIES);
  buildStatusPills(counts);
  render();
}

function wireExportImportUI() {
  const exportBtn = document.getElementById("exportBtn");
  const importInput = document.getElementById("importFile");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportLibraryToFile().catch(err => {
        console.warn("[LN Tracker] Export failed:", err);
        alert("Export failed.");
      });
    });
  }

  if (importInput) {
    importInput.addEventListener("change", async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const payload = JSON.parse(text);

        // Hold SHIFT while choosing file to REPLACE instead of merge
        const replace = !!ev.shiftKey;
        await importLibraryFromPayload(payload, { mode: replace ? "replace" : "merge" });

        alert(replace ? "Import complete (replaced library)." : "Import complete (merged).");
      } catch (err) {
        console.warn("[LN Tracker] Import failed:", err);
        alert(err?.message || "Import failed.");
      } finally {
        // Allow selecting the same file again
        ev.target.value = "";
      }
    });
  }
}

// Call this once on startup
wireExportImportUI();

wireUI();
loadAndRender();

// Toolbar collapse + persistence
(() => {
  const toolbar = document.getElementById("toolbar");
  const toggle = document.getElementById("toolbarToggle");
  if (!toolbar || !toggle) return;

  const KEY = "lnTracker.toolbarCollapsed";

  function setCollapsed(collapsed) {
    toolbar.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.textContent = collapsed ? "Expand" : "Collapse";
    try { localStorage.setItem(KEY, collapsed ? "1" : "0"); } catch {}
  }

  // restore state
  let collapsed = false;
  try { collapsed = localStorage.getItem(KEY) === "1"; } catch {}
  setCollapsed(collapsed);

  toggle.addEventListener("click", () => {
    setCollapsed(!toolbar.classList.contains("is-collapsed"));
  });
})();
