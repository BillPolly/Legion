/**
 * HierarchyEditorDemo - Umbilical MVVM component for demonstrating HierarchyEditor
 * 
 * A comprehensive demo component that showcases all features of the HierarchyEditor
 * component with multiple interactive examples.
 */

import { createMVVMComponent } from '../base/index.js';
import { HierarchyEditorDemoModel } from './model/HierarchyEditorDemoModel.js';
import { HierarchyEditorDemoView } from './view/HierarchyEditorDemoView.js';
import { HierarchyEditorDemoViewModel } from './viewmodel/HierarchyEditorDemoViewModel.js';

const HierarchyEditorDemoClass = createMVVMComponent({
  ModelClass: HierarchyEditorDemoModel,
  ViewClass: HierarchyEditorDemoView,
  ViewModelClass: HierarchyEditorDemoViewModel,
  name: 'HierarchyEditorDemo',
  
  // Default configuration
  defaults: {
    theme: 'light',
    showApiExamples: true,
    maxEventLogEntries: 20
  },
  
  // Define component-specific requirements
  defineRequirements(requirements, config) {
    requirements.add('theme', 'string', 'Color theme: light or dark (default: light)', false);
    requirements.add('showApiExamples', 'boolean', 'Show API usage examples section (default: true)', false);
    requirements.add('maxEventLogEntries', 'number', 'Maximum number of events to keep in log (default: 20)', false);
    requirements.add('sampleData', 'object', 'Custom sample data for different formats (optional)', false);
    requirements.add('onEditorCreate', 'function', 'Called when an editor instance is created (optional)', false);
    requirements.add('onEditorDestroy', 'function', 'Called when an editor instance is destroyed (optional)', false);
  },
  
  // Define component-specific validation
  validateCapabilities(umbilical, config) {
    const checks = {
      hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme),
      hasValidMaxEntries: !umbilical.maxEventLogEntries || 
        (typeof umbilical.maxEventLogEntries === 'number' && umbilical.maxEventLogEntries > 0),
      hasValidCallbacks: (!umbilical.onEditorCreate || typeof umbilical.onEditorCreate === 'function') &&
        (!umbilical.onEditorDestroy || typeof umbilical.onEditorDestroy === 'function')
    };
    
    return checks;
  }
});

// Create wrapper with additional public API methods
export const HierarchyEditorDemo = {
  create(umbilical) {
    // Handle introspection mode
    if (umbilical.describe) {
      return HierarchyEditorDemoClass.create(umbilical);
    }
    
    // Handle validation mode
    if (umbilical.validate) {
      return HierarchyEditorDemoClass.create(umbilical);
    }
    
    // Handle instance creation mode
    const instance = HierarchyEditorDemoClass.create(umbilical);
    
    // Only add methods if instance was successfully created
    if (instance) {
      // Add demo-specific public API methods
      instance.getEditorInstance = function(name) {
        return this.viewModel.getEditorInstance(name);
      };
      
      instance.getAllEditorInstances = function() {
        return this.viewModel.getAllEditorInstances();
      };
      
      instance.getEventLog = function() {
        return this.viewModel.getEventLog();
      };
      
      instance.loadSampleData = function(editorName, format) {
        const editor = this.viewModel.getEditorInstance(editorName);
        if (editor && format) {
          const sampleData = this.model.getSampleData(format);
          if (sampleData) {
            editor.loadContent(sampleData, format);
          }
        }
      };
      
      instance.clearEventLog = function() {
        this.model.clearEventLog();
        this.view.clearEventLog();
      };
      
      instance.setTheme = function(theme) {
        if (['light', 'dark'].includes(theme)) {
          this.model.setTheme(theme);
        }
      };
      
      instance.getState = function() {
        return this.model.getState();
      };
    }
    
    return instance;
  }
};

// Export the model, view, and viewmodel for advanced usage
export { HierarchyEditorDemoModel, HierarchyEditorDemoView, HierarchyEditorDemoViewModel };