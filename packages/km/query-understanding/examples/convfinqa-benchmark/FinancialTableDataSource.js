/**
 * FinancialTableDataSource - DataSource adapter for ConvFinQA financial tables
 *
 * Implements the DataSource interface to query structured financial tables.
 * Does NOT implement arithmetic reasoning - only table lookups.
 */

export class FinancialTableDataSource {
  constructor(table, metadata = {}) {
    this.table = table; // e.g., { "2009": { "net income": 103102.0, ... }, "2008": { ... } }
    this.metadata = metadata;

    // Build column index for fuzzy matching
    this.columnIndex = this._buildColumnIndex();
  }

  /**
   * Build index of all column names across all rows
   */
  _buildColumnIndex() {
    const columns = new Set();

    for (const row of Object.values(this.table)) {
      for (const colName of Object.keys(row)) {
        columns.add(colName.toLowerCase());
      }
    }

    return Array.from(columns);
  }

  /**
   * Normalize column name for matching
   */
  _normalizeColumnName(name) {
    return name.toLowerCase().trim();
  }

  /**
   * Find matching column name using fuzzy matching
   */
  _findColumn(searchTerm) {
    const normalized = this._normalizeColumnName(searchTerm);

    // Exact match
    if (this.columnIndex.includes(normalized)) {
      return normalized;
    }

    // Partial match (contains)
    const partial = this.columnIndex.find(col => col.includes(normalized) || normalized.includes(col));
    if (partial) {
      return partial;
    }

    return null;
  }

  /**
   * Normalize row identifier (year/period)
   */
  _normalizeRowId(rowId) {
    // Handle various formats: "2009", "Year ended June 30, 2009", etc.
    const yearMatch = String(rowId).match(/\d{4}/);
    if (yearMatch) {
      return yearMatch[0]; // Extract just the year
    }
    return String(rowId).toLowerCase().trim();
  }

  /**
   * Find matching row identifier
   */
  _findRow(searchTerm) {
    const normalized = this._normalizeRowId(searchTerm);

    // Try exact match first
    for (const rowId of Object.keys(this.table)) {
      if (this._normalizeRowId(rowId) === normalized) {
        return rowId;
      }
    }

    // Try partial match
    for (const rowId of Object.keys(this.table)) {
      const normalizedRowId = this._normalizeRowId(rowId);
      if (normalizedRowId.includes(normalized) || normalized.includes(normalizedRowId)) {
        return rowId;
      }
    }

    return null;
  }

  /**
   * Query the table using DataScript-style query spec
   *
   * Expected patterns:
   * - {find: ['?x'], where: [['?row', ':year', '2009'], ['?row', ':column', 'net income']]}
   *   → Returns value at table[2009]['net income']
   *
   * - {find: ['?x'], where: [['?x', ':year', '2009']]}
   *   → Returns entire row for 2009
   *
   * @param {Object} querySpec - DataScript query specification
   * @returns {Array} Query results
   */
  async query(querySpec) {
    const results = [];

    if (!querySpec.where || querySpec.where.length === 0) {
      return results;
    }

    // Extract constraints from where clauses
    const constraints = {
      row: null,
      column: null
    };

    for (const whereClause of querySpec.where) {
      const [subject, predicate, object] = whereClause;

      const cleanPred = String(predicate).replace(/^:/, '');
      const cleanObj = String(object).replace(/^:/, '');

      if (cleanPred === 'year' || cleanPred === 'period' || cleanPred === 'row') {
        constraints.row = cleanObj;
      } else if (cleanPred === 'column' || cleanPred === 'field' || cleanPred === 'metric') {
        constraints.column = cleanObj;
      }
    }

    // Case 1: Row + Column specified → return cell value
    if (constraints.row && constraints.column) {
      const rowId = this._findRow(constraints.row);
      const colName = this._findColumn(constraints.column);

      if (rowId && colName) {
        const row = this.table[rowId];
        if (row) {
          // Find actual column name (case-insensitive)
          const actualColName = Object.keys(row).find(k => k.toLowerCase() === colName);
          if (actualColName && row[actualColName] !== undefined) {
            results.push({
              '?x': row[actualColName],
              value: row[actualColName],
              row: rowId,
              column: actualColName
            });
          }
        }
      }
    }

    // Case 2: Only row specified → return entire row
    else if (constraints.row) {
      const rowId = this._findRow(constraints.row);
      if (rowId) {
        const row = this.table[rowId];
        if (row) {
          results.push({
            '?x': row,
            row: rowId,
            data: row
          });
        }
      }
    }

    // Case 3: Only column specified → return all values in that column
    else if (constraints.column) {
      const colName = this._findColumn(constraints.column);
      if (colName) {
        for (const [rowId, row] of Object.entries(this.table)) {
          const actualColName = Object.keys(row).find(k => k.toLowerCase() === colName);
          if (actualColName && row[actualColName] !== undefined) {
            results.push({
              '?x': row[actualColName],
              value: row[actualColName],
              row: rowId,
              column: actualColName
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get all rows (years/periods) in the table
   */
  getRows() {
    return Object.keys(this.table);
  }

  /**
   * Get all columns (metrics) in the table
   */
  getColumns() {
    return this.columnIndex;
  }

  /**
   * Get raw table data
   */
  getRawTable() {
    return this.table;
  }
}
