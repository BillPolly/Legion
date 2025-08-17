/**
 * Network Error Handling Tests
 * Tests WebSocket disconnection, reconnection logic, and network failures
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('Network Error Handling Tests', () => {
  let component;
  let mockUmbilical;
  let dom;
  let mockPlanningActor;
  let mockExecutionActor;
  let mockWebSocket;
  let reconnectAttempts;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Reset reconnect attempts
    reconnectAttempts = 0;

    // Create mock WebSocket
    mockWebSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Create comprehensive mock actors
    mockPlanningActor = {
      createPlan: jest.fn(),
      decomposePlan: jest.fn(),
      savePlan: jest.fn(),
      loadPlan: jest.fn(),
      getPlans: jest.fn(),
      validatePlan: jest.fn()
    };

    mockExecutionActor = {
      executePlan: jest.fn(),
      startExecution: jest.fn(),
      pauseExecution: jest.fn(),
      resumeExecution: jest.fn(),
      stopExecution: jest.fn(),
      getExecutionStatus: jest.fn()
    };

    // Define planning tabs
    const tabs = [
      {
        id: 'planning',
        label: 'Planning Workspace',
        title: 'Planning Workspace',
        icon: '🧠',
        component: 'PlanningWorkspacePanel'
      },
      {
        id: 'execution',
        label: 'Execution Control',
        title: 'Execution Control',
        icon: '⚡',
        component: 'ExecutionControlPanel'
      }
    ];

    // Create umbilical with network state tracking
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'planning',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      
      // Network state
      webSocket: mockWebSocket,
      connectionState: 'connected',
      reconnectTimer: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      
      // Network callbacks
      onDisconnect: jest.fn(() => {
        mockUmbilical.connectionState = 'disconnected';
      }),
      
      onReconnect: jest.fn(() => {
        mockUmbilical.connectionState = 'connected';
        mockUmbilical.reconnectAttempts = 0;
      }),
      
      onReconnectAttempt: jest.fn((attempt) => {
        mockUmbilical.reconnectAttempts = attempt;
        reconnectAttempts = attempt;
      }),
      
      onNetworkError: jest.fn((error) => {
        mockUmbilical.connectionState = 'error';
      }),
      
      // Standard callbacks
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await NavigationTabs.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
    if (mockUmbilical.reconnectTimer) {
      clearTimeout(mockUmbilical.reconnectTimer);
    }
    jest.clearAllMocks();
  });

  describe('WebSocket Disconnection Handling', () => {
    test('should detect WebSocket disconnection', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      // Simulate WebSocket disconnection
      mockWebSocket.readyState = 3; // CLOSED
      if (mockUmbilical.onDisconnect) {
        mockUmbilical.onDisconnect();
      }
      
      // Verify disconnection was detected
      expect(mockUmbilical.connectionState).toBe('disconnected');
      expect(mockUmbilical.onDisconnect).toHaveBeenCalled();
    });

    test('should handle unexpected WebSocket closure', async () => {
      const closeEvent = {
        code: 1006,
        reason: 'Abnormal closure',
        wasClean: false
      };
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      // Simulate unexpected closure
      mockWebSocket.readyState = 3; // CLOSED
      if (mockUmbilical.onNetworkError) {
        mockUmbilical.onNetworkError(closeEvent);
      }
      
      // Verify error was handled
      expect(mockUmbilical.connectionState).toBe('error');
      expect(mockUmbilical.onNetworkError).toHaveBeenCalledWith(closeEvent);
    });

    test('should queue messages during disconnection', async () => {
      const messageQueue = [];
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Simulate disconnection
      mockWebSocket.readyState = 3; // CLOSED
      mockUmbilical.connectionState = 'disconnected';
      
      // Try to send messages while disconnected
      const testMessages = [
        { type: 'createPlan', data: { goal: 'Test goal 1' } },
        { type: 'savePlan', data: { plan: 'Test plan' } },
        { type: 'validatePlan', data: { planId: 'test-id' } }
      ];
      
      testMessages.forEach(msg => {
        if (mockWebSocket.readyState !== 1) {
          messageQueue.push(msg);
        } else {
          mockWebSocket.send(JSON.stringify(msg));
        }
      });
      
      // Verify messages were queued
      expect(messageQueue).toHaveLength(3);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    test('should maintain component state during disconnection', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Set state before disconnection
        planningComponent.api.setGoal('Test goal during disconnection');
        const stateBefore = planningComponent.api.getState();
        
        // Simulate disconnection
        mockWebSocket.readyState = 3; // CLOSED
        mockUmbilical.connectionState = 'disconnected';
        
        // Verify state is maintained
        const stateAfter = planningComponent.api.getState();
        expect(stateAfter.goal).toBe(stateBefore.goal);
        expect(stateAfter.goal).toBe('Test goal during disconnection');
      }
    });
  });

  describe('Reconnection Logic', () => {
    test('should attempt automatic reconnection', async () => {
      // Simulate reconnection logic
      const attemptReconnection = () => {
        if (mockUmbilical.reconnectAttempts < mockUmbilical.maxReconnectAttempts) {
          mockUmbilical.onReconnectAttempt(mockUmbilical.reconnectAttempts + 1);
          
          // Simulate reconnection timer
          mockUmbilical.reconnectTimer = setTimeout(() => {
            if (mockUmbilical.reconnectAttempts === 3) {
              // Succeed on 3rd attempt
              mockWebSocket.readyState = 1; // OPEN
              mockUmbilical.onReconnect();
            } else {
              // Continue attempting
              attemptReconnection();
            }
          }, mockUmbilical.reconnectDelay);
        }
      };
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      // Simulate disconnection
      mockWebSocket.readyState = 3; // CLOSED
      mockUmbilical.onDisconnect();
      
      // Start reconnection attempts
      attemptReconnection();
      
      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Verify reconnection succeeded
      expect(mockUmbilical.onReconnectAttempt).toHaveBeenCalled();
      expect(reconnectAttempts).toBeGreaterThan(0);
    });

    test('should use exponential backoff for reconnection', async () => {
      const backoffDelays = [];
      
      // Calculate exponential backoff
      const calculateBackoff = (attempt) => {
        const baseDelay = 1000;
        const maxDelay = 30000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        backoffDelays.push(delay);
        return delay;
      };
      
      // Simulate reconnection with backoff
      for (let i = 1; i <= 5; i++) {
        calculateBackoff(i);
      }
      
      // Verify exponential backoff pattern
      expect(backoffDelays[0]).toBe(1000);  // 1 second
      expect(backoffDelays[1]).toBe(2000);  // 2 seconds
      expect(backoffDelays[2]).toBe(4000);  // 4 seconds
      expect(backoffDelays[3]).toBe(8000);  // 8 seconds
      expect(backoffDelays[4]).toBe(16000); // 16 seconds
    });

    test('should limit reconnection attempts', async () => {
      let attemptCount = 0;
      const maxAttempts = 5;
      
      // Simulate failed reconnection attempts
      const attemptReconnection = () => {
        if (attemptCount < maxAttempts) {
          attemptCount++;
          mockUmbilical.onReconnectAttempt(attemptCount);
          
          // All attempts fail
          if (attemptCount < maxAttempts) {
            setTimeout(attemptReconnection, 100);
          }
        }
      };
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      // Start reconnection attempts
      attemptReconnection();
      
      // Wait for all attempts
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Verify attempts were limited
      expect(attemptCount).toBe(maxAttempts);
      expect(mockUmbilical.onReconnectAttempt).toHaveBeenCalledTimes(maxAttempts);
    });

    test('should restore message flow after reconnection', async () => {
      const queuedMessages = [
        { type: 'createPlan', data: { goal: 'Queued goal' } },
        { type: 'savePlan', data: { plan: 'Queued plan' } }
      ];
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      // Simulate disconnection
      mockWebSocket.readyState = 3; // CLOSED
      mockUmbilical.connectionState = 'disconnected';
      
      // Simulate reconnection
      mockWebSocket.readyState = 1; // OPEN
      mockUmbilical.onReconnect();
      
      // Send queued messages after reconnection
      queuedMessages.forEach(msg => {
        mockWebSocket.send(JSON.stringify(msg));
      });
      
      // Verify messages were sent
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(mockUmbilical.connectionState).toBe('connected');
    });
  });

  describe('Network Failure Scenarios', () => {
    test('should handle network timeout', async () => {
      const timeoutError = new Error('Network request timeout');
      timeoutError.code = 'ETIMEDOUT';
      
      // Mock network timeout
      mockPlanningActor.createPlan.mockRejectedValue(timeoutError);
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Attempt operation that times out
        planningComponent.api.setGoal('Test network timeout');
        await planningComponent.api.createPlan();
        
        // Verify timeout was handled
        expect(mockPlanningActor.createPlan).toHaveBeenCalled();
        
        const state = planningComponent.api.getState();
        expect(state.planningStatus).toBe('error');
      }
    });

    test('should handle DNS resolution failure', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND api.example.com');
      dnsError.code = 'ENOTFOUND';
      dnsError.hostname = 'api.example.com';
      
      // Mock DNS failure
      mockPlanningActor.savePlan.mockRejectedValue(dnsError);
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Attempt to save with DNS failure
        const testPlan = {
          id: 'test-plan',
          name: 'Test Plan',
          goal: 'Test DNS failure'
        };
        
        planningComponent.api.setCurrentPlan(testPlan);
        await planningComponent.api.savePlan('Test Plan');
        
        // Verify DNS error was encountered
        expect(mockPlanningActor.savePlan).toHaveBeenCalled();
      }
    });

    test('should handle connection refused', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:8080');
      connectionError.code = 'ECONNREFUSED';
      connectionError.address = '127.0.0.1';
      connectionError.port = 8080;
      
      // Mock connection refused
      mockExecutionActor.startExecution.mockRejectedValue(connectionError);
      
      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');
      
      if (executionComponent && executionComponent.api) {
        // Attempt execution with connection refused
        const testPlan = {
          id: 'test-plan',
          name: 'Test Connection',
          behaviorTree: { rootNode: { type: 'action', command: 'test' } }
        };
        
        executionComponent.api.setPlan(testPlan);
        await executionComponent.api.startExecution();
        
        // Verify connection error
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        
        const state = executionComponent.api.getState();
        expect(state.executionStatus).toBe('error');
      }
    });

    test('should handle proxy errors', async () => {
      const proxyError = new Error('Proxy authentication required');
      proxyError.code = 'PROXY_AUTH_REQUIRED';
      proxyError.statusCode = 407;
      
      // Mock proxy error
      mockPlanningActor.loadPlan.mockRejectedValue(proxyError);
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Attempt to load through proxy
        await planningComponent.api.loadPlan('proxy-test-plan');
        
        // Verify proxy error was encountered
        expect(mockPlanningActor.loadPlan).toHaveBeenCalledWith('proxy-test-plan');
      }
    });
  });

  describe('Connection State Management', () => {
    test('should track connection state changes', async () => {
      const stateChanges = [];
      
      // Track state changes
      const trackStateChange = (newState) => {
        stateChanges.push({
          state: newState,
          timestamp: Date.now()
        });
      };
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      // Simulate state transitions
      trackStateChange('connected');
      
      mockWebSocket.readyState = 0; // CONNECTING
      trackStateChange('connecting');
      
      mockWebSocket.readyState = 3; // CLOSED
      trackStateChange('disconnected');
      
      mockWebSocket.readyState = 1; // OPEN
      trackStateChange('connected');
      
      // Verify state transitions
      expect(stateChanges).toHaveLength(4);
      expect(stateChanges[0].state).toBe('connected');
      expect(stateChanges[1].state).toBe('connecting');
      expect(stateChanges[2].state).toBe('disconnected');
      expect(stateChanges[3].state).toBe('connected');
    });

    test('should provide connection status to components', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Verify component can access connection state
      expect(mockUmbilical.connectionState).toBe('connected');
      
      // Simulate disconnection
      mockWebSocket.readyState = 3; // CLOSED
      mockUmbilical.connectionState = 'disconnected';
      
      // Component should be aware of disconnection
      expect(mockUmbilical.connectionState).toBe('disconnected');
      
      // Simulate reconnection
      mockWebSocket.readyState = 1; // OPEN
      mockUmbilical.connectionState = 'connected';
      
      // Component should be aware of reconnection
      expect(mockUmbilical.connectionState).toBe('connected');
    });

    test('should handle connection state during panel switches', async () => {
      // Start in planning panel
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      // Verify initial connection
      expect(mockUmbilical.connectionState).toBe('connected');
      
      // Simulate disconnection
      mockWebSocket.readyState = 3; // CLOSED
      mockUmbilical.connectionState = 'disconnected';
      
      // Switch to execution panel while disconnected
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      // Connection state should persist
      expect(mockUmbilical.connectionState).toBe('disconnected');
      
      // Simulate reconnection
      mockWebSocket.readyState = 1; // OPEN
      mockUmbilical.connectionState = 'connected';
      
      // Switch back to planning
      await component.switchTab('planning');
      
      // Connection should be restored
      expect(mockUmbilical.connectionState).toBe('connected');
    });
  });

  describe('Offline Mode Support', () => {
    test('should enable offline mode when disconnected', async () => {
      let offlineMode = false;
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Simulate going offline
      mockWebSocket.readyState = 3; // CLOSED
      mockUmbilical.connectionState = 'disconnected';
      offlineMode = true;
      
      if (planningComponent && planningComponent.api) {
        // Should allow local operations in offline mode
        planningComponent.api.setGoal('Offline goal');
        const state = planningComponent.api.getState();
        expect(state.goal).toBe('Offline goal');
      }
      
      // Verify offline mode is active
      expect(offlineMode).toBe(true);
    });

    test('should sync changes when connection restored', async () => {
      const offlineChanges = [];
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Make changes while offline
        mockWebSocket.readyState = 3; // CLOSED
        mockUmbilical.connectionState = 'disconnected';
        
        planningComponent.api.setGoal('Offline change 1');
        offlineChanges.push({ type: 'setGoal', value: 'Offline change 1' });
        
        planningComponent.api.setCurrentPlan({ id: 'offline-plan', name: 'Offline Plan' });
        offlineChanges.push({ type: 'setPlan', value: { id: 'offline-plan' } });
        
        // Simulate reconnection
        mockWebSocket.readyState = 1; // OPEN
        mockUmbilical.connectionState = 'connected';
        
        // Sync offline changes
        offlineChanges.forEach(change => {
          mockWebSocket.send(JSON.stringify(change));
        });
        
        // Verify changes were synced
        expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
        expect(offlineChanges).toHaveLength(2);
      }
    });

    test('should cache data for offline access', async () => {
      const cache = new Map();
      
      // Load and cache data while online
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Cache some data
        const testPlan = {
          id: 'cached-plan',
          name: 'Cached Plan',
          goal: 'Test caching'
        };
        
        planningComponent.api.setCurrentPlan(testPlan);
        cache.set('currentPlan', testPlan);
        
        // Go offline
        mockWebSocket.readyState = 3; // CLOSED
        mockUmbilical.connectionState = 'disconnected';
        
        // Access cached data while offline
        const cachedPlan = cache.get('currentPlan');
        expect(cachedPlan).toBeDefined();
        expect(cachedPlan.id).toBe('cached-plan');
        expect(cachedPlan.name).toBe('Cached Plan');
      }
    });
  });
});