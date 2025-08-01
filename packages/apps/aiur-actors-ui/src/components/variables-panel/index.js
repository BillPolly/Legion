/**
 * VariablesPanel - Main component for variables management panel
 * Implements the umbilical protocol for component creation and dependency injection
 */
import { VariablesPanelModel } from './VariablesPanelModel.js';
import { VariablesPanelView } from './VariablesPanelView.js';
import { VariablesPanelViewModel } from './VariablesPanelViewModel.js';

export class VariablesPanel {
  constructor(model, view, viewModel) {
    this.model = model;
    this.view = view;
    this.viewModel = viewModel;
  }

  /**
   * Create VariablesPanel instance using umbilical protocol
   * @param {Object} umbilical - Umbilical object containing dependencies
   * @returns {VariablesPanel|boolean} VariablesPanel instance or validation result
   */
  static create(umbilical) {
    // Introspection mode: describe requirements
    if (umbilical.describe) {
      const requirements = {
        dom: {
          type: 'HTMLElement',
          description: 'Parent DOM element for variables panel',
          required: true
        },
        actorSpace: {
          type: 'ActorSpace',
          description: 'Actor space for inter-component communication',
          required: true
        },
        config: {
          type: 'Object',
          description: 'Configuration options for variables panel',
          required: false,
          properties: {
            theme: { type: 'string', description: 'UI theme (light, dark)' },
            groupByType: { type: 'boolean', description: 'Group variables by type' },
            groupByScope: { type: 'boolean', description: 'Group variables by scope' },
            showDescriptions: { type: 'boolean', description: 'Show variable descriptions' }
          }
        },
        onMount: {
          type: 'Function',
          description: 'Callback when component is mounted',
          required: false
        },
        onDestroy: {
          type: 'Function',
          description: 'Callback when component is destroyed',
          required: false
        }
      };
      
      umbilical.describe({
        getAll: () => requirements,
        get: (key) => requirements[key]
      });
      return;
    }

    // Validation mode: validate umbilical properties
    if (umbilical.validate) {
      const checks = {
        hasDomElement: !!(umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE),
        hasActorSpace: !!(umbilical.actorSpace && typeof umbilical.actorSpace.getActor === 'function'),
        hasValidConfig: !umbilical.config || typeof umbilical.config === 'object'
      };
      
      return umbilical.validate(checks);
    }

    // Instance creation mode: create and configure component
    const { dom, actorSpace, config = {}, onMount, onDestroy } = umbilical;

    // Validate required dependencies
    if (!dom || dom.nodeType !== Node.ELEMENT_NODE) {
      throw new Error('VariablesPanel requires a valid DOM element');
    }

    if (!actorSpace || typeof actorSpace.getActor !== 'function') {
      throw new Error('VariablesPanel requires a valid ActorSpace');
    }

    // Create component instances
    const model = new VariablesPanelModel();
    const view = new VariablesPanelView(dom);
    const viewModel = new VariablesPanelViewModel(model, view, actorSpace);

    // Apply configuration
    if (config.groupByType !== undefined) {
      viewModel.groupByType = config.groupByType;
    }
    if (config.groupByScope !== undefined) {
      viewModel.groupByScope = config.groupByScope;
    }
    if (config.showDescriptions !== undefined) {
      viewModel.showDescriptions = config.showDescriptions;
    }

    // Create variables panel instance
    const variablesPanel = new VariablesPanel(model, view, viewModel);

    // Initialize component (proper order: render → bind → initialize)
    const renderOptions = {};
    if (config.theme) {
      renderOptions.theme = config.theme;
    }

    // Render view with options first
    view.render(renderOptions);

    // Bind before initialize so model events are subscribed
    viewModel.bind();

    // Initialize last (this will call requestVariablesList which uses setLoading)
    viewModel.initialize();

    // Expose public API
    Object.assign(variablesPanel, {
      // Variable management
      refreshVariables: () => viewModel.requestVariablesList(),
      selectVariable: (variableId) => model.selectVariable(variableId),
      getCurrentVariable: () => model.getSelectedVariable(),
      createVariable: (variableData) => viewModel.handleCreateVariable(variableData),
      updateVariable: (variableId, updates) => viewModel.updateVariable(variableId, updates),
      deleteVariable: (variableId) => viewModel.confirmDeleteVariable(variableId),
      duplicateVariable: (variableId) => viewModel.duplicateVariable(variableId),
      
      // Import/Export
      importVariables: (json) => viewModel.importVariables(json),
      exportVariables: () => viewModel.exportVariables(),
      showImportDialog: () => viewModel.showImportDialog(),
      
      // Search and filtering
      searchVariables: (query) => model.setSearchQuery(query),
      clearSearch: () => model.setSearchQuery(''),
      
      // View controls
      toggleTypeView: () => viewModel.toggleTypeView(),
      toggleScopeView: () => viewModel.toggleScopeView(),
      focusSearch: () => view.focusSearch(),
      
      // Data access
      getVariables: () => model.getVariables(),
      getFilteredVariables: () => model.getFilteredVariables(),
      getVariableTypes: () => model.getVariableTypes(),
      getVariableScopes: () => model.getVariableScopes(),
      getVariableById: (id) => model.getVariableById(id),
      
      // State queries
      isLoading: () => view.variablesPanel?.classList.contains('loading') || false,
      hasError: () => !!view.errorMessage,
      
      // Utility functions
      copyVariableValue: (variableId) => viewModel.copyVariableValue(variableId),
      editVariable: (variableId) => viewModel.editVariable(variableId),
      
      // Component lifecycle
      destroy: () => {
        if (onDestroy) {
          onDestroy(variablesPanel);
        }
        viewModel.destroy();
        view.destroy();
        model.destroy();
      },
      
      // Internal access for testing
      model,
      view,
      viewModel
    });

    // Call mount callback if provided
    if (onMount) {
      onMount(variablesPanel);
    }

    return variablesPanel;
  }
}

// Export for use in other modules
export { VariablesPanelModel, VariablesPanelView, VariablesPanelViewModel };