// DOM elements
const searchQuery = document.getElementById('searchQuery');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const caseSensitive = document.getElementById('caseSensitive');
const useRegex = document.getElementById('useRegex');
const searchHistory = document.getElementById('searchHistory');
const searchSnapshots = document.getElementById('searchSnapshots');
const urlFilter = document.getElementById('urlFilter');
const dateFilter = document.getElementById('dateFilter');
const searchStats = document.getElementById('searchStats');
const resultsSection = document.getElementById('resultsSection');
const searchResults = document.getElementById('searchResults');
const exportResultsBtn = document.getElementById('exportResultsBtn');
const exportReportBtn = document.getElementById('exportReportBtn');

// Stats elements
const totalMatches = document.getElementById('totalMatches');
const urlsWithMatches = document.getElementById('urlsWithMatches');
const averageMatches = document.getElementById('averageMatches');
const searchTime = document.getElementById('searchTime');

let currentResults = [];
let allData = null;

// Initialize
loadData();

// Event listeners
searchBtn.addEventListener('click', performSearch);
clearSearchBtn.addEventListener('click', clearSearch);
exportResultsBtn.addEventListener('click', exportResults);
exportReportBtn.addEventListener('click', generateReport);
searchQuery.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});

// Load all data and populate filters
async function loadData() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getAllData" }, resolve);
    });
    
    allData = response.data || {};
    populateFilters();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

// Populate filter dropdowns
function populateFilters() {
  const urls = allData.monitoredUrls || [];
  const historyUrls = Object.keys(allData.history || {});
  const snapshotUrls = Object.keys(allData.snapshots || {});
  
  // Combine all URLs
  const allUrls = [...new Set([...urls, ...historyUrls, ...snapshotUrls])];
  
  urlFilter.innerHTML = '<option value="">All URLs</option>' +
    allUrls.map(url => `<option value="${escapeHtml(url)}">${escapeHtml(url.length > 50 ? url.substring(0, 47) + '...' : url)}</option>`).join('');
}

// Perform search
async function performSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    alert('Please enter a search query');
    return;
  }
  
  const startTime = Date.now();
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';
  
  try {
    const results = await searchContent(query);
    const searchDuration = Date.now() - startTime;
    
    currentResults = results;
    displayResults(results, searchDuration);
    updateStats(results, searchDuration);
    
  } catch (error) {
    console.error('Search failed:', error);
    searchResults.innerHTML = `<div class="no-results">Search failed: ${escapeHtml(error.message)}</div>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

// Search through content
async function searchContent(query) {
  const results = [];
  const options = {
    caseSensitive: caseSensitive.checked,
    useRegex: useRegex.checked,
    includeHistory: searchHistory.checked,
    includeSnapshots: searchSnapshots.checked,
    urlFilter: urlFilter.value,
    dateFilter: parseInt(dateFilter.value) || null
  };
  
  let searchPattern;
  try {
    if (options.useRegex) {
      const flags = options.caseSensitive ? 'g' : 'gi';
      searchPattern = new RegExp(query, flags);
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = options.caseSensitive ? 'g' : 'gi';
      searchPattern = new RegExp(escapedQuery, flags);
    }
  } catch (error) {
    throw new Error('Invalid regular expression: ' + error.message);
  }
  
  // Search current snapshots
  if (options.includeSnapshots && allData.snapshots) {
    for (const [url, snapshot] of Object.entries(allData.snapshots)) {
      if (options.urlFilter && url !== options.urlFilter) continue;
      
      const content = snapshot.content || '';
      const matches = [...content.matchAll(searchPattern)];
      
      if (matches.length > 0) {
        results.push({
          type: 'snapshot',
          url: url,
          timestamp: new Date().toISOString(),
          content: content,
          matches: matches,
          matchCount: matches.length
        });
      }
    }
  }
  
  // Search history
  if (options.includeHistory && allData.history) {
    for (const [url, changes] of Object.entries(allData.history)) {
      if (options.urlFilter && url !== options.urlFilter) continue;
      
      for (const change of changes) {
        // Apply date filter
        if (options.dateFilter) {
          const changeDate = new Date(change.timestamp);
          const cutoffDate = new Date(Date.now() - (options.dateFilter * 24 * 60 * 60 * 1000));
          if (changeDate < cutoffDate) continue;
        }
        
        // Search both old and new content
        const oldMatches = [...(change.oldContent || '').matchAll(searchPattern)];
        const newMatches = [...(change.newContent || '').matchAll(searchPattern)];
        
        if (oldMatches.length > 0) {
          results.push({
            type: 'history_old',
            url: url,
            timestamp: change.timestamp,
            content: change.oldContent,
            matches: oldMatches,
            matchCount: oldMatches.length
          });
        }
        
        if (newMatches.length > 0) {
          results.push({
            type: 'history_new',
            url: url,
            timestamp: change.timestamp,
            content: change.newContent,
            matches: newMatches,
            matchCount: newMatches.length
          });
        }
      }
    }
  }
  
  return results.sort((a, b) => b.matchCount - a.matchCount);
}

// Display search results
function displayResults(results, searchDuration) {
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="no-results">No matches found for your search query.</div>';
    resultsSection.style.display = 'block';
    return;
  }
  
  searchResults.innerHTML = results.map((result, index) => {
    const typeLabel = {
      'snapshot': 'Current Snapshot',
      'history_old': 'Historical (Previous)',
      'history_new': 'Historical (Updated)'
    }[result.type];
    
    const date = new Date(result.timestamp);
    const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
    // Get context around matches
    const contexts = getMatchContexts(result.content, result.matches);
    
    return `
      <div class="search-result">
        <div class="result-header">
          <div class="result-url">${escapeHtml(result.url)}</div>
          <div class="result-meta">
            ${typeLabel} • ${timeStr} • 
            <span class="match-count">${result.matchCount} matches</span>
          </div>
        </div>
        <div class="result-content">
          ${contexts.map(context => `<div class="context-snippet">${context}</div>`).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  resultsSection.style.display = 'block';
}

// Get context around search matches
function getMatchContexts(content, matches, contextLength = 200) {
  const contexts = [];
  const processedPositions = new Set();
  
  for (const match of matches.slice(0, 10)) { // Limit to first 10 matches per result
    const start = Math.max(0, match.index - contextLength);
    const end = Math.min(content.length, match.index + match[0].length + contextLength);
    
    // Skip if we've already processed this area
    if (processedPositions.has(match.index)) continue;
    processedPositions.add(match.index);
    
    let context = content.substring(start, end);
    
    // Highlight the match
    const matchStart = match.index - start;
    const matchEnd = matchStart + match[0].length;
    
    context = escapeHtml(context.substring(0, matchStart)) +
             '<span class="search-highlight">' + escapeHtml(match[0]) + '</span>' +
             escapeHtml(context.substring(matchEnd));
    
    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';
    
    contexts.push(context);
  }
  
  return contexts;
}

// Update search statistics
function updateStats(results, searchDuration) {
  const totalMatchCount = results.reduce((sum, result) => sum + result.matchCount, 0);
  const uniqueUrls = new Set(results.map(result => result.url)).size;
  const avgMatches = uniqueUrls > 0 ? Math.round(totalMatchCount / uniqueUrls) : 0;
  
  totalMatches.textContent = totalMatchCount.toLocaleString();
  urlsWithMatches.textContent = uniqueUrls;
  averageMatches.textContent = avgMatches;
  searchTime.textContent = searchDuration + 'ms';
  
  searchStats.style.display = 'grid';
}

// Clear search
function clearSearch() {
  searchQuery.value = '';
  currentResults = [];
  searchStats.style.display = 'none';
  resultsSection.style.display = 'none';
}

// Export search results as JSON
function exportResults() {
  if (currentResults.length === 0) {
    alert('No search results to export');
    return;
  }
  
  const exportData = {
    searchQuery: searchQuery.value,
    searchOptions: {
      caseSensitive: caseSensitive.checked,
      useRegex: useRegex.checked,
      includeHistory: searchHistory.checked,
      includeSnapshots: searchSnapshots.checked,
      urlFilter: urlFilter.value,
      dateFilter: dateFilter.value
    },
    timestamp: new Date().toISOString(),
    totalResults: currentResults.length,
    totalMatches: currentResults.reduce((sum, result) => sum + result.matchCount, 0),
    results: currentResults.map(result => ({
      type: result.type,
      url: result.url,
      timestamp: result.timestamp,
      matchCount: result.matchCount,
      matches: result.matches.map(match => ({
        text: match[0],
        index: match.index
      }))
    }))
  };
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `search-results-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generate comprehensive report
function generateReport() {
  if (currentResults.length === 0) {
    alert('No search results to report on');
    return;
  }
  
  const query = searchQuery.value;
  const totalMatches = currentResults.reduce((sum, result) => sum + result.matchCount, 0);
  const uniqueUrls = new Set(currentResults.map(result => result.url));
  
  // Create detailed report
  let report = `SEARCH REPORT\n`;
  report += `=============\n\n`;
  report += `Search Query: "${query}"\n`;
  report += `Generated: ${new Date().toLocaleString()}\n\n`;
  
  report += `SUMMARY\n`;
  report += `-------\n`;
  report += `Total Matches: ${totalMatches}\n`;
  report += `URLs with Matches: ${uniqueUrls.size}\n`;
  report += `Total Results: ${currentResults.length}\n\n`;
  
  report += `RESULTS BY URL\n`;
  report += `--------------\n`;
  
  // Group results by URL
  const resultsByUrl = {};
  for (const result of currentResults) {
    if (!resultsByUrl[result.url]) {
      resultsByUrl[result.url] = [];
    }
    resultsByUrl[result.url].push(result);
  }
  
  for (const [url, urlResults] of Object.entries(resultsByUrl)) {
    const urlTotalMatches = urlResults.reduce((sum, result) => sum + result.matchCount, 0);
    report += `\n${url}\n`;
    report += `  Total Matches: ${urlTotalMatches}\n`;
    
    for (const result of urlResults) {
      const typeLabel = {
        'snapshot': 'Current',
        'history_old': 'Historical (Old)',
        'history_new': 'Historical (New)'
      }[result.type];
      
      report += `  - ${typeLabel}: ${result.matchCount} matches (${new Date(result.timestamp).toLocaleString()})\n`;
    }
  }
  
  report += `\n\nDETAILED MATCHES\n`;
  report += `================\n`;
  
  for (const result of currentResults.slice(0, 20)) { // Limit detailed output
    report += `\nURL: ${result.url}\n`;
    report += `Type: ${result.type}\n`;
    report += `Timestamp: ${new Date(result.timestamp).toLocaleString()}\n`;
    report += `Matches: ${result.matchCount}\n`;
    
    // Show first few matches with context
    for (const match of result.matches.slice(0, 3)) {
      const start = Math.max(0, match.index - 100);
      const end = Math.min(result.content.length, match.index + match[0].length + 100);
      const context = result.content.substring(start, end);
      
      report += `\nMatch: "${match[0]}"\n`;
      report += `Context: ${start > 0 ? '...' : ''}${context}${end < result}