/**
 * MVVMComponentFactory - Utility for standardized MVVM component initialization
 * 
 * Provides a consistent pattern for creating MVVM components with:
 * - Standardized initialization order
 * - Dependency injection
 * - Error handling and validation
 * - Lifecycle management
 * - Configuration management
 */

import { BaseUmbilicalComponent } from './BaseUmbilicalComponent.js';

export class MVVMComponentFactory {
  /**
   * Create an MVVM component instance
   * @param {Object} config - Component configuration
   * @param {Function} config.ModelClass - Model class constructor
   * @param {Function} config.ViewClass - View class constructor  
   * @param {Function} config.ViewModelClass - ViewModel class constructor
   * @param {Object} config.defaults - Default configuration values
   * @param {Function} config.validator - Configuration validator function
   * @returns {Object} Component instance with MVVM layers
   */
  static createComponent(config) {
    const {
      ModelClass,
      ViewClass,
      ViewModelClass,
      defaults = {},
      validator = null,
      name = 'MVVMComponent'
    } = config;

    // Validate required classes
    this._validateClasses({ ModelClass, ViewClass, ViewModelClass, name });

    return class extends BaseUmbilicalComponent {
      static defineRequirements(componentConfig = {}) {
        const requirements = super.defineRequirements(componentConfig);
        
        // Allow component-specific requirement additions
        if (config.defineRequirements) {
          config.defineRequirements(requirements, componentConfig);
        }
        
        return requirements;
      }

      static validateCapabilities(umbilical, componentConfig = {}) {
        const checks = super.validateCapabilities(umbilical, componentConfig);
        
        // Allow component-specific validation additions
        if (config.validateCapabilities) {
          const componentChecks = config.validateCapabilities(umbilical, componentConfig);
          Object.assign(checks, componentChecks);
        }
        
        return checks;
      }

      static validateConfig(componentConfig) {
        if (!super.validateConfig(componentConfig)) return false;
        
        // Run custom validator if provided
        if (validator && !validator(componentConfig)) {
          return false;
        }
        
        return true;
      }

      constructor(umbilical, componentConfig = {}) {
        super();
        
        this.umbilical = umbilical;
        this.destroyed = false;
        
        // Extract and merge configuration
        this.config = BaseUmbilicalComponent.extractConfig(umbilical, {
          ...defaults,
          ...componentConfig
        });
        
        // Initialize MVVM layers
        try {
          this._initializeMVVM();
          this._setupLifecycle();
          
          // Call mount callback
          BaseUmbilicalComponent.handleLifecycle('mount', umbilical, this);
          
        } catch (error) {
          console.error(`${name} initialization failed:`, error);
          BaseUmbilicalComponent.handleLifecycle('error', umbilical, error);
          throw error;
        }
      }

      /**
       * Initialize MVVM layers in correct order
       * @private
       */
      _initializeMVVM() {
        // 1. Create Model (data layer)
        this.model = new ModelClass(this.config.data, this.config);
        
        // 2. Create View (presentation layer)
        this.view = new ViewClass(this.config.dom, this.config);
        
        // 3. Create ViewModel (coordination layer)
        this.viewModel = new ViewModelClass(this.model, this.view, this.config);
        
        // 4. Initial render
        this.viewModel.render();
      }

      /**
       * Setup component lifecycle management
       * @private
       */
      _setupLifecycle() {
        // Listen for ViewModel events to forward to umbilical callbacks
        this.viewModel.addEventListener('error', (event) => {
          BaseUmbilicalComponent.handleLifecycle('error', this.umbilical, event.data.error);
        });
        
        this.viewModel.addEventListener('stateChanged', (event) => {
          if (this.config.onStateChange) {
            try {
              this.config.onStateChange(event.data);
            } catch (error) {
              console.error(`${name} onStateChange callback error:`, error);
            }
          }
        });
      }

      /**
       * Get component statistics and debug info
       * @returns {Object} Debug information
       */
      debug() {
        return {
          model: this.model,
          view: this.view,
          viewModel: this.viewModel,
          config: this.config,
          stats: {
            model: this.model.getStats(),
            view: this.view.getStats(),
            viewModel: this.viewModel.getStats()
          },
          destroyed: this.destroyed
        };
      }

      /**
       * Update component configuration
       * @param {Object} updates - Configuration updates
       */
      updateConfig(updates) {
        if (this.destroyed) return;
        
        const oldConfig = { ...this.config };
        Object.assign(this.config, updates);
        
        // Apply updates to layers
        if (updates.theme && this.viewModel.setTheme) {
          this.viewModel.setTheme(updates.theme);
        }
        
        if (updates.data && this.model.setData) {
          this.model.setData(updates.data);
        }
        
        // Trigger re-render if needed
        this.viewModel.render();
        
        // Notify of config change
        if (this.config.onConfigChange) {
          try {
            this.config.onConfigChange({ oldConfig, newConfig: this.config, updates });
          } catch (error) {
            console.error(`${name} onConfigChange callback error:`, error);
          }
        }
      }

      /**
       * Get current configuration
       * @returns {Object} Current configuration
       */
      getConfig() {
        return { ...this.config };
      }

      /**
       * Execute a command on the ViewModel
       * @param {string} command - Command name
       * @param {*} params - Command parameters
       * @returns {*} Command result
       */
      executeCommand(command, params) {
        if (this.destroyed) return null;
        return this.viewModel.executeCommand(command, params);
      }

      /**
       * Check if command can be executed
       * @param {string} command - Command name
       * @returns {boolean} True if command can be executed
       */
      canExecuteCommand(command) {
        if (this.destroyed) return false;
        return this.viewModel.canExecuteCommand(command);
      }

      /**
       * Clean up component resources
       */
      destroy() {
        if (this.destroyed) return;
        
        this.destroyed = true;
        
        try {
          // Destroy MVVM layers in reverse order
          if (this.viewModel) {
            this.viewModel.destroy();
            this.viewModel = null;
          }
          
          if (this.view) {
            this.view.destroy();
            this.view = null;
          }
          
          if (this.model) {
            this.model.destroy();
            this.model = null;
          }
          
          // Call destroy callback
          BaseUmbilicalComponent.handleLifecycle('destroy', this.umbilical, this);
          
        } catch (error) {
          console.error(`${name} destruction failed:`, error);
        }
      }
    };
  }

  /**
   * Create a simple component wrapper for existing MVVM components
   * @param {string} name - Component name
   * @param {Function} ModelClass - Model class
   * @param {Function} ViewClass - View class
   * @param {Function} ViewModelClass - ViewModel class
   * @param {Object} options - Additional options
   * @returns {Object} Component wrapper
   */
  static wrapComponent(name, ModelClass, ViewClass, ViewModelClass, options = {}) {
    const ComponentClass = this.createComponent({
      ModelClass,
      ViewClass,
      ViewModelClass,
      name,
      ...options
    });

    return {
      create(umbilical) {
        return ComponentClass.create(umbilical, ComponentClass, options.config);
      }
    };
  }

  /**
   * Create a factory for batch component creation
   * @param {Object} componentDefinitions - Map of component definitions
   * @returns {Object} Component factories
   */
  static createFactories(componentDefinitions) {
    const factories = {};
    
    Object.entries(componentDefinitions).forEach(([name, definition]) => {
      factories[name] = this.wrapComponent(name, ...definition);
    });
    
    return factories;
  }

  // Private helper methods

  /**
   * Validate required MVVM classes
   * @private
   */
  static _validateClasses({ ModelClass, ViewClass, ViewModelClass, name }) {
    if (!ModelClass || typeof ModelClass !== 'function') {
      throw new Error(`${name}: ModelClass must be a constructor function`);
    }
    
    if (!ViewClass || typeof ViewClass !== 'function') {
      throw new Error(`${name}: ViewClass must be a constructor function`);
    }
    
    if (!ViewModelClass || typeof ViewModelClass !== 'function') {
      throw new Error(`${name}: ViewModelClass must be a constructor function`);
    }
  }
}

/**
 * Convenience function for creating MVVM components
 * @param {Object} config - Component configuration
 * @returns {Function} Component class
 */
export function createMVVMComponent(config) {
  return MVVMComponentFactory.createComponent(config);
}

/**
 * Convenience function for wrapping existing MVVM components
 * @param {string} name - Component name
 * @param {Function} ModelClass - Model class
 * @param {Function} ViewClass - View class  
 * @param {Function} ViewModelClass - ViewModel class
 * @param {Object} options - Additional options
 * @returns {Object} Component wrapper
 */
export function wrapMVVMComponent(name, ModelClass, ViewClass, ViewModelClass, options = {}) {
  return MVVMComponentFactory.wrapComponent(name, ModelClass, ViewClass, ViewModelClass, options);
}