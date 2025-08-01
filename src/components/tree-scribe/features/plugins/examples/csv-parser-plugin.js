/**
 * CSV Parser Plugin for TreeScribe
 * Parses CSV files with automatic hierarchy detection
 * 
 * @author TreeScribe Team
 * @version 1.0.0
 */

const BaseParser = globalThis.BaseParser || class BaseParser {
  _normalizeNode(node) { return node; }
};

class CsvParser extends BaseParser {
  getName() {
    return 'CsvParser';
  }

  getSupportedFormats() {
    return ['csv', 'tsv'];
  }

  getSupportedMimeTypes() {
    return ['text/csv', 'text/tab-separated-values', 'application/csv'];
  }

  canParse(content, hints = {}) {
    // Check hints
    if (hints.format && this.getSupportedFormats().includes(hints.format.toLowerCase())) {
      return 1.0;
    }

    if (hints.mimeType && this.getSupportedMimeTypes().includes(hints.mimeType.toLowerCase())) {
      return 1.0;
    }

    // Check content
    if (!content || typeof content !== 'string') {
      return 0;
    }

    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return 0;
    }

    // Detect delimiter
    const delimiter = this._detectDelimiter(lines[0]);
    if (!delimiter) {
      return 0;
    }

    // Check consistency
    const firstRowCells = lines[0].split(delimiter).length;
    let consistentRows = 0;

    for (let i = 1; i < Math.min(5, lines.length); i++) {
      const cells = lines[i].split(delimiter).length;
      if (Math.abs(cells - firstRowCells) <= 1) {
        consistentRows++;
      }
    }

    const consistency = consistentRows / Math.min(4, lines.length - 1);
    return Math.min(consistency * 0.9, 0.95);
  }

  validate(content) {
    const errors = [];

    if (!content || typeof content !== 'string') {
      errors.push('Content must be a non-empty string');
    } else {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        errors.push('CSV must contain at least one row');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  parse(content, options = {}) {
    try {
      const validation = this.validate(content);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      // Parse CSV
      const data = this._parseCsv(content, options);
      
      // Detect hierarchy
      const hierarchical = this._detectHierarchy(data, options);
      
      // Build tree
      const tree = hierarchical 
        ? this._buildHierarchicalTree(data, options)
        : this._buildFlatTree(data, options);

      const normalized = this._normalizeNode(tree);
      normalized.sourceFormat = 'csv';

      return normalized;

    } catch (error) {
      return this._normalizeNode({
        title: 'CSV Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'csv',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  _detectDelimiter(firstLine) {
    const delimiters = [',', '\t', ';', '|'];
    let maxCount = 0;
    let bestDelimiter = ',';

    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(delimiter, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    }

    return maxCount > 0 ? bestDelimiter : null;
  }

  _parseCsv(content, options) {
    const lines = content.split('\n').filter(line => line.trim());
    const delimiter = options.delimiter || this._detectDelimiter(lines[0]) || ',';
    
    // Parse headers
    const headers = this._parseRow(lines[0], delimiter);
    
    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseRow(lines[i], delimiter);
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      rows.push(row);
    }

    return {
      headers,
      rows,
      delimiter,
      rowCount: rows.length,
      columnCount: headers.length
    };
  }

  _parseRow(line, delimiter) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // Cell boundary
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last cell
    cells.push(current.trim());

    return cells;
  }

  _detectHierarchy(data, options) {
    if (options.hierarchyColumn) {
      return true;
    }

    // Look for columns that might indicate hierarchy
    const hierarchyIndicators = [
      'parent', 'parent_id', 'parentId',
      'category', 'group', 'type',
      'level', 'depth', 'indent'
    ];

    return data.headers.some(header => 
      hierarchyIndicators.some(indicator => 
        header.toLowerCase().includes(indicator)
      )
    );
  }

  _buildFlatTree(data, options) {
    const groupBy = options.groupBy || null;
    const maxRows = options.maxRows || 1000;

    const root = {
      title: options.filename || 'CSV Document',
      content: `${data.columnCount} columns, ${data.rowCount} rows`,
      contentType: 'csv',
      children: [],
      metadata: {
        delimiter: data.delimiter,
        headers: data.headers,
        totalRows: data.rowCount
      }
    };

    if (groupBy && data.headers.includes(groupBy)) {
      // Group by specified column
      const groups = {};
      
      data.rows.forEach(row => {
        const groupValue = row[groupBy] || 'Ungrouped';
        if (!groups[groupValue]) {
          groups[groupValue] = [];
        }
        groups[groupValue].push(row);
      });

      // Create group nodes
      for (const [groupName, rows] of Object.entries(groups)) {
        const groupNode = {
          title: `${groupBy}: ${groupName}`,
          content: `${rows.length} rows`,
          contentType: 'csv-group',
          children: rows.slice(0, maxRows).map((row, index) => 
            this._createRowNode(row, index, data.headers)
          )
        };

        if (rows.length > maxRows) {
          groupNode.children.push({
            title: `... and ${rows.length - maxRows} more rows`,
            content: 'Rows truncated for performance',
            contentType: 'info'
          });
        }

        root.children.push(groupNode);
      }
    } else {
      // Flat structure
      root.children = data.rows.slice(0, maxRows).map((row, index) => 
        this._createRowNode(row, index, data.headers)
      );

      if (data.rows.length > maxRows) {
        root.children.push({
          title: `... and ${data.rows.length - maxRows} more rows`,
          content: 'Rows truncated for performance',
          contentType: 'info'
        });
      }
    }

    return root;
  }

  _buildHierarchicalTree(data, options) {
    const hierarchyColumn = options.hierarchyColumn || this._findHierarchyColumn(data.headers);
    const nameColumn = options.nameColumn || this._findNameColumn(data.headers);

    const root = {
      title: options.filename || 'CSV Document',
      content: `Hierarchical data with ${data.rowCount} rows`,
      contentType: 'csv',
      children: [],
      metadata: {
        hierarchyColumn,
        nameColumn,
        totalRows: data.rowCount
      }
    };

    // Build hierarchy
    const nodeMap = {};
    const rootNodes = [];

    // First pass: create all nodes
    data.rows.forEach((row, index) => {
      const id = row.id || row.ID || index.toString();
      const name = row[nameColumn] || `Row ${index + 1}`;
      
      nodeMap[id] = {
        title: name,
        content: this._rowToContent(row, data.headers),
        contentType: 'csv-row',
        children: [],
        metadata: { row, id }
      };
    });

    // Second pass: build hierarchy
    data.rows.forEach(row => {
      const id = row.id || row.ID || data.rows.indexOf(row).toString();
      const parentId = row[hierarchyColumn];
      const node = nodeMap[id];

      if (parentId && nodeMap[parentId]) {
        nodeMap[parentId].children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    root.children = rootNodes;
    return root;
  }

  _createRowNode(row, index, headers) {
    const primaryKey = headers[0];
    const title = row[primaryKey] || `Row ${index + 1}`;

    return {
      title,
      content: this._rowToContent(row, headers),
      contentType: 'csv-row',
      children: headers.map(header => ({
        title: header,
        content: String(row[header] || ''),
        contentType: 'csv-cell',
        metadata: { 
          header, 
          value: row[header],
          type: this._detectCellType(row[header])
        }
      }))
    };
  }

  _rowToContent(row, headers) {
    return headers
      .map(header => `${header}: ${row[header] || 'N/A'}`)
      .join(' | ');
  }

  _findHierarchyColumn(headers) {
    const candidates = ['parent', 'parent_id', 'parentId', 'parentID'];
    return headers.find(header => 
      candidates.some(c => header.toLowerCase() === c.toLowerCase())
    ) || null;
  }

  _findNameColumn(headers) {
    const candidates = ['name', 'title', 'label', 'description'];
    return headers.find(header => 
      candidates.some(c => header.toLowerCase() === c.toLowerCase())
    ) || headers[0];
  }

  _detectCellType(value) {
    if (value === null || value === undefined || value === '') {
      return 'empty';
    }
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return 'number';
    }
    if (value === 'true' || value === 'false') {
      return 'boolean';
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return 'date';
    }
    if (/^https?:\/\//.test(value)) {
      return 'url';
    }
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
      return 'email';
    }
    return 'string';
  }

  getCapabilities() {
    return {
      async: false,
      streaming: true,
      bidirectional: false,
      preservesFormatting: false,
      requiresDOM: false,
      maxFileSize: 100 * 1024 * 1024, // 100MB

      features: [
        'auto-delimiter',
        'quoted-values',
        'header-detection',
        'hierarchy-detection',
        'grouping',
        'type-inference'
      ],

      options: {
        delimiter: {
          type: 'string',
          enum: [',', '\t', ';', '|'],
          description: 'Column delimiter'
        },
        hasHeaders: {
          type: 'boolean',
          default: true,
          description: 'First row contains headers'
        },
        groupBy: {
          type: 'string',
          description: 'Column to group rows by'
        },
        hierarchyColumn: {
          type: 'string',
          description: 'Column containing parent references'
        },
        maxRows: {
          type: 'number',
          default: 1000,
          description: 'Maximum rows to display'
        }
      }
    };
  }
}

// Plugin export
export default {
  metadata: {
    name: 'CsvParser',
    version: '1.0.0',
    author: 'TreeScribe Team',
    description: 'CSV/TSV parser with hierarchy detection and grouping',
    homepage: 'https://github.com/treescribe/csv-parser',
    license: 'MIT'
  },

  Parser: CsvParser,

  examples: {
    flat: `Name,Age,City,Country
John Doe,30,New York,USA
Jane Smith,25,London,UK
Bob Johnson,35,Paris,France`,

    hierarchical: `id,name,parent,type
1,Electronics,,category
2,Computers,1,category
3,Laptops,2,product
4,Desktops,2,product
5,Accessories,1,category
6,Keyboards,5,product
7,Mice,5,product`,

    grouped: `Product,Category,Price,Stock
iPhone 14,Electronics,999,50
Samsung S23,Electronics,899,75
iPad Pro,Electronics,1099,30
Office Chair,Furniture,299,100
Standing Desk,Furniture,599,25
USB Cable,Accessories,19,500
Mouse Pad,Accessories,15,300`
  }
};

// CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports.default;
}