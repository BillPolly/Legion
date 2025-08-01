/**
 * ToolsPanel component with umbilical protocol
 */
import { ToolsPanelModel } from './ToolsPanelModel.js';
import { ToolsPanelView } from './ToolsPanelView.js';
import { ToolsPanelViewModel } from './ToolsPanelViewModel.js';

export const ToolsPanel = {
  create(umbilical) {
    // Introspection mode
    if (umbilical.describe) {
      const requirements = {
        dom: {
          type: 'HTMLElement',
          description: 'Parent DOM element for tools panel',
          required: true
        },
        actorSpace: {
          type: 'ActorSpace',
          description: 'Actor space for server communication',
          required: true
        },
        config: {
          type: 'object',
          description: 'Tools panel configuration',
          required: false,
          properties: {
            theme: {
              type: 'string',
              description: 'Panel theme',
              default: 'default'
            },
            groupByCategory: {
              type: 'boolean',
              description: 'Group tools by category',
              default: false
            },
            showDescriptions: {
              type: 'boolean',
              description: 'Show tool descriptions',
              default: true
            },
            autoRefresh: {
              type: 'boolean',
              description: 'Auto-refresh tools list',
              default: false
            }
          }
        },
        onMount: {
          type: 'function',
          description: 'Called when tools panel is created',
          required: false
        },
        onDestroy: {
          type: 'function',
          description: 'Called when tools panel is destroyed',
          required: false
        }
      };
      
      umbilical.describe({
        getAll: () => requirements
      });
      return;
    }
    
    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === 1,
        hasActorSpace: umbilical.actorSpace && typeof umbilical.actorSpace.getActor === 'function',
        hasValidConfig: !umbilical.config || typeof umbilical.config === 'object'
      });
    }
    
    // Instance creation mode
    
    // Validate required properties
    if (!umbilical.dom || umbilical.dom.nodeType !== 1) {
      throw new Error('ToolsPanel requires a DOM element');
    }
    
    if (!umbilical.actorSpace || typeof umbilical.actorSpace.getActor !== 'function') {
      throw new Error('ToolsPanel requires an actor space');
    }
    
    // Create MVVM components
    const model = new ToolsPanelModel();
    const view = new ToolsPanelView(umbilical.dom);
    const viewModel = new ToolsPanelViewModel(model, view, umbilical.actorSpace);
    
    // Apply configuration
    if (umbilical.config) {
      if (typeof umbilical.config.groupByCategory === 'boolean') {
        viewModel.groupByCategory = umbilical.config.groupByCategory;
      }
      if (typeof umbilical.config.showDescriptions === 'boolean') {
        viewModel.showDescriptions = umbilical.config.showDescriptions;
      }
    }
    
    // Render view with options first
    const renderOptions = {
      theme: umbilical.config?.theme || 'default'
    };
    view.render(renderOptions);
    
    // Bind before initialize so model events are subscribed
    viewModel.bind();
    
    // Initialize last (this will call requestToolsList which uses setLoading)
    viewModel.initialize();
    
    // Get tools panel API
    const api = viewModel.getToolsPanelAPI();
    
    // Create tools panel instance
    const toolsPanel = {
      // Expose model, view, viewModel for testing
      model,
      view,
      viewModel,
      
      // Public API
      refreshTools: api.refreshTools,
      selectTool: api.selectTool,
      getSelectedTool: api.getSelectedTool,
      executeTool: api.executeTool,
      searchTools: api.searchTools,
      toggleCategoryView: api.toggleCategoryView,
      getTools: api.getTools,
      getFilteredTools: api.getFilteredTools,
      
      destroy() {
        if (umbilical.onDestroy) {
          umbilical.onDestroy(toolsPanel);
        }
        viewModel.destroy();
      }
    };
    
    // Call mount callback
    if (umbilical.onMount) {
      umbilical.onMount(toolsPanel);
    }
    
    return toolsPanel;
  }
};