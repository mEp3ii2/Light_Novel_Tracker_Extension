// content/sites/ranobes.js
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

    const seriesSegment = parts[0];
    const chapterFile = parts[1];

    const seriesIdMatch = seriesSegment.match(/-(\d+)$/);
    const chapterIdMatch = chapterFile.match(/^(\d+)\.html$/);

    if (!seriesIdMatch || !chapterIdMatch) return null;

    return {
      novelKey: seriesIdMatch[1],
      chapterId: chapterIdMatch[1],
      url: url.toString()
    };
  }

  function extractFromTitle() {
    const t = (document.title || "").trim();
    if (!t) return { novelName: null, chapterLabel: null, chapterTitle: null };

    const [left, right] = t.split("|").map(s => s.trim());
    const novelName = right || null;

    let chapterLabel = null;
    let chapterTitle = null;

    if (left) {
      const m = left.match(/^chapter\s+(.+?)(?::\s*(.*))?$/i);
      if (m) {
        chapterLabel = (m[1] || "").trim() || null;
        chapterTitle = (m[2] || "").trim() || null;
      } else {
        chapterTitle = left;
      }
    }

    return { novelName, chapterLabel, chapterTitle };
  }

  function getNovelUrlFromSpeedbar() {
    const speedbar = document.querySelector("#dle-speedbar");
    if (!speedbar) return null;

    const links = speedbar.querySelectorAll("a[href]");
    if (!links || links.length < 2) return null;

    const href = links[1].getAttribute("href");
    if (!href) return null;

    return new URL(href, location.origin).toString();
  }

  function extractCoverFromNovelDoc(doc, novelUrl) {
    
    const fig = doc.querySelector(".poster figure.cover");
    const style = fig?.getAttribute("style") || "";
    const m = style.match(/background-image\s*:\s*url\(([^)]+)\)/i);
    if (m && m[1]) {
      const raw = m[1].trim().replace(/^['"]|['"]$/g, "");
      if (raw) return new URL(raw, novelUrl).toString();
    }

    const a = doc.querySelector('.poster a.highslide[href]');
    if (a?.getAttribute("href")) {
      return new URL(a.getAttribute("href"), novelUrl).toString();
    }
  
    const img = doc.querySelector(".poster img[src]");
    if (img?.getAttribute("src")) {
      return new URL(img.getAttribute("src"), novelUrl).toString();
    }

    return null;
  }

  function extractGenresFromNovelDoc(doc) {
  
    const blocks = Array.from(doc.querySelectorAll(".r-fullstory-s2 .mcollapse-block"));

    const genreBlock = blocks.find(block => {
      const h4 = block.querySelector(".mcollapse-title h4.title");
      return h4 && h4.textContent.trim().toLowerCase() === "genres";
    });

    if (!genreBlock) return [];

    const linksDiv = genreBlock.querySelector(".mcollapse-cont .links");
    if (!linksDiv) return [];

    return Array.from(linksDiv.querySelectorAll("a"))
      .map(a => a.textContent.trim())
      .filter(Boolean);
  }

  async function fetchNovelMeta(novelUrl) {
    const resp = await fetch(novelUrl, { credentials: "include" });
    if (!resp.ok) throw new Error(`Novel page fetch failed: ${resp.status}`);

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const coverUrl = extractCoverFromNovelDoc(doc, novelUrl);
    const genres = extractGenresFromNovelDoc(doc);

    return { coverUrl, genres };
  }

  async function handler() {
    const parsed = parseFromUrl(location.href);
    if (!parsed) return;

    const { novelName, chapterLabel, chapterTitle } = extractFromTitle();

    const novelUrl = getNovelUrlFromSpeedbar();

    let coverUrl = null;
    let genres = null;

    if (novelUrl) {
      const existing = await window.LNTracker.getLibraryEntry("ranobes", parsed.novelKey);
      const hasCover = !!existing?.cover_url;
      const hasGenres = Array.isArray(existing?.genres) && existing.genres.length > 0;

      if (!hasCover || !hasGenres) {
        try {
          const meta = await fetchNovelMeta(novelUrl);
          coverUrl = meta.coverUrl;
          genres = meta.genres;
        } catch (err) {
          console.warn("[LN Tracker] Ranobes meta fetch failed:", err);
        }
      }
    }

    await window.LNTracker.upsertLibraryEntry({
      source: "ranobes",
      novel_key: parsed.novelKey,
      novel_name: novelName,

      novel_url: novelUrl,
      cover_url: coverUrl,
      genres,

      chapter_label: chapterLabel || parsed.chapterId, 
      chapter_title: chapterTitle,
      link: parsed.url
    });
  }

  window.LNTracker.registerSite({
    id: "ranobes",
    matchesHost: (host) => host === "ranobes.top" || host === "ranobes.net",
    handler
  });
})();
