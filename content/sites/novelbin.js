// content/sites/novelbin.js
(() => {
  function normalizePathname(pathname) {
    return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  }

  function parseFromUrl(urlStr) {
    let url;
    try {
      url = new URL(urlStr);
    } catch {
      return null;
    }

    const parts = normalizePathname(url.pathname).split("/").filter(Boolean);

    // OLD assumption was: /b/<novel-slug>/<chapter-slug>
    // Newer NovelBin commonly: /b/<novel-slug>/c/<chapter-slug>
    // Support both:
    if (parts.length < 3) return null;
    if (parts[0] !== "b") return null;

    const novelSlug = parts[1];
    if (!novelSlug) return null;

    // Determine chapter part:
    // - If "c" exists, use everything after it
    // - Else use everything after /b/<novelSlug>/
    const cIndex = parts.indexOf("c");
    const chapterParts = cIndex !== -1 ? parts.slice(cIndex + 1) : parts.slice(2);
    if (!chapterParts.length) return null;

    const chapterSlug = chapterParts.join("/");

    // Fallback chapter label from URL slug
    let chapterLabel = null;
    const m = chapterSlug.match(/^chapter-([^/]+)/i);
    if (m) {
      const after = m[1];
      const bits = after.split("-");
      if (bits.length >= 1 && /^\d+(\.\d+)?$/.test(bits[0])) {
        chapterLabel = bits[0];
        if (bits[1]?.toLowerCase() === "part" && bits[2]) {
          chapterLabel = `${bits[0]} part ${bits[2]}`;
        }
      }
    }
    if (!chapterLabel) chapterLabel = chapterSlug;

    return { novelSlug, chapterLabel, url: url.toString() };
  }

  function extractFromDom() {
    const novelAnchor = document.querySelector("a.novel-title");
    const chapterAnchor = document.querySelector("a.chr-title");

    const novelName = novelAnchor?.textContent?.trim() || null;

    const novelUrl = novelAnchor?.getAttribute("href")
      ? new URL(novelAnchor.getAttribute("href"), location.origin).toString()
      : null;

    const chapterText =
      chapterAnchor?.querySelector(".chr-text")?.textContent?.trim() ||
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
    }

    return { novelName, novelUrl, chapterLabel, chapterTitle };
  }

  async function fetchNovelMeta(novelUrl, expectedTitle) {
    const resp = await fetch(novelUrl, { credentials: "include" });
    if (!resp.ok) throw new Error(`Novel page fetch failed: ${resp.status}`);

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Cover:
    let coverUrl = null;

    const bookDiv = doc.querySelector("div.book");
    const img = bookDiv?.querySelector("img");
    if (img) {
      const src =
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("src");
      if (src){
        const absolute = new URL(src, novelUrl).toString();
        const lookslikeCover = 
          /images\.novelbin\.com\/novel\//i.test(absolute) ||
          /\/novel\//i.test(absolute);
        if (lookslikeCover){
          coverUrl = absolute;
        }
      }  
    }
    // Genres:
    // <ul class="info info-meta">
    //   <li><h3>Genre:</h3> <a>Fantasy</a>, <a>Action</a> ...</li>
    // </ul>
    const genreLi = Array.from(doc.querySelectorAll("ul.info.info-meta > li")).find(li => {
      const h3 = li.querySelector("h3");
      return h3 && h3.textContent.trim().toLowerCase() === "genre:";
    });

    const genres = genreLi
      ? Array.from(genreLi.querySelectorAll("a"))
          .map(a => a.textContent.trim())
          .filter(Boolean)
      : [];

    return { coverUrl, genres };
  }

  async function handler() {
    const parsed = parseFromUrl(location.href);
    if (!parsed) return;

    const { novelName, novelUrl, chapterLabel, chapterTitle } = extractFromDom();

    // Only fetch novel metadata if not already stored
    let coverUrl = null;
    let genres = null;

    if (novelUrl) {
      const existing = await window.LNTracker.getLibraryEntry("novelbin", parsed.novelSlug);
      const hasCover = !!existing?.cover_url;
      const hasGenres = Array.isArray(existing?.genres) && existing.genres.length > 0;

      if (!hasCover || !hasGenres) {
        try {
          const meta = await fetchNovelMeta(novelUrl, novelName);
          coverUrl = meta.coverUrl;
          genres = meta.genres;
        } catch (err) {
          console.warn("[LN Tracker] NovelBin meta fetch failed:", err);
        }
      }
    }

    await window.LNTracker.upsertLibraryEntry({
      source: "novelbin",
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
    id: "novelbin",
    matchesHost: (host) => host === "novelbin.com",
    handler
  });
})();
