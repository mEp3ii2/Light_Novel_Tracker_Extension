// content/sites/novelfull.js
(() => {
  function parseFromUrl(urlStr) {
    let url;
    try {
      url = new URL(urlStr);
    } catch {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const novelSlug = parts[0];
    const chapterPart = parts[1];

    if (!/^chapter-.*\.html$/i.test(chapterPart)) return null;

    const base = chapterPart.replace(/\.html$/i, "");
    const m = base.match(/^chapter-(.+)$/i);

    let chapterLabel = null;
    if (m) {
      const after = m[1];
      const bits = after.split("-");
      if (bits.length >= 1 && /^\d+(\.\d+)?$/.test(bits[0])) {
        chapterLabel = bits[0];
        if (bits[1]?.toLowerCase() === "part" && bits[2]) {
          chapterLabel = `${bits[0]} part ${bits[2]}`;
        }
      } else {
        chapterLabel = after;
      }
    }

    if (!chapterLabel) chapterLabel = chapterPart;

    return { novelSlug, chapterLabel, url: url.toString() };
  }

  function extractFromDom() {
    const novelAnchor = document.querySelector("a.truyen-title");
    const chapterAnchor = document.querySelector("a.chapter-title");

    const novelName = novelAnchor?.textContent?.trim() || null;

    const chapterText =
      chapterAnchor?.getAttribute("title")?.trim() ||
      chapterAnchor?.querySelector(".chapter-text")?.childNodes?.[0]?.textContent?.trim() ||
      chapterAnchor?.querySelector(".chapter-text")?.textContent?.trim() ||
      chapterAnchor?.textContent?.trim() ||
      null;

    let chapterLabel = null;
    let chapterTitle = null;

    if (chapterText) {
      const cleaned = chapterText.replace(/\s+/g, " ").trim();

      const m = cleaned.match(/^chapter\s+(.+?)(?::\s*(.*))?$/i);
      if (m) {
        chapterLabel = (m[1] || "").trim() || null;
        chapterTitle = (m[2] || "").trim() || null;
      } else {
        chapterTitle = cleaned;
      }

    
      if (chapterTitle && /read .* online for free/i.test(chapterTitle)) {
        chapterTitle = chapterTitle.replace(/read .* online for free/i, "").trim() || null;
      }
      if (chapterLabel && /read .* online for free/i.test(chapterLabel)) {
        chapterLabel = chapterLabel.replace(/read .* online for free/i, "").trim() || null;
      }
    }

    const novelUrl = novelAnchor?.getAttribute("href")
      ? new URL(novelAnchor.getAttribute("href"), location.origin).toString()
      : null;

    return { novelName, novelUrl, chapterLabel, chapterTitle };
  }

  async function fetchNovelMeta(novelUrl, expectedTitle) {
    const resp = await fetch(novelUrl, { credentials: "include" });
    if (!resp.ok) throw new Error(`Novel page fetch failed: ${resp.status}`);

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    
    let coverEl = null;
    if (expectedTitle) {
      coverEl = Array.from(doc.querySelectorAll("img[alt][src]"))
        .find(img => (img.getAttribute("alt") || "").trim() === expectedTitle) || null;
    }
    if (!coverEl) {
      coverEl =
        doc.querySelector('img[src^="/uploads/"][alt], img[src^="/uploads/"]') ||
        doc.querySelector('img[src*="/uploads/"]') ||
        doc.querySelector('img[src*="thumb"]');
    }

    const coverSrc = coverEl?.getAttribute("src") || null;
    const coverUrl = coverSrc ? new URL(coverSrc, novelUrl).toString() : null;

    
    const infoRows = Array.from(doc.querySelectorAll(".info > div"));
    const genreRow = infoRows.find(row => {
      const h3 = row.querySelector("h3");
      return h3 && h3.textContent.trim().toLowerCase() === "genre:";
    });

    const genres = genreRow
      ? Array.from(genreRow.querySelectorAll("a"))
          .map(a => a.textContent.trim())
          .filter(Boolean)
      : [];

    return { coverUrl, genres };
  }

  async function handler() {
    const parsed = parseFromUrl(location.href);
    if (!parsed) return;

    const { novelName, novelUrl, chapterLabel, chapterTitle } = extractFromDom();

    
    let coverUrl = null;
    let genres = null;

    if (novelUrl) {
      const existing = await window.LNTracker.getLibraryEntry("novelfull", parsed.novelSlug);
      const hasCover = !!existing?.cover_url;
      const hasGenres = Array.isArray(existing?.genres) && existing.genres.length > 0;

      if (!hasCover || !hasGenres) {
        try {
          const meta = await fetchNovelMeta(novelUrl, novelName);
          coverUrl = meta.coverUrl;
          genres = meta.genres;
        } catch (err) {
          console.warn("[LN Tracker] NovelFull meta fetch failed:", err);
        }
      }
    }

    await window.LNTracker.upsertLibraryEntry({
      source: "novelfull",
      novel_key: parsed.novelSlug,
      novel_name: novelName,

      novel_url: novelUrl,
      cover_url: coverUrl,
      genres,

      chapter_label: chapterLabel || parsed.chapterLabel,
      chapter_title: chapterTitle,
      link: parsed.url
    });
  }

  window.LNTracker.registerSite({
    id: "novelfull",
    matchesHost: (host) => host === "novelfull.net" || host === "novelfull.com",
    handler
  });
})();
