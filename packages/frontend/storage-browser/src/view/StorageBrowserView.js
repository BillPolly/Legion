/**
 * Storage Browser View
 * DOM rendering and user interaction handling
 */

export class StorageBrowserView {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      theme: 'light',
      mode: 'split',
      layout: { splitRatio: 30 },
      display: { documentsView: 'table' },
      ...options
    };
    
    this.elements = {};
    this.listeners = new Map();
    
    this.render();
    this.setupEventHandlers();
  }

  render() {
    // Check if initial provider is MongoDB
    const showDatabaseSelect = this.options.provider === 'mongodb';
    
    this.container.innerHTML = `
      <div class="storage-browser ${this.options.theme}">
        <div class="toolbar">
          <select class="provider-select">
            <option value="memory" ${this.options.provider === 'memory' ? 'selected' : ''}>Memory</option>
            <option value="mongodb" ${this.options.provider === 'mongodb' ? 'selected' : ''}>MongoDB</option>
            <option value="sqlite" ${this.options.provider === 'sqlite' ? 'selected' : ''}>SQLite</option>
          </select>
          <select class="database-select" style="display: ${showDatabaseSelect ? 'inline-block' : 'none'};">
            <option value="">Loading databases...</option>
          </select>
          <button class="refresh-btn">↻ Refresh</button>
          <button class="new-doc-btn">+ New</button>
          <div class="connection-status">Disconnected</div>
        </div>
        
        <div class="content ${this.options.mode}">
          <div class="collections-panel">
            <h3>Collections</h3>
            <div class="collections-list">
              <div class="loading">Loading...</div>
            </div>
          </div>
          
          <div class="documents-panel">
            <div class="query-editor">
              <textarea class="query-input" placeholder='{"status": "active"}'></textarea>
              <button class="execute-query-btn">Run Query</button>
            </div>
            
            <div class="documents-grid">
              <div class="loading">Select a collection</div>
            </div>
            
            <div class="pagination">
              <button class="prev-btn">← Previous</button>
              <span class="page-info">Page 1 of 1</span>
              <button class="next-btn">Next →</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cache elements
    this.elements = {
      providerSelect: this.container.querySelector('.provider-select'),
      databaseSelect: this.container.querySelector('.database-select'),
      refreshBtn: this.container.querySelector('.refresh-btn'),
      newDocBtn: this.container.querySelector('.new-doc-btn'),
      connectionStatus: this.container.querySelector('.connection-status'),
      collectionsList: this.container.querySelector('.collections-list'),
      queryInput: this.container.querySelector('.query-input'),
      executeQueryBtn: this.container.querySelector('.execute-query-btn'),
      documentsGrid: this.container.querySelector('.documents-grid'),
      prevBtn: this.container.querySelector('.prev-btn'),
      nextBtn: this.container.querySelector('.next-btn'),
      pageInfo: this.container.querySelector('.page-info')
    };

    this.applyStyles();
  }

  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .storage-browser {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      
      .toolbar {
        display: flex;
        gap: 10px;
        padding: 10px;
        border-bottom: 1px solid #ddd;
        align-items: center;
      }
      
      .content.split {
        display: flex;
        flex: 1;
      }
      
      .collections-panel {
        width: 30%;
        border-right: 1px solid #ddd;
        padding: 10px;
      }
      
      .documents-panel {
        flex: 1;
        padding: 10px;
        display: flex;
        flex-direction: column;
      }
      
      .query-editor {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
      }
      
      .query-input {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: monospace;
      }
      
      .documents-grid {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: auto;
        padding: 10px;
      }
      
      .collections-list .collection-item {
        padding: 8px;
        cursor: pointer;
        border-radius: 4px;
        margin-bottom: 2px;
      }
      
      .collections-list .collection-item:hover {
        background: #f5f5f5;
      }
      
      .collections-list .collection-item.selected {
        background: #007acc;
        color: white;
      }
      
      .document-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .document-table th,
      .document-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      
      .document-table th {
        background: #f8f9fa;
        font-weight: 600;
      }
      
      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        padding: 10px;
      }
      
      button {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
      }
      
      button:hover {
        background: #f8f9fa;
      }
      
      .loading {
        text-align: center;
        color: #666;
        font-style: italic;
      }
      
      .connection-status {
        margin-left: auto;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .connection-status.connected {
        background: #d4edda;
        color: #155724;
      }
      
      .connection-status.disconnected {
        background: #f8d7da;
        color: #721c24;
      }
    `;
    
    if (!document.querySelector('#storage-browser-styles')) {
      style.id = 'storage-browser-styles';
      document.head.appendChild(style);
    }
  }

  setupEventHandlers() {
    this.elements.refreshBtn.addEventListener('click', () => {
      this.emit('action', { type: 'refresh' });
    });

    this.elements.providerSelect.addEventListener('change', () => {
      const provider = this.elements.providerSelect.value;
      console.log('[View] Provider changed to:', provider);
      this.emit('action', { type: 'selectProvider', provider });
      
      // Show database selector for MongoDB
      if (provider === 'mongodb') {
        console.log('[View] Showing database selector, requesting database list');
        this.elements.databaseSelect.style.display = 'inline-block';
        this.emit('action', { type: 'listDatabases' });
      } else {
        this.elements.databaseSelect.style.display = 'none';
      }
    });

    this.elements.databaseSelect.addEventListener('change', () => {
      const database = this.elements.databaseSelect.value;
      if (database) {
        this.emit('action', { type: 'selectDatabase', database });
      }
    });

    this.elements.executeQueryBtn.addEventListener('click', () => {
      try {
        const query = JSON.parse(this.elements.queryInput.value || '{}');
        this.emit('action', { type: 'executeQuery', query });
      } catch (error) {
        alert('Invalid JSON query');
      }
    });

    this.elements.newDocBtn.addEventListener('click', () => {
      this.showNewDocumentDialog();
    });
  }

  updateConnection(data) {
    const status = data.status || 'disconnected';
    this.elements.connectionStatus.textContent = status;
    this.elements.connectionStatus.className = `connection-status ${status}`;
  }

  updateDatabases(data) {
    console.log('[View] updateDatabases called with:', data);
    if (data.loading) {
      this.elements.databaseSelect.innerHTML = '<option value="">Loading databases...</option>';
      return;
    }

    if (data.list) {
      console.log('[View] Database list received:', data.list);
      this.elements.databaseSelect.innerHTML = data.list
        .map(db => `
          <option value="${db.name || db}">${db.name || db}${db.sizeOnDisk ? ` (${Math.round(db.sizeOnDisk / 1024 / 1024)}MB)` : ''}</option>
        `).join('');
      
      // Select current database if provided
      if (data.current) {
        this.elements.databaseSelect.value = data.current;
      }
    }
  }

  updateCollections(data) {
    if (data.loading) {
      this.elements.collectionsList.innerHTML = '<div class="loading">Loading...</div>';
      return;
    }

    if (data.list) {
      this.elements.collectionsList.innerHTML = data.list
        .map(col => `
          <div class="collection-item" data-collection="${col.name}">
            ${col.name} (${col.count || 0})
          </div>
        `).join('');

      // Add click handlers
      this.elements.collectionsList.querySelectorAll('.collection-item').forEach(item => {
        item.addEventListener('click', () => {
          const collection = item.dataset.collection;
          this.selectCollection(collection);
          this.emit('action', { type: 'selectCollection', collection });
        });
      });
    }
  }

  selectCollection(name) {
    this.elements.collectionsList.querySelectorAll('.collection-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.collection === name);
    });
  }

  updateDocuments(data) {
    if (data.loading) {
      this.elements.documentsGrid.innerHTML = '<div class="loading">Loading documents...</div>';
      return;
    }

    if (data.items) {
      this.renderDocumentsTable(data.items);
    }
  }

  renderDocumentsTable(documents) {
    if (documents.length === 0) {
      this.elements.documentsGrid.innerHTML = '<div class="loading">No documents found</div>';
      return;
    }

    // Get all unique keys from documents
    const keys = new Set();
    documents.forEach(doc => {
      Object.keys(doc).forEach(key => keys.add(key));
    });

    const headers = Array.from(keys).slice(0, 10); // Limit columns

    const table = `
      <table class="document-table">
        <thead>
          <tr>
            ${headers.map(key => `<th>${key}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${documents.map(doc => `
            <tr>
              ${headers.map(key => `
                <td>${this.formatValue(doc[key])}</td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    this.elements.documentsGrid.innerHTML = table;
  }

  formatValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return String(value);
  }

  showNewDocumentDialog() {
    const json = prompt('Enter document JSON:', '{\n  "name": "New Document"\n}');
    if (json) {
      try {
        const data = JSON.parse(json);
        this.emit('action', { type: 'createDocument', data });
      } catch (error) {
        alert('Invalid JSON');
      }
    }
  }

  updateUI(data) {
    if (data.theme) {
      this.setTheme(data.theme);
    }
  }

  setTheme(theme) {
    this.container.querySelector('.storage-browser').className = `storage-browser ${theme}`;
  }

  // Event emitter
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  emit(event, ...args) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in View listener for ${event}:`, error);
      }
    });
  }

  destroy() {
    this.listeners.clear();
    this.container.innerHTML = '';
  }
}