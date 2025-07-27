/**
 * VariablesList - Renders the variables sidebar content
 */

export class VariablesList {
  constructor(variables) {
    this.variables = variables;
  }

  /**
   * Render the variables list HTML
   */
  render() {
    let html = '';
    
    // Local variables
    if (this.variables.local.length > 0) {
      html += '<div class="cli-variable-section">';
      html += '<div class="cli-variable-section-header">Local Variables</div>';
      
      this.variables.local.forEach(({ name, value }) => {
        html += this.renderVariable(name, value, 'local');
      });
      
      html += '</div>';
    }
    
    // Context variables
    if (this.variables.context.length > 0) {
      html += '<div class="cli-variable-section">';
      html += '<div class="cli-variable-section-header">Context Variables</div>';
      
      this.variables.context.forEach(({ name, value, description }) => {
        html += this.renderVariable(name, value, 'context', description);
      });
      
      html += '</div>';
    }
    
    // Empty state
    if (this.variables.local.length === 0 && this.variables.context.length === 0) {
      html = '<div class="cli-empty-state">No variables stored yet</div>';
    }
    
    return html;
  }

  /**
   * Render a single variable
   */
  renderVariable(name, value, type, description) {
    const preview = this.formatPreview(value);
    const escapedName = this.escapeHtml(name);
    const escapedPreview = this.escapeHtml(preview);
    const escapedDesc = description ? this.escapeHtml(description) : '';
    
    return `
      <div class="cli-variable-item" data-variable="${escapedName}" data-type="${type}">
        <div class="cli-variable-name">${escapedName}</div>
        ${escapedDesc ? `<div class="cli-variable-desc">${escapedDesc}</div>` : ''}
        <div class="cli-variable-value">${escapedPreview}</div>
      </div>
    `;
  }

  /**
   * Format value preview
   */
  formatPreview(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    try {
      const str = JSON.stringify(value, null, 2);
      if (str.length > 200) {
        // Truncate long values
        const lines = str.split('\n');
        if (lines.length > 5) {
          return lines.slice(0, 5).join('\n') + '\n...';
        }
        return str.substring(0, 200) + '...';
      }
      return str;
    } catch (e) {
      return String(value);
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}