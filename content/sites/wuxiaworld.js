// content/sites/wuxiaworld.js
(() => {
  function hasAllClasses(el, classes) {
    if (!el || !el.classList) return false;
    for (const c of classes) {
      if (!el.classList.contains(c)) return false;
    }
    return true;
  }

  function findFirstByClasses(tagName, classes) {
    const nodes = document.getElementsByTagName(tagName);
    for (const el of nodes) {
      if (hasAllClasses(el, classes)) return el;
    }
    return null;
  }

  function extractChapterParts(chapterText) {
    if (!chapterText) return { chapterLabel: null, chapterTitle: null };

    const cleaned = chapterText.replace(/\s+/g, " ").trim();

    // "Chapter 0", "Chapter 53: Title", "Ch. 53 - Title"
    let m = cleaned.match(/^(chapter|ch\.?)\s+(.+?)(?::|-)\s*(.*)$/i);
    if (m) {
      return {
        chapterLabel: (m[2] || "").trim() || null,
        chapterTitle: (m[3] || "").trim() || null
      };
    }

    m = cleaned.match(/^(chapter|ch\.?)\s+(.+)$/i);
    if (m) {
      return { chapterLabel: (m[2] || "").trim() || null, chapterTitle: null };
    }
    return { chapterLabel: null, chapterTitle: cleaned };
  }

  function parseFromUrl(urlStr) {
    let url;
    try {
      url = new URL(urlStr);
    } catch {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);

    // Expected: ["novel", "<novelSlug>", "<chapterSlug>"]
    if (parts.length < 3) return null;
    if (parts[0].toLowerCase() !== "novel") return null;

    const novelSlug = parts[1];
    const chapterSlug = parts[2];
    let chapterLabelFromUrl = null;
    const m = chapterSlug.match(/chapter-([0-9]+(?:\.[0-9]+)?)/i);
    if (m) chapterLabelFromUrl = m[1];

    return {
      novelSlug,
      chapterSlug,
      chapterLabelFromUrl,
      url: url.toString()
    };
  }

  function extractFromDom() {
    const chapterH4 = findFirstByClasses("h4", [
      "font-set-b18",
      "flex",
      "items-start",
      "!font-sans",
      "sm:font-set-b26"
    ]);

    const novelP = findFirstByClasses("p", [
      "MuiTypography-root",
      "MuiTypography-body1",
      "text-[13px]",
      "text-gray-t0",
      "sm:text-[15px]",
      "ww-1ne0po4"
    ]);

    const chapterText = chapterH4?.textContent?.trim() || null;
    const novelName = novelP?.textContent?.trim() || null;

    const { chapterLabel, chapterTitle } = extractChapterParts(chapterText);

    return { novelName, chapterLabel, chapterTitle };
  }

  function deriveNovelUrlFromChapterUrl(novelSlug) {
    if (!novelSlug) return null;
    return new URL(`/novel/${novelSlug}`, location.origin).toString();
  }

  function extractCoverFromChapterPage(expectedTitle) {   
    const imgs = Array.from(
      document.querySelectorAll('img[src*="cdn.wuxiaworld.com/images/covers/"]')
    );

    if (!imgs.length) return null;

    if (expectedTitle) {
      const exact = imgs.find(
        i => (i.getAttribute("alt") || "").trim() === expectedTitle
      );
      const src = exact?.getAttribute("src");
      if (src) return src;
    }

    return imgs[0].getAttribute("src") || null;
  }

  function extractGenresFromNovelDoc(doc) {
    
    const genreLinks = Array.from(doc.querySelectorAll('a[href*="/novels/?genre="]'));

    const genres = genreLinks
      .map(a => a.textContent.trim())
      .filter(Boolean);

    
    const seen = new Set();
    return genres.filter(g => (seen.has(g) ? false : (seen.add(g), true)));
  }

  async function fetchNovelGenres(novelUrl) {
    const resp = await fetch(novelUrl, { credentials: "include" });
    if (!resp.ok) throw new Error(`Novel page fetch failed: ${resp.status}`);

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    return extractGenresFromNovelDoc(doc);
  }

  async function handler() {
    const parsed = parseFromUrl(location.href);
    if (!parsed) return;

    const { novelName, chapterLabel, chapterTitle } = extractFromDom();

    
    const novelKey = parsed.novelSlug;

    
    const finalChapterLabel = chapterLabel || parsed.chapterLabelFromUrl || parsed.chapterSlug;
    if (!finalChapterLabel) return;

    
    const novelUrl = deriveNovelUrlFromChapterUrl(parsed.novelSlug);

    
    let coverUrl = extractCoverFromChapterPage(novelName);

    
    let genres = null;
    try {
      const existing = await window.LNTracker.getLibraryEntry("wuxiaworld", novelKey);
      const hasGenres = Array.isArray(existing?.genres) && existing.genres.length > 0;
      const hasCoverStored = !!existing?.cover_url;

      if (!coverUrl && hasCoverStored) coverUrl = existing.cover_url;

      if (!hasGenres && novelUrl) {
        genres = await fetchNovelGenres(novelUrl);
      }
    } catch (err) {
      console.warn("[LN Tracker] WuxiaWorld meta fetch failed:", err);
    }

    await window.LNTracker.upsertLibraryEntry({
      source: "wuxiaworld",
      novel_key: novelKey,
      novel_name: novelName,

      // NEW FIELDS
      novel_url: novelUrl,
      cover_url: coverUrl,
      genres,

      chapter_label: finalChapterLabel,
      chapter_title: chapterTitle,
      link: parsed.url
    });
  }

  window.LNTracker.registerSite({
    id: "wuxiaworld",
    matchesHost: (host) => host === "wuxiaworld.com",
    handler
  });
})();
