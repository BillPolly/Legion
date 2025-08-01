/**
 * Factory for creating MVVM components with umbilical protocol
 */
import { Terminal } from './terminal/index.js';
import { ToolsPanel } from './tools-panel/index.js';
import { SessionPanel } from './session-panel/index.js';
import { VariablesPanel } from './variables-panel/index.js';

export class ComponentFactory {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Validate umbilical has required properties
   * @param {Object} umbilical - Umbilical object to validate
   * @param {Array} required - Required properties
   * @returns {Object} Validation result
   */
  validateUmbilical(umbilical, required = []) {
    const errors = [];
    
    // Check required properties
    for (const prop of required) {
      if (!(prop in umbilical)) {
        errors.push(`Missing required property: ${prop}`);
      }
    }
    
    // Validate DOM element if present
    if (umbilical.dom && !(umbilical.dom instanceof Element)) {
      errors.push('Invalid DOM element');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Merge factory config with umbilical
   * @param {Object} umbilical - Component umbilical
   * @returns {Object} Merged umbilical
   */
  mergeConfig(umbilical) {
    const merged = { ...umbilical };
    
    // Add factory config (except nested config which we handle separately)
    Object.keys(this.config).forEach(key => {
      if (key !== 'config' && !(key in merged)) {
        merged[key] = this.config[key];
      }
    });
    
    // Handle config merging specially
    if (!merged.config) {
      merged.config = {};
    }
    
    // Merge factory config into umbilical config
    if (this.config.defaultPrompt) {
      merged.config.defaultPrompt = this.config.defaultPrompt;
    }
    
    // Merge any other factory config properties
    if (this.config.config) {
      merged.config = { ...this.config.config, ...merged.config };
    }
    
    return merged;
  }

  /**
   * Create terminal component
   * @param {Object} umbilical - Component umbilical
   * @returns {Object} Terminal component instance
   */
  createTerminal(umbilical) {
    // Validate requirements
    const validation = this.validateUmbilical(umbilical, ['dom']);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }
    
    // Merge config
    const mergedUmbilical = this.mergeConfig(umbilical);
    
    // Create component
    const terminal = Terminal.create(mergedUmbilical);
    
    // Call lifecycle hook
    if (umbilical.onMount) {
      umbilical.onMount(terminal);
    }
    
    // Wrap destroy to call onDestroy
    const originalDestroy = terminal.destroy;
    terminal.destroy = () => {
      if (umbilical.onDestroy) {
        umbilical.onDestroy(terminal);
      }
      originalDestroy.call(terminal);
    };
    
    return terminal;
  }

  /**
   * Create tools panel component
   * @param {Object} umbilical - Component umbilical
   * @returns {Object} ToolsPanel component instance
   */
  createToolsPanel(umbilical) {
    // Validate requirements
    const validation = this.validateUmbilical(umbilical, ['dom']);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }
    
    // Merge config
    const mergedUmbilical = this.mergeConfig(umbilical);
    
    // Create component
    const toolsPanel = ToolsPanel.create(mergedUmbilical);
    
    // Call lifecycle hook
    if (umbilical.onMount) {
      umbilical.onMount(toolsPanel);
    }
    
    // Wrap destroy
    const originalDestroy = toolsPanel.destroy;
    toolsPanel.destroy = () => {
      if (umbilical.onDestroy) {
        umbilical.onDestroy(toolsPanel);
      }
      originalDestroy.call(toolsPanel);
    };
    
    return toolsPanel;
  }

  /**
   * Create session panel component
   * @param {Object} umbilical - Component umbilical
   * @returns {Object} SessionPanel component instance
   */
  createSessionPanel(umbilical) {
    // Validate requirements
    const validation = this.validateUmbilical(umbilical, ['dom']);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }
    
    // Merge config
    const mergedUmbilical = this.mergeConfig(umbilical);
    
    // Create component
    const sessionPanel = SessionPanel.create(mergedUmbilical);
    
    // Call lifecycle hook
    if (umbilical.onMount) {
      umbilical.onMount(sessionPanel);
    }
    
    // Wrap destroy
    const originalDestroy = sessionPanel.destroy;
    sessionPanel.destroy = () => {
      if (umbilical.onDestroy) {
        umbilical.onDestroy(sessionPanel);
      }
      originalDestroy.call(sessionPanel);
    };
    
    return sessionPanel;
  }

  /**
   * Create variables panel component
   * @param {Object} umbilical - Component umbilical
   * @returns {Object} VariablesPanel component instance
   */
  createVariablesPanel(umbilical) {
    // Validate requirements
    const validation = this.validateUmbilical(umbilical, ['dom']);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }
    
    // Merge config
    const mergedUmbilical = this.mergeConfig(umbilical);
    
    // Create component
    const variablesPanel = VariablesPanel.create(mergedUmbilical);
    
    // Call lifecycle hook
    if (umbilical.onMount) {
      umbilical.onMount(variablesPanel);
    }
    
    // Wrap destroy
    const originalDestroy = variablesPanel.destroy;
    variablesPanel.destroy = () => {
      if (umbilical.onDestroy) {
        umbilical.onDestroy(variablesPanel);
      }
      originalDestroy.call(variablesPanel);
    };
    
    return variablesPanel;
  }

  /**
   * Create complete application with all components
   * @param {Object} config - Application configuration
   * @returns {Object} Application instance
   */
  createApplication(config) {
    const { containers, callbacks } = config;
    
    // Create terminal
    const terminal = this.createTerminal({
      dom: containers.terminal,
      actorSpace: this.config.actorSpace
    });
    
    // Create tools panel
    const toolsPanel = this.createToolsPanel({
      dom: containers.tools,
      actorSpace: this.config.actorSpace,
      onToolSelect: callbacks.onToolSelect
    });
    
    // Create session panel
    const sessionPanel = this.createSessionPanel({
      dom: containers.session,
      actorSpace: this.config.actorSpace,
      onSessionChange: callbacks.onSessionChange
    });
    
    // Create variables panel
    const variablesPanel = this.createVariablesPanel({
      dom: containers.variables,
      actorSpace: this.config.actorSpace,
      onVariableSelect: callbacks.onVariableSelect
    });
    
    // Return application object
    return {
      terminal,
      toolsPanel,
      sessionPanel,
      variablesPanel,
      
      destroy() {
        terminal.destroy();
        toolsPanel.destroy();
        sessionPanel.destroy();
        variablesPanel.destroy();
      }
    };
  }
}