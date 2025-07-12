/**
 * TableFormatter - Formats data as tables
 */

export class TableFormatter {
  /**
   * Format data as a table
   * @param {array} data - Array of objects to format
   */
  format(data) {
    if (!data || data.length === 0) {
      console.log('No data to display');
      return;
    }
    
    // Get all unique keys
    const keys = [...new Set(data.flatMap(item => Object.keys(item)))];
    
    // Calculate column widths
    const widths = {};
    keys.forEach(key => {
      widths[key] = Math.max(
        key.length,
        ...data.map(item => String(item[key] || '').length)
      );
    });
    
    // Print header
    const header = keys.map(key => key.padEnd(widths[key])).join(' | ');
    console.log(header);
    console.log(keys.map(key => '-'.repeat(widths[key])).join('-+-'));
    
    // Print rows
    data.forEach(item => {
      const row = keys.map(key => String(item[key] || '').padEnd(widths[key])).join(' | ');
      console.log(row);
    });
  }

  /**
   * Format data as a simple table (no borders)
   * @param {array} data - Array of objects to format
   */
  formatSimple(data) {
    if (!data || data.length === 0) {
      console.log('No data to display');
      return;
    }
    
    // Get all unique keys
    const keys = [...new Set(data.flatMap(item => Object.keys(item)))];
    
    // Calculate column widths
    const widths = {};
    keys.forEach(key => {
      widths[key] = Math.max(
        key.length,
        ...data.map(item => String(item[key] || '').length)
      );
    });
    
    // Print rows
    data.forEach(item => {
      const row = keys.map(key => String(item[key] || '').padEnd(widths[key])).join('  ');
      console.log(row);
    });
  }

  /**
   * Format data as key-value pairs
   * @param {object} data - Object to format
   * @param {number} indent - Indentation level
   */
  formatKeyValue(data, indent = 0) {
    const spaces = ' '.repeat(indent);
    const entries = Object.entries(data);
    
    if (entries.length === 0) {
      console.log(`${spaces}(empty)`);
      return;
    }
    
    // Calculate max key length for alignment
    const maxKeyLength = Math.max(...entries.map(([key]) => key.length));
    
    entries.forEach(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLength);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        console.log(`${spaces}${paddedKey}:`);
        this.formatKeyValue(value, indent + 2);
      } else if (Array.isArray(value)) {
        console.log(`${spaces}${paddedKey}: [${value.join(', ')}]`);
      } else {
        console.log(`${spaces}${paddedKey}: ${value}`);
      }
    });
  }
}

export default TableFormatter;