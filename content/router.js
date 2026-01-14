// content/router.js
(() => {
  function run() {
    const found = window.LNTracker.findHandlerForHost(location.hostname);
    if (!found) return;

    found.handler().catch(err => console.warn("[LN Tracker] Handler error:", err));
  }

  // Run once
  run();

  let lastHref = location.href;
  const obs = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      run();
    }
  });

  obs.observe(document.documentElement, { subtree: true, childList: true });
})();
