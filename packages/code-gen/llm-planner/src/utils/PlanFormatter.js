/**
 * PlanFormatter - Utility for formatting plans in various output formats
 */

class PlanFormatter {
  constructor() {
    this.formatters = {
      markdown: this.toMarkdown.bind(this),
      json: this.toJSON.bind(this),
      text: this.toText.bind(this),
      html: this.toHTML.bind(this),
      mermaid: this.toMermaid.bind(this),
      yaml: this.toYAML.bind(this)
    };
  }

  /**
   * Format plan using specified format
   * @param {Plan} plan - Plan to format
   * @param {string} format - Format type
   * @param {Object} options - Format options
   * @returns {string} Formatted plan
   */
  format(plan, format, options = {}) {
    if (!this.formatters[format]) {
      throw new Error(`Unknown format: ${format}`);
    }
    
    return this.formatters[format](plan, options);
  }

  /**
   * Register custom formatter
   * @param {string} name - Formatter name
   * @param {Function} formatter - Formatter function
   */
  registerFormatter(name, formatter) {
    this.formatters[name] = formatter;
  }

  /**
   * Get available formats
   * @returns {Array<string>} Available format names
   */
  getAvailableFormats() {
    return Object.keys(this.formatters);
  }

  /**
   * Format plan as Markdown
   * @param {Plan} plan - Plan to format
   * @param {Object} options - Format options
   * @returns {string} Markdown formatted plan
   */
  toMarkdown(plan, options = {}) {
    const lines = [];
    
    // Title
    lines.push(`# ${plan.name}`);
    lines.push('');
    
    // Metadata
    lines.push('## Overview');
    lines.push('');
    if (plan.version) {
      lines.push(`**Version:** ${plan.version}`);
    }
    if (plan.metadata) {
      if (plan.metadata.complexity) {
        lines.push(`**Complexity:** ${plan.metadata.complexity}`);
      }
      if (plan.metadata.estimatedDuration) {
        lines.push(`**Estimated Duration:** ${plan.metadata.estimatedDuration}`);
      }
      if (plan.metadata.createdBy) {
        lines.push(`**Created By:** ${plan.metadata.createdBy}`);
      }
    }
    lines.push('');
    
    // Context
    if (plan.context && Object.keys(plan.context).length > 0) {
      lines.push('## Context');
      lines.push('');
      if (plan.context.projectType) {
        lines.push(`**Project Type:** ${plan.context.projectType}`);
      }
      if (plan.context.technologies) {
        lines.push(`**Technologies:** ${plan.context.technologies.join(', ')}`);
      }
      if (plan.context.constraints) {
        lines.push(`**Constraints:** ${plan.context.constraints.join(', ')}`);
      }
      lines.push('');
    }
    
    // Steps
    lines.push('## Steps');
    lines.push('');
    
    if (plan.steps && plan.steps.length > 0) {
      plan.steps.forEach((step, index) => {
        lines.push(`### ${index + 1}. ${step.name}`);
        lines.push('');
        
        if (step.description) {
          lines.push(step.description);
          lines.push('');
        }
        
        if (step.type) {
          lines.push(`**Type:** ${step.type}`);
        }
        
        if (step.estimatedDuration) {
          lines.push(`**Duration:** ${step.estimatedDuration} minutes`);
        }
        
        if (step.dependencies && step.dependencies.length > 0) {
          lines.push(`**Dependencies:** ${step.dependencies.join(', ')}`);
        }
        
        if (step.actions && step.actions.length > 0) {
          lines.push('');
          lines.push('**Actions:**');
          step.actions.forEach(action => {
            lines.push(`- ${this._formatAction(action)}`);
          });
        }
        
        lines.push('');
      });
    } else {
      lines.push('*No steps defined*');
      lines.push('');
    }
    
    // Success Criteria
    if (plan.successCriteria && plan.successCriteria.length > 0) {
      lines.push('## Success Criteria');
      lines.push('');
      plan.successCriteria.forEach(criteria => {
        lines.push(`- ${criteria}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Format plan as JSON
   * @param {Plan} plan - Plan to format
   * @param {Object} options - Format options
   * @returns {string} JSON formatted plan
   */
  toJSON(plan, options = {}) {
    const indent = options.indent || 2;
    const compact = options.compact || false;
    
    if (compact) {
      return JSON.stringify(plan.toJSON());
    }
    
    return JSON.stringify(plan.toJSON(), null, indent);
  }

  /**
   * Format plan as plain text
   * @param {Plan} plan - Plan to format
   * @param {Object} options - Format options
   * @returns {string} Text formatted plan
   */
  toText(plan, options = {}) {
    const style = options.style || 'default';
    const lines = [];
    
    // Header
    lines.push('='.repeat(50));
    lines.push(plan.name.toUpperCase());
    lines.push('='.repeat(50));
    lines.push('');
    
    // Summary
    const totalSteps = plan.steps?.length || 0;
    const totalDuration = plan.steps?.reduce((sum, step) => sum + (step.estimatedDuration || 0), 0) || 0;
    
    lines.push(`Total Steps: ${totalSteps}`);
    lines.push(`Total Duration: ${totalDuration} minutes`);
    lines.push('');
    
    // Steps
    if (style === 'tree') {
      lines.push('Steps:');
      plan.steps?.forEach((step, index) => {
        const isLast = index === plan.steps.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(`${prefix} Step ${index + 1}: ${step.name}`);
        
        if (step.dependencies?.length > 0) {
          const depPrefix = isLast ? '   ' : '│  ';
          lines.push(`${depPrefix}└─ Depends on: ${step.dependencies.join(', ')}`);
        }
      });
    } else {
      plan.steps?.forEach((step, index) => {
        lines.push(`Step ${index + 1}: ${step.name}`);
        if (step.description) {
          lines.push(`  ${step.description}`);
        }
        if (step.estimatedDuration) {
          lines.push(`  Duration: ${step.estimatedDuration} minutes`);
        }
        lines.push('');
      });
    }
    
    // Success Criteria
    if (plan.successCriteria?.length > 0) {
      lines.push('');
      lines.push('Success Criteria:');
      plan.successCriteria.forEach(criteria => {
        lines.push(`• ${criteria}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Format plan as HTML
   * @param {Plan} plan - Plan to format
   * @param {Object} options - Format options
   * @returns {string} HTML formatted plan
   */
  toHTML(plan, options = {}) {
    const escape = (str) => {
      const div = { innerHTML: '' };
      div.innerHTML = str;
      return div.innerHTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    const html = [];
    
    html.push('<div class="plan-container">');
    html.push(`  <h1>${escape(plan.name)}</h1>`);
    
    // Metadata
    if (plan.metadata) {
      html.push('  <div class="plan-metadata">');
      if (plan.version) {
        html.push(`    <span class="version">Version: ${escape(plan.version)}</span>`);
      }
      if (plan.metadata.complexity) {
        html.push(`    <span class="complexity">Complexity: ${escape(plan.metadata.complexity)}</span>`);
      }
      html.push('  </div>');
    }
    
    // Steps
    html.push('  <div class="plan-steps">');
    html.push('    <h2>Steps</h2>');
    
    plan.steps?.forEach((step, index) => {
      html.push(`    <div class="plan-step" data-step-id="${escape(step.id)}">`);
      html.push(`      <h3>${index + 1}. ${escape(step.name)}</h3>`);
      
      if (step.description) {
        html.push(`      <p>${escape(step.description)}</p>`);
      }
      
      if (step.actions?.length > 0) {
        html.push('      <ul class="actions">');
        step.actions.forEach(action => {
          html.push(`        <li>${escape(this._formatAction(action))}</li>`);
        });
        html.push('      </ul>');
      }
      
      html.push('    </div>');
    });
    
    html.push('  </div>');
    
    // Success Criteria
    if (plan.successCriteria?.length > 0) {
      html.push('  <div class="success-criteria">');
      html.push('    <h2>Success Criteria</h2>');
      html.push('    <ul>');
      plan.successCriteria.forEach(criteria => {
        html.push(`      <li>${escape(criteria)}</li>`);
      });
      html.push('    </ul>');
      html.push('  </div>');
    }
    
    html.push('</div>');
    
    return html.join('\n');
  }

  /**
   * Format plan as Mermaid diagram
   * @param {Plan} plan - Plan to format
   * @param {Object} options - Format options
   * @returns {string} Mermaid diagram
   */
  toMermaid(plan, options = {}) {
    const lines = [];
    
    lines.push('graph TD');
    
    // Define nodes
    plan.steps?.forEach(step => {
      const label = step.name.replace(/"/g, "'");
      lines.push(`    ${step.id}["${label}"]`);
    });
    
    // Define edges (dependencies)
    plan.steps?.forEach(step => {
      step.dependencies?.forEach(dep => {
        lines.push(`    ${dep} --> ${step.id}`);
      });
    });
    
    // Add styling
    lines.push('');
    lines.push('    %% Styling');
    const typeStyles = {
      setup: 'fill:#f9f,stroke:#333,stroke-width:2px',
      implementation: 'fill:#bbf,stroke:#333,stroke-width:2px',
      testing: 'fill:#bfb,stroke:#333,stroke-width:2px',
      validation: 'fill:#fbf,stroke:#333,stroke-width:2px',
      deployment: 'fill:#ffb,stroke:#333,stroke-width:2px'
    };
    
    plan.steps?.forEach(step => {
      if (step.type && typeStyles[step.type]) {
        lines.push(`    class ${step.id} ${step.type}`);
      }
    });
    
    return lines.join('\n');
  }

  /**
   * Format plan as YAML
   * @param {Plan} plan - Plan to format
   * @param {Object} options - Format options
   * @returns {string} YAML formatted plan
   */
  toYAML(plan, options = {}) {
    const indent = options.indent || 2;
    const spaces = ' '.repeat(indent);
    
    const formatValue = (value, level = 0) => {
      const currentIndent = ' '.repeat(level * indent);
      
      if (value === null || value === undefined) {
        return 'null';
      }
      
      if (typeof value === 'string') {
        // Quote strings that might be interpreted as other types
        if (value.match(/^(true|false|null|undefined|\d+(\.\d+)?|0x[0-9a-fA-F]+)$/)) {
          return `"${value}"`;
        }
        return value.includes('\n') ? `|\n${currentIndent}${spaces}${value.replace(/\n/g, '\n' + currentIndent + spaces)}` : value;
      }
      
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        return value.map(item => `\n${currentIndent}- ${formatValue(item, level + 1)}`).join('');
      }
      
      if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) return '{}';
        
        return entries.map(([key, val]) => {
          const formattedValue = formatValue(val, level + 1);
          if (formattedValue.startsWith('\n')) {
            return `\n${currentIndent}${key}:${formattedValue}`;
          }
          return `\n${currentIndent}${key}: ${formattedValue}`;
        }).join('');
      }
      
      return String(value);
    };
    
    const planData = plan.toJSON();
    const lines = [];
    
    Object.entries(planData).forEach(([key, value]) => {
      const formattedValue = formatValue(value, 1);
      if (formattedValue.startsWith('\n')) {
        lines.push(`${key}:${formattedValue}`);
      } else {
        lines.push(`${key}: ${formattedValue}`);
      }
    });
    
    return lines.join('');
  }

  /**
   * Format individual step
   * @param {PlanStep} step - Step to format
   * @param {Object} options - Format options
   * @returns {string} Formatted step
   */
  formatStep(step, options = {}) {
    const includeActions = options.includeActions || false;
    const format = options.format || 'detailed';
    
    if (format === 'compact') {
      const parts = [`${step.name} (${step.type})`];
      if (step.estimatedDuration) {
        parts.push(`${step.estimatedDuration}min`);
      }
      if (includeActions && step.actions) {
        parts.push(`${step.actions.length} actions`);
      }
      return parts.join(' - ');
    }
    
    const lines = [];
    lines.push(step.name);
    if (step.description) {
      lines.push(`  ${step.description}`);
    }
    lines.push(`  Type: ${step.type}`);
    if (step.estimatedDuration) {
      lines.push(`  Duration: ${step.estimatedDuration} minutes`);
    }
    
    if (includeActions && step.actions?.length > 0) {
      lines.push('  Actions:');
      step.actions.forEach(action => {
        lines.push(`    - ${this._formatAction(action)}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Generate plan summary
   * @param {Plan} plan - Plan to summarize
   * @returns {string} Summary
   */
  generateSummary(plan) {
    const totalSteps = plan.steps?.length || 0;
    const totalDuration = plan.steps?.reduce((sum, step) => sum + (step.estimatedDuration || 0), 0) || 0;
    const projectType = plan.context?.projectType || 'project';
    
    return `${plan.name} - A ${projectType} with ${totalSteps} steps, estimated to take ${totalDuration} minutes.`;
  }

  /**
   * Generate execution timeline
   * @param {Plan} plan - Plan to generate timeline for
   * @returns {string} Timeline
   */
  generateTimeline(plan) {
    const lines = [];
    let currentTime = 0;
    
    plan.steps?.forEach((step, index) => {
      const duration = step.estimatedDuration || 0;
      const startTime = this._formatTime(currentTime);
      const endTime = this._formatTime(currentTime + duration);
      
      lines.push(`${startTime} - ${endTime}: ${step.name}`);
      currentTime += duration;
    });
    
    return lines.join('\n');
  }

  /**
   * Export plan to file format
   * @param {Plan} plan - Plan to export
   * @param {Object} options - Export options
   * @returns {Object} Export data
   */
  exportToFile(plan, options = {}) {
    const format = options.format || 'markdown';
    const filename = options.filename || `${plan.name.toLowerCase().replace(/\s+/g, '-')}.${this._getFileExtension(format)}`;
    
    const content = this.format(plan, format, options);
    
    return {
      filename,
      content,
      mimeType: this._getMimeType(format),
      encoding: 'utf-8'
    };
  }

  // Private helper methods

  _formatAction(action) {
    switch (action.type) {
      case 'create-directory':
        return `Create directory: ${action.path}`;
      case 'create-file':
        return `Create file: ${action.path}`;
      case 'update-file':
        return `Update file: ${action.path}`;
      case 'delete-file':
        return `Delete file: ${action.path}`;
      case 'run-command':
        return `Run command: ${action.command}`;
      default:
        return `${action.type}: ${JSON.stringify(action)}`;
    }
  }

  _formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  _getFileExtension(format) {
    const extensions = {
      markdown: 'md',
      json: 'json',
      text: 'txt',
      html: 'html',
      mermaid: 'mmd',
      yaml: 'yml'
    };
    return extensions[format] || 'txt';
  }

  _getMimeType(format) {
    const mimeTypes = {
      markdown: 'text/markdown',
      json: 'application/json',
      text: 'text/plain',
      html: 'text/html',
      mermaid: 'text/plain',
      yaml: 'text/yaml'
    };
    return mimeTypes[format] || 'text/plain';
  }
}

export { PlanFormatter };