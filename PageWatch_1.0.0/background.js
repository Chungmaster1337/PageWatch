let monitoredUrls = [];
let tabMap = {};

function loadUrls(callback) {
  chrome.storage.local.get(["monitoredUrls"], (result) => {
    monitoredUrls = result.monitoredUrls || [];
    if (callback) callback();
  });
}

function openTabAndInject(url) {
  chrome.tabs.create({ url: url, active: false }, (tab) => {
    tabMap[tab.id] = url;
    setTimeout(() => chrome.tabs.remove(tab.id), 15000);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  loadUrls(() => {
    chrome.alarms.create("hourlyCheck", { periodInMinutes: 60 });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "hourlyCheck") {
    loadUrls(() => {
      monitoredUrls.forEach(openTabAndInject);
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "pageContent") {
    const url = message.url;
    const html = message.html;
    chrome.storage.local.get(["snapshots", "history"], (result) => {
      const snapshots = result.snapshots || {};
      const history = result.history || {};
      const oldHtml = snapshots[url];
      if (!oldHtml) {
        snapshots[url] = html;
      } else if (oldHtml !== html) {
        const timestamp = new Date().toISOString();
        if (!history[url]) history[url] = [];
        history[url].push({ timestamp, oldHtml, newHtml: html });
        snapshots[url] = html;
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon.png",
          title: "Page Change Detected",
          message: `Change detected on ${url}`
        });
      }
      chrome.storage.local.set({ snapshots, history });
    });
  } else if (message.type === "runNow") {
    loadUrls(() => {
      monitoredUrls.forEach(openTabAndInject);
    });
  }
});