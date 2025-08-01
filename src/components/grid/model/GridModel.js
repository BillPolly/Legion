/**
 * GridModel - Data layer for the grid component
 * 
 * Manages data state, ordering, validation, and drag & drop operations
 * following the Model layer of MVVM pattern.
 */
export class GridModel {
  constructor(data, columns, config) {
    this.data = [...data];
    this.columns = [...columns];
    this.config = config;
    
    // State tracking
    this.changes = new Map();
    this.selection = new Set();
    this.sortColumn = null;
    this.sortDirection = 'asc';
    
    // Interactive features state
    this.columnOrder = columns.map((col, index) => index);
    this.columnWidths = new Map(columns.map(col => [col.key, col.width || '150px']));
    this.rowOrder = data.map((_, index) => index);
    
    // Drag & drop state
    this.isDragging = false;
    this.dragType = null; // 'row' | 'column'
    this.dragIndex = null;
    this.dropIndex = null;
  }
  
  // Data operations
  updateRow(index, updates) {
    const actualIndex = this.rowOrder[index];
    this.data[actualIndex] = { ...this.data[actualIndex], ...updates };
    this.changes.set(actualIndex, { ...this.changes.get(actualIndex), ...updates });
  }
  
  getRow(index) {
    const actualIndex = this.rowOrder[index];
    return this.data[actualIndex];
  }
  
  addRow(newRow) {
    const newIndex = this.data.length;
    this.data.push(newRow);
    this.rowOrder.push(newIndex);
    return newIndex;
  }
  
  deleteRow(index) {
    const actualIndex = this.rowOrder[index];
    this.data.splice(actualIndex, 1);
    this.rowOrder = this.rowOrder.filter(i => i !== actualIndex)
      .map(i => i > actualIndex ? i - 1 : i);
  }
  
  deleteRows(indices) {
    // Sort indices in descending order to avoid index shifting issues
    const sortedIndices = [...indices].sort((a, b) => b - a);
    sortedIndices.forEach(index => this.deleteRow(index));
  }
  
  // Row drag & drop
  moveRow(fromIndex, toIndex) {
    if (fromIndex === toIndex) return this.getOrderedData();
    
    const newOrder = [...this.rowOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    this.rowOrder = newOrder;
    return this.getOrderedData();
  }
  
  // Column operations
  moveColumn(fromIndex, toIndex) {
    if (fromIndex === toIndex) return this.getOrderedColumns();
    
    const newOrder = [...this.columnOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    this.columnOrder = newOrder;
    return this.getOrderedColumns();
  }
  
  resizeColumn(columnKey, newWidth) {
    this.columnWidths.set(columnKey, newWidth);
  }
  
  getColumnWidth(columnKey) {
    return this.columnWidths.get(columnKey) || '150px';
  }
  
  getOrderedColumns() {
    return this.columnOrder.map(index => this.columns[index]);
  }
  
  getOrderedData() {
    return this.rowOrder.map(index => this.data[index]);
  }
  
  // Selection management
  selectRow(index) {
    if (this.config.selectable === 'single') {
      this.selection.clear();
    }
    this.selection.add(index);
  }
  
  deselectRow(index) {
    this.selection.delete(index);
  }
  
  toggleRowSelection(index) {
    if (this.selection.has(index)) {
      this.deselectRow(index);
    } else {
      this.selectRow(index);
    }
  }
  
  clearSelection() {
    this.selection.clear();
  }
  
  getSelectedRows() {
    return Array.from(this.selection);
  }
  
  isRowSelected(index) {
    return this.selection.has(index);
  }
  
  // Drag state management
  startDrag(type, index) {
    this.isDragging = true;
    this.dragType = type;
    this.dragIndex = index;
  }
  
  endDrag() {
    this.isDragging = false;
    this.dragType = null;
    this.dragIndex = null;
    this.dropIndex = null;
  }
  
  setDropTarget(index) {
    this.dropIndex = index;
  }
  
  // Sorting
  sort(columnKey, direction) {
    const column = this.columns.find(col => col.key === columnKey);
    if (!column || !column.sortable) return;
    
    const sortedIndices = this.rowOrder
      .map(index => ({ index, value: this.data[index][columnKey] }))
      .sort((a, b) => {
        let aVal = a.value;
        let bVal = b.value;
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        // Convert to comparable types
        if (column.type === 'number') {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        } else {
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();
        }
        
        if (direction === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      })
      .map(item => item.index);
    
    this.rowOrder = sortedIndices;
    this.sortColumn = columnKey;
    this.sortDirection = direction;
  }
  
  // Validation
  validateRow(index) {
    const row = this.getRow(index);
    const errors = [];
    
    this.getOrderedColumns().forEach(column => {
      const value = row[column.key];
      
      // Required field validation
      if (column.required && (value === null || value === undefined || value === '')) {
        errors.push({
          columnKey: column.key,
          message: `${column.label} is required`
        });
      }
      
      // Custom validation
      if (column.validator && value !== null && value !== undefined) {
        const validation = column.validator(value);
        if (!validation.valid) {
          errors.push({
            columnKey: column.key,
            message: validation.message
          });
        }
      }
      
      // Type-specific validation
      if (column.type === 'number' && value !== null && value !== undefined && value !== '') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors.push({
            columnKey: column.key,
            message: `${column.label} must be a valid number`
          });
        } else {
          if (column.min !== undefined && numValue < column.min) {
            errors.push({
              columnKey: column.key,
              message: `${column.label} must be at least ${column.min}`
            });
          }
          if (column.max !== undefined && numValue > column.max) {
            errors.push({
              columnKey: column.key,
              message: `${column.label} must be at most ${column.max}`
            });
          }
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  validateAll() {
    const allErrors = [];
    
    for (let i = 0; i < this.getOrderedData().length; i++) {
      const validation = this.validateRow(i);
      if (!validation.valid) {
        allErrors.push({
          rowIndex: i,
          errors: validation.errors
        });
      }
    }
    
    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }
  
  // Data management
  setData(newData) {
    this.data = [...newData];
    this.rowOrder = newData.map((_, index) => index);
    this.changes.clear();
    this.selection.clear();
  }
  
  getData() {
    return this.getOrderedData();
  }
  
  getChanges() {
    return new Map(this.changes);
  }
  
  hasChanges() {
    return this.changes.size > 0;
  }
  
  // Configuration updates
  updateColumns(newColumns) {
    this.columns = [...newColumns];
    this.columnOrder = newColumns.map((col, index) => index);
    // Preserve existing column widths
    newColumns.forEach(col => {
      if (!this.columnWidths.has(col.key)) {
        this.columnWidths.set(col.key, col.width || '150px');
      }
    });
  }
}