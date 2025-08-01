/**
 * Tests for SessionPanelView
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('SessionPanelView', () => {
  let SessionPanelView;
  let view;
  let container;
  
  beforeEach(async () => {
    ({ SessionPanelView } = await import('../../../../src/components/session-panel/SessionPanelView.js'));
    
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    view = new SessionPanelView(container);
  });
  
  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Initial Rendering', () => {
    test('should render session panel structure', () => {
      view.render();
      
      expect(container.querySelector('.session-panel')).toBeDefined();
      expect(container.querySelector('.session-header')).toBeDefined();
      expect(container.querySelector('.session-search')).toBeDefined();
      expect(container.querySelector('.session-list')).toBeDefined();
      expect(container.querySelector('.session-actions')).toBeDefined();
    });

    test('should render search input', () => {
      view.render();
      
      const searchInput = container.querySelector('.session-search input');
      expect(searchInput).toBeDefined();
      expect(searchInput.getAttribute('type')).toBe('text');
      expect(searchInput.getAttribute('placeholder')).toBe('Search sessions...');
    });

    test('should render new session button', () => {
      view.render();
      
      const newButton = container.querySelector('.new-session-button');
      expect(newButton).toBeDefined();
      expect(newButton.textContent).toContain('New Session');
    });

    test('should show empty state when no sessions', () => {
      view.render();
      view.renderSessions([]);
      
      const emptyState = container.querySelector('.sessions-empty');
      expect(emptyState).toBeDefined();
      expect(emptyState.textContent).toContain('No sessions available');
    });

    test('should apply theme class if provided', () => {
      view.render({ theme: 'dark' });
      
      const panel = container.querySelector('.session-panel');
      expect(panel.classList.contains('session-panel-theme-dark')).toBe(true);
    });
  });

  describe('Sessions Display', () => {
    const mockSessions = [
      { id: 'session1', name: 'Chat Session', type: 'chat', lastModified: Date.now() },
      { id: 'session2', name: 'Code Review', type: 'code', lastModified: Date.now() - 1000 },
      { id: 'session3', name: 'Debug Session', type: 'debug', lastModified: Date.now() - 2000 }
    ];

    test('should render list of sessions', () => {
      view.render();
      view.renderSessions(mockSessions);
      
      const sessionItems = container.querySelectorAll('.session-item');
      expect(sessionItems.length).toBe(3);
      
      expect(sessionItems[0].textContent).toContain('Chat Session');
      expect(sessionItems[1].textContent).toContain('Code Review');
      expect(sessionItems[2].textContent).toContain('Debug Session');
    });

    test('should display session types', () => {
      view.render();
      view.renderSessions(mockSessions);
      
      const typeElements = container.querySelectorAll('.session-type');
      expect(typeElements[0].textContent).toBe('chat');
      expect(typeElements[1].textContent).toBe('code');
      expect(typeElements[2].textContent).toBe('debug');
    });

    test('should display last modified times', () => {
      view.render();
      view.renderSessions(mockSessions);
      
      const timeElements = container.querySelectorAll('.session-time');
      expect(timeElements.length).toBe(3);
      // Times should be formatted as relative time
      expect(timeElements[0].textContent).toMatch(/ago|now/i);
    });

    test('should render sessions grouped by type', () => {
      view.render();
      view.renderSessionsByType({
        'chat': [mockSessions[0]],
        'code': [mockSessions[1]],
        'debug': [mockSessions[2]]
      });
      
      const categories = container.querySelectorAll('.session-category');
      expect(categories.length).toBe(3);
      
      const chatCategory = categories[0];
      expect(chatCategory.querySelector('.category-header').textContent).toBe('Chat');
      expect(chatCategory.querySelectorAll('.session-item').length).toBe(1);
    });

    test('should handle sessions without descriptions', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Basic Session', type: 'chat' }]);
      
      const description = container.querySelector('.session-description');
      expect(description.textContent).toBe('');
    });

    test('should show session descriptions when available', () => {
      const sessionWithDesc = {
        id: 'session1',
        name: 'Detailed Session',
        type: 'chat',
        description: 'This is a detailed session'
      };
      
      view.render();
      view.renderSessions([sessionWithDesc]);
      
      const description = container.querySelector('.session-description');
      expect(description.textContent).toBe('This is a detailed session');
    });
  });

  describe('Session Selection', () => {
    test('should highlight selected session', () => {
      view.render();
      view.renderSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' }
      ]);
      
      view.setSelectedSession('session2');
      
      const sessionItems = container.querySelectorAll('.session-item');
      expect(sessionItems[0].classList.contains('selected')).toBe(false);
      expect(sessionItems[1].classList.contains('selected')).toBe(true);
    });

    test('should clear selection when null', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      view.setSelectedSession('session1');
      view.setSelectedSession(null);
      
      const sessionItem = container.querySelector('.session-item');
      expect(sessionItem.classList.contains('selected')).toBe(false);
    });

    test('should handle selection of non-existent session', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      // Should not throw
      view.setSelectedSession('invalid-id');
      
      const sessionItem = container.querySelector('.session-item');
      expect(sessionItem.classList.contains('selected')).toBe(false);
    });
  });

  describe('Session Loading State', () => {
    test('should show loading state for specific session', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      view.setSessionLoading('session1', true);
      
      const sessionItem = container.querySelector('[data-session-id="session1"]');
      expect(sessionItem.classList.contains('loading')).toBe(true);
      
      const spinner = sessionItem.querySelector('.session-spinner');
      expect(spinner).toBeDefined();
    });

    test('should remove loading state when loading ends', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      view.setSessionLoading('session1', true);
      view.setSessionLoading('session1', false);
      
      const sessionItem = container.querySelector('[data-session-id="session1"]');
      expect(sessionItem.classList.contains('loading')).toBe(false);
      
      const spinner = sessionItem.querySelector('.session-spinner');
      expect(spinner).toBeNull();
    });

    test('should disable session during loading', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      view.setSessionLoading('session1', true);
      
      const sessionItem = container.querySelector('[data-session-id="session1"]');
      expect(sessionItem.classList.contains('disabled')).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    test('should update search input value', () => {
      view.render();
      view.setSearchQuery('test');
      
      const searchInput = container.querySelector('.session-search input');
      expect(searchInput.value).toBe('test');
    });

    test('should show search results count', () => {
      view.render();
      view.renderSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' }
      ]);
      view.showSearchResults(2, 5);
      
      const resultsCount = container.querySelector('.search-results-count');
      expect(resultsCount).toBeDefined();
      expect(resultsCount.textContent).toContain('2 of 5');
    });

    test('should show no results message', () => {
      view.render();
      view.renderSessions([]);
      view.showNoResults('nonexistent');
      
      const noResults = container.querySelector('.sessions-no-results');
      expect(noResults).toBeDefined();
      expect(noResults.textContent).toContain('No sessions found for "nonexistent"');
    });

    test('should show clear search button when query exists', () => {
      view.render();
      view.setSearchQuery('test');
      
      const clearButton = container.querySelector('.search-clear');
      expect(clearButton.style.display).not.toBe('none');
    });

    test('should hide clear search button when query is empty', () => {
      view.render();
      view.setSearchQuery('');
      
      const clearButton = container.querySelector('.search-clear');
      expect(clearButton.style.display).toBe('none');
    });
  });

  describe('Session Creation Dialog', () => {
    test('should show new session dialog', () => {
      view.render();
      view.showNewSessionDialog();
      
      const dialog = container.querySelector('.new-session-dialog');
      expect(dialog.style.display).not.toBe('none');
      
      const nameInput = dialog.querySelector('input[name="name"]');
      const typeSelect = dialog.querySelector('select[name="type"]');
      expect(nameInput).toBeDefined();
      expect(typeSelect).toBeDefined();
    });

    test('should hide new session dialog', () => {
      view.render();
      view.showNewSessionDialog();
      view.hideNewSessionDialog();
      
      const dialog = container.querySelector('.new-session-dialog');
      expect(dialog.style.display).toBe('none');
    });

    test('should clear dialog form when hidden', () => {
      view.render();
      view.showNewSessionDialog();
      
      const nameInput = container.querySelector('.new-session-dialog input[name="name"]');
      const descInput = container.querySelector('.new-session-dialog textarea[name="description"]');
      nameInput.value = 'Test Session';
      descInput.value = 'Test description';
      
      view.hideNewSessionDialog();
      view.showNewSessionDialog();
      
      expect(nameInput.value).toBe('');
      expect(descInput.value).toBe('');
    });

    test('should populate session type options', () => {
      view.render();
      view.showNewSessionDialog();
      
      const typeSelect = container.querySelector('.new-session-dialog select[name="type"]');
      const options = typeSelect.querySelectorAll('option');
      
      expect(options.length).toBeGreaterThan(1); // Default option + session types
      expect(options[0].value).toBe('');
      expect(options[1].value).toBe('chat');
      expect(options[2].value).toBe('code');
    });
  });

  describe('Session Actions', () => {
    test('should show session context menu', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      view.showSessionContextMenu('session1', { x: 100, y: 200 });
      
      const contextMenu = container.querySelector('.session-context-menu');
      expect(contextMenu.style.display).not.toBe('none');
      expect(contextMenu.style.left).toBe('100px');
      expect(contextMenu.style.top).toBe('200px');
    });

    test('should hide session context menu', () => {
      view.render();
      view.showSessionContextMenu('session1', { x: 100, y: 200 });
      view.hideSessionContextMenu();
      
      const contextMenu = container.querySelector('.session-context-menu');
      expect(contextMenu.style.display).toBe('none');
    });

    test('should show session delete confirmation', () => {
      view.render();
      view.showDeleteConfirmation({ id: 'session1', name: 'Test Session' });
      
      const confirmation = container.querySelector('.delete-confirmation');
      expect(confirmation.style.display).not.toBe('none');
      expect(confirmation.textContent).toContain('Test Session');
    });
  });

  describe('Event Handlers', () => {
    test('should call onSessionClick when session is clicked', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      const onSessionClick = jest.fn();
      view.onSessionClick = onSessionClick;
      
      const sessionItem = container.querySelector('.session-item');
      sessionItem.click();
      
      expect(onSessionClick).toHaveBeenCalledWith({ id: 'session1', name: 'Session 1', type: 'chat' });
    });

    test('should call onSearchInput when typing in search', () => {
      view.render();
      
      const onSearchInput = jest.fn();
      view.onSearchInput = onSearchInput;
      
      const searchInput = container.querySelector('.session-search input');
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));
      
      expect(onSearchInput).toHaveBeenCalledWith('test');
    });

    test('should call onNewSession when new session button clicked', () => {
      view.render();
      
      const onNewSession = jest.fn();
      view.onNewSession = onNewSession;
      
      const newButton = container.querySelector('.new-session-button');
      newButton.click();
      
      expect(onNewSession).toHaveBeenCalled();
    });

    test('should call onCreateSession when dialog form submitted', () => {
      view.render();
      view.showNewSessionDialog();
      
      const onCreateSession = jest.fn();
      view.onCreateSession = onCreateSession;
      
      const form = container.querySelector('.new-session-form');
      const nameInput = form.querySelector('input[name="name"]');
      const typeSelect = form.querySelector('select[name="type"]');
      
      nameInput.value = 'New Session';
      typeSelect.value = 'chat';
      
      form.dispatchEvent(new Event('submit'));
      
      expect(onCreateSession).toHaveBeenCalledWith({
        name: 'New Session',
        type: 'chat',
        description: ''
      });
    });

    test('should not call onSessionClick for disabled sessions', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      view.setSessionLoading('session1', true);
      
      const onSessionClick = jest.fn();
      view.onSessionClick = onSessionClick;
      
      const sessionItem = container.querySelector('.session-item');
      sessionItem.click();
      
      expect(onSessionClick).not.toHaveBeenCalled();
    });

    test('should handle right-click for context menu', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      const onSessionRightClick = jest.fn();
      view.onSessionRightClick = onSessionRightClick;
      
      const sessionItem = container.querySelector('.session-item');
      sessionItem.dispatchEvent(new MouseEvent('contextmenu', { 
        bubbles: true,
        clientX: 100,
        clientY: 200
      }));
      
      expect(onSessionRightClick).toHaveBeenCalledWith(
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { x: 100, y: 200 }
      );
    });
  });

  describe('Keyboard Navigation', () => {
    test('should focus search on / key', () => {
      view.render();
      
      const searchInput = container.querySelector('.session-search input');
      const focusSpy = jest.spyOn(searchInput, 'focus');
      
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
      
      expect(focusSpy).toHaveBeenCalled();
    });

    test('should navigate sessions with arrow keys', () => {
      view.render();
      view.renderSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' },
        { id: 'session3', name: 'Session 3', type: 'debug' }
      ]);
      
      const onNavigate = jest.fn();
      view.onNavigate = onNavigate;
      
      const sessionsList = container.querySelector('.session-list');
      sessionsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      
      expect(onNavigate).toHaveBeenCalledWith('down');
      
      sessionsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      
      expect(onNavigate).toHaveBeenCalledWith('up');
    });

    test('should select session on Enter key', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      view.setHighlightedSession('session1');
      
      const onSessionSelect = jest.fn();
      view.onSessionSelect = onSessionSelect;
      
      const sessionsList = container.querySelector('.session-list');
      sessionsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(onSessionSelect).toHaveBeenCalledWith({ id: 'session1', name: 'Session 1', type: 'chat' });
    });
  });

  describe('Visual States', () => {
    test('should show loading state for entire panel', () => {
      view.render();
      view.setLoading(true);
      
      const panel = container.querySelector('.session-panel');
      expect(panel.classList.contains('loading')).toBe(true);
      
      const loadingOverlay = container.querySelector('.sessions-loading');
      expect(loadingOverlay).toBeDefined();
    });

    test('should show error state', () => {
      view.render();
      view.showError('Failed to load sessions');
      
      const errorMessage = container.querySelector('.sessions-error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.textContent).toContain('Failed to load sessions');
    });

    test('should clear error state', () => {
      view.render();
      view.showError('Error');
      view.clearError();
      
      const errorMessage = container.querySelector('.sessions-error');
      expect(errorMessage).toBeNull();
    });

    test('should highlight session on hover', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      const sessionItem = container.querySelector('.session-item');
      
      sessionItem.dispatchEvent(new MouseEvent('mouseenter'));
      expect(sessionItem.classList.contains('hover')).toBe(true);
      
      sessionItem.dispatchEvent(new MouseEvent('mouseleave'));
      expect(sessionItem.classList.contains('hover')).toBe(false);
    });

    test('should set highlighted session for keyboard navigation', () => {
      view.render();
      view.renderSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' }
      ]);
      
      view.setHighlightedSession('session2');
      
      const sessions = container.querySelectorAll('.session-item');
      expect(sessions[0].classList.contains('highlighted')).toBe(false);
      expect(sessions[1].classList.contains('highlighted')).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('should remove all event listeners on destroy', () => {
      view.render();
      view.renderSessions([{ id: 'session1', name: 'Session 1', type: 'chat' }]);
      
      const onSessionClick = jest.fn();
      view.onSessionClick = onSessionClick;
      
      view.destroy();
      
      const sessionItem = container.querySelector('.session-item');
      if (sessionItem) {
        sessionItem.click();
        expect(onSessionClick).not.toHaveBeenCalled();
      }
    });

    test('should clear container on destroy', () => {
      view.render();
      view.destroy();
      
      expect(container.innerHTML).toBe('');
    });
  });
});