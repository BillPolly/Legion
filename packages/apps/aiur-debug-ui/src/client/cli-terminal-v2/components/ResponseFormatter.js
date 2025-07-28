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
      if (!result.modules) return this.formatDefault(result);
      
      const lines = [];
      lines.push('═══ Module Status ═══');
      lines.push('');
      
      // Simple format - show modules by status
      if (typeof result.modules === 'object' && !Array.isArray(result.modules)) {
        for (const [status, moduleNames] of Object.entries(result.modules)) {
          if (moduleNames.length === 0) continue;
          
          lines.push(`${status.toUpperCase()} (${moduleNames.length}):`);
          
          // Display modules in columns
          const columns = 3;
          const columnWidth = 25;
          
          for (let i = 0; i < moduleNames.length; i += columns) {
            const row = moduleNames.slice(i, i + columns)
              .map(name => name.padEnd(columnWidth))
              .join('');
            lines.push(`  ${row}`);
          }
          lines.push('');
        }
      } 
      // Detailed format - show as table
      else if (Array.isArray(result.modules)) {
        const headers = ['Module', 'Status', 'Type', 'Tools'];
        const rows = result.modules.map(m => [
          m.name || '',
          m.status || '',
          m.type || '',
          m.tools ? m.tools.length.toString() : '0'
        ]);
        
        lines.push(this.formatTable(headers, rows));
      }
      
      // Add statistics
      if (result.stats) {
        lines.push('─── Statistics ───');
        lines.push(`Total Discovered: ${result.stats.totalDiscovered || 0}`);
        lines.push(`Total Loaded: ${result.stats.totalLoaded || 0}`);
        lines.push(`Total Available: ${result.stats.totalAvailable || 0}`);
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

    // Generic success/error formatter
    this.formatters.set('_generic', (result) => {
      if (result.success === false || result.error) {
        const lines = ['❌ Error'];
        if (result.error) lines.push(result.error);
        if (result.message) lines.push(result.message);
        return lines.join('\n');
      }
      
      if (result.message) {
        return `✓ ${result.message}`;
      }
      
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
    
    // Pretty print JSON
    return JSON.stringify(result, null, 2);
  }

  /**
   * Check if a tool has a custom formatter
   */
  hasFormatter(toolName) {
    return this.formatters.has(toolName);
  }
}

export default ResponseFormatter;