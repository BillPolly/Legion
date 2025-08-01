/**
 * SessionPanelViewModel - ViewModel for session panel component
 */
import { ExtendedBaseViewModel } from '../base/ExtendedBaseViewModel.js';

export class SessionPanelViewModel extends ExtendedBaseViewModel {
  constructor(model, view, actorSpace) {
    super(model, view, actorSpace);
    
    this.groupByType = false;
    this.showDescriptions = true;
    this.defaultSessionType = 'chat';
    this.highlightedIndex = -1;
  }

  /**
   * Initialize the view model
   */
  initialize() {
    super.initialize();
    
    // Get additional actors for session panel
    this.actors.sessionsActor = this.actorSpace.getActor('sessions-actor');
    
    // Request initial sessions list
    this.requestSessionsList();
  }

  /**
   * Bind model and view
   */
  bind() {
    super.bind();
    
    // Bind view event handlers
    this.view.onSessionClick = this.handleSessionClick.bind(this);
    this.view.onSessionRightClick = this.handleSessionRightClick.bind(this);
    this.view.onSearchInput = this.handleSearchInput.bind(this);
    this.view.onSearchClear = this.handleSearchClear.bind(this);
    this.view.onNewSession = this.handleNewSession.bind(this);
    this.view.onCreateSession = this.handleCreateSession.bind(this);
    this.view.onNavigate = this.handleNavigate.bind(this);
    this.view.onSessionSelect = this.handleSessionSelect.bind(this);
    this.view.onRetry = this.handleRetry.bind(this);
    
    // Context menu handlers
    this.view.onSessionDuplicate = this.handleSessionDuplicate.bind(this);
    this.view.onSessionExport = this.handleSessionExport.bind(this);
    this.view.onSessionDelete = this.handleSessionDelete.bind(this);
    this.view.onConfirmDelete = this.handleConfirmDelete.bind(this);
  }

  /**
   * Request sessions list from actor
   */
  requestSessionsList() {
    this.view.setLoading(true);
    
    if (this.actors.sessionsActor) {
      this.actors.sessionsActor.receive({
        type: 'getSessions'
      });
    }
  }

  /**
   * Handle session click from view
   * @param {Object} session - Session object
   */
  handleSessionClick(session) {
    this.model.selectSession(session.id);
    this.loadSession(session.id);
  }

  /**
   * Handle session right-click from view
   * @param {Object} session - Session object
   * @param {Object} position - Click position
   */
  handleSessionRightClick(session, position) {
    this.view.showSessionContextMenu(session.id, position);
  }

  /**
   * Handle session selection (keyboard Enter)
   * @param {Object} session - Session object
   */
  handleSessionSelect(session) {
    this.model.selectSession(session.id);
    this.loadSession(session.id);
  }

  /**
   * Handle search input from view
   * @param {string} query - Search query
   */
  handleSearchInput(query) {
    this.model.setSearchQuery(query);
  }

  /**
   * Handle search clear from view
   */
  handleSearchClear() {
    this.model.setSearchQuery('');
  }

  /**
   * Handle new session button click
   */
  handleNewSession() {
    this.view.showNewSessionDialog();
  }

  /**
   * Handle create session from dialog
   * @param {Object} sessionData - Session data from form
   */
  handleCreateSession(sessionData) {
    // Validate session data
    if (!sessionData.name || !sessionData.name.trim()) {
      this.view.showError('Session name is required');
      return;
    }
    
    if (!sessionData.type) {
      this.view.showError('Session type is required');
      return;
    }
    
    // Create session through model (which will generate ID and timestamps)
    try {
      this.model.createSession(sessionData);
      
      // Send to actor
      if (this.actors.sessionsActor) {
        this.actors.sessionsActor.receive({
          type: 'createSession',
          sessionData: this.model.pendingSession
        });
      }
      
      // Hide dialog
      this.view.hideNewSessionDialog();
      
    } catch (error) {
      this.view.showError(error.message);
    }
  }

  /**
   * Handle keyboard navigation
   * @param {string} direction - Navigation direction ('up' or 'down')
   */
  handleNavigate(direction) {
    const filteredSessions = this.model.getFilteredSessions();
    if (filteredSessions.length === 0) {
      return;
    }
    
    if (direction === 'down') {
      this.highlightedIndex = (this.highlightedIndex + 1) % filteredSessions.length;
    } else if (direction === 'up') {
      this.highlightedIndex = this.highlightedIndex <= 0 
        ? filteredSessions.length - 1 
        : this.highlightedIndex - 1;
    }
    
    const highlightedSession = filteredSessions[this.highlightedIndex];
    if (highlightedSession) {
      this.view.setHighlightedSession(highlightedSession.id);
    }
  }

  /**
   * Handle retry button click
   */
  handleRetry() {
    this.view.clearError();
    this.requestSessionsList();
  }

  /**
   * Handle session duplicate action
   * @param {string} sessionId - Session ID
   */
  handleSessionDuplicate(sessionId) {
    this.duplicateSession(sessionId);
  }

  /**
   * Handle session export action
   * @param {string} sessionId - Session ID
   */
  handleSessionExport(sessionId) {
    this.exportSession(sessionId);
  }

  /**
   * Handle session delete action
   * @param {string} sessionId - Session ID
   */
  handleSessionDelete(sessionId) {
    this.requestDeleteSession(sessionId);
  }

  /**
   * Handle delete confirmation
   * @param {string} sessionId - Session ID
   */
  handleConfirmDelete(sessionId) {
    this.confirmDeleteSession(sessionId);
  }

  /**
   * Load a session
   * @param {string} sessionId - Session ID
   */
  loadSession(sessionId) {
    this.model.setSessionLoading(sessionId, true);
    
    if (this.actors.sessionsActor) {
      this.actors.sessionsActor.receive({
        type: 'loadSession',
        sessionId
      });
    }
  }

  /**
   * Update a session
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Updates to apply
   */
  updateSession(sessionId, updates) {
    if (this.actors.sessionsActor) {
      this.actors.sessionsActor.receive({
        type: 'updateSession',
        sessionId,
        updates
      });
    }
  }

  /**
   * Request session deletion (show confirmation)
   * @param {string} sessionId - Session ID
   */
  requestDeleteSession(sessionId) {
    const session = this.model.getSessionById(sessionId);
    if (session) {
      this.view.showDeleteConfirmation(session);
    }
  }

  /**
   * Confirm session deletion
   * @param {string} sessionId - Session ID
   */
  confirmDeleteSession(sessionId) {
    if (this.actors.sessionsActor) {
      this.actors.sessionsActor.receive({
        type: 'deleteSession',
        sessionId
      });
    }
  }

  /**
   * Duplicate a session
   * @param {string} sessionId - Session ID
   */
  duplicateSession(sessionId) {
    if (this.actors.sessionsActor) {
      this.actors.sessionsActor.receive({
        type: 'duplicateSession',
        sessionId
      });
    }
  }

  /**
   * Export a session
   * @param {string} sessionId - Session ID
   */
  exportSession(sessionId) {
    if (this.actors.sessionsActor) {
      this.actors.sessionsActor.receive({
        type: 'exportSession',
        sessionId
      });
    }
  }

  /**
   * Toggle type view
   */
  toggleTypeView() {
    this.groupByType = !this.groupByType;
    this.refreshView();
  }

  /**
   * Refresh the view based on current state
   */
  refreshView() {
    const filteredSessions = this.model.getFilteredSessions();
    
    if (this.groupByType) {
      const grouped = this.model.getSessionsByType();
      // Filter each type
      const filteredGrouped = {};
      Object.keys(grouped).forEach(type => {
        const typeSessions = grouped[type].filter(session => 
          filteredSessions.includes(session)
        );
        if (typeSessions.length > 0) {
          filteredGrouped[type] = typeSessions;
        }
      });
      this.view.renderSessionsByType(filteredGrouped);
    } else {
      this.view.renderSessions(filteredSessions);
    }
    
    // Update search results
    if (this.model.searchQuery) {
      const totalSessions = this.model.getSessions().length;
      if (filteredSessions.length === 0) {
        this.view.showNoResults(this.model.searchQuery);
      } else {
        this.view.showSearchResults(filteredSessions.length, totalSessions);
      }
    }
  }

  /**
   * Handle model changes
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  onModelChange(event, data) {
    super.onModelChange(event, data);
    
    switch (event) {
      case 'sessionsChanged':
        this.view.setLoading(false);
        this.refreshView();
        break;
        
      case 'sessionSelected':
        this.view.setSelectedSession(data.sessionId);
        
        // Notify command actor
        if (data.sessionId && this.actors.commandActor) {
          this.actors.commandActor.receive({
            type: 'sessionSelected',
            sessionId: data.sessionId,
            session: data.session
          });
        }
        break;
        
      case 'searchQueryChanged':
        this.view.setSearchQuery(data.query);
        this.highlightedIndex = -1; // Reset navigation
        this.refreshView();
        break;
        
      case 'sessionLoadingStateChanged':
        this.view.setSessionLoading(data.sessionId, data.loading);
        break;
        
      case 'sessionUpdated':
        this.refreshView();
        break;
        
      case 'sessionDeleted':
        this.refreshView();
        break;
        
      case 'sessionCreated':
        // Will be handled by actor response
        break;
    }
  }

  /**
   * Handle updates from actors
   * @param {Object} update - Update from actor
   */
  handleActorUpdate(update) {
    super.handleActorUpdate(update);
    
    switch (update.type) {
      case 'sessionsListResponse':
        this.view.clearError();
        this.model.setSessions(update.sessions || []);
        break;
        
      case 'sessionsListError':
        this.view.setLoading(false);
        this.view.showError(`Failed to load sessions: ${update.error}`);
        break;
        
      case 'sessionLoadComplete':
        this.model.setSessionLoading(update.sessionId, false);
        break;
        
      case 'sessionLoadError':
        this.model.setSessionLoading(update.sessionId, false);
        this.view.showError(`Failed to load session: ${update.error}`);
        break;
        
      case 'sessionCreated':
        // Refresh sessions list to include new session
        this.requestSessionsList();
        break;
        
      case 'sessionCreationError':
        this.view.showError(`Failed to create session: ${update.error}`);
        break;
        
      case 'sessionUpdated':
        this.model.updateSession(update.sessionId, update.session);
        break;
        
      case 'sessionDeleted':
        this.model.deleteSession(update.sessionId);
        break;
        
      case 'sessionDuplicated':
        // Refresh sessions list to include duplicated session
        this.requestSessionsList();
        break;
        
      case 'sessionExported':
        // Could show success message or trigger download
        break;
    }
  }

  /**
   * Get sessions panel API
   * @returns {Object} Sessions panel API
   */
  getSessionsPanelAPI() {
    return {
      refreshSessions: () => this.requestSessionsList(),
      selectSession: (sessionId) => this.model.selectSession(sessionId),
      getCurrentSession: () => this.model.getCurrentSession(),
      createSession: (sessionData) => this.handleCreateSession(sessionData),
      deleteSession: (sessionId) => this.confirmDeleteSession(sessionId),
      duplicateSession: (sessionId) => this.duplicateSession(sessionId),
      exportSession: (sessionId) => this.exportSession(sessionId),
      searchSessions: (query) => this.model.setSearchQuery(query),
      toggleTypeView: () => this.toggleTypeView(),
      getSessions: () => this.model.getSessions(),
      getFilteredSessions: () => this.model.getFilteredSessions()
    };
  }

  /**
   * Retry loading sessions
   */
  retryLoadSessions() {
    this.requestSessionsList();
  }
}