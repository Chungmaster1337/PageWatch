# PageWatch Database Schema Documentation

## Overview

PageWatch uses SQLite as its primary storage system, replacing Chrome storage for better performance, security, and data integrity. This document provides a complete breakdown of the database schema.

## 📊 Database Architecture

The database consists of 7 core tables with well-defined relationships and proper indexing for optimal performance.

### Quick Reference
- **monitored_urls** - URL management and metadata
- **content_snapshots** - Processed content storage  
- **change_history** - Change tracking and notifications
- **app_settings** - Configuration (replaces Chrome storage)
- **error_logs** - Error tracking and debugging
- **search_analytics** - Search performance metrics
- **content_keywords** - Enhanced search capability

---

## 🔗 Table Schemas

### 1. `monitored_urls`
**Purpose:** Core URL management and metadata storage

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique identifier for each URL |
| `url` | TEXT | UNIQUE NOT NULL | The actual URL being monitored |
| `title` | TEXT | NULL | User-friendly title for the URL |
| `description` | TEXT | NULL | Optional description/notes about the URL |
| `category` | TEXT | DEFAULT 'general' | Categorization for organization |
| `priority` | INTEGER | DEFAULT 1 | Priority level (1=low, 5=high) for checking order |
| `active` | BOOLEAN | DEFAULT 1 | Whether URL is currently being monitored |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When URL was first added |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last time URL metadata was modified |

**Indexes:**
- `idx_monitored_urls_active` ON (active)

**Example Row:**
```json
{
  "id": 1,
  "url": "https://news.example.com",
  "title": "Example News Site", 
  "description": "Tech news updates",
  "category": "news",
  "priority": 3,
  "active": 1,
  "created_at": "2024-01-15 10:30:00",
  "updated_at": "2024-01-15 10:30:00"
}
```

---

### 2. `content_snapshots`
**Purpose:** Store processed content for each URL check

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique snapshot identifier |
| `url_id` | INTEGER | NOT NULL, FK → monitored_urls(id) | References monitored URL |
| `content_hash` | TEXT | NOT NULL | Hash of sanitized content for comparison |
| `sanitized_content` | TEXT | NOT NULL | Processed/cleaned content for change detection |
| `raw_content` | TEXT | NOT NULL | Original HTML content as fetched |
| `content_length` | INTEGER | NULL | Length of sanitized_content in characters |
| `word_count` | INTEGER | NULL | Number of words in sanitized content |
| `capture_timestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When snapshot was taken |
| `processing_time_ms` | INTEGER | NULL | Time taken to process content |

**Foreign Keys:**
- `url_id` → `monitored_urls(id)` ON DELETE CASCADE

**Indexes:**
- `idx_content_snapshots_url_id` ON (url_id)
- `idx_content_snapshots_timestamp` ON (capture_timestamp)

---

### 3. `change_history`
**Purpose:** Track all detected changes between content snapshots

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique change record identifier |
| `url_id` | INTEGER | NOT NULL, FK → monitored_urls(id) | References monitored URL |
| `old_snapshot_id` | INTEGER | FK → content_snapshots(id) | Previous snapshot (NULL for first) |
| `new_snapshot_id` | INTEGER | NOT NULL, FK → content_snapshots(id) | Current snapshot that triggered change |
| `change_type` | TEXT | DEFAULT 'content_update' | Type of change detected |
| `change_summary` | TEXT | NULL | Human-readable summary of changes |
| `change_percentage` | REAL | NULL | Percentage of content changed (0-100) |
| `words_added` | INTEGER | DEFAULT 0 | Number of words added |
| `words_removed` | INTEGER | DEFAULT 0 | Number of words removed |
| `detected_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When change was detected |
| `notification_sent` | BOOLEAN | DEFAULT 0 | Whether user was notified |
| `reviewed` | BOOLEAN | DEFAULT 0 | Whether user has reviewed change |

**Foreign Keys:**
- `url_id` → `monitored_urls(id)` ON DELETE CASCADE
- `old_snapshot_id` → `content_snapshots(id)`
- `new_snapshot_id` → `content_snapshots(id)`

**Indexes:**
- `idx_change_history_url_id` ON (url_id)
- `idx_change_history_timestamp` ON (detected_at)

---

### 4. `app_settings`
**Purpose:** Application configuration (replaces Chrome storage)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique setting identifier |
| `setting_key` | TEXT | UNIQUE NOT NULL | Configuration key name |
| `setting_value` | TEXT | NOT NULL | JSON-encoded or string value |
| `data_type` | TEXT | DEFAULT 'string' | Value type: 'string', 'number', 'boolean', 'json' |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When setting was last modified |

**Indexes:**
- `idx_app_settings_key` ON (setting_key)

**Default Configuration:**
```json
{
  "sanitizationConfig": {
    "includeImages": false,
    "includeLinks": true,
    "includeTables": true,
    "includeForms": false,
    "includeMetadata": false,
    "preserveStructure": false,
    "minTextLength": 5
  },
  "checkInterval": 15,
  "maxSnapshots": 100,
  "enableNotifications": true,
  "notificationSound": true
}
```

---

### 5. `error_logs`
**Purpose:** Comprehensive error tracking and debugging

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique error identifier |
| `session_id` | TEXT | NOT NULL | Browser session identifier |
| `error_type` | TEXT | NOT NULL | Error classification |
| `error_message` | TEXT | NOT NULL | Sanitized error message |
| `error_stack` | TEXT | NULL | Sanitized stack trace |
| `severity` | TEXT | DEFAULT 'error' | 'info', 'warning', 'error', 'critical' |
| `category` | TEXT | DEFAULT 'general' | Error category grouping |
| `context` | TEXT | NULL | JSON string with additional context |
| `timestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When error occurred |
| `resolved` | BOOLEAN | DEFAULT 0 | Whether error has been addressed |

**Indexes:**
- `idx_error_logs_timestamp` ON (timestamp)
- `idx_error_logs_severity` ON (severity)

**Error Categories:**
- `url_monitoring` - URL checking and content fetching
- `database` - Database operations and integrity
- `content_processing` - Content sanitization and analysis
- `notification` - User notification system
- `general` - Uncategorized errors

---

### 6. `search_analytics`
**Purpose:** Track search performance and user behavior

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique search identifier |
| `search_query` | TEXT | NOT NULL | User's search query |
| `results_count` | INTEGER | NULL | Number of results returned |
| `urls_matched` | INTEGER | NULL | Number of unique URLs in results |
| `search_time_ms` | INTEGER | NULL | Time taken to execute search |
| `filters_used` | TEXT | NULL | JSON string of applied filters |
| `executed_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When search was performed |
| `user_session` | TEXT | NULL | Session identifier for analytics |

**Example filters_used:**
```json
{
  "caseSensitive": false,
  "useRegex": false,
  "searchHistory": true,
  "searchSnapshots": false,
  "urlFilter": "",
  "dateFilter": "2024-01-01"
}
```

---

### 7. `content_keywords`
**Purpose:** Enhanced search capability through keyword extraction

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique keyword identifier |
| `snapshot_id` | INTEGER | NOT NULL, FK → content_snapshots(id) | References content snapshot |
| `keyword` | TEXT | NOT NULL | Extracted keyword or phrase |
| `frequency` | INTEGER | DEFAULT 1 | Number of occurrences |
| `relevance_score` | REAL | DEFAULT 0.0 | Calculated relevance (0.0-1.0) |

**Foreign Keys:**
- `snapshot_id` → `content_snapshots(id)` ON DELETE CASCADE

**Indexes:**
- `idx_keywords_snapshot` ON (snapshot_id)

---

## 🔗 Relationship Diagram

```
┌─────────────────┐     1:N     ┌──────────────────┐     1:N     ┌──────────────────┐
│  monitored_urls │ ──────────→ │ content_snapshots│ ──────────→ │ content_keywords │
│                 │             │                  │             │                  │
│ • id (PK)       │             │ • id (PK)        │             │ • id (PK)        │
│ • url           │             │ • url_id (FK)    │             │ • snapshot_id(FK)│
│ • title         │             │ • content_hash   │             │ • keyword        │
│ • category      │             │ • sanitized_...  │             │ • frequency      │
│ • active        │             │ • raw_content    │             │ • relevance_...  │
└─────────────────┘             └──────────────────┘             └──────────────────┘
         │                               │
         │ 1:N                          │ 1:N (old)
         ▼                               │ 1:N (new)
┌─────────────────┐                     ▼
│ change_history  │◄────────────────────┘
│                 │
│ • id (PK)       │
│ • url_id (FK)   │
│ • old_snap...(FK)│
│ • new_snap...(FK)│
│ • change_type   │
│ • detected_at   │
└─────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   app_settings  │    │   error_logs     │    │ search_analytics │
│                 │    │                  │    │                  │
│ • id (PK)       │    │ • id (PK)        │    │ • id (PK)        │
│ • setting_key   │    │ • session_id     │    │ • search_query   │
│ • setting_value │    │ • error_type     │    │ • results_count  │
│ • data_type     │    │ • error_message  │    │ • search_time_ms │
└─────────────────┘    │ • severity       │    │ • executed_at    │
   (Standalone)        └──────────────────┘    └──────────────────┘
                          (Standalone)            (Standalone)
```

---

## 📊 Storage and Performance

### **Typical Storage Estimates**

| Table | Row Size | Growth Rate | Impact | Notes |
|-------|----------|-------------|--------|--------|
| **monitored_urls** | ~200 bytes | Manual | Low | User-controlled growth |
| **content_snapshots** | 10-50KB | Per check cycle | **High** | Largest table by far |
| **change_history** | ~500 bytes | Per change | Medium | Depends on change frequency |
| **app_settings** | ~100 bytes | Rare updates | Minimal | Nearly static |
| **error_logs** | ~1KB | Per error | Low | Should be minimal in production |
| **search_analytics** | ~200 bytes | Per search | Low | Analytics only |
| **content_keywords** | ~50 bytes | Per keyword | Medium | Depends on content complexity |

### **Performance Optimizations**

**Built-in Indexes:**
- All foreign keys are indexed
- Timestamp columns for time-based queries
- Active status for filtering
- Error severity for debugging

**Query Performance:**
- Foreign key constraints ensure data integrity
- Cascading deletes maintain consistency
- Proper indexing supports complex searches
- VACUUM and ANALYZE recommended monthly

---

## 🧹 Maintenance Strategy

### **Automated Cleanup**
```sql
-- Clean old snapshots (keep last 100 per URL)
DELETE FROM content_snapshots 
WHERE id NOT IN (
  SELECT id FROM content_snapshots 
  WHERE url_id = ? 
  ORDER BY capture_timestamp DESC 
  LIMIT 100
);

-- Archive old changes (older than 6 months)
DELETE FROM change_history 
WHERE detected_at < datetime('now', '-6 months');

-- Purge resolved errors (older than 30 days)
DELETE FROM error_logs 
WHERE resolved = 1 AND timestamp < datetime('now', '-30 days');
```

### **Performance Maintenance**
```sql
-- Reclaim space after deletions
VACUUM;

-- Update query planner statistics
ANALYZE;

-- Check database integrity
PRAGMA integrity_check;
```

---

## 🚀 Usage Examples

### **Adding a New URL**
```javascript
const urlId = await pageMonitorDB.addUrl(
  'https://example.com',
  'Example Site',
  'Main company website',
  'business',
  5  // High priority
);
```

### **Recording a Content Change**
```javascript
const snapshotId = await pageMonitorDB.saveSnapshot(
  urlId,
  contentHash,
  sanitizedContent,
  rawContent,
  processingTime
);

await pageMonitorDB.recordChange(
  urlId,
  oldSnapshotId,
  snapshotId,
  'Content updated - new article added',
  15.7  // 15.7% change
);
```

### **Configuration Management**
```javascript
// Set configuration
await pageMonitorDB.setSetting('checkInterval', 30);

// Get configuration with default
const interval = await pageMonitorDB.getSetting('checkInterval', 15);

// Complex configuration
const config = await pageMonitorDB.getSetting('sanitizationConfig', defaultConfig);
```

---

## 🔒 Security Considerations

### **Data Sanitization**
- All user inputs are sanitized before storage
- HTML content is cleaned to prevent XSS
- Error messages exclude sensitive information
- Stack traces remove internal paths

### **Access Control**
- Foreign key constraints prevent orphaned data
- Parameterized queries prevent SQL injection
- Input validation on all external data
- Secure error logging without data exposure

### **Privacy Protection**
- No personal information stored
- URLs and content only (user-controlled)
- Error logs anonymized
- Session IDs are temporary identifiers

---

## 📋 Migration Guide

### **From Chrome Storage**
```javascript
// Old Chrome storage approach
chrome.storage.local.get(['urls'], (result) => {
  const urls = result.urls || [];
  // Process URLs...
});

// New SQLite approach
const urls = await pageMonitorDB.getUrls();
// Process URLs...
```

### **Data Migration Script**
```javascript
async function migrateFromChromeStorage() {
  // Get existing data
  const chromeData = await new Promise(resolve => {
    chrome.storage.local.get(null, resolve);
  });
  
  // Migrate URLs
  if (chromeData.monitoredUrls) {
    for (const url of chromeData.monitoredUrls) {
      await pageMonitorDB.addUrl(url);
    }
  }
  
  // Migrate settings
  if (chromeData.sanitizationConfig) {
    await pageMonitorDB.setSetting('sanitizationConfig', chromeData.sanitizationConfig);
  }
  
  // Clear old storage
  chrome.storage.local.clear();
}
```

---

## 📚 API Reference

### **Core Database Methods**

| Method | Description | Returns |
|--------|-------------|---------|
| `addUrl(url, title, description, category, priority)` | Add new monitored URL | url_id |
| `removeUrl(url)` | Remove URL and all related data | boolean |
| `getUrls(activeOnly)` | Get all URLs with optional filtering | Array<URL> |
| `saveSnapshot(urlId, hash, content, raw, time)` | Store content snapshot | snapshot_id |
| `getLatestSnapshot(urlId)` | Get most recent snapshot for URL | Snapshot |
| `recordChange(urlId, oldId, newId, summary, %)` | Log detected change | change_id |
| `getRecentChanges(limit)` | Get recent changes across all URLs | Array<Change> |
| `setSetting(key, value)` | Store configuration setting | boolean |
| `getSetting(key, default)` | Retrieve configuration | any |
| `exportAllData()` | Export complete database | Object |
| `clearAllData()` | Reset database (development) | boolean |

---

## 🐛 Troubleshooting

### **Common Issues**

**Database Lock Errors:**
```javascript
// Use proper async/await patterns
await pageMonitorDB.init();
const result = await pageMonitorDB.addUrl(url);
```

**Storage Full:**
```javascript
// Check database size
const stats = await pageMonitorDB.getStorageStats();
if (stats.size > MAX_SIZE) {
  await pageMonitorDB.cleanOldSnapshots();
}
```

**Performance Issues:**
```sql
-- Check for missing indexes
EXPLAIN QUERY PLAN SELECT * FROM content_snapshots WHERE url_id = ?;

-- Update statistics if queries are slow
ANALYZE;
```

### **Debug Queries**

```sql
-- Check database integrity
PRAGMA integrity_check;

-- View database schema
.schema

-- Table sizes
SELECT name, COUNT(*) FROM sqlite_master 
JOIN (
  SELECT 'monitored_urls' as name, COUNT(*) as count FROM monitored_urls
  UNION ALL
  SELECT 'content_snapshots', COUNT(*) FROM content_snapshots
  -- Add other tables...
) USING(name);

-- Recent activity
SELECT url, detected_at, change_summary 
FROM change_history 
JOIN monitored_urls ON change_history.url_id = monitored_urls.id 
ORDER BY detected_at DESC 
LIMIT 10;
```

---

## 📈 Future Enhancements

### **Planned Features**
- Content diffing visualization
- Advanced search with relevance scoring
- Change pattern analysis
- Export/import functionality
- Performance dashboard
- Automated categorization

### **Schema Evolution**
The schema is designed to be extensible:
- Additional columns can be added without breaking changes
- New tables for features like user preferences
- Indexes can be added/removed as needed
- Foreign keys ensure data consistency during upgrades

---

*This documentation is maintained alongside the PageWatch codebase. For implementation details, see the source code in `sqlite_database.js`.*