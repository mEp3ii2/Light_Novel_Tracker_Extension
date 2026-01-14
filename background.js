chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("library.html");
  await chrome.tabs.create({ url });
});
