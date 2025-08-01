/**
 * Grid Component - Main entry point
 * 
 * A flexible, interactive data grid component that follows the umbilical protocol
 * externally and uses MVVM pattern internally. Supports both table and attribute modes
 * with drag & drop, resizing, and inline editing capabilities.
 */
import { UmbilicalUtils, UmbilicalError } from '../../umbilical/index.js';
import { GridModel } from './model/GridModel.js';
import { GridView } from './view/GridView.js';
import { GridViewModel } from './viewmodel/GridViewModel.js';

export const Grid = {
  /**
   * Create a Grid instance or provide introspection
   */
  create(umbilical) {
    if (!umbilical) {
      return {
        name: 'Grid',
        version: '1.0.0',
        capabilities: [
          'data-display', 'inline-editing', 'validation', 'sorting',
          'row-dragging', 'column-dragging', 'column-resizing',
          'selection', 'table-mode', 'attribute-mode'
        ]
      };
    }

    const {
      // Required
      data = [],
      columns = [],
      dom = null,
      
      // Mode
      mode = 'table', // 'table' | 'attribute'
      
      // Basic features
      editable = false,
      sortable = false,
      selectable = 'none', // 'none' | 'single' | 'multiple'
      
      // Interactive features
      rowDragging = { enabled: false },
      columnDragging = { enabled: false },
      columnResizing = { enabled: false },
      
      // Event callbacks
      onDataChange = null,
      onSelectionChange = null,
      onValidationError = null,
      
      // Advanced options
      defaultValue = null,
      
      // Lifecycle callbacks
      onMount = null,
      onDestroy = null
    } = umbilical;

    // Validation
    if (!dom) {
      throw new UmbilicalError('Grid requires a DOM container element', 'Grid');
    }

    if (!Array.isArray(data)) {
      throw new UmbilicalError('Grid data must be an array', 'Grid');
    }

    if (!Array.isArray(columns)) {
      throw new UmbilicalError('Grid columns must be an array', 'Grid');
    }

    if (columns.length === 0) {
      throw new UmbilicalError('Grid requires at least one column definition', 'Grid');
    }

    // Validate mode
    if (!['table', 'attribute'].includes(mode)) {
      throw new UmbilicalError('Grid mode must be "table" or "attribute"', 'Grid');
    }

    // Validate attribute mode constraints
    if (mode === 'attribute' && data.length > 1) {
      console.warn('Grid: Attribute mode works best with single records. Only the first record will be used.');
    }

    // Create configuration object
    const config = {
      mode,
      editable,
      sortable,
      selectable,
      rowDragging: {
        enabled: false,
        ...rowDragging
      },
      columnDragging: {
        enabled: false,
        ...columnDragging
      },
      columnResizing: {
        enabled: false,
        ...columnResizing
      },
      onDataChange,
      onSelectionChange,
      onValidationError
    };

    // Validate column definitions
    columns.forEach((column, index) => {
      if (!column.key) {
        throw new UmbilicalError(`Column at index ${index} missing required "key" property`, 'Grid');
      }
      if (!column.label) {
        throw new UmbilicalError(`Column "${column.key}" missing required "label" property`, 'Grid');
      }
      
      // Set defaults
      column.type = column.type || 'text';
      column.sortable = column.sortable !== undefined ? column.sortable : sortable;
      column.editable = column.editable !== undefined ? column.editable : editable;
      column.resizable = column.resizable !== undefined ? column.resizable : true;
      column.draggable = column.draggable !== undefined ? column.draggable : true;
    });

    // Create MVVM components
    const model = new GridModel(data, columns, config);
    const view = new GridView(dom, mode, config);
    const viewModel = new GridViewModel(model, view, config);

    // Initial render
    viewModel.render();

    // Create grid instance
    const gridInstance = {
      // Data operations
      getData() {
        return viewModel.getData();
      },

      setData(newData) {
        if (!Array.isArray(newData)) {
          throw new UmbilicalError('Grid data must be an array', 'Grid');
        }
        viewModel.setData(newData);
      },

      addRow(newRow) {
        if (typeof newRow !== 'object' || newRow === null) {
          throw new UmbilicalError('New row must be an object', 'Grid');
        }
        return viewModel.addRow(newRow);
      },

      deleteRows(indices) {
        if (!Array.isArray(indices)) {
          indices = [indices];
        }
        viewModel.deleteRows(indices);
      },

      // Selection operations
      getSelectedRows() {
        return viewModel.getSelectedRows();
      },

      selectRow(index) {
        if (typeof index !== 'number' || index < 0) {
          throw new UmbilicalError('Row index must be a non-negative number', 'Grid');
        }
        viewModel.selectRow(index);
      },

      deselectRow(index) {
        if (typeof index !== 'number' || index < 0) {
          throw new UmbilicalError('Row index must be a non-negative number', 'Grid');
        }
        viewModel.deselectRow(index);
      },

      clearSelection() {
        viewModel.clearSelection();
      },

      // Validation
      validate() {
        return viewModel.validateAll();
      },

      validateRow(index) {
        if (typeof index !== 'number' || index < 0) {
          throw new UmbilicalError('Row index must be a non-negative number', 'Grid');
        }
        return model.validateRow(index);
      },

      // Column operations
      getColumns() {
        return model.getOrderedColumns();
      },

      updateColumns(newColumns) {
        if (!Array.isArray(newColumns)) {
          throw new UmbilicalError('Columns must be an array', 'Grid');
        }
        model.updateColumns(newColumns);
        viewModel.render();
      },

      resizeColumn(columnKey, width) {
        if (typeof columnKey !== 'string') {
          throw new UmbilicalError('Column key must be a string', 'Grid');
        }
        model.resizeColumn(columnKey, width);
        view.updateColumnWidth(columnKey, width);
      },

      // Sorting
      sort(columnKey, direction = 'asc') {
        if (typeof columnKey !== 'string') {
          throw new UmbilicalError('Column key must be a string', 'Grid');
        }
        if (!['asc', 'desc'].includes(direction)) {
          throw new UmbilicalError('Sort direction must be "asc" or "desc"', 'Grid');
        }
        
        model.sort(columnKey, direction);
        view.updateRowOrder(model.getOrderedData());
        view.updateSortIndicators(columnKey, direction);
        viewModel.updateSelection();
      },

      getSortState() {
        return {
          column: model.sortColumn,
          direction: model.sortDirection
        };
      },

      // State queries
      hasChanges() {
        return model.hasChanges();
      },

      getChanges() {
        return model.getChanges();
      },

      isEditing() {
        return viewModel.editingCell !== null;
      },

      getCurrentEdit() {
        return viewModel.editingCell;
      },

      // Edit operations
      startEdit(rowIndex, columnKey) {
        viewModel.startEdit(rowIndex, columnKey);
      },

      saveEdit() {
        return viewModel.saveEdit();
      },

      cancelEdit() {
        viewModel.cancelEdit();
      },

      // Mode switching
      getMode() {
        return config.mode;
      },

      setMode(newMode) {
        if (!['table', 'attribute'].includes(newMode)) {
          throw new UmbilicalError('Grid mode must be "table" or "attribute"', 'Grid');
        }
        
        if (newMode !== config.mode) {
          config.mode = newMode;
          view.mode = newMode;
          viewModel.render();
        }
      },

      // Configuration
      getConfig() {
        return { ...config };
      },

      updateConfig(newConfig) {
        Object.assign(config, newConfig);
        // Re-initialize components if needed
        viewModel.render();
      },

      // Refresh
      refresh() {
        viewModel.render();
      },

      // Focus management
      focus() {
        dom.focus();
      },

      // Cleanup
      destroy() {
        viewModel.destroy();
        
        if (onDestroy) {
          onDestroy(gridInstance);
        }
      }
    };

    // Call onMount callback
    if (onMount) {
      onMount(gridInstance);
    }

    return gridInstance;
  }
};

// Export individual components for advanced usage
export { GridModel } from './model/GridModel.js';
export { GridView } from './view/GridView.js';
export { GridViewModel } from './viewmodel/GridViewModel.js';