/**
 * SessionPanel - Main component for session management panel
 * Implements the umbilical protocol for component creation and dependency injection
 */
import { SessionPanelModel } from './SessionPanelModel.js';
import { SessionPanelView } from './SessionPanelView.js';
import { SessionPanelViewModel } from './SessionPanelViewModel.js';

export class SessionPanel {
  constructor(model, view, viewModel) {
    this.model = model;
    this.view = view;
    this.viewModel = viewModel;
  }

  /**
   * Create SessionPanel instance using umbilical protocol
   * @param {Object} umbilical - Umbilical object containing dependencies
   * @returns {SessionPanel|boolean} SessionPanel instance or validation result
   */
  static create(umbilical) {
    // Introspection mode: describe requirements
    if (umbilical.describe) {
      const requirements = {
        dom: {
          type: 'HTMLElement',
          description: 'Parent DOM element for session panel',
          required: true
        },
        actorSpace: {
          type: 'ActorSpace',
          description: 'Actor space for inter-component communication',
          required: true
        },
        config: {
          type: 'Object',
          description: 'Configuration options for session panel',
          required: false,
          properties: {
            theme: { type: 'string', description: 'UI theme (light, dark)' },
            groupByType: { type: 'boolean', description: 'Group sessions by type' },
            showDescriptions: { type: 'boolean', description: 'Show session descriptions' },
            defaultSessionType: { type: 'string', description: 'Default type for new sessions' }
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
      throw new Error('SessionPanel requires a valid DOM element');
    }

    if (!actorSpace || typeof actorSpace.getActor !== 'function') {
      throw new Error('SessionPanel requires a valid ActorSpace');
    }

    // Create component instances
    const model = new SessionPanelModel();
    const view = new SessionPanelView(dom);
    const viewModel = new SessionPanelViewModel(model, view, actorSpace);

    // Apply configuration
    if (config.groupByType !== undefined) {
      viewModel.groupByType = config.groupByType;
    }
    if (config.showDescriptions !== undefined) {
      viewModel.showDescriptions = config.showDescriptions;
    }
    if (config.defaultSessionType !== undefined) {
      viewModel.defaultSessionType = config.defaultSessionType;
    }

    // Create session panel instance
    const sessionPanel = new SessionPanel(model, view, viewModel);

    // Initialize component (proper order: render → bind → initialize)
    const renderOptions = {};
    if (config.theme) {
      renderOptions.theme = config.theme;
    }

    // Render view with options first
    view.render(renderOptions);

    // Bind before initialize so model events are subscribed
    viewModel.bind();

    // Initialize last (this will call requestSessionsList which uses setLoading)
    viewModel.initialize();

    // Expose public API
    Object.assign(sessionPanel, {
      // Session management
      refreshSessions: () => viewModel.requestSessionsList(),
      selectSession: (sessionId) => model.selectSession(sessionId),
      getCurrentSession: () => model.getCurrentSession(),
      createSession: (sessionData) => viewModel.handleCreateSession(sessionData),
      deleteSession: (sessionId) => viewModel.confirmDeleteSession(sessionId),
      duplicateSession: (sessionId) => viewModel.duplicateSession(sessionId),
      exportSession: (sessionId) => viewModel.exportSession(sessionId),
      
      // Search and filtering
      searchSessions: (query) => model.setSearchQuery(query),
      clearSearch: () => model.setSearchQuery(''),
      
      // View controls
      toggleTypeView: () => viewModel.toggleTypeView(),
      focusSearch: () => view.focusSearch(),
      
      // Data access
      getSessions: () => model.getSessions(),
      getFilteredSessions: () => model.getFilteredSessions(),
      getSessionTypes: () => model.getSessionTypes(),
      
      // State queries
      isLoading: () => view.sessionPanel?.classList.contains('loading') || false,
      hasError: () => !!view.errorMessage,
      
      // Component lifecycle
      destroy: () => {
        if (onDestroy) {
          onDestroy(sessionPanel);
        }
        viewModel.destroy();
        view.destroy();
        model.destroy();
      },
      
      // Internal access for testing
      model,
      view,
      viewModel,
      
      // Actor communication shortcuts
      loadSession: (sessionId) => viewModel.loadSession(sessionId),
      updateSession: (sessionId, updates) => viewModel.updateSession(sessionId, updates)
    });

    // Call mount callback if provided
    if (onMount) {
      onMount(sessionPanel);
    }

    return sessionPanel;
  }
}

// Export for use in other modules
export { SessionPanelModel, SessionPanelView, SessionPanelViewModel };