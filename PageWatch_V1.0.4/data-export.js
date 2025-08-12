// DOM elements
const refreshBtn = document.getElementById('refreshBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const statusContainer = document.getElementById('statusContainer');
const statsContainer = document.getElementById('statsContainer');
const urlsContainer = document.getElementById('urlsContainer');
const historyContainer = document.getElementById('historyContainer');
const snapshotsContainer = document.getElementById('snapshotsContainer');
const rawDataContainer = document.getElementById('rawDataContainer');

let currentData = null;

// Initialize
loadAllData();

// Event listeners
refreshBtn.addEventListener('click', loadAllData);
exportJsonBtn.addEventListener('click', exportAsJson);
exportCsvBtn.addEventListener('click', exportAsCsv);
clearHistoryBtn.addEventListener('click', clearHistory);
clearAllBtn.addEventListener('click', clearAllData);

// Load all data from storage
async function loadAllData() {
  try {
    showStatus('Loading data...', 'info');
    
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getAllData" }, resolve);
    });
    
    currentData = response.data || {};
    displayData(currentData);
    hideStatus();
  } catch (error) {
    showStatus('Failed to load data: ' + error.message, 'error');
  }
}

// Display all data sections
function displayData(data) {
  displayStats(data);
  displayUrls(data.monitoredUrls || []);
  displayHistory(data.history || {});
  displaySnapshots(data.snapshots || {});
  displayRawData(data);
}

// Display statistics
function displayStats(data) {
  const monitoredUrls = data.monitoredUrls || [];
  const history = data.history || {};
  const snapshots = data.snapshots || {};
  
  let totalChanges = 0;
  let lastChangeDate = null;
  
  for (const url in history) {
    totalChanges += history[url].length;
    for (const change of history[url]) {
      const changeDate = new Date(change.timestamp);
      if (!lastChangeDate || changeDate > lastChangeDate) {
        lastChangeDate = changeDate;
      }
    }
  }
  
  statsContainer.innerHTML = `
    <div class="stat-item">
      <div class="stat-number">${monitoredUrls.length}</div>
      <div class="stat-label">Monitored URLs</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${Object.keys(snapshots).length}</div>
      <div class="stat-label">Stored Snapshots</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${totalChanges}</div>
      <div class="stat-label">Total Changes</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${lastChangeDate ? lastChangeDate.toLocaleDateString() : 'None'}</div>
      <div class="stat-label">Last Change</div>
    </div>
  `;
}

// Display monitored URLs
function displayUrls(urls) {
  if (urls.length === 0) {
    urlsContainer.innerHTML = '<p style="color: #666;">No URLs are currently being monitored.</p>';
    return;
  }
  
  urlsContainer.innerHTML = urls.map((url, index) => `
    <div class="url-item">
      <div class="url-title">${escapeHtml(url)}</div>
      <div class="url-stats">Index: ${index + 1}</div>
    </div>
  `).join('');
}

// Display change history
function displayHistory(history) {
  const historyEntries = Object.keys(history);
  
  if (historyEntries.length === 0) {
    historyContainer.innerHTML = '<p style="color: #666;">No changes have been detected yet.</p>';
    return;
  }
  
  historyContainer.innerHTML = historyEntries.map(url => {
    const changes = history[url];
    return `
      <div class="history-item">
        <div class="history-url">${escapeHtml(url)}</div>
        <div class="history-changes">
          <strong>${changes.length} changes detected:</strong>
          ${changes.map(change => `
            <div class="change-entry">
              <span class="change-time">${new Date(change.timestamp).toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Display snapshots
function displaySnapshots(snapshots) {
  const snapshotUrls = Object.keys(snapshots);
  
  if (snapshotUrls.length === 0) {
    snapshotsContainer.innerHTML = '<p style="color: #666;">No snapshots stored.</p>';
    return;
  }
  
  snapshotsContainer.innerHTML = snapshotUrls.map(url => {
    const snapshot = snapshots[url];
    const contentLength = snapshot.content ? snapshot.content.length : 0;
    
    return `
      <div class="url-item">
        <div class="url-title">${escapeHtml(url)}</div>
        <div class="url-stats">
          Hash: ${snapshot.hash || 'N/A'} | 
          Content Length: ${contentLength.toLocaleString()} characters
        </div>
      </div>
    `;
  }).join('');
}

// Display raw data
function displayRawData(data) {
  // Create a cleaned version without large content for display
  const cleanedData = JSON.parse(JSON.stringify(data));
  
  // Truncate large content for display
  if (cleanedData.snapshots) {
    for (const url in cleanedData.snapshots) {
      if (cleanedData.snapshots[url].content) {
        const content = cleanedData.snapshots[url].content;
        if (content.length > 500) {
          cleanedData.snapshots[url].content = content.substring(0, 500) + '... [TRUNCATED]';
        }
      }
    }
  }
  
  if (cleanedData.history) {
    for (const url in cleanedData.history) {
      for (const change of cleanedData.history[url]) {
        if (change.oldContent && change.oldContent.length > 200) {
          change.oldContent = change.oldContent.substring(0, 200) + '... [TRUNCATED]';
        }
        if (change.newContent && change.newContent.length > 200) {
          change.newContent = change.newContent.substring(0, 200) + '... [TRUNCATED]';
        }
      }
    }
  }
  
  rawDataContainer.textContent = JSON.stringify(cleanedData, null, 2);
}

// Export as JSON
function exportAsJson() {
  if (!currentData) {
    showStatus('No data to export', 'error');
    return;
  }
  
  const dataStr = JSON.stringify(currentData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `page-monitor-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('Data exported successfully!', 'success');
}

// Export history as CSV
function exportAsCsv() {
  if (!currentData || !currentData.history) {
    showStatus('No history data to export', 'error');
    return;
  }
  
  const history = currentData.history;
  let csvContent = 'URL,Timestamp,Change Type,Content Length (Old),Content Length (New)\n';
  
  for (const url in history) {
    for (const change of history[url]) {
      const oldLength = change.oldContent ? change.oldContent.length : 0;
      const newLength = change.newContent ? change.newContent.length : 0;
      
      csvContent += `"${url.replace(/"/g, '""')}","${change.timestamp}","Content Change","${oldLength}","${newLength}"\n`;
    }
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `page-monitor-history-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('History exported as CSV successfully!', 'success');
}

// Clear history
function clearHistory() {
  if (!confirm('Are you sure you want to clear all change history? This cannot be undone.')) {
    return;
  }
  
  chrome.runtime.sendMessage({ type: "clearHistory" }, (response) => {
    if (response && response.success) {
      showStatus('History cleared successfully!', 'success');
      loadAllData();
    } else {
      showStatus('Failed to clear history', 'error');
    }
  });
}

// Clear all data
function clearAllData() {
  if (!confirm('Are you sure you want to clear ALL stored data? This will remove URLs, snapshots, and history. This cannot be undone.')) {
    return;
  }
  
  chrome.runtime.sendMessage({ type: "clearAllData" }, (response) => {
    if (response && response.success) {
      showStatus('All data cleared successfully!', 'success');
      loadAllData();
    } else {
      showStatus('Failed to clear data', 'error');
    }
  });
}

// Show status message
function showStatus(message, type = 'info') {
  statusContainer.innerHTML = `<div class="status ${type}">${escapeHtml(message)}</div>`;
  
  if (type === 'success') {
    setTimeout(hideStatus, 3000);
  }
}

// Hide status message
function hideStatus() {
  statusContainer.innerHTML = '';
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}