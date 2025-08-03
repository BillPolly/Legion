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
    this.isAddingNew = false; // Track if we're adding a new document
    this.newDocumentData = {}; // Store new document data
    
    // Sorting state
    this.sortColumns = []; // Array of {field, direction, order}
    this.originalDocuments = []; // Keep original unsorted documents
    
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
        overflow: hidden;
        min-width: 0;
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
        max-height: calc(100vh - 250px);
        overflow-x: auto;
        overflow-y: auto;
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
        min-width: 600px;
        border-collapse: collapse;
        table-layout: auto;
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
      
      .sortable-header {
        cursor: pointer;
        user-select: none;
        position: relative;
        transition: background-color 0.2s;
      }
      
      .sortable-header:hover {
        background: #e9ecef;
      }
      
      .sort-indicator {
        margin-left: 5px;
        color: #007acc;
        font-size: 12px;
      }
      
      .sort-indicator sup {
        font-size: 10px;
        margin-left: 2px;
        color: #666;
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
      
      .new-document-row {
        background: #e8f5e9;
        border: 2px solid #4caf50;
      }
      
      .new-document-row .new-cell {
        background: white;
        border: 1px solid #4caf50;
        min-height: 20px;
        padding: 8px;
      }
      
      .new-document-row .new-cell:empty::before {
        content: attr(placeholder);
        color: #999;
        font-style: italic;
      }
      
      .new-document-row .new-cell:focus {
        outline: 2px solid #4caf50;
        box-shadow: 0 0 3px rgba(76, 175, 80, 0.3);
      }
      
      .save-new-btn {
        background: #4caf50;
        color: white;
        border: none;
        padding: 4px 8px;
        cursor: pointer;
      }
      
      .save-new-btn:hover {
        background: #45a049;
      }
      
      .cancel-new-btn {
        background: #f44336;
        color: white;
        border: none;
        padding: 4px 8px;
        cursor: pointer;
        margin-left: 4px;
      }
      
      .cancel-new-btn:hover {
        background: #da190b;
      }
      
      /* Scrollbar styling */
      .documents-grid::-webkit-scrollbar {
        width: 12px;
        height: 12px;
      }
      
      .documents-grid::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      
      .documents-grid::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
      }
      
      .documents-grid::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      
      .documents-grid::-webkit-scrollbar-corner {
        background: #f1f1f1;
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
      this.startNewDocument();
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
    if (documents.length === 0 && !this.isAddingNew) {
      this.elements.documentsGrid.innerHTML = '<div class="loading">No documents found</div>';
      return;
    }

    // Store original documents
    this.originalDocuments = [...documents];
    
    // Apply sorting if any
    const sortedDocuments = this.sortColumns.length > 0 
      ? this.sortDocuments([...documents]) 
      : documents;

    // Get all unique keys from documents
    const keys = new Set();
    sortedDocuments.forEach(doc => {
      Object.keys(doc).forEach(key => keys.add(key));
    });
    
    // If adding new, ensure we have some default fields
    if (this.isAddingNew && keys.size === 0) {
      // Add some default fields for common collections
      keys.add('name');
      keys.add('value');
      keys.add('description');
    }

    const headers = Array.from(keys).filter(key => key !== '_id').slice(0, 10); // Limit columns, exclude _id

    // Add save button if there are edits
    const saveButton = this.editedCells.size > 0 
      ? `<div class="edit-toolbar">
          <button class="save-all-btn">💾 Save Changes (${this.editedCells.size})</button>
          <button class="cancel-all-btn">❌ Cancel</button>
        </div>` 
      : '';

    // Add new document row if in adding mode
    const newDocumentRow = this.isAddingNew ? `
      <tr class="new-document-row">
        ${headers.map(field => `
          <td 
            class="document-cell editable new-cell"
            contenteditable="true"
            data-doc-id="new"
            data-field="${field}"
            data-type="string"
            placeholder="Enter ${field}"
          >${this.newDocumentData[field] || ''}</td>
        `).join('')}
        <td class="actions-column">
          <button class="save-new-btn" title="Save">💾</button>
          <button class="cancel-new-btn" title="Cancel">❌</button>
        </td>
      </tr>
    ` : '';

    const table = `
      ${saveButton}
      <table class="document-table">
        <thead>
          <tr>
            ${headers.map(key => {
              const sortInfo = this.sortColumns.find(s => s.field === key);
              const sortIndicator = sortInfo 
                ? `<span class="sort-indicator">${sortInfo.direction === 'asc' ? '▲' : '▼'}${this.sortColumns.length > 1 ? `<sup>${sortInfo.order}</sup>` : ''}</span>`
                : '';
              return `<th class="sortable-header" data-field="${key}">${key}${sortIndicator}</th>`;
            }).join('')}
            <th class="actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${newDocumentRow}
          ${sortedDocuments.map(doc => {
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
    this.attachHeaderClickHandlers();
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
    // Handle new document row cells
    this.elements.documentsGrid.querySelectorAll('.new-cell').forEach(cell => {
      cell.addEventListener('blur', (e) => {
        const field = e.target.dataset.field;
        this.newDocumentData[field] = e.target.textContent.trim();
      });
      
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const field = e.target.dataset.field;
          this.newDocumentData[field] = e.target.textContent.trim();
          // Move to next field
          const nextCell = e.target.nextElementSibling;
          if (nextCell && nextCell.classList.contains('new-cell')) {
            nextCell.focus();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelNewDocument();
        }
      });
    });

    // Handle save new button
    const saveNewBtn = this.elements.documentsGrid.querySelector('.save-new-btn');
    if (saveNewBtn) {
      saveNewBtn.addEventListener('click', () => {
        this.saveNewDocument();
      });
    }

    // Handle cancel new button
    const cancelNewBtn = this.elements.documentsGrid.querySelector('.cancel-new-btn');
    if (cancelNewBtn) {
      cancelNewBtn.addEventListener('click', () => {
        this.cancelNewDocument();
      });
    }
    
    // Handle existing cell editing
    this.elements.documentsGrid.querySelectorAll('.document-cell.editable:not(.new-cell)').forEach(cell => {
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

  startNewDocument() {
    this.isAddingNew = true;
    this.newDocumentData = {};
    // Re-render the documents table to show the new row
    const state = this.elements.documentsGrid.innerHTML;
    if (state.includes('document-table')) {
      // Trigger a re-render by emitting a refresh
      this.emit('action', { type: 'refresh' });
    } else {
      // No documents yet, render empty table with new row
      this.renderDocumentsTable([]);
    }
  }

  saveNewDocument() {
    // Collect all data from the new document row
    const newCells = this.elements.documentsGrid.querySelectorAll('.new-cell');
    newCells.forEach(cell => {
      const field = cell.dataset.field;
      const value = cell.textContent.trim();
      if (value) {
        // Parse value based on content
        let parsedValue = value;
        try {
          if (value === 'true' || value === 'false') {
            parsedValue = value === 'true';
          } else if (!isNaN(value) && value !== '') {
            parsedValue = Number(value);
          } else if (value.startsWith('{') || value.startsWith('[')) {
            parsedValue = JSON.parse(value);
          }
        } catch (e) {
          // Keep as string if parsing fails
        }
        this.newDocumentData[field] = parsedValue;
      }
    });

    // Only save if we have some data
    if (Object.keys(this.newDocumentData).length > 0) {
      this.emit('action', { type: 'createDocument', data: this.newDocumentData });
      this.cancelNewDocument();
    } else {
      alert('Please enter at least one field value');
    }
  }

  cancelNewDocument() {
    this.isAddingNew = false;
    this.newDocumentData = {};
    // Refresh to remove the new row
    this.emit('action', { type: 'refresh' });
  }

  attachHeaderClickHandlers() {
    const headers = this.elements.documentsGrid.querySelectorAll('.sortable-header');
    headers.forEach(header => {
      header.addEventListener('click', (e) => {
        const field = header.dataset.field;
        
        console.log('Header clicked:', field, 'ctrlKey:', e.ctrlKey, 'metaKey:', e.metaKey, 'shiftKey:', e.shiftKey);
        
        if (e.ctrlKey || e.metaKey) {
          // Multi-column sort
          console.log('Adding to multi-column sort');
          this.addOrToggleSort(field);
        } else {
          // Single column sort
          console.log('Setting single column sort');
          this.setSingleSort(field);
        }
        
        // Re-render with new sort
        this.renderDocumentsTable(this.originalDocuments);
      });
    });
  }

  setSingleSort(field) {
    const existingSort = this.sortColumns.find(s => s.field === field);
    
    if (!existingSort) {
      // First click: sort descending
      this.sortColumns = [{ field, direction: 'desc', order: 1 }];
    } else if (existingSort.direction === 'desc') {
      // Second click: sort ascending
      this.sortColumns = [{ field, direction: 'asc', order: 1 }];
    } else {
      // Third click: clear sort
      this.sortColumns = [];
    }
  }

  addOrToggleSort(field) {
    const existingIndex = this.sortColumns.findIndex(s => s.field === field);
    
    if (existingIndex === -1) {
      // Add new sort column
      this.sortColumns.push({
        field,
        direction: 'desc',
        order: this.sortColumns.length + 1
      });
    } else {
      const existing = this.sortColumns[existingIndex];
      if (existing.direction === 'desc') {
        // Toggle to ascending
        existing.direction = 'asc';
      } else {
        // Remove from sort
        this.sortColumns.splice(existingIndex, 1);
        // Reorder remaining columns
        this.sortColumns.forEach((col, idx) => {
          col.order = idx + 1;
        });
      }
    }
  }

  sortDocuments(documents) {
    if (this.sortColumns.length === 0) return documents;
    
    return documents.sort((a, b) => {
      for (const sortCol of this.sortColumns) {
        const { field, direction } = sortCol;
        const aVal = this.getSortValue(a[field]);
        const bVal = this.getSortValue(b[field]);
        
        let comparison = 0;
        
        // Handle null/undefined
        if (aVal === null && bVal === null) continue;
        if (aVal === null) return direction === 'asc' ? -1 : 1;
        if (bVal === null) return direction === 'asc' ? 1 : -1;
        
        // Compare values
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          comparison = (aVal === bVal) ? 0 : aVal ? 1 : -1;
        } else {
          // String comparison
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        if (comparison !== 0) {
          return direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  getSortValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') {
      // For objects, sort by JSON string representation
      return JSON.stringify(value);
    }
    return value;
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