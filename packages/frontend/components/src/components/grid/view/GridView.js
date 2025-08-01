/**
 * GridView - View layer for the grid component
 * 
 * Handles DOM rendering, user interactions, and visual feedback
 * following the View layer of MVVM pattern.
 */
export class GridView {
  constructor(element, mode, config) {
    this.element = element;
    this.mode = mode; // 'table' or 'attribute'
    this.config = config;
    this.rendered = false;
    
    // DOM references
    this.tableElement = null;
    this.headerElement = null;
    this.bodyElement = null;
    
    // Event handlers storage
    this.eventHandlers = new Map();
    
    // Current data/columns cache
    this.currentData = [];
    this.currentColumns = [];
  }
  
  render(data, columns) {
    this.currentData = data;
    this.currentColumns = columns;
    
    if (this.mode === 'table') {
      this.renderTable(data, columns);
    } else {
      this.renderAttribute(data, columns);
    }
    this.rendered = true;
  }
  
  renderTable(data, columns) {
    // Clear existing content
    this.element.innerHTML = '';
    
    // Create table structure
    this.tableElement = document.createElement('table');
    this.tableElement.className = 'umbilical-grid-table';
    this.tableElement.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      font-family: inherit;
      font-size: 14px;
      background: white;
    `;
    
    // Create header
    this.headerElement = document.createElement('thead');
    this.renderTableHeader(columns);
    this.tableElement.appendChild(this.headerElement);
    
    // Create body
    this.bodyElement = document.createElement('tbody');
    this.renderTableRows(data, columns);
    this.tableElement.appendChild(this.bodyElement);
    
    this.element.appendChild(this.tableElement);
  }
  
  renderTableHeader(columns) {
    this.headerElement.innerHTML = '';
    const headerRow = document.createElement('tr');
    
    // Remove drag handle column since entire rows are now draggable
    
    // Add selection column if selectable
    if (this.config.selectable && this.config.selectable !== 'none') {
      const selectColumn = document.createElement('th');
      selectColumn.className = 'select-column-header';
      selectColumn.style.cssText = `
        width: 40px;
        padding: 12px 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        text-align: center;
        font-weight: 600;
      `;
      
      if (this.config.selectable === 'multiple') {
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.className = 'select-all-checkbox';
        selectColumn.appendChild(selectAllCheckbox);
      }
      
      headerRow.appendChild(selectColumn);
    }
    
    // Create column headers
    columns.forEach((column, index) => {
      const th = document.createElement('th');
      th.className = 'column-header';
      th.setAttribute('data-column-key', column.key);
      th.setAttribute('data-column-index', index);
      
      const width = this.getColumnWidth(column);
      // Make column draggable if column dragging is enabled
      if (this.config.columnDragging?.enabled) {
        th.setAttribute('draggable', 'true');
      }
      
      th.style.cssText = `
        padding: 12px 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        text-align: left;
        font-weight: 600;
        position: relative;
        width: ${width};
        cursor: ${column.sortable ? 'pointer' : 'default'};
        user-select: none;
        ${this.config.columnDragging?.enabled ? 'cursor: move;' : ''}
      `;
      
      // Header content container
      const headerContent = document.createElement('div');
      headerContent.className = 'header-content';
      headerContent.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      `;
      
      // Column label
      const labelSpan = document.createElement('span');
      labelSpan.textContent = column.label;
      labelSpan.style.cssText = 'flex: 1; min-width: 0;';
      headerContent.appendChild(labelSpan);
      
      // Sort indicator
      if (column.sortable) {
        const sortIndicator = document.createElement('span');
        sortIndicator.className = 'sort-indicator';
        sortIndicator.innerHTML = '↕';
        sortIndicator.style.cssText = `
          opacity: 0.3;
          font-size: 12px;
          cursor: pointer;
        `;
        headerContent.appendChild(sortIndicator);
      }
      
      th.appendChild(headerContent);
      
      // Add resize handle
      if (this.config.columnResizing?.enabled && column.resizable !== false) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.setAttribute('data-column-key', column.key);
        resizeHandle.style.cssText = `
          position: absolute;
          top: 0;
          right: -3px;
          width: 6px;
          height: 100%;
          background: transparent;
          cursor: col-resize;
          z-index: 2;
        `;
        
        resizeHandle.addEventListener('mouseenter', () => {
          resizeHandle.style.background = 'rgba(59, 130, 246, 0.3)';
        });
        
        resizeHandle.addEventListener('mouseleave', () => {
          resizeHandle.style.background = 'transparent';
        });
        
        th.appendChild(resizeHandle);
      }
      
      headerRow.appendChild(th);
    });
    
    this.headerElement.appendChild(headerRow);
  }
  
  renderTableRows(data, columns) {
    this.bodyElement.innerHTML = '';
    
    data.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      tr.className = 'grid-row';
      tr.setAttribute('data-row-index', rowIndex);
      
      const isSelected = this.isRowSelected ? this.isRowSelected(rowIndex) : false;
      
      // Make entire row draggable if row dragging is enabled
      if (this.config.rowDragging?.enabled) {
        tr.setAttribute('draggable', 'true');
        tr.style.cursor = 'grab';
      }
      
      tr.style.cssText = `
        border: 1px solid #e2e8f0;
        background: ${isSelected ? '#eff6ff' : (rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc')};
        transition: all 0.2s ease;
        transform: translate3d(0, 0, 0);
        ${this.config.rowDragging?.enabled ? 'cursor: grab;' : ''}
      `;
      
      // Enhanced hover effect with smooth transitions
      tr.addEventListener('mouseenter', () => {
        if (!isSelected && !tr.classList.contains('dragging')) {
          tr.style.background = '#f1f5f9';
          if (this.config.rowDragging?.enabled) {
            tr.style.transform = 'translate3d(0, -1px, 0)';
            tr.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
          }
        }
      });
      
      tr.addEventListener('mouseleave', () => {
        if (!tr.classList.contains('dragging')) {
          tr.style.background = isSelected ? '#eff6ff' : (rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc');
          tr.style.transform = 'translate3d(0, 0, 0)';
          tr.style.boxShadow = 'none';
        }
      });
      
      // Add drag start visual feedback
      if (this.config.rowDragging?.enabled) {
        tr.addEventListener('dragstart', () => {
          tr.style.cursor = 'grabbing';
        });
        
        tr.addEventListener('dragend', () => {
          tr.style.cursor = 'grab';
        });
      }
      
      // Add selection cell
      if (this.config.selectable && this.config.selectable !== 'none') {
        const selectCell = document.createElement('td');
        selectCell.className = 'select-cell';
        selectCell.style.cssText = `
          width: 40px;
          padding: 8px;
          text-align: center;
          border: 1px solid #e2e8f0;
        `;
        
        const selectInput = document.createElement('input');
        selectInput.type = this.config.selectable === 'multiple' ? 'checkbox' : 'radio';
        selectInput.className = 'row-selector';
        selectInput.setAttribute('data-row-index', rowIndex);
        selectInput.checked = isSelected;
        
        selectCell.appendChild(selectInput);
        tr.appendChild(selectCell);
      }
      
      // Create data cells
      columns.forEach((column) => {
        const td = document.createElement('td');
        td.className = 'grid-cell';
        td.setAttribute('data-column-key', column.key);
        td.setAttribute('data-row-index', rowIndex);
        td.style.cssText = `
          padding: 8px;
          border: 1px solid #e2e8f0;
          cursor: ${column.editable ? 'pointer' : 'default'};
          position: relative;
        `;
        
        const value = row[column.key];
        const formattedValue = this.formatCellValue(value, column);
        td.textContent = formattedValue;
        
        // Add click handler for editing
        if (column.editable) {
          td.addEventListener('click', () => {
            this.onCellClick && this.onCellClick(rowIndex, column.key);
          });
        }
        
        tr.appendChild(td);
      });
      
      this.bodyElement.appendChild(tr);
    });
  }
  
  renderAttribute(data, columns) {
    // Clear existing content
    this.element.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'umbilical-grid-attribute';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-family: inherit;
      background: white;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    `;
    
    const record = data[0] || {};
    
    columns.forEach((column) => {
      const row = document.createElement('div');
      row.className = 'attribute-row';
      row.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 20px;
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: #ffffff;
        min-height: 44px;
      `;
      
      // Label
      const label = document.createElement('div');
      label.className = 'attribute-label';
      label.style.cssText = `
        min-width: 150px;
        font-weight: 500;
        color: #374151;
        padding-top: 8px;
        flex-shrink: 0;
      `;
      label.textContent = column.label;
      
      // Required indicator
      if (column.required) {
        const requiredSpan = document.createElement('span');
        requiredSpan.style.color = '#ef4444';
        requiredSpan.textContent = ' *';
        label.appendChild(requiredSpan);
      }
      
      // Value container
      const valueContainer = document.createElement('div');
      valueContainer.className = 'attribute-value';
      valueContainer.setAttribute('data-column-key', column.key);
      valueContainer.setAttribute('data-row-index', '0');
      valueContainer.style.cssText = `
        flex: 1;
        cursor: ${column.editable ? 'pointer' : 'default'};
        min-height: 32px;
        padding: 8px;
        border-radius: 4px;
        ${column.editable ? 'border: 1px solid transparent; transition: border-color 0.15s;' : ''}
      `;
      
      if (column.editable) {
        valueContainer.addEventListener('mouseenter', () => {
          valueContainer.style.borderColor = '#d1d5db';
          valueContainer.style.background = '#f9fafb';
        });
        
        valueContainer.addEventListener('mouseleave', () => {
          valueContainer.style.borderColor = 'transparent';
          valueContainer.style.background = 'transparent';
        });
        
        valueContainer.addEventListener('click', () => {
          this.onCellClick && this.onCellClick(0, column.key);
        });
      }
      
      const value = record[column.key];
      const formattedValue = this.formatCellValue(value, column);
      
      if (column.multiline && formattedValue) {
        valueContainer.style.whiteSpace = 'pre-wrap';
      }
      
      valueContainer.textContent = formattedValue || '';
      
      row.appendChild(label);
      row.appendChild(valueContainer);
      container.appendChild(row);
    });
    
    this.element.appendChild(container);
  }
  
  // Cell management
  updateCell(rowIndex, columnKey, value) {
    const cell = this.element.querySelector(`[data-row-index="${rowIndex}"][data-column-key="${columnKey}"]`);
    if (cell) {
      const column = this.currentColumns.find(col => col.key === columnKey);
      const formattedValue = this.formatCellValue(value, column);
      cell.textContent = formattedValue;
    }
  }
  
  showEditor(rowIndex, columnKey, editorElement) {
    const cell = this.element.querySelector(`[data-row-index="${rowIndex}"][data-column-key="${columnKey}"]`);
    if (cell) {
      cell.innerHTML = '';
      cell.appendChild(editorElement);
      // Keep original padding - editor will handle its own spacing
      cell.style.padding = '0';
    }
  }
  
  hideEditor(rowIndex, columnKey) {
    const cell = this.element.querySelector(`[data-row-index="${rowIndex}"][data-column-key="${columnKey}"]`);
    if (cell) {
      const column = this.currentColumns.find(col => col.key === columnKey);
      const row = this.currentData[rowIndex];
      const value = row ? row[columnKey] : '';
      const formattedValue = this.formatCellValue(value, column);
      
      cell.innerHTML = '';
      cell.textContent = formattedValue;
      cell.style.padding = '8px';
    }
  }
  
  // Utility methods
  formatCellValue(value, column) {
    if (value === null || value === undefined) return '';
    
    if (column.format) {
      return column.format(value);
    }
    
    if (column.type === 'boolean') {
      return value ? (column.trueLabel || 'Yes') : (column.falseLabel || 'No');
    }
    
    return String(value);
  }
  
  getColumnWidth(column) {
    return this.getStoredWidth ? this.getStoredWidth(column.key) : (column.width || '150px');
  }
  
  // Event handler management
  addEventListener(element, event, handler, key) {
    element.addEventListener(event, handler);
    
    if (key) {
      if (!this.eventHandlers.has(key)) {
        this.eventHandlers.set(key, []);
      }
      this.eventHandlers.get(key).push({ element, event, handler });
    }
  }
  
  removeEventListeners(key) {
    if (this.eventHandlers.has(key)) {
      this.eventHandlers.get(key).forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.eventHandlers.delete(key);
    }
  }
  
  // Selection visual updates
  updateRowSelection(rowIndex, isSelected) {
    const row = this.element.querySelector(`tr[data-row-index="${rowIndex}"]`);
    if (row) {
      row.style.background = isSelected ? '#eff6ff' : (rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc');
      
      const checkbox = row.querySelector('.row-selector');
      if (checkbox) {
        checkbox.checked = isSelected;
      }
    }
  }
  
  updateSelectAllCheckbox(isChecked, isIndeterminate = false) {
    const selectAllCheckbox = this.element.querySelector('.select-all-checkbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = isChecked;
      selectAllCheckbox.indeterminate = isIndeterminate;
    }
  }
  
  // Sort indicators
  updateSortIndicators(columnKey, direction) {
    // Reset all indicators
    const indicators = this.element.querySelectorAll('.sort-indicator');
    indicators.forEach(indicator => {
      indicator.innerHTML = '↕';
      indicator.style.opacity = '0.3';
    });
    
    // Update active indicator
    const activeHeader = this.element.querySelector(`th[data-column-key="${columnKey}"] .sort-indicator`);
    if (activeHeader) {
      activeHeader.innerHTML = direction === 'asc' ? '↑' : '↓';
      activeHeader.style.opacity = '1';
      activeHeader.style.color = '#3b82f6';
    }
  }
  
  // Column width updates
  updateColumnWidth(columnKey, width) {
    const th = this.element.querySelector(`th[data-column-key="${columnKey}"]`);
    if (th) {
      th.style.width = width;
    }
    
    // Update all cells in this column
    const cells = this.element.querySelectorAll(`td[data-column-key="${columnKey}"]`);
    cells.forEach(cell => {
      cell.style.width = width;
    });
  }
  
  // Drag & Drop visual feedback with smooth animations
  showRowDragFeedback(rowIndex) {
    const row = this.element.querySelector(`tr[data-row-index="${rowIndex}"]`);
    if (row) {
      row.classList.add('dragging');
      // Hide the original row completely - no space left behind
      row.style.display = 'none';
      
      // Create ghost placeholder to show where the row came from
      this.createGhostPlaceholder(row, rowIndex);
    }
  }
  
  createGhostPlaceholder(originalRow, rowIndex) {
    // Remove existing ghost
    const existingGhost = this.element.querySelector('.ghost-placeholder');
    if (existingGhost) {
      existingGhost.remove();
    }
    
    const ghost = originalRow.cloneNode(true);
    ghost.className = 'ghost-placeholder';
    
    // Clear any dragging styles from the cloned element
    ghost.classList.remove('dragging');
    
    // Reset all styles and apply only ghost styles
    ghost.style.cssText = `
      opacity: 0.3;
      background: #f8fafc !important;
      border: 2px dashed #cbd5e1;
      position: relative;
      pointer-events: none;
      transform: none;
      z-index: auto;
      box-shadow: none;
      cursor: auto;
    `;
    
    // Insert ghost after original row
    originalRow.parentNode.insertBefore(ghost, originalRow.nextSibling);
  }
  
  hideRowDragFeedback() {
    const draggingRows = this.element.querySelectorAll('.dragging');
    draggingRows.forEach(row => {
      row.classList.remove('dragging');
      // Restore display
      row.style.display = '';
    });
    
    // Remove ghost placeholder
    const ghost = this.element.querySelector('.ghost-placeholder');
    if (ghost) {
      ghost.remove();
    }
    
    // Clear drop zones and indicators
    this.clearDropIndicators();
  }
  
  showRowDropZone(targetIndex) {
    // Clear previous drop indicators
    this.clearDropIndicators();
    
    const targetRow = this.element.querySelector(`tr[data-row-index="${targetIndex}"]`);
    if (targetRow && !targetRow.classList.contains('dragging')) {
      // Create drop indicator line
      const indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      indicator.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: #3b82f6;
        border-radius: 2px;
        box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
        z-index: 999;
        animation: pulse 1s infinite;
        transform: translateY(-1px);
      `;
      
      // Position indicator above target row
      targetRow.style.position = 'relative';
      targetRow.insertBefore(indicator, targetRow.firstChild);
      targetRow.classList.add('drop-target');
      
      // Add pulse animation if not already defined
      if (!document.querySelector('#drop-indicator-styles')) {
        const style = document.createElement('style');
        style.id = 'drop-indicator-styles';
        style.textContent = `
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: translateY(-1px) scaleY(1); }
            50% { opacity: 0.7; transform: translateY(-1px) scaleY(1.2); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }
  
  clearDropIndicators() {
    const indicators = this.element.querySelectorAll('.drop-indicator');
    indicators.forEach(indicator => indicator.remove());
    
    const dropTargets = this.element.querySelectorAll('.drop-target');
    dropTargets.forEach(target => {
      target.classList.remove('drop-target');
      target.style.position = '';
    });
  }
  
  showColumnDragFeedback(columnIndex) {
    // Find the column key from the header
    const header = this.element.querySelector(`th[data-column-index="${columnIndex}"]`);
    if (!header) {
      return;
    }
    
    const columnKey = header.getAttribute('data-column-key');
    const columnElements = this.getColumnElements(columnKey);
    
    // Apply the SAME styling as row dragging - visible but styled
    columnElements.forEach((element) => {
      element.classList.add('dragging-column');
      element.style.cssText += `
        opacity: 0.7;
        transform: translate3d(0, 0, 0) scale(1.02);
        z-index: 1000;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        background: #ffffff !important;
        border: 2px solid #3b82f6;
      `;
    });
    
    // NO ghost placeholders for columns - the styled column + drag image is enough
  }
  
  // Removed createColumnGhostPlaceholder - columns can't have placeholders like rows do
  
  getColumnElements(columnKey) {
    // Get header and all cells for this column
    const elements = [];
    
    // Add header
    const header = this.element.querySelector(`th[data-column-key="${columnKey}"]`);
    if (header) {
      elements.push(header);
    }
    
    // Add all cells in this column
    const cells = this.element.querySelectorAll(`td[data-column-key="${columnKey}"]`);
    cells.forEach(cell => elements.push(cell));
    
    return elements;
  }
  
  hideColumnDragFeedback() {
    // Restore original styling of dragging elements
    const draggingElements = this.element.querySelectorAll('.dragging-column');
    draggingElements.forEach(element => {
      element.classList.remove('dragging-column');
      // Remove the inline styles we added
      element.style.cssText = element.style.cssText
        .replace(/opacity:[^;]*;?/g, '')
        .replace(/transform:[^;]*;?/g, '')
        .replace(/z-index:[^;]*;?/g, '')
        .replace(/box-shadow:[^;]*;?/g, '')
        .replace(/background:[^;]*;?/g, '')
        .replace(/border:[^;]*;?/g, '');
    });
    
    // Clear column drop indicators
    this.clearColumnDropIndicators();
  }
  
  showColumnDropZone(targetIndex) {
    // Clear previous drop indicators
    this.clearColumnDropIndicators();
    
    const targetHeader = this.element.querySelector(`th[data-column-index="${targetIndex}"]`);
    if (targetHeader && !targetHeader.classList.contains('dragging-column')) {
      const targetColumnKey = targetHeader.getAttribute('data-column-key');
      const columnElements = this.getColumnElements(targetColumnKey);
      
      columnElements.forEach(element => {
        // Create drop indicator line
        const indicator = document.createElement('div');
        indicator.className = 'column-drop-indicator';
        indicator.style.cssText = `
          position: absolute;
          left: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background: #3b82f6;
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
          z-index: 999;
          animation: columnPulse 1s infinite;
        `;
        
        // Position indicator at the left edge of target column
        element.style.position = 'relative';
        element.insertBefore(indicator, element.firstChild);
        element.classList.add('column-drop-target');
      });
      
      // Add column pulse animation if not already defined
      if (!document.querySelector('#column-indicator-styles')) {
        const style = document.createElement('style');
        style.id = 'column-indicator-styles';
        style.textContent = `
          @keyframes columnPulse {
            0%, 100% { opacity: 1; width: 4px; }
            50% { opacity: 0.7; width: 6px; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }
  
  clearColumnDropIndicators() {
    const indicators = this.element.querySelectorAll('.column-drop-indicator');
    indicators.forEach(indicator => indicator.remove());
    
    const dropTargets = this.element.querySelectorAll('.column-drop-target');
    dropTargets.forEach(target => {
      target.classList.remove('column-drop-target');
      target.style.position = '';
    });
  }
  
  showResizeFeedback(columnKey) {
    const th = this.element.querySelector(`th[data-column-key="${columnKey}"]`);
    if (th) {
      th.style.borderRight = '2px solid #3b82f6';
    }
  }
  
  hideResizeFeedback() {
    const headers = this.element.querySelectorAll('th');
    headers.forEach(header => {
      header.style.borderRight = '1px solid #e2e8f0';
    });
  }
  
  // Complete re-render
  updateRowOrder(newData) {
    // Temporarily use a simpler approach - re-render the rows
    // This will lose event listeners but should work for testing
    console.log('🔄 Updating row order with data:', newData);
    this.currentData = newData;
    this.renderTableRows(newData, this.currentColumns);
    console.log('✅ Row order updated');
  }
  
  updateColumnOrder(newColumns) {
    console.log('🔄 Updating column order with:', newColumns.map(col => col.key));
    this.render(this.currentData, newColumns);
    console.log('✅ Column order updated');
  }
  
  // Cleanup
  destroy() {
    // Remove all event listeners
    this.eventHandlers.forEach((handlers, key) => {
      this.removeEventListeners(key);
    });
    
    // Clear DOM
    this.element.innerHTML = '';
  }
}