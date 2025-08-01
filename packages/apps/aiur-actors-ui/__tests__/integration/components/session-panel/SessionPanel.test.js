/**
 * Integration tests for SessionPanel component
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestUtilities } from '../../../utils/test-utilities.js';

describe('SessionPanel Component Integration', () => {
  let SessionPanel;
  let sessionPanel;
  let container;
  let actorSpace;
  let sessionsActor;
  let commandActor;
  
  beforeEach(async () => {
    ({ SessionPanel } = await import('../../../../src/components/session-panel/index.js'));
    
    // Create DOM environment
    const env = TestUtilities.createDOMTestEnvironment();
    container = env.container;
    
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
  });
  
  afterEach(() => {
    if (sessionPanel) {
      sessionPanel.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Complete Sessions Workflow', () => {
    test('should load and display sessions', async () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Verify sessions request was sent
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'getSessions'
      });
      
      // Simulate sessions response
      const sessions = [
        { id: 'session1', name: 'Daily Standup', type: 'chat', lastModified: Date.now() },
        { id: 'session2', name: 'Code Review', type: 'code', lastModified: Date.now() - 1000 },
        { id: 'session3', name: 'Debug Session', type: 'debug', lastModified: Date.now() - 2000 }
      ];
      
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions
      });
      
      // Check sessions are displayed
      const sessionItems = container.querySelectorAll('.session-item');
      expect(sessionItems.length).toBe(3);
      expect(sessionItems[0].textContent).toContain('Daily Standup');
      expect(sessionItems[1].textContent).toContain('Code Review');
      expect(sessionItems[2].textContent).toContain('Debug Session');
    });

    test('should select and load session', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [{ id: 'test_session', name: 'Test Session', type: 'chat' }]
      });
      
      // Click on session
      const sessionItem = container.querySelector('.session-item');
      sessionItem.click();
      
      // Verify session is selected
      expect(sessionItem.classList.contains('selected')).toBe(true);
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'sessionSelected',
        sessionId: 'test_session',
        session: { id: 'test_session', name: 'Test Session', type: 'chat' }
      });
      
      // Verify session load request
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'loadSession',
        sessionId: 'test_session'
      });
    });

    test('should create new session', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Click new session button
      const newButton = container.querySelector('.new-session-button');
      newButton.click();
      
      // Check dialog is shown
      const dialog = container.querySelector('.new-session-dialog');
      expect(dialog.style.display).not.toBe('none');
      
      // Fill form
      const nameInput = dialog.querySelector('input[name="name"]');
      const typeSelect = dialog.querySelector('select[name="type"]');
      const descTextarea = dialog.querySelector('textarea[name="description"]');
      
      nameInput.value = 'New Project Session';
      typeSelect.value = 'code';
      descTextarea.value = 'Working on new feature';
      
      // Submit form
      const form = dialog.querySelector('.new-session-form');
      form.dispatchEvent(new Event('submit'));
      
      // Verify session creation request
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'createSession',
        sessionData: expect.objectContaining({
          name: 'New Project Session',
          type: 'code',
          description: 'Working on new feature'
        })
      });
      
      // Verify dialog is hidden
      expect(dialog.style.display).toBe('none');
    });

    test('should search and filter sessions', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      const sessions = [
        { id: 'chat1', name: 'Daily Standup', type: 'chat' },
        { id: 'code1', name: 'Code Review', type: 'code' },
        { id: 'chat2', name: 'Client Meeting', type: 'chat' }
      ];
      
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions
      });
      
      // Search for "chat"
      const searchInput = container.querySelector('.session-search input');
      searchInput.value = 'chat';
      searchInput.dispatchEvent(new Event('input'));
      
      // Check filtered results
      const visibleSessions = container.querySelectorAll('.session-item:not(.hidden)');
      expect(visibleSessions.length).toBe(2);
      
      // Check search results count
      const resultsCount = container.querySelector('.search-results-count');
      expect(resultsCount.textContent).toContain('2 of 3');
    });

    test('should handle keyboard navigation', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [
          { id: 'session1', name: 'Session 1', type: 'chat' },
          { id: 'session2', name: 'Session 2', type: 'code' },
          { id: 'session3', name: 'Session 3', type: 'debug' }
        ]
      });
      
      const sessionsList = container.querySelector('.session-list');
      
      // Navigate down
      sessionsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      
      let highlightedSession = container.querySelector('.session-item.highlighted');
      expect(highlightedSession).toBeDefined();
      expect(highlightedSession.textContent).toContain('Session 1');
      
      // Navigate down again
      sessionsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      
      highlightedSession = container.querySelector('.session-item.highlighted');
      expect(highlightedSession.textContent).toContain('Session 2');
      
      // Select with Enter
      sessionsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'sessionSelected',
        sessionId: 'session2',
        session: expect.any(Object)
      });
    });

    test('should show session loading state', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [{ id: 'test_session', name: 'Test Session', type: 'chat' }]
      });
      
      // Load session
      sessionPanel.loadSession('test_session');
      
      // Check loading state
      const sessionItem = container.querySelector('[data-session-id="test_session"]');
      expect(sessionItem.classList.contains('loading')).toBe(true);
      expect(sessionItem.querySelector('.session-spinner')).toBeDefined();
      
      // Simulate load completion
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionLoadComplete',
        sessionId: 'test_session',
        success: true
      });
      
      // Check state cleared
      expect(sessionItem.classList.contains('loading')).toBe(false);
      expect(sessionItem.querySelector('.session-spinner')).toBeNull();
    });
  });

  describe('Umbilical Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      SessionPanel.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });
      
      expect(requirements).toBeDefined();
      expect(requirements.dom).toBeDefined();
      expect(requirements.dom.type).toBe('HTMLElement');
      expect(requirements.actorSpace).toBeDefined();
    });

    test('should support validation mode', () => {
      let validationChecks = null;
      
      const umbilical = {
        validate: (checks) => {
          validationChecks = checks;
          return true;
        },
        dom: container,
        actorSpace: actorSpace
      };
      
      const result = SessionPanel.create(umbilical);
      
      expect(result).toBe(true);
      expect(validationChecks).toBeDefined();
      expect(validationChecks.hasDomElement).toBe(true);
      expect(validationChecks.hasActorSpace).toBe(true);
    });

    test('should validate required properties', () => {
      // Missing dom
      expect(() => {
        SessionPanel.create({ actorSpace });
      }).toThrow();
      
      // Missing actor space
      expect(() => {
        SessionPanel.create({ dom: container });
      }).toThrow();
    });

    test('should handle lifecycle callbacks', () => {
      const onMount = jest.fn();
      const onDestroy = jest.fn();
      
      const umbilical = {
        dom: container,
        actorSpace,
        onMount,
        onDestroy
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      expect(onMount).toHaveBeenCalledWith(sessionPanel);
      
      sessionPanel.destroy();
      
      expect(onDestroy).toHaveBeenCalledWith(sessionPanel);
    });

    test('should expose public API', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      expect(sessionPanel).toBeDefined();
      expect(typeof sessionPanel.refreshSessions).toBe('function');
      expect(typeof sessionPanel.selectSession).toBe('function');
      expect(typeof sessionPanel.createSession).toBe('function');
      expect(typeof sessionPanel.deleteSession).toBe('function');
      expect(typeof sessionPanel.searchSessions).toBe('function');
      expect(typeof sessionPanel.getCurrentSession).toBe('function');
      expect(typeof sessionPanel.destroy).toBe('function');
    });

    test('should handle configuration options', () => {
      const umbilical = {
        dom: container,
        actorSpace,
        config: {
          theme: 'dark',
          groupByType: true,
          showDescriptions: false,
          defaultSessionType: 'code'
        }
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Check theme applied
      const panel = container.querySelector('.session-panel');
      expect(panel.classList.contains('session-panel-theme-dark')).toBe(true);
      
      // Check type grouping
      expect(sessionPanel.viewModel.groupByType).toBe(true);
      
      // Check descriptions hidden
      expect(sessionPanel.viewModel.showDescriptions).toBe(false);
      
      // Check default session type
      expect(sessionPanel.viewModel.defaultSessionType).toBe('code');
    });
  });

  describe('Session Management', () => {
    test('should delete session with confirmation', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [{ id: 'session1', name: 'Test Session', type: 'chat' }]
      });
      
      // Right-click to show context menu
      const sessionItem = container.querySelector('.session-item');
      sessionItem.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: 100,
        clientY: 200
      }));
      
      // Check context menu shown
      const contextMenu = container.querySelector('.session-context-menu');
      expect(contextMenu.style.display).not.toBe('none');
      
      // Click delete option
      const deleteOption = contextMenu.querySelector('.delete-option');
      deleteOption.click();
      
      // Check confirmation dialog
      const confirmation = container.querySelector('.delete-confirmation');
      expect(confirmation.style.display).not.toBe('none');
      expect(confirmation.textContent).toContain('Test Session');
      
      // Confirm deletion
      const confirmButton = confirmation.querySelector('.confirm-delete');
      confirmButton.click();
      
      // Verify delete request
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'deleteSession',
        sessionId: 'session1'
      });
    });

    test('should duplicate session', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [{ id: 'session1', name: 'Original Session', type: 'chat' }]
      });
      
      // Trigger duplicate action
      sessionPanel.duplicateSession('session1');
      
      // Verify duplicate request
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'duplicateSession',
        sessionId: 'session1'
      });
    });

    test('should export session', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [{ id: 'session1', name: 'Export Session', type: 'code' }]
      });
      
      // Trigger export action
      sessionPanel.exportSession('session1');
      
      // Verify export request
      expect(sessionsActor.receive).toHaveBeenCalledWith({
        type: 'exportSession',
        sessionId: 'session1'
      });
    });
  });

  describe('Error Handling', () => {
    test('should display error when sessions fail to load', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Simulate error response
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListError',
        error: 'Database connection failed'
      });
      
      // Check error displayed
      const errorMessage = container.querySelector('.sessions-error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.textContent).toContain('Failed to load sessions');
      
      // Check retry button
      const retryButton = errorMessage.querySelector('.retry-button');
      expect(retryButton).toBeDefined();
      
      // Click retry
      retryButton.click();
      
      // Verify new request sent
      expect(sessionsActor.receive).toHaveBeenLastCalledWith({
        type: 'getSessions'
      });
    });

    test('should handle session creation errors', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Simulate creation error
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionCreationError',
        error: 'Session name already exists'
      });
      
      // Check error displayed
      const errorMessage = container.querySelector('.sessions-error');
      expect(errorMessage.textContent).toContain('Failed to create session');
    });

    test('should handle session load errors', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [{ id: 'session1', name: 'Test Session', type: 'chat' }]
      });
      
      // Simulate load error
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionLoadError',
        sessionId: 'session1',
        error: 'Session data corrupted'
      });
      
      // Check error displayed and loading state cleared
      const errorMessage = container.querySelector('.sessions-error');
      expect(errorMessage.textContent).toContain('Failed to load session');
      
      const sessionItem = container.querySelector('[data-session-id="session1"]');
      expect(sessionItem.classList.contains('loading')).toBe(false);
    });
  });

  describe('Session Types', () => {
    test('should display sessions grouped by type', () => {
      const umbilical = {
        dom: container,
        actorSpace,
        config: { groupByType: true }
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load categorized sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [
          { id: 'chat1', name: 'Daily Standup', type: 'chat' },
          { id: 'chat2', name: 'Client Call', type: 'chat' },
          { id: 'code1', name: 'Code Review', type: 'code' },
          { id: 'debug1', name: 'Bug Hunt', type: 'debug' }
        ]
      });
      
      // Check categories displayed
      const categories = container.querySelectorAll('.session-category');
      expect(categories.length).toBe(3);
      
      const chatCategory = Array.from(categories).find(cat => 
        cat.querySelector('.category-header').textContent === 'Chat'
      );
      expect(chatCategory.querySelectorAll('.session-item').length).toBe(2);
      
      const codeCategory = Array.from(categories).find(cat => 
        cat.querySelector('.category-header').textContent === 'Code'
      );
      expect(codeCategory.querySelectorAll('.session-item').length).toBe(1);
    });

    test('should toggle type view', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions with types
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [
          { id: 'session1', name: 'Session 1', type: 'chat' },
          { id: 'session2', name: 'Session 2', type: 'code' }
        ]
      });
      
      // Initially flat list
      expect(container.querySelector('.session-category')).toBeNull();
      expect(container.querySelectorAll('.session-item').length).toBe(2);
      
      // Toggle to type view
      sessionPanel.toggleTypeView();
      
      expect(container.querySelectorAll('.session-category').length).toBe(2);
      
      // Toggle back
      sessionPanel.toggleTypeView();
      
      expect(container.querySelector('.session-category')).toBeNull();
    });
  });

  describe('Real-time Updates', () => {
    test('should update session details in real-time', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [{ id: 'session1', name: 'Original Name', type: 'chat' }]
      });
      
      // Update session details
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionUpdated',
        sessionId: 'session1',
        session: { id: 'session1', name: 'Updated Name', type: 'chat' }
      });
      
      // Check details updated in model and view
      const session = sessionPanel.model.getSessionById('session1');
      expect(session.name).toBe('Updated Name');
      
      const sessionItem = container.querySelector('[data-session-id="session1"]');
      expect(sessionItem.textContent).toContain('Updated Name');
    });

    test('should add new sessions dynamically', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load initial sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [{ id: 'session1', name: 'Session 1', type: 'chat' }]
      });
      
      expect(container.querySelectorAll('.session-item').length).toBe(1);
      
      // Add new session
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionCreated',
        session: { id: 'session2', name: 'Session 2', type: 'code' }
      });
      
      // Should refresh sessions list
      expect(sessionsActor.receive).toHaveBeenLastCalledWith({
        type: 'getSessions'
      });
    });

    test('should remove deleted sessions dynamically', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      sessionPanel = SessionPanel.create(umbilical);
      
      // Load sessions
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionsListResponse',
        sessions: [
          { id: 'session1', name: 'Session 1', type: 'chat' },
          { id: 'session2', name: 'Session 2', type: 'code' }
        ]
      });
      
      expect(container.querySelectorAll('.session-item').length).toBe(2);
      
      // Delete session
      sessionPanel.viewModel.handleActorUpdate({
        type: 'sessionDeleted',
        sessionId: 'session1'
      });
      
      expect(container.querySelectorAll('.session-item').length).toBe(1);
      expect(container.querySelector('[data-session-id="session1"]')).toBeNull();
      expect(container.querySelector('[data-session-id="session2"]')).toBeDefined();
    });
  });
});