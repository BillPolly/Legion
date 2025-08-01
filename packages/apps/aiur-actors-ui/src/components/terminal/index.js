/**
 * Terminal component with umbilical protocol
 */
import { TerminalModel } from './TerminalModel.js';
import { TerminalView } from './TerminalView.js';
import { TerminalViewModel } from './TerminalViewModel.js';

export const Terminal = {
  create(umbilical) {
    // Introspection mode
    if (umbilical.describe) {
      const requirements = {
        dom: {
          type: 'HTMLElement',
          description: 'Parent DOM element for terminal',
          required: true
        },
        actorSpace: {
          type: 'ActorSpace',
          description: 'Actor space for server communication',
          required: true
        },
        prompt: {
          type: 'string',
          description: 'Terminal prompt string',
          required: false,
          default: '> '
        },
        config: {
          type: 'object',
          description: 'Terminal configuration',
          required: false,
          properties: {
            maxHistory: {
              type: 'number',
              description: 'Maximum command history size',
              default: 1000
            },
            maxOutputLines: {
              type: 'number',
              description: 'Maximum output buffer size',
              default: 10000
            },
            theme: {
              type: 'string',
              description: 'Terminal theme',
              default: 'default'
            }
          }
        },
        onMount: {
          type: 'function',
          description: 'Called when terminal is created',
          required: false
        },
        onDestroy: {
          type: 'function',
          description: 'Called when terminal is destroyed',
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
        hasValidPrompt: !umbilical.prompt || typeof umbilical.prompt === 'string',
        hasValidConfig: !umbilical.config || typeof umbilical.config === 'object'
      });
    }
    
    // Instance creation mode
    
    // Validate required properties
    if (!umbilical.dom || umbilical.dom.nodeType !== 1) {
      throw new Error('Terminal requires a DOM element');
    }
    
    if (!umbilical.actorSpace || typeof umbilical.actorSpace.getActor !== 'function') {
      throw new Error('Terminal requires an actor space');
    }
    
    // Create MVVM components
    const model = new TerminalModel();
    const view = new TerminalView(umbilical.dom);
    const viewModel = new TerminalViewModel(model, view, umbilical.actorSpace);
    
    // Apply configuration
    if (umbilical.config) {
      if (umbilical.config.maxHistory) {
        model.maxHistorySize = umbilical.config.maxHistory;
      }
      if (umbilical.config.maxOutputLines) {
        model.maxOutputLines = umbilical.config.maxOutputLines;
      }
    }
    
    // Set prompt before initializing
    if (umbilical.prompt) {
      viewModel.prompt = umbilical.prompt;
    }
    
    // Initialize
    viewModel.initialize();
    
    // Render view with options
    const renderOptions = {
      theme: umbilical.config?.theme || 'default',
      prompt: viewModel.prompt || '> '
    };
    view.render(renderOptions);
    
    // Bind after rendering
    viewModel.bind();
    
    // Get terminal API
    const api = viewModel.getTerminalAPI();
    
    // Create terminal instance
    const terminal = {
      // Expose model, view, viewModel for testing
      model,
      view,
      viewModel,
      
      // Public API
      execute: api.execute,
      clear: api.clear,
      focus: api.focus,
      getHistory: api.getHistory,
      getOutput: api.getOutput,
      setPrompt: api.setPrompt,
      
      destroy() {
        if (umbilical.onDestroy) {
          umbilical.onDestroy(terminal);
        }
        viewModel.destroy();
      }
    };
    
    // Call mount callback
    if (umbilical.onMount) {
      umbilical.onMount(terminal);
    }
    
    return terminal;
  }
};