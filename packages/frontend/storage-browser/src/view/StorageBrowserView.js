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
    this.editedCells = new Map(); // Track edited cells: "docId-field" -> newValue
    this.originalValues = new Map(); // Store original values for reverting
    
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
          <button class="delete-db-btn" style="display: ${showDatabaseSelect ? 'inline-block' : 'none'};" title="Delete Current Database">🗑️ DB</button>
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
      deleteDbBtn: this.container.querySelector('.delete-db-btn'),
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
      
      .document-cell.editable {
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .document-cell.editable:hover {
        background: #f0f8ff;
        outline: 1px solid #007acc;
      }
      
      .document-cell.editable:focus {
        background: white;
        outline: 2px solid #007acc;
        box-shadow: 0 0 3px rgba(0, 122, 204, 0.3);
      }
      
      .document-cell.edited {
        background: #fff3cd !important;
        position: relative;
      }
      
      .document-cell.edited::after {
        content: '✏️';
        position: absolute;
        top: 2px;
        right: 2px;
        font-size: 10px;
      }
      
      .edit-toolbar {
        padding: 10px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 4px;
        margin-bottom: 10px;
        display: flex;
        gap: 10px;
        align-items: center;
      }
      
      .save-all-btn {
        background: #28a745;
        color: white;
        font-weight: bold;
      }
      
      .save-all-btn:hover {
        background: #218838;
      }
      
      .cancel-all-btn {
        background: #dc3545;
        color: white;
      }
      
      .cancel-all-btn:hover {
        background: #c82333;
      }
      
      .actions-column {
        width: 80px;
        text-align: center;
      }
      
      .delete-doc-btn {
        background: transparent;
        border: 1px solid #dc3545;
        color: #dc3545;
        padding: 4px 8px;
        font-size: 14px;
        cursor: pointer;
      }
      
      .delete-doc-btn:hover {
        background: #dc3545;
        color: white;
      }
      
      .delete-db-btn {
        background: #dc3545;
        color: white;
        border: 1px solid #dc3545;
        font-weight: bold;
      }
      
      .delete-db-btn:hover {
        background: #c82333;
        border-color: #bd2130;
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
      
      // Show database selector and delete button for MongoDB
      if (provider === 'mongodb') {
        console.log('[View] Showing database selector, requesting database list');
        this.elements.databaseSelect.style.display = 'inline-block';
        this.elements.deleteDbBtn.style.display = 'inline-block';
        this.emit('action', { type: 'listDatabases' });
      } else {
        this.elements.databaseSelect.style.display = 'none';
        this.elements.deleteDbBtn.style.display = 'none';
      }
    });

    this.elements.databaseSelect.addEventListener('change', () => {
      const database = this.elements.databaseSelect.value;
      if (database) {
        this.emit('action', { type: 'selectDatabase', database });
      }
    });

    this.elements.deleteDbBtn.addEventListener('click', () => {
      const currentDb = this.elements.databaseSelect.value;
      if (currentDb) {
        this.emit('action', { type: 'deleteDatabase', database: currentDb });
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
        .map(db => {
          let sizeStr = '';
          if (db.sizeOnDisk) {
            const sizeInMB = db.sizeOnDisk / 1024 / 1024;
            if (sizeInMB < 0.1) {
              // Show in KB for very small databases
              sizeStr = ` (${Math.round(db.sizeOnDisk / 1024)}KB)`;
            } else if (sizeInMB < 1) {
              // Show with decimal for small databases
              sizeStr = ` (${sizeInMB.toFixed(1)}MB)`;
            } else {
              // Round to nearest MB for larger databases
              sizeStr = ` (${Math.round(sizeInMB)}MB)`;
            }
          }
          return `<option value="${db.name || db}">${db.name || db}${sizeStr}</option>`;
        }).join('');
      
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

    // Add save button if there are edits
    const saveButton = this.editedCells.size > 0 
      ? `<div class="edit-toolbar">
          <button class="save-all-btn">💾 Save Changes (${this.editedCells.size})</button>
          <button class="cancel-all-btn">❌ Cancel</button>
        </div>` 
      : '';

    const table = `
      ${saveButton}
      <table class="document-table">
        <thead>
          <tr>
            ${headers.map(key => `<th>${key}</th>`).join('')}
            <th class="actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${documents.map(doc => {
            const docId = doc._id || doc.id;
            return `
            <tr data-doc-id="${docId}">
              ${headers.map(key => {
                const cellKey = `${docId}-${key}`;
                const isEdited = this.editedCells.has(cellKey);
                const value = isEdited ? this.editedCells.get(cellKey) : doc[key];
                const isEditable = key !== '_id' && key !== 'id'; // Don't allow editing IDs
                
                return `
                <td 
                  class="document-cell ${isEdited ? 'edited' : ''} ${isEditable ? 'editable' : ''}"
                  ${isEditable ? 'contenteditable="true"' : ''}
                  data-doc-id="${docId}"
                  data-field="${key}"
                  data-type="${typeof doc[key]}"
                  data-original="${this.escapeHtml(this.formatValueForEdit(doc[key]))}"
                >${this.formatValueForEdit(value)}</td>
              `;
              }).join('')}
              <td class="actions-column">
                <button class="delete-doc-btn" data-doc-id="${docId}">🗑️</button>
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    `;

    this.elements.documentsGrid.innerHTML = table;
    this.attachCellEditHandlers();
  }

  formatValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return String(value);
  }

  formatValueForEdit(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  attachCellEditHandlers() {
    // Handle cell editing
    this.elements.documentsGrid.querySelectorAll('.document-cell.editable').forEach(cell => {
      // Store original value on focus
      cell.addEventListener('focus', (e) => {
        const docId = e.target.dataset.docId;
        const field = e.target.dataset.field;
        const key = `${docId}-${field}`;
        
        if (!this.originalValues.has(key)) {
          this.originalValues.set(key, e.target.textContent);
        }
        
        // Select all text for easy editing
        const range = document.createRange();
        range.selectNodeContents(e.target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });

      // Handle blur (save changes)
      cell.addEventListener('blur', (e) => {
        this.handleCellEdit(e.target);
      });

      // Handle keyboard shortcuts
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.target.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelCellEdit(e.target);
        }
      });
    });

    // Handle save all button
    const saveAllBtn = this.elements.documentsGrid.querySelector('.save-all-btn');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => {
        this.saveAllChanges();
      });
    }

    // Handle cancel all button
    const cancelAllBtn = this.elements.documentsGrid.querySelector('.cancel-all-btn');
    if (cancelAllBtn) {
      cancelAllBtn.addEventListener('click', () => {
        this.cancelAllChanges();
      });
    }

    // Handle delete buttons
    this.elements.documentsGrid.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = e.target.dataset.docId;
        this.emit('action', { type: 'deleteDocument', id: docId });
      });
    });
  }

  handleCellEdit(cell) {
    const docId = cell.dataset.docId;
    const field = cell.dataset.field;
    const type = cell.dataset.type;
    const key = `${docId}-${field}`;
    const newValue = cell.textContent.trim();
    const originalValue = this.originalValues.get(key) || cell.dataset.original;

    if (newValue !== originalValue) {
      // Parse value based on type
      let parsedValue = newValue;
      try {
        if (type === 'number') {
          parsedValue = Number(newValue);
          if (isNaN(parsedValue)) {
            throw new Error('Invalid number');
          }
        } else if (type === 'boolean') {
          parsedValue = newValue.toLowerCase() === 'true';
        } else if (type === 'object' || newValue.startsWith('{') || newValue.startsWith('[')) {
          parsedValue = JSON.parse(newValue);
        }
      } catch (error) {
        alert(`Invalid value for ${field}: ${error.message}`);
        cell.textContent = originalValue;
        return;
      }

      // Mark as edited
      this.editedCells.set(key, parsedValue);
      cell.classList.add('edited');
      
      // Re-render to show save button
      this.emit('action', { type: 'cellEdited', docId, field, value: parsedValue });
    }
  }

  cancelCellEdit(cell) {
    const docId = cell.dataset.docId;
    const field = cell.dataset.field;
    const key = `${docId}-${field}`;
    
    // Restore original value
    const originalValue = this.originalValues.get(key) || cell.dataset.original;
    cell.textContent = originalValue;
    
    // Remove from edited cells
    this.editedCells.delete(key);
    cell.classList.remove('edited');
    
    // Blur to exit edit mode
    cell.blur();
  }

  async saveAllChanges() {
    console.log('[View] saveAllChanges called');
    console.log('[View] editedCells:', Array.from(this.editedCells.entries()));
    
    const changes = new Map();
    
    // Group changes by document
    for (const [key, value] of this.editedCells) {
      // Split at the last hyphen to handle IDs with hyphens
      const lastHyphen = key.lastIndexOf('-');
      const docId = key.substring(0, lastHyphen);
      const field = key.substring(lastHyphen + 1);
      
      console.log(`[View] Processing edit - docId: ${docId}, field: ${field}, value:`, value);
      
      if (!changes.has(docId)) {
        changes.set(docId, {});
      }
      changes.get(docId)[field] = value;
    }

    console.log('[View] Grouped changes:', Array.from(changes.entries()));

    // Emit save action for each document
    for (const [docId, updates] of changes) {
      console.log(`[View] Emitting updateDocument for ${docId} with updates:`, { $set: updates });
      this.emit('action', { 
        type: 'updateDocument', 
        id: docId, 
        update: { $set: updates } 
      });
    }

    // Clear edited cells after saving
    this.editedCells.clear();
    this.originalValues.clear();
  }

  cancelAllChanges() {
    // Clear all edits and refresh
    this.editedCells.clear();
    this.originalValues.clear();
    this.emit('action', { type: 'refresh' });
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