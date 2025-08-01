/**
 * ModernTree - A new Tree component built with MVVM base classes
 * 
 * Demonstrates the power of the base class abstraction by implementing
 * a full-featured tree component with minimal boilerplate.
 */

import { createMVVMComponent } from '../base/index.js';
import { ModernTreeModel } from './model/ModernTreeModel.js';
import { ModernTreeView } from './view/ModernTreeView.js';
import { ModernTreeViewModel } from './viewmodel/ModernTreeViewModel.js';

const ModernTreeClass = createMVVMComponent({
  ModelClass: ModernTreeModel,
  ViewClass: ModernTreeView,
  ViewModelClass: ModernTreeViewModel,
  name: 'ModernTree',
  
  // Default configuration
  defaults: {
    theme: 'light',
    selectable: 'single',
    expandable: true,
    draggable: false,
    editable: false,
    searchable: true,
    virtualScrolling: false,
    showIcons: true,
    showLines: true,
    animateTransitions: true,
    lazyLoading: false
  },
  
  // Define component-specific requirements
  defineRequirements(requirements, config) {
    requirements.add('data', 'array', 'Hierarchical data array with id, name, and optional children');
    requirements.add('selectable', 'string', 'Selection mode: none, single, multiple (default: single)', false);
    requirements.add('expandable', 'boolean', 'Allow node expansion/collapse (default: true)', false);
    requirements.add('draggable', 'boolean', 'Enable drag and drop (default: false)', false);
    requirements.add('editable', 'boolean', 'Enable inline editing (default: false)', false);
    requirements.add('searchable', 'boolean', 'Enable search functionality (default: true)', false);
    requirements.add('virtualScrolling', 'boolean', 'Enable virtual scrolling for large trees (default: false)', false);
    requirements.add('nodeRenderer', 'function', 'Custom node renderer function (optional)', false);
    requirements.add('iconProvider', 'function', 'Custom icon provider function (optional)', false);
    requirements.add('onSelectionChange', 'function', 'Called when selection changes (optional)', false);
    requirements.add('onExpansionChange', 'function', 'Called when node expansion changes (optional)', false);
    requirements.add('onNodeEdit', 'function', 'Called when node is edited (optional)', false);
    requirements.add('onNodeMove', 'function', 'Called when node is moved via drag/drop (optional)', false);
  },
  
  // Define component-specific validation
  validateCapabilities(umbilical, config) {
    const validateTreeCallbacks = (umbilical) => {
      const callbacks = ['onSelectionChange', 'onExpansionChange', 'onNodeEdit', 'onNodeMove', 'nodeRenderer', 'iconProvider'];
      return callbacks.every(callback => {
        const fn = umbilical[callback];
        return !fn || typeof fn === 'function';
      });
    };
    
    const checks = {
      hasValidData: Array.isArray(umbilical.data) || typeof umbilical.data === 'object',
      hasValidSelectable: !umbilical.selectable || ['none', 'single', 'multiple'].includes(umbilical.selectable),
      hasValidCallbacks: validateTreeCallbacks(umbilical)
    };
    
    return checks;
  }
});

// Create wrapper with additional public API methods
export const ModernTree = {
  create(umbilical) {
    // Handle introspection mode
    if (umbilical.describe) {
      return ModernTreeClass.create(umbilical);
    }
    
    // Handle validation mode
    if (umbilical.validate) {
      return ModernTreeClass.create(umbilical);
    }
    
    // Handle instance creation mode
    const instance = ModernTreeClass.create(umbilical);
    
    // Only add methods if instance was successfully created
    if (instance) {
      // Add tree-specific public API methods
      instance.getSelection = function() {
        return this.viewModel.getSelection();
      };
      
      instance.getStats = function() {
        return this.viewModel.getStats();
      };
      
      instance.search = function(query, options) {
        return this.viewModel.search(query, options);
      };
    }
    
    return instance;
  }
};

// Export the model, view, and viewmodel for advanced usage
export { ModernTreeModel, ModernTreeView, ModernTreeViewModel };