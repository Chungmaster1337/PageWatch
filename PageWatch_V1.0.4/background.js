let monitoredUrls = [];
let pendingNotifications = {};

// Utility function to clean HTML content for better change detection
function cleanHtml(html) {
  // Remove script tags, style tags, and common dynamic elements
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--.*?-->/gs, '')
    .replace(/\s+/g, ' ')
    .replace(/timestamp="\d+"/g, '')
    .replace(/data-time="\d+"/g, '')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '[TIMESTAMP]')
    .trim();
}

// Generate hash for content comparison
function generateHash(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

// Load monitored URLs from storage
function loadUrls(callback) {
  chrome.storage.local.get(["monitoredUrls"], (result) => {
    monitoredUrls = result.monitoredUrls || [];
    if (callback) callback();
  });
}

// Create tab and inject content script for URL checking
function checkUrl(url) {
  chrome.tabs.create({ url: url, active: false }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error(`Failed to create tab for ${url}:`, chrome.runtime.lastError);
      return;
    }
    
    // Set timeout to close tab
    setTimeout(() => {
      chrome.tabs.remove(tab.id, () => {
        // Ignore errors if tab was already closed
        if (chrome.runtime.lastError) {
          console.log(`Tab ${tab.id} was already closed`);
        }
      });
    }, 10000); // 10 seconds should be enough for most pages
    
    // Wait for page to load, then inject script
    chrome.tabs.onUpdated.addListener(function tabUpdatedListener(tabId, changeInfo, tab) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
        
        // Inject content script to get page content
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Send page content back to background script
            chrome.runtime.sendMessage({
              type: "pageContent",
              url: window.location.href,
              html: document.documentElement.innerHTML
            });
          }
        }).catch(error => {
          console.error(`Failed to inject script into ${url}:`, error);
        });
      }
    });
  });
}

// Check all monitored URLs
function checkAllUrls() {
  loadUrls(() => {
    monitoredUrls.forEach((url, index) => {
      // Stagger the tab creation to avoid overwhelming the browser
      setTimeout(() => checkUrl(url), index * 2000);
    });
  });
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  loadUrls(() => {
    chrome.alarms.create("quarterHourlyCheck", { periodInMinutes: 15 });
  });
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "quarterHourlyCheck") {
    checkAllUrls();
  }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  const notification = pendingNotifications[notificationId];
  if (!notification) return;
  
  // Clear timeout
  clearTimeout(notification.timeoutId);
  
  if (buttonIndex === 0) {
    // User clicked "Yes - View Diff"
    chrome.tabs.create({
      url: chrome.runtime.getURL(`diff.html?url=${encodeURIComponent(notification.url)}&timestamp=${encodeURIComponent(notification.timestamp)}`)
    });
  }
  
  // Clean up
  delete pendingNotifications[notificationId];
  chrome.notifications.clear(notificationId);
});

// Handle notification clicks (clicking the notification itself)
chrome.notifications.onClicked.addListener((notificationId) => {
  const notification = pendingNotifications[notificationId];
  if (!notification) return;
  
  // Treat as "Yes" click
  clearTimeout(notification.timeoutId);
  chrome.tabs.create({
    url: chrome.runtime.getURL(`diff.html?url=${encodeURIComponent(notification.url)}&timestamp=${encodeURIComponent(notification.timestamp)}`)
  });
  
  delete pendingNotifications[notificationId];
  chrome.notifications.clear(notificationId);
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "pageContent") {
    const url = message.url;
    const html = message.html;
    
    if (!html) {
      console.error(`No HTML content received for ${url}`);
      return;
    }
    
    const cleanedHtml = cleanHtml(html);
    const currentHash = generateHash(cleanedHtml);
    
    chrome.storage.local.get(["snapshots", "history"], (result) => {
      const snapshots = result.snapshots || {};
      const history = result.history || {};
      
      const storedSnapshot = snapshots[url];
      const storedHash = storedSnapshot?.hash;
      
      if (!storedHash) {
        // First time monitoring this URL
        snapshots[url] = { hash: currentHash, content: cleanedHtml };
        chrome.storage.local.set({ snapshots });
      } else if (storedHash !== currentHash) {
        // Change detected
        const timestamp = new Date().toISOString();
        
        if (!history[url]) history[url] = [];
        history[url].push({
          timestamp,
          oldContent: storedSnapshot.content,
          newContent: cleanedHtml
        });
        
        // Keep only last 10 changes to prevent storage bloat
        if (history[url].length > 10) {
          history[url] = history[url].slice(-10);
        }
        
        // Update snapshot
        snapshots[url] = { hash: currentHash, content: cleanedHtml };
        
        // Save to storage
        chrome.storage.local.set({ snapshots, history });
        
        // Show notification with buttons
        const notificationId = `change-${Date.now()}`;
        pendingNotifications[notificationId] = {
          url,
          timestamp,
          timeoutId: setTimeout(() => {
            // Auto-dismiss after 10 minutes
            delete pendingNotifications[notificationId];
            chrome.notifications.clear(notificationId);
          }, 10 * 60 * 1000)
        };
        
        chrome.notifications.create(notificationId, {
          type: "basic",
          iconUrl: "icons/icon.png",
          title: "Page Change Detected",
          message: `The URL "${url}" has changed. Would you like to view the diff?`,
          buttons: [
            { title: "Yes - View Diff" },
            { title: "No - Dismiss" }
          ],
          requireInteraction: true
        });
      }
    });
  } else if (message.type === "runNow") {
    checkAllUrls();
    sendResponse({ success: true });
  } else if (message.type === "getHistory") {
    chrome.storage.local.get(["history"], (result) => {
      sendResponse({ history: result.history || {} });
    });
    return true; // Indicates async response
  } else if (message.type === "getAllData") {
    chrome.storage.local.get(null, (result) => {
      sendResponse({ data: result });
    });
    return true; // Indicates async response
  } else if (message.type === "clearAllData") {
    chrome.storage.local.clear(() => {
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  } else if (message.type === "clearHistory") {
    chrome.storage.local.remove(["history"], () => {
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  }
});