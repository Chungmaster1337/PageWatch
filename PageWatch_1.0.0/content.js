chrome.runtime.sendMessage({
  type: "pageContent",
  url: window.location.href,
  html: document.documentElement.innerHTML
});