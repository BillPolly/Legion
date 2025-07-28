/**
 * ResponseFormatter - Formats tool responses for better CLI display
 */
export class ResponseFormatter {
  constructor() {
    this.formatters = new Map();
    this.setupFormatters();
  }

  setupFormatters() {
    // Module list formatter
    this.formatters.set('module_list', (result) => {
      // Handle the new format from ModuleHandler
      if (!result.success) {
        return `❌ Failed to list modules: ${result.error || 'Unknown error'}`;
      }
      
      const lines = [];
      lines.push('═══ Module List ═══');
      lines.push('');
      
      // Show available modules
      if (result.available && result.available.length > 0) {
        lines.push(`AVAILABLE MODULES (${result.available.length}):`);
        lines.push('');
        
        // Create a table format for better readability
        const headers = ['Module', 'Type', 'Tools', 'Description'];
        const rows = result.available.map(m => [
          m.name || 'unknown',
          m.type || 'unknown',
          (m.toolCount || 0).toString(),
          m.description || 'No description'
        ]);
        
        lines.push(this.formatTable(headers, rows));
        lines.push('');
      }
      
      // Show loaded modules
      if (result.loaded && result.loaded.length > 0) {
        lines.push(`LOADED MODULES (${result.loaded.length}):`);
        lines.push('');
        
        // Simple list for loaded modules
        result.loaded.forEach(m => {
          lines.push(`  • ${m.name} (${m.toolCount || 0} tools)`);
          if (m.description && m.description !== 'No description') {
            lines.push(`    ${m.description}`);
          }
        });
        lines.push('');
      } else {
        lines.push('No modules currently loaded.');
        lines.push('');
      }
      
      // Add totals
      if (result.total) {
        lines.push('─── Summary ───');
        lines.push(`Available: ${result.total.available || 0}`);
        lines.push(`Loaded: ${result.total.loaded || 0}`);
      }
      
      return lines.join('\n');
    });

    // Module info formatter
    this.formatters.set('module_info', (result) => {
      const lines = [];
      lines.push(`═══ Module: ${result.name} ═══`);
      lines.push('');
      
      lines.push(`Status: ${result.status || 'unknown'}`);
      lines.push(`Type: ${result.type || 'unknown'}`);
      lines.push(`Loaded: ${result.loaded ? 'Yes' : 'No'}`);
      
      if (result.metadata) {
        lines.push(`Path: ${result.metadata.path || 'unknown'}`);
      }
      
      if (result.source) {
        lines.push('');
        lines.push('─── Source ───');
        lines.push(`Path: ${result.source.path}`);
        lines.push(`Directory: ${result.source.directory}`);
      }
      
      if (result.dependencies && result.dependencies.length > 0) {
        lines.push('');
        lines.push('─── Dependencies ───');
        result.dependencies.forEach(dep => lines.push(`  • ${dep}`));
      }
      
      if (result.tools && result.tools.length > 0) {
        lines.push('');
        lines.push('─── Tools ───');
        result.tools.forEach(tool => {
          lines.push(`  • ${tool.name}: ${tool.description}`);
        });
      }
      
      return lines.join('\n');
    });

    // Module discover formatter
    this.formatters.set('module_discover', (result) => {
      const lines = [];
      lines.push('═══ Module Discovery Results ═══');
      lines.push('');
      
      lines.push(`Discovered: ${result.discovered} modules`);
      lines.push(`Search Depth: ${result.searchDepth}`);
      lines.push('');
      
      if (result.directories && result.directories.length > 0) {
        lines.push('Searched Directories:');
        result.directories.forEach(dir => lines.push(`  • ${dir}`));
        lines.push('');
      }
      
      if (result.byType) {
        lines.push('By Type:');
        Object.entries(result.byType).forEach(([type, count]) => {
          lines.push(`  ${type}: ${count}`);
        });
        lines.push('');
      }
      
      if (result.byStatus) {
        lines.push('By Status:');
        Object.entries(result.byStatus).forEach(([status, count]) => {
          lines.push(`  ${status}: ${count}`);
        });
        lines.push('');
      }
      
      if (result.modules && result.modules.length > 0) {
        lines.push('─── Modules Found ───');
        const headers = ['Module', 'Type', 'Status'];
        const rows = result.modules.map(m => [
          m.name,
          m.type || 'unknown',
          m.status || 'available'
        ]);
        lines.push(this.formatTable(headers, rows));
      }
      
      if (result.autoLoad) {
        lines.push('');
        lines.push('─── Auto-Load Results ───');
        lines.push(`Attempted: ${result.autoLoad.attempted}`);
        lines.push(`Loaded: ${result.autoLoad.loaded}`);
        if (result.autoLoad.errors && result.autoLoad.errors.length > 0) {
          lines.push('Errors:');
          result.autoLoad.errors.forEach(err => {
            lines.push(`  • ${err.module}: ${err.error}`);
          });
        }
      }
      
      return lines.join('\n');
    });

    // Context list formatter
    this.formatters.set('context_list', (result) => {
      if (!result.contexts || result.contexts.length === 0) {
        return 'No context variables stored.';
      }
      
      const lines = [];
      lines.push('═══ Stored Variables ═══');
      lines.push('');
      
      result.contexts.forEach(ctx => {
        lines.push(`@${ctx.name}:`);
        lines.push(`  Value: ${JSON.stringify(ctx.data, null, 2).split('\n').join('\n  ')}`);
        if (ctx.description) {
          lines.push(`  Description: ${ctx.description}`);
        }
        lines.push('');
      });
      
      return lines.join('\n');
    });

    // Module tools formatter
    this.formatters.set('module_tools', (result) => {
      // Handle wrapped response format (result.data.*)
      const data = result.data || result;
      
      const lines = [];
      lines.push(`═══ Module: ${data.module} ═══`);
      lines.push('');
      
      lines.push(`Status: ${data.status}`);
      lines.push(`Tool Count: ${data.toolCount}`);
      lines.push('');
      
      if (data.tools && data.tools.length > 0) {
        lines.push('─── Available Tools ───');
        
        // Check if it's detailed format
        if (Array.isArray(data.tools) && typeof data.tools[0] === 'object' && data.tools[0].description) {
          // Detailed format
          data.tools.forEach(tool => {
            lines.push(`• ${tool.name}: ${tool.description}`);
            if (tool.type && tool.type !== 'function') {
              lines.push(`  Type: ${tool.type}`);
            }
            if (tool.toolName && tool.toolName !== tool.name) {
              lines.push(`  Tool: ${tool.toolName}`);
            }
            if (tool.error) {
              lines.push(`  Error: ${tool.error}`);
            }
            lines.push('');
          });
        } else {
          // Simple format - just names in columns
          const columns = 3;
          const columnWidth = 25;
          
          for (let i = 0; i < data.tools.length; i += columns) {
            const row = data.tools.slice(i, i + columns)
              .map(name => (typeof name === 'string' ? name : name.name || 'unknown').padEnd(columnWidth))
              .join('');
            lines.push(`  ${row}`);
          }
        }
      } else {
        lines.push('No tools available in this module.');
      }
      
      // Add note if present
      if (data.note) {
        lines.push('');
        lines.push(`Note: ${data.note}`);
      }
      
      return lines.join('\n');
    });

    // Calculator formatter
    this.formatters.set('calculator_evaluate', (result) => {
      if (result.success === false || result.error) {
        const lines = ['❌ Calculation Error'];
        if (result.error) lines.push(result.error);
        if (result.data && result.data.expression) {
          lines.push(`Expression: ${result.data.expression}`);
        }
        return lines.join('\n');
      }
      
      if (result.data && result.data.result !== undefined) {
        const expression = result.data.expression || 'unknown';
        const calculationResult = result.data.result;
        
        // Format the result nicely
        if (typeof calculationResult === 'number') {
          if (Number.isInteger(calculationResult)) {
            return `${expression} = ${calculationResult}`;
          } else {
            // Round to reasonable precision for display
            const rounded = Math.round(calculationResult * 1000000) / 1000000;
            return `${expression} = ${rounded}`;
          }
        }
        
        return `${expression} = ${calculationResult}`;
      }
      
      return this.formatDefault(result);
    });

    // File operation formatters
    this.formatters.set('file_read', (result) => {
      if (result.success === false || result.error) {
        return `❌ Failed to read file: ${result.error || 'Unknown error'}`;
      }
      
      if (result.data && result.data.content !== undefined) {
        const content = result.data.content;
        const path = result.data.path || 'file';
        
        // Show first few lines for preview
        const lines = content.split('\n');
        if (lines.length > 20) {
          const preview = lines.slice(0, 20).join('\n');
          return `📄 ${path} (${lines.length} lines, showing first 20):\n\n${preview}\n\n... (${lines.length - 20} more lines)`;
        }
        
        return `📄 ${path} (${lines.length} lines):\n\n${content}`;
      }
      
      return this.formatDefault(result);
    });

    this.formatters.set('file_write', (result) => {
      if (result.success === false || result.error) {
        return `❌ Failed to write file: ${result.error || 'Unknown error'}`;
      }
      
      if (result.data) {
        const path = result.data.path || 'file';
        const bytes = result.data.bytesWritten || 'unknown';
        return `✓ File written: ${path} (${bytes} bytes)`;
      }
      
      return '✓ File written successfully';
    });

    this.formatters.set('directory_list', (result) => {
      if (result.success === false || result.error) {
        return `❌ Failed to list directory: ${result.error || 'Unknown error'}`;
      }
      
      if (result.data && result.data.entries) {
        const entries = result.data.entries;
        const path = result.data.path || 'directory';
        
        const lines = [`📁 ${path} (${entries.length} items):`];
        lines.push('');
        
        // Group by type
        const dirs = entries.filter(e => e.type === 'directory');
        const files = entries.filter(e => e.type === 'file');
        
        if (dirs.length > 0) {
          lines.push('Directories:');
          dirs.forEach(dir => lines.push(`  📁 ${dir.name}`));
          lines.push('');
        }
        
        if (files.length > 0) {
          lines.push('Files:');
          files.forEach(file => {
            const size = file.size ? ` (${file.size} bytes)` : '';
            lines.push(`  📄 ${file.name}${size}`);
          });
        }
        
        return lines.join('\n');
      }
      
      return this.formatDefault(result);
    });

    // Context operations formatter
    this.formatters.set('context_add', (result) => {
      if (result.success === false || result.error) {
        return `❌ Failed to add context: ${result.error || 'Unknown error'}`;
      }
      
      if (result.data && result.data.name) {
        return `✓ Added context variable: @${result.data.name}`;
      }
      
      return '✓ Context variable added';
    });

    this.formatters.set('context_get', (result) => {
      if (result.success === false || result.error) {
        return `❌ Context variable not found: ${result.error || 'Unknown error'}`;
      }
      
      if (result.data) {
        const name = result.data.name || 'variable';
        const value = result.data.data;
        const description = result.data.description;
        
        const lines = [`📋 @${name}:`];
        if (description) {
          lines.push(`Description: ${description}`);
          lines.push('');
        }
        
        if (typeof value === 'string') {
          lines.push(value);
        } else {
          lines.push(JSON.stringify(value, null, 2));
        }
        
        return lines.join('\n');
      }
      
      return this.formatDefault(result);
    });

    // Plan execution formatter
    this.formatters.set('plan_execute', (result) => {
      if (result.success === false || result.error) {
        return `❌ Plan execution failed: ${result.error || 'Unknown error'}`;
      }
      
      if (result.data) {
        const lines = ['✅ Plan executed successfully'];
        
        if (result.data.steps) {
          lines.push('');
          lines.push('Step Results:');
          result.data.steps.forEach((step, index) => {
            const status = step.completed ? '✅' : '❌';
            lines.push(`  ${index + 1}. ${status} ${step.action || 'Unknown step'}`);
          });
        }
        
        if (result.data.executionTime) {
          lines.push('');
          lines.push(`Execution time: ${result.data.executionTime}ms`);
        }
        
        return lines.join('\n');
      }
      
      return '✅ Plan executed successfully';
    });

    // Generic success/error formatter (improved)
    this.formatters.set('_generic', (result) => {
      // Handle explicit success/error flags
      if (result.success === false || result.error) {
        const lines = ['❌ Error'];
        if (result.error) lines.push(result.error);
        if (result.message) lines.push(result.message);
        return lines.join('\n');
      }
      
      // Handle successful operations with messages
      if (result.success === true || result.message) {
        const message = result.message || 'Operation completed successfully';
        return `✓ ${message}`;
      }
      
      // Handle simple data responses
      if (result.data) {
        // If data has a simple structure, format it nicely
        if (typeof result.data === 'string') {
          return result.data;
        }
        
        if (typeof result.data === 'number') {
          return result.data.toString();
        }
        
        if (typeof result.data === 'boolean') {
          return result.data ? 'true' : 'false';
        }
        
        // For complex objects, try to extract key information
        if (typeof result.data === 'object' && result.data !== null) {
          // If it has a single key-value pair, show it simply
          const keys = Object.keys(result.data);
          if (keys.length === 1) {
            const key = keys[0];
            const value = result.data[key];
            if (typeof value === 'string' || typeof value === 'number') {
              return `${key}: ${value}`;
            }
          }
          
          // If it has a result field, show that
          if (result.data.result !== undefined) {
            return result.data.result.toString();
          }
          
          // If it has a value field, show that
          if (result.data.value !== undefined) {
            return result.data.value.toString();
          }
        }
      }
      
      // Fall back to JSON only for complex structures
      return this.formatDefault(result);
    });
  }

  /**
   * Format a response based on the tool name
   */
  format(toolName, response) {
    // Extract result from response wrapper if needed
    let result = response;
    if (response && response.content && Array.isArray(response.content)) {
      const textContent = response.content.find(item => item.type === 'text');
      if (textContent && textContent.text) {
        try {
          result = JSON.parse(textContent.text);
        } catch {
          result = textContent.text;
        }
      }
    }

    // Get specific formatter or use generic
    const formatter = this.formatters.get(toolName) || this.formatters.get('_generic');
    
    try {
      return formatter(result);
    } catch (error) {
      console.error('Formatting error:', error);
      return this.formatDefault(result);
    }
  }

  /**
   * Format data as a table
   */
  formatTable(headers, rows) {
    // Calculate column widths
    const widths = headers.map((h, i) => {
      const headerWidth = h.length;
      const maxRowWidth = Math.max(...rows.map(r => (r[i] || '').toString().length));
      return Math.max(headerWidth, maxRowWidth) + 2;
    });
    
    const lines = [];
    
    // Header
    const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('│');
    lines.push(headerLine);
    
    // Separator
    const separator = widths.map(w => '─'.repeat(w)).join('┼');
    lines.push(separator);
    
    // Rows
    rows.forEach(row => {
      const rowLine = row.map((cell, i) => (cell || '').toString().padEnd(widths[i])).join('│');
      lines.push(rowLine);
    });
    
    return lines.join('\n');
  }

  /**
   * Default formatter for unknown responses
   */
  formatDefault(result) {
    if (typeof result === 'string') {
      return result;
    }
    
    if (typeof result === 'number' || typeof result === 'boolean') {
      return result.toString();
    }
    
    if (result === null || result === undefined) {
      return 'null';
    }
    
    // For objects, try to format them nicely before falling back to JSON
    if (typeof result === 'object') {
      // If it's an array with simple values, show them on one line
      if (Array.isArray(result)) {
        if (result.length === 0) {
          return '(empty array)';
        }
        
        // If all items are simple types, show inline
        const allSimple = result.every(item => 
          typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
        );
        
        if (allSimple && result.length <= 10) {
          return `[${result.join(', ')}]`;
        }
        
        // For complex arrays, show count and first few items
        if (result.length > 5) {
          const preview = result.slice(0, 3).map(item => 
            typeof item === 'object' ? '...' : String(item)
          ).join(', ');
          return `Array (${result.length} items): [${preview}, ...]`;
        }
      }
      
      // For objects, show a summary if they're too complex
      const keys = Object.keys(result);
      if (keys.length === 0) {
        return '(empty object)';
      }
      
      if (keys.length > 5) {
        return `Object with ${keys.length} properties: {${keys.slice(0, 3).join(', ')}, ...}`;
      }
    }
    
    // Fall back to compact JSON for complex structures
    try {
      const jsonStr = JSON.stringify(result, null, 2);
      // If JSON is very long, truncate it
      if (jsonStr.length > 500) {
        const truncated = jsonStr.substring(0, 500);
        const lastNewline = truncated.lastIndexOf('\n');
        return truncated.substring(0, lastNewline > 0 ? lastNewline : 500) + '\n  ... (truncated)';
      }
      return jsonStr;
    } catch (error) {
      return '[Object - cannot stringify]';
    }
  }

  /**
   * Check if a tool has a custom formatter
   */
  hasFormatter(toolName) {
    return this.formatters.has(toolName);
  }
}

export default ResponseFormatter;