/**
 * Tests for SessionPanelViewModel
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TestUtilities } from '../../../utils/test-utilities.js';

describe('SessionPanelViewModel', () => {
  let SessionPanelViewModel;
  let SessionPanelModel;
  let SessionPanelView;
  let viewModel;
  let model;
  let view;
  let actorSpace;
  let sessionsActor;
  let commandActor;
  
  beforeEach(async () => {
    // Import classes
    ({ SessionPanelViewModel } = await import('../../../../src/components/session-panel/SessionPanelViewModel.js'));
    ({ SessionPanelModel } = await import('../../../../src/components/session-panel/SessionPanelModel.js'));
    ({ SessionPanelView } = await import('../../../../src/components/session-panel/SessionPanelView.js'));
    
    // Create DOM container
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create instances
    model = new SessionPanelModel();
    view = new SessionPanelView(container);
    view.render();
    
    // Create mock actor space
    sessionsActor = {
      receive: jest.fn()
    };
    commandActor = {
      receive: jest.fn()
    };
    
    actorSpace = TestUtilities.createMockActorSpace({
      'sessions-actor': sessionsActor,
      'command-actor': commandActor
    });
    
    // Create view model
    viewModel = new SessionPanelViewModel(model, view, actorSpace);
  });

  describe('Initialization', () => {
    test('should initialize actors on setup', () => {
      viewModel.initialize();
      
      expect(actorSpace.getActor).toHaveBeenCalledWith('sessions-actor');
      expect(actorSpace.getActor).toHaveBeenCalledWith('command-actor');
    });

    test('should request sessions list on initialization', () => {
      viewModel.initialize();
      
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'getSessions'
      });
    });

    test('should set loading state during initialization', () => {
      const setLoadingSpy = jest.spyOn(view, 'setLoading');
      
      viewModel.initialize();
      
      expect(setLoadingSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('Sessions Management', () => {
    test('should handle sessions list response from actor', () => {
      viewModel.initialize();
      
      const sessions = [
        { id: 'session1', name: 'Session 1', type: 'chat', lastModified: Date.now() },
        { id: 'session2', name: 'Session 2', type: 'code', lastModified: Date.now() }
      ];
      
      viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions
      });
      
      expect(model.getSessions()).toEqual(sessions);
    });

    test('should render sessions when model updates', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderSessionsSpy = jest.spyOn(view, 'renderSessions');
      
      const sessions = [{ id: 'session1', name: 'Session 1', type: 'chat' }];
      model.setSessions(sessions);
      
      expect(renderSessionsSpy).toHaveBeenCalledWith(sessions);
    });

    test('should handle empty sessions list', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderSessionsSpy = jest.spyOn(view, 'renderSessions');
      
      viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: []
      });
      
      expect(renderSessionsSpy).toHaveBeenCalledWith([]);
    });

    test('should clear loading state after sessions load', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const setLoadingSpy = jest.spyOn(view, 'setLoading');
      
      viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: []
      });
      
      expect(setLoadingSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('Session Selection', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      const sessions = [
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' }
      ];
      model.setSessions(sessions);
    });

    test('should handle session click from view', () => {
      view.onSessionClick({ id: 'session1', name: 'Session 1', type: 'chat' });
      
      expect(model.getCurrentSession()).toEqual({ id: 'session1', name: 'Session 1', type: 'chat' });
    });

    test('should update view when session is selected', () => {
      const setSelectedSessionSpy = jest.spyOn(view, 'setSelectedSession');
      
      model.selectSession('session2');
      
      expect(setSelectedSessionSpy).toHaveBeenCalledWith('session2');
    });

    test('should notify actor when session is selected', () => {
      model.selectSession('session1');
      
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'sessionSelected',
        sessionId: 'session1',
        session: { id: 'session1', name: 'Session 1', type: 'chat' }
      });
    });

    test('should load session when selected', () => {
      viewModel.loadSession('session1');
      
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'loadSession',
        sessionId: 'session1'
      });
    });

    test('should set loading state during session load', () => {
      const setSessionLoadingSpy = jest.spyOn(view, 'setSessionLoading');
      
      viewModel.loadSession('session1');
      
      expect(setSessionLoadingSpy).toHaveBeenCalledWith('session1', true);
    });

    test('should handle session load response', () => {
      viewModel.loadSession('session1');
      
      const setSessionLoadingSpy = jest.spyOn(view, 'setSessionLoading');
      
      viewModel.handleActorUpdate({
        type: 'sessionLoadComplete',
        sessionId: 'session1',
        success: true
      });
      
      expect(setSessionLoadingSpy).toHaveBeenCalledWith('session1', false);
    });
  });

  describe('Session Creation', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
    });

    test('should handle new session button click', () => {
      const showNewSessionDialogSpy = jest.spyOn(view, 'showNewSessionDialog');
      
      view.onNewSession();
      
      expect(showNewSessionDialogSpy).toHaveBeenCalled();
    });

    test('should create session from dialog', () => {
      const sessionData = {
        name: 'New Session',
        type: 'chat',
        description: 'A new chat session'
      };
      
      view.onCreateSession(sessionData);
      
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'createSession',
        sessionData: expect.objectContaining(sessionData)
      });
    });

    test('should hide dialog after session creation', () => {
      const hideNewSessionDialogSpy = jest.spyOn(view, 'hideNewSessionDialog');
      
      const sessionData = { name: 'Test Session', type: 'chat' };
      view.onCreateSession(sessionData);
      
      expect(hideNewSessionDialogSpy).toHaveBeenCalled();
    });

    test('should handle session creation response', () => {
      viewModel.handleActorUpdate({
        type: 'sessionCreated',
        session: { id: 'new-session', name: 'New Session', type: 'chat' }
      });
      
      // Should refresh sessions list
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'getSessions'
      });
    });

    test('should validate session data before creation', () => {
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      // Missing name
      view.onCreateSession({ type: 'chat' });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Session name is required');
      expect(sessionsActor.receive).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'createSession' })
      );
    });
  });

  describe('Session Updates', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' }
      ]);
    });

    test('should update session details', () => {
      viewModel.updateSession('session1', { name: 'Updated Session' });
      
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'updateSession',
        sessionId: 'session1',
        updates: { name: 'Updated Session' }
      });
    });

    test('should handle session update response', () => {
      viewModel.handleActorUpdate({
        type: 'sessionUpdated',
        sessionId: 'session1',
        session: { id: 'session1', name: 'Updated Session', type: 'chat' }
      });
      
      const session = model.getSessionById('session1');
      expect(session.name).toBe('Updated Session');
    });

    test('should refresh view when session details update', () => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      const renderSessionsSpy = jest.spyOn(view, 'renderSessions');
      renderSessionsSpy.mockClear();
      
      model.updateSession('session1', { name: 'Updated' });
      
      expect(renderSessionsSpy).toHaveBeenCalled();
    });
  });

  describe('Session Deletion', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' }
      ]);
    });

    test('should show delete confirmation', () => {
      const showDeleteConfirmationSpy = jest.spyOn(view, 'showDeleteConfirmation');
      
      viewModel.requestDeleteSession('session1');
      
      expect(showDeleteConfirmationSpy).toHaveBeenCalledWith(
        { id: 'session1', name: 'Session 1', type: 'chat' }
      );
    });

    test('should delete session when confirmed', () => {
      viewModel.confirmDeleteSession('session1');
      
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'deleteSession',
        sessionId: 'session1'
      });
    });

    test('should handle session deletion response', () => {
      model.selectSession('session1');
      
      viewModel.handleActorUpdate({
        type: 'sessionDeleted',
        sessionId: 'session1'
      });
      
      expect(model.getSessionById('session1')).toBeNull();
      expect(model.getCurrentSession()).toBeNull(); // Should deselect
    });

    test('should refresh view after deletion', () => {
      const renderSessionsSpy = jest.spyOn(view, 'renderSessions');
      renderSessionsSpy.mockClear();
      
      viewModel.handleActorUpdate({
        type: 'sessionDeleted',
        sessionId: 'session1'
      });
      
      expect(renderSessionsSpy).toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setSessions([
        { id: 'chat1', name: 'Daily Standup', type: 'chat', description: 'Team meeting' },
        { id: 'code1', name: 'Code Review', type: 'code', description: 'PR review' },
        { id: 'chat2', name: 'Client Call', type: 'chat', description: 'Project discussion' }
      ]);
    });

    test('should handle search input from view', () => {
      view.onSearchInput('standup');
      
      expect(model.searchQuery).toBe('standup');
    });

    test('should render filtered sessions when search changes', () => {
      const renderSessionsSpy = jest.spyOn(view, 'renderSessions');
      
      model.setSearchQuery('code');
      
      const filtered = model.getFilteredSessions();
      expect(renderSessionsSpy).toHaveBeenCalledWith(filtered);
      expect(filtered).toHaveLength(1);
    });

    test('should show search results count', () => {
      const showSearchResultsSpy = jest.spyOn(view, 'showSearchResults');
      
      model.setSearchQuery('chat');
      
      expect(showSearchResultsSpy).toHaveBeenCalledWith(2, 3);
    });

    test('should show no results message', () => {
      const showNoResultsSpy = jest.spyOn(view, 'showNoResults');
      
      model.setSearchQuery('nonexistent');
      
      expect(showNoResultsSpy).toHaveBeenCalledWith('nonexistent');
    });

    test('should clear search on clear button click', () => {
      model.setSearchQuery('test');
      
      view.onSearchClear();
      
      expect(model.searchQuery).toBe('');
    });

    test('should render all sessions when search is cleared', () => {
      model.setSearchQuery('code');
      
      const renderSessionsSpy = jest.spyOn(view, 'renderSessions');
      renderSessionsSpy.mockClear();
      
      view.onSearchClear();
      
      expect(renderSessionsSpy).toHaveBeenCalledWith(model.getSessions());
    });
  });

  describe('Keyboard Navigation', () => {
    let sessions;
    
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      sessions = [
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' },
        { id: 'session3', name: 'Session 3', type: 'debug' }
      ];
      model.setSessions(sessions);
    });

    test('should navigate down through sessions', () => {
      const setHighlightedSessionSpy = jest.spyOn(view, 'setHighlightedSession');
      
      view.onNavigate('down');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session1');
      
      view.onNavigate('down');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session2');
      
      view.onNavigate('down');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session3');
    });

    test('should navigate up through sessions', () => {
      // Start at bottom
      viewModel.highlightedIndex = 2;
      
      const setHighlightedSessionSpy = jest.spyOn(view, 'setHighlightedSession');
      
      view.onNavigate('up');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session2');
      
      view.onNavigate('up');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session1');
    });

    test('should wrap around when navigating past bounds', () => {
      const setHighlightedSessionSpy = jest.spyOn(view, 'setHighlightedSession');
      
      // At top, go up
      viewModel.highlightedIndex = 0;
      view.onNavigate('up');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session3');
      
      // At bottom, go down
      viewModel.highlightedIndex = 2;
      view.onNavigate('down');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session1');
    });

    test('should respect filtered sessions during navigation', () => {
      model.setSearchQuery('Session 1');
      
      const setHighlightedSessionSpy = jest.spyOn(view, 'setHighlightedSession');
      
      view.onNavigate('down');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session1');
      
      // Should not navigate to filtered out sessions
      view.onNavigate('down');
      expect(setHighlightedSessionSpy).toHaveBeenCalledWith('session1');
    });

    test('should select highlighted session on Enter', () => {
      viewModel.highlightedIndex = 1;
      
      view.onSessionSelect(sessions[1]);
      
      expect(model.getCurrentSession()).toEqual(sessions[1]);
    });
  });

  describe('Session Types', () => {
    test('should render sessions by type when enabled', () => {
      viewModel.initialize();
      viewModel.bind();
      
      viewModel.groupByType = true;
      
      const sessions = [
        { id: 'chat1', name: 'Chat Session', type: 'chat' },
        { id: 'code1', name: 'Code Session', type: 'code' }
      ];
      model.setSessions(sessions);
      
      const renderByTypeSpy = jest.spyOn(view, 'renderSessionsByType');
      
      viewModel.refreshView();
      
      expect(renderByTypeSpy).toHaveBeenCalledWith({
        'chat': [sessions[0]],
        'code': [sessions[1]]
      });
    });

    test('should toggle type grouping', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderSessionsSpy = jest.spyOn(view, 'renderSessions');
      const renderByTypeSpy = jest.spyOn(view, 'renderSessionsByType');
      
      model.setSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      // Default is not grouped
      expect(renderSessionsSpy).toHaveBeenCalled();
      
      // Toggle to grouped
      viewModel.toggleTypeView();
      expect(renderByTypeSpy).toHaveBeenCalled();
      
      // Toggle back
      viewModel.toggleTypeView();
      expect(renderSessionsSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Context Menu Actions', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' }
      ]);
    });

    test('should show context menu on right click', () => {
      const showSessionContextMenuSpy = jest.spyOn(view, 'showSessionContextMenu');
      
      const session = { id: 'session1', name: 'Session 1', type: 'chat' };
      const position = { x: 100, y: 200 };
      
      view.onSessionRightClick(session, position);
      
      expect(showSessionContextMenuSpy).toHaveBeenCalledWith('session1', position);
    });

    test('should handle duplicate session action', () => {
      viewModel.duplicateSession('session1');
      
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'duplicateSession',
        sessionId: 'session1'
      });
    });

    test('should handle export session action', () => {
      viewModel.exportSession('session1');
      
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'exportSession',
        sessionId: 'session1'
      });
    });
  });

  describe('Error Handling', () => {
    test('should show error when sessions fail to load', () => {
      viewModel.initialize();
      
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      viewModel.handleActorUpdate({
        type: 'sessionsListError',
        error: 'Network connection failed'
      });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Failed to load sessions: Network connection failed');
    });

    test('should clear error on successful sessions load', () => {
      viewModel.initialize();
      
      const clearErrorSpy = jest.spyOn(view, 'clearError');
      
      viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: []
      });
      
      expect(clearErrorSpy).toHaveBeenCalled();
    });

    test('should handle session creation errors', () => {
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      viewModel.handleActorUpdate({
        type: 'sessionCreationError',
        error: 'Session name already exists'
      });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Failed to create session: Session name already exists');
    });

    test('should retry loading sessions on error retry', () => {
      viewModel.initialize();
      
      const receiveSpy = jest.spyOn(sessionsActor, 'receive');
      receiveSpy.mockClear();
      
      viewModel.retryLoadSessions();
      
      expect(receiveSpy).toHaveBeenCalledWith({
        type: 'getSessions'
      });
    });
  });

  describe('Sessions Panel API', () => {
    test('should expose sessions panel API', () => {
      viewModel.initialize();
      
      const api = viewModel.getSessionsPanelAPI();
      
      expect(api).toBeDefined();
      expect(typeof api.refreshSessions).toBe('function');
      expect(typeof api.selectSession).toBe('function');
      expect(typeof api.createSession).toBe('function');
      expect(typeof api.deleteSession).toBe('function');
      expect(typeof api.searchSessions).toBe('function');
    });

    test('should refresh sessions through API', () => {
      viewModel.initialize();
      
      const api = viewModel.getSessionsPanelAPI();
      const receiveSpy = jest.spyOn(sessionsActor, 'receive');
      receiveSpy.mockClear();
      
      api.refreshSessions();
      
      expect(receiveSpy).toHaveBeenCalledWith({ type: 'getSessions' });
    });

    test('should select session through API', () => {
      viewModel.initialize();
      model.setSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      const api = viewModel.getSessionsPanelAPI();
      api.selectSession('session1');
      
      expect(model.getCurrentSession()).toEqual({ id: 'session1', name: 'Session 1', type: 'chat' });
    });

    test('should create session through API', () => {
      viewModel.initialize();
      
      const api = viewModel.getSessionsPanelAPI();
      const sessionData = { name: 'API Session', type: 'chat' };
      
      api.createSession(sessionData);
      
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'createSession',
        sessionData: expect.objectContaining(sessionData)
      });
    });

    test('should search sessions through API', () => {
      viewModel.initialize();
      
      const api = viewModel.getSessionsPanelAPI();
      api.searchSessions('test');
      
      expect(model.searchQuery).toBe('test');
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const modelDestroySpy = jest.spyOn(model, 'destroy');
      const viewDestroySpy = jest.spyOn(view, 'destroy');
      
      viewModel.destroy();
      
      expect(modelDestroySpy).toHaveBeenCalled();
      expect(viewDestroySpy).toHaveBeenCalled();
    });
  });
});