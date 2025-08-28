import { describe, it, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventHandler } from '../../../src/extension/EventHandler.js';

describe('Real-time Event Handling', () => {
  let eventHandler;
  let mockWebSocketClient;
  let mockCommandInterface;

  beforeEach(() => {
    mockWebSocketClient = {
      on: jest.fn(),
      off: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    };

    mockCommandInterface = {
      on: jest.fn(),
      off: jest.fn()
    };

    eventHandler = new EventHandler(mockWebSocketClient, mockCommandInterface);
  });

  afterEach(() => {
    if (eventHandler) {
      eventHandler.destroy();
    }
    jest.clearAllMocks();
  });

  describe('Progress Event Handling', () => {
    test('should handle progress events from server', () => {
      const progressListener = jest.fn();
      eventHandler.on('progress', progressListener);

      // Setup message handler
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      // Simulate progress event
      const progressEvent = {
        type: 'event',
        event: 'progress',
        data: {
          command_id: 'cmd-123',
          progress: 0.5,
          message: 'Analyzing DOM structure...',
          stage: 'analysis'
        }
      };

      messageHandler(progressEvent);

      expect(progressListener).toHaveBeenCalledWith({
        command_id: 'cmd-123',
        progress: 0.5,
        message: 'Analyzing DOM structure...',
        stage: 'analysis'
      });
    });

    test('should track progress by command ID', () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      // Send multiple progress events for same command
      messageHandler({
        type: 'event',
        event: 'progress',
        data: { command_id: 'cmd-123', progress: 0.2, message: 'Starting...' }
      });

      messageHandler({
        type: 'event',
        event: 'progress',
        data: { command_id: 'cmd-123', progress: 0.8, message: 'Almost done...' }
      });

      const progress = eventHandler.getCommandProgress('cmd-123');
      expect(progress).toEqual({
        progress: 0.8,
        message: 'Almost done...',
        lastUpdate: expect.any(Number)
      });
    });

    test('should handle progress completion', () => {
      const completeListener = jest.fn();
      eventHandler.on('progressComplete', completeListener);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      messageHandler({
        type: 'event',
        event: 'progress',
        data: {
          command_id: 'cmd-123',
          progress: 1.0,
          message: 'Analysis complete',
          completed: true
        }
      });

      expect(completeListener).toHaveBeenCalledWith({
        command_id: 'cmd-123',
        progress: 1.0,
        message: 'Analysis complete',
        completed: true
      });
    });

    test('should cleanup completed progress entries', () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      messageHandler({
        type: 'event',
        event: 'progress',
        data: { command_id: 'cmd-123', progress: 1.0, completed: true }
      });

      // Progress should be cleaned up after completion
      setTimeout(() => {
        expect(eventHandler.getCommandProgress('cmd-123')).toBeNull();
      }, 10);
    });
  });

  describe('Agent Suggestion Events', () => {
    test('should handle agent suggestions', () => {
      const suggestionListener = jest.fn();
      eventHandler.on('suggestion', suggestionListener);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      const suggestion = {
        type: 'event',
        event: 'suggestion',
        data: {
          command_id: 'cmd-123',
          suggestion: {
            type: 'optimization',
            title: 'Performance Improvement',
            description: 'Consider using CSS Grid instead of flexbox for this layout',
            code: 'display: grid; grid-template-columns: 1fr 1fr;',
            confidence: 0.8,
            impact: 'medium'
          }
        }
      };

      messageHandler(suggestion);

      expect(suggestionListener).toHaveBeenCalledWith(suggestion.data);
    });

    test('should categorize suggestions by type', () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      // Send different types of suggestions
      const suggestions = [
        { type: 'optimization', title: 'Performance tip' },
        { type: 'accessibility', title: 'A11y improvement' },
        { type: 'security', title: 'Security concern' }
      ];

      suggestions.forEach((suggestion, index) => {
        messageHandler({
          type: 'event',
          event: 'suggestion',
          data: {
            command_id: `cmd-${index}`,
            suggestion
          }
        });
      });

      const categorized = eventHandler.getSuggestionsByCategory();
      expect(categorized).toEqual({
        optimization: expect.arrayContaining([
          expect.objectContaining({ type: 'optimization' })
        ]),
        accessibility: expect.arrayContaining([
          expect.objectContaining({ type: 'accessibility' })
        ]),
        security: expect.arrayContaining([
          expect.objectContaining({ type: 'security' })
        ])
      });
    });

    test('should filter suggestions by confidence threshold', () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();
      eventHandler.setConfidenceThreshold(0.7);

      // High confidence suggestion
      messageHandler({
        type: 'event',
        event: 'suggestion',
        data: {
          command_id: 'cmd-1',
          suggestion: { confidence: 0.9, title: 'High confidence' }
        }
      });

      // Low confidence suggestion
      messageHandler({
        type: 'event',
        event: 'suggestion',
        data: {
          command_id: 'cmd-2',
          suggestion: { confidence: 0.5, title: 'Low confidence' }
        }
      });

      const suggestions = eventHandler.getFilteredSuggestions();
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('High confidence');
    });
  });

  describe('Page State Change Events', () => {
    test('should handle DOM change events', () => {
      const domChangeListener = jest.fn();
      eventHandler.on('domChange', domChangeListener);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      const domChangeEvent = {
        type: 'event',
        event: 'domChange',
        data: {
          changeType: 'childList',
          target: '#main-content',
          addedNodes: ['<div>New element</div>'],
          removedNodes: [],
          timestamp: Date.now()
        }
      };

      messageHandler(domChangeEvent);

      expect(domChangeListener).toHaveBeenCalledWith(domChangeEvent.data);
    });

    test('should handle navigation events', () => {
      const navigationListener = jest.fn();
      eventHandler.on('navigation', navigationListener);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      messageHandler({
        type: 'event',
        event: 'navigation',
        data: {
          from: 'https://example.com/page1',
          to: 'https://example.com/page2',
          type: 'pushstate',
          timestamp: Date.now()
        }
      });

      expect(navigationListener).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'https://example.com/page1',
          to: 'https://example.com/page2',
          type: 'pushstate'
        })
      );
    });

    test('should handle performance metric events', () => {
      const performanceListener = jest.fn();
      eventHandler.on('performance', performanceListener);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      messageHandler({
        type: 'event',
        event: 'performance',
        data: {
          metrics: {
            FCP: 1200,
            LCP: 2400,
            FID: 80,
            CLS: 0.1
          },
          url: 'https://example.com',
          timestamp: Date.now()
        }
      });

      expect(performanceListener).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            FCP: 1200,
            LCP: 2400
          })
        })
      );
    });

    test('should track page state history', () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      const events = [
        { event: 'navigation', data: { to: '/page1' } },
        { event: 'domChange', data: { changeType: 'childList' } },
        { event: 'performance', data: { metrics: { LCP: 2000 } } }
      ];

      events.forEach(evt => {
        messageHandler({
          type: 'event',
          ...evt
        });
      });

      const history = eventHandler.getPageStateHistory();
      expect(history).toHaveLength(3);
      expect(history[0].event).toBe('navigation');
      expect(history[1].event).toBe('domChange');
      expect(history[2].event).toBe('performance');
    });
  });

  describe('Event Filtering and Routing', () => {
    test('should filter events by type', () => {
      eventHandler.setEventFilters(['progress', 'suggestion']);

      const progressListener = jest.fn();
      const suggestionListener = jest.fn();
      const domChangeListener = jest.fn();

      eventHandler.on('progress', progressListener);
      eventHandler.on('suggestion', suggestionListener);
      eventHandler.on('domChange', domChangeListener);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      // Send different event types
      messageHandler({ type: 'event', event: 'progress', data: {} });
      messageHandler({ type: 'event', event: 'suggestion', data: {} });
      messageHandler({ type: 'event', event: 'domChange', data: {} });

      expect(progressListener).toHaveBeenCalled();
      expect(suggestionListener).toHaveBeenCalled();
      expect(domChangeListener).not.toHaveBeenCalled(); // Filtered out
    });

    test('should route events to specific command handlers', () => {
      const commandEventListener = jest.fn();
      eventHandler.onCommandEvent('cmd-123', commandEventListener);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      // Event for specific command
      messageHandler({
        type: 'event',
        event: 'progress',
        data: { command_id: 'cmd-123', progress: 0.5 }
      });

      // Event for different command
      messageHandler({
        type: 'event',
        event: 'progress',
        data: { command_id: 'cmd-456', progress: 0.3 }
      });

      expect(commandEventListener).toHaveBeenCalledTimes(1);
      expect(commandEventListener).toHaveBeenCalledWith(
        'progress',
        expect.objectContaining({ command_id: 'cmd-123' })
      );
    });

    test('should handle event priorities', () => {
      const highPriorityListener = jest.fn();
      const normalPriorityListener = jest.fn();

      eventHandler.on('suggestion', highPriorityListener, { priority: 'high' });
      eventHandler.on('suggestion', normalPriorityListener);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      messageHandler({
        type: 'event',
        event: 'suggestion',
        data: { priority: 'high', suggestion: { title: 'Critical issue' } }
      });

      // High priority listener should be called first
      expect(highPriorityListener).toHaveBeenCalled();
      expect(normalPriorityListener).toHaveBeenCalled();
    });
  });

  describe('Event State Management', () => {
    test('should maintain event statistics', () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      // Send various events
      messageHandler({ type: 'event', event: 'progress', data: {} });
      messageHandler({ type: 'event', event: 'progress', data: {} });
      messageHandler({ type: 'event', event: 'suggestion', data: {} });
      messageHandler({ type: 'event', event: 'domChange', data: {} });

      const stats = eventHandler.getEventStatistics();
      expect(stats).toEqual({
        totalEvents: 4,
        eventCounts: {
          progress: 2,
          suggestion: 1,
          domChange: 1
        },
        eventsPerSecond: expect.any(Number),
        lastEventTimestamp: expect.any(Number),
        startTime: expect.any(Number)
      });
    });

    test('should handle event buffering', () => {
      eventHandler.enableEventBuffering(3);

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      // Send events
      for (let i = 0; i < 5; i++) {
        messageHandler({
          type: 'event',
          event: 'progress',
          data: { index: i }
        });
      }

      const buffer = eventHandler.getEventBuffer();
      expect(buffer).toHaveLength(3); // Only last 3 events
      expect(buffer[2].data.index).toBe(4); // Most recent event
    });

    test('should clear expired events', () => {
      eventHandler.setEventExpiration(100); // 100ms expiration

      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      eventHandler.initialize();

      messageHandler({
        type: 'event',
        event: 'progress',
        data: { command_id: 'cmd-123', progress: 0.5 }
      });

      expect(eventHandler.getCommandProgress('cmd-123')).toBeTruthy();

      // Wait for expiration
      setTimeout(() => {
        eventHandler.cleanupExpiredEvents();
        expect(eventHandler.getCommandProgress('cmd-123')).toBeNull();
      }, 150);
    });
  });

  describe('Event Handler Lifecycle', () => {
    test('should initialize and setup listeners', () => {
      eventHandler.initialize();

      expect(mockWebSocketClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });

    test('should handle disconnection gracefully', () => {
      let disconnectHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'disconnected') {
          disconnectHandler = handler;
        }
      });

      eventHandler.initialize();

      // Add some state
      eventHandler.commandProgress.set('cmd-123', { progress: 0.5 });
      eventHandler.suggestions.push({ id: 'sug-1' });

      // Simulate disconnection
      disconnectHandler();

      // Should clear transient state but preserve configuration
      expect(eventHandler.commandProgress.size).toBe(0);
      expect(eventHandler.suggestions).toHaveLength(0);
      expect(eventHandler.getEventFilters()).toBeDefined(); // Config preserved
    });

    test('should cleanup resources on destroy', () => {
      eventHandler.initialize();
      eventHandler.destroy();

      expect(mockWebSocketClient.off).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });

    test('should handle multiple initialize calls gracefully', () => {
      eventHandler.initialize();
      eventHandler.initialize(); // Second call should be ignored

      // Should only register listeners once
      expect(mockWebSocketClient.on).toHaveBeenCalledTimes(3);
    });
  });
});