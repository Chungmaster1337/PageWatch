// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const targetUrl = urlParams.get('url');
const timestamp = urlParams.get('timestamp');

let showRawHtml = false;
let currentData = null;

// DOM elements
const urlDisplay = document.getElementById('urlDisplay');
const timestampDisplay = document.getElementById('timestampDisplay');
const oldContent = document.getElementById('oldContent');
const newContent = document.getElementById('newContent');
const refreshBtn = document.getElementById('refreshBtn');
const rawViewBtn = document.getElementById('rawViewBtn');
const closeBtn = document.getElementById('closeBtn');

// Initialize
if (targetUrl && timestamp) {
  urlDisplay.textContent = targetUrl;
  const date = new Date(timestamp);
  timestampDisplay.textContent = `Change detected at: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  loadDiffData();
} else {
  showError('Invalid parameters. Missing URL or timestamp.');
}

// Load diff data from storage
async function loadDiffData() {
  try {
    const result = await chrome.storage.local.get(['history']);
    const history = result.history || {};
    
    if (!history[targetUrl]) {
      showError('No history found for this URL.');
      return;
    }
    
    // Find the change entry by timestamp
    const changeEntry = history[targetUrl].find(entry => entry.timestamp === timestamp);
    if (!changeEntry) {
      showError('Change entry not found.');
      return;
    }
    
    currentData = changeEntry;
    displayDiff(changeEntry.oldContent, changeEntry.newContent);
  } catch (error) {
    showError('Failed to load diff data: ' + error.message);
  }
}

// Display the diff
function displayDiff(oldHtml, newHtml) {
  if (showRawHtml) {
    // Show raw HTML
    oldContent.textContent = oldHtml;
    newContent.textContent = newHtml;
  } else {
    // Show processed/cleaned HTML with basic highlighting
    const processedOld = processContentForDisplay(oldHtml);
    const processedNew = processContentForDisplay(newHtml);
    
    oldContent.innerHTML = highlightDifferences(processedOld, processedNew, true);
    newContent.innerHTML = highlightDifferences(processedNew, processedOld, false);
  }
}

// Process content for better display
function processContentForDisplay(html) {
  // Remove extra whitespace and format for readability
  return html
    .replace(/></g, '>\n<')
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple diff highlighting
function highlightDifferences(content, compareContent, isOld) {
  const lines = content.split('\n');
  const compareLines = compareContent.split('\n');
  
  return lines.map((line, index) => {
    const compareLine = compareLines[index];
    
    if (!compareLine) {
      // Line doesn't exist in comparison
      return `<span class="${isOld ? 'removed' : 'added'}">${escapeHtml(line)}</span>`;
    }
    
    if (line !== compareLine) {
      // Lines are different
      if (isOld) {
        return `<span class="removed">${escapeHtml(line)}</span>`;
      } else {
        return `<span class="added">${escapeHtml(line)}</span>`;
      }
    }
    
    return escapeHtml(line);
  }).join('\n');
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  
  // Replace both content areas with error
  oldContent.innerHTML = '';
  newContent.innerHTML = '';
  oldContent.appendChild(errorDiv.cloneNode(true));
  newContent.appendChild(errorDiv);
}

// Event handlers
refreshBtn.addEventListener('click', () => {
  if (currentData) {
    displayDiff(currentData.oldContent, currentData.newContent);
  }
});

rawViewBtn.addEventListener('click', () => {
  showRawHtml = !showRawHtml;
  rawViewBtn.textContent = showRawHtml ? 'Toggle Formatted View' : 'Toggle Raw HTML';
  