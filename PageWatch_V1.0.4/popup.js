const urlBox = document.getElementById("urlList");
const saveBtn = document.getElementById("saveBtn");
const runNowBtn = document.getElementById("runNowBtn");
const exportBtn = document.getElementById("exportBtn");
const reportBtn = document.getElementById("reportBtn");
const status = document.getElementById("status");
const urlCount = document.getElementById("urlCount");
const historyList = document.getElementById("historyList");

// Load saved URLs
chrome.storage.local.get(["monitoredUrls"], (result) => {
  const urls = result.monitoredUrls || [];
  urlBox.value = urls.join("\n");
  updateUrlCount();
});

// Update URL count display
function updateUrlCount() {
  const urls = urlBox.value.split("\n").map(u => u.trim()).filter(u => u);
  urlCount.textContent = `${urls.length} URLs configured`;
}

// Show status message
function showStatus(message, type = 'success') {
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// Validate URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Save URLs
saveBtn.onclick = () => {
  const urls = urlBox.value.split("\n")
    .map(u => u.trim())
    .filter(u => u);
  
  // Validate URLs
  const invalidUrls = urls.filter(url => !isValidUrl(url));
  if (invalidUrls.length > 0) {
    showStatus(`Invalid URLs found: ${invalidUrls.join(', ')}`, 'error');
    return;
  }
  
  chrome.storage.local.set({ monitoredUrls: urls }, () => {
    showStatus(`Saved ${urls.length} URLs successfully!`);
    updateUrlCount();
    loadHistory(); // Refresh history
  });
};

// Run check now
runNowBtn.onclick = () => {
  runNowBtn.disabled = true;
  runNowBtn.textContent = 'Checking...';
  
  chrome.runtime.sendMessage({ type: "runNow" }, (response) => {
    runNowBtn.disabled = false;
    runNowBtn.textContent = 'Check Now';
    
    if (response && response.success) {
      showStatus('Check initiated successfully!');
      // Refresh history after a short delay
      setTimeout(loadHistory, 2000);
    } else {
      showStatus('Failed to initiate check', 'error');
    }
  });
};

// Open data export window
exportBtn.onclick = () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('data-export.html'),
    active: true
  });
};

// Open search and reports window
reportBtn.onclick = () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('search-reports.html'),
    active: true
  });
};

// Update count when typing
urlBox.addEventListener('input', updateUrlCount);

// Load and display recent changes
function loadHistory() {
  chrome.runtime.sendMessage({ type: "getHistory" }, (response) => {
    const history = response.history || {};
    displayHistory(history);
  });
}

function displayHistory(history) {
  const historyEntries = [];
  
  // Flatten history into sortable entries
  for (const [url, changes] of Object.entries(history)) {
    for (const change of changes.slice(-3)) { // Show last 3 changes per URL
      historyEntries.push({ url, ...change });
    }
  }
  
  // Sort by timestamp (newest first)
  historyEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (historyEntries.length === 0) {
    historyList.innerHTML = '<div style="color: #666; font-size: 12px;">No changes detected yet</div>';
    return;
  }
  
  // Display recent changes (limit to 5 most recent)
  const recentEntries = historyEntries.slice(0, 5);
  historyList.innerHTML = recentEntries.map(entry => {
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    const shortUrl = entry.url.length > 40 ? entry.url.substring(0, 37) + '...' : entry.url;
    
    return `
      <div class="history-item">
        <div class="history-url">${shortUrl}</div>
        <div class="history-time">${timeStr}</div>
      </div>
    `;
  }).join('');
}

// Load history on popup open
loadHistory();