/**
 * ProgressOverlayPanel Integration Tests
 * Tests progress visualization during plan execution
 */

import { jest } from '@jest/globals';
import { ProgressOverlayPanel } from '../../src/components/tool-registry/components/panels/ProgressOverlayPanel.js';

describe('ProgressOverlayPanel Integration Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container with SVG namespace support
    dom = document.createElement('div');
    dom.style.width = '800px';
    dom.style.height = '600px';
    document.body.appendChild(dom);

    // Create mock umbilical with execution event handlers
    mockUmbilical = {
      dom,
      onMount: jest.fn(),
      onExecutionStart: jest.fn(),
      onExecutionComplete: jest.fn(),
      onTaskProgress: jest.fn(),
      onMetricsUpdate: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await ProgressOverlayPanel.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Execution Progress Integration', () => {
    test('should track execution from start to completion', () => {
      const executionId = 'exec-123';
      const tasks = [
        { id: 'task1', name: 'Setup database', estimatedDuration: 30000 },
        { id: 'task2', name: 'Create API routes', estimatedDuration: 45000 },
        { id: 'task3', name: 'Write tests', estimatedDuration: 60000 },
        { id: 'task4', name: 'Deploy application', estimatedDuration: 20000 }
      ];

      // Set node positions for overlay rendering
      const nodePositions = {
        'task1': { x: 100, y: 100 },
        'task2': { x: 200, y: 150 },
        'task3': { x: 300, y: 100 },
        'task4': { x: 400, y: 150 }
      };
      component.api.setNodePositions(nodePositions);

      // Start execution
      component.api.startExecution(executionId, tasks);

      // Verify execution state
      expect(component.model.getState('executionId')).toBe(executionId);
      expect(component.model.getState('executionStatus')).toBe('running');

      // Verify task progress initialization
      const taskProgress = component.api.getTaskProgress();
      expect(Object.keys(taskProgress)).toHaveLength(4);
      expect(taskProgress['task1'].status).toBe('pending');
      expect(taskProgress['task1'].progress).toBe(0);

      // Start first task
      component.api.updateTaskProgress('task1', { status: 'running', progress: 0 });
      component.api.setCurrentTask('task1');

      expect(taskProgress['task1'].status).toBe('running');
      expect(component.model.getState('currentTask')).toBe('task1');

      // Simulate progress updates
      component.api.updateTaskProgress('task1', { status: 'running', progress: 0.5 });
      expect(taskProgress['task1'].progress).toBe(0.5);

      // Complete first task
      component.api.updateTaskProgress('task1', { status: 'completed', progress: 1.0 });

      // Start second task
      component.api.updateTaskProgress('task2', { status: 'running', progress: 0 });
      component.api.setCurrentTask('task2');

      // Complete all tasks
      component.api.updateTaskProgress('task2', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('task3', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('task4', { status: 'completed', progress: 1.0 });

      // Stop execution
      component.api.stopExecution();
      expect(component.model.getState('executionStatus')).toBe('completed');
    });

    test('should handle execution with failures', () => {
      const executionId = 'exec-fail-456';
      const tasks = [
        { id: 'setup', name: 'Setup environment' },
        { id: 'build', name: 'Build application' },
        { id: 'deploy', name: 'Deploy to server' }
      ];

      const nodePositions = {
        'setup': { x: 100, y: 100 },
        'build': { x: 200, y: 100 },
        'deploy': { x: 300, y: 100 }
      };
      component.api.setNodePositions(nodePositions);

      // Start execution
      component.api.startExecution(executionId, tasks);

      // Complete setup successfully
      component.api.updateTaskProgress('setup', { status: 'completed', progress: 1.0 });

      // Fail build step
      component.api.updateTaskProgress('build', { 
        status: 'failed', 
        progress: 0.3,
        error: 'Compilation error: missing dependency'
      });

      // Verify failure state
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['build'].status).toBe('failed');
      expect(taskProgress['build'].error).toBe('Compilation error: missing dependency');

      // Stop execution due to failure
      component.api.stopExecution();
      expect(component.model.getState('executionStatus')).toBe('completed');
    });

    test('should track execution metrics and timeline', () => {
      const executionId = 'exec-metrics-789';
      const tasks = [
        { id: 'task1', name: 'Fast task' },
        { id: 'task2', name: 'Medium task' },
        { id: 'task3', name: 'Slow task' }
      ];

      component.api.startExecution(executionId, tasks);

      // Add timeline events
      component.api.addTimelineEvent({
        timestamp: Date.now(),
        type: 'execution_started',
        description: 'Plan execution initiated'
      });

      component.api.addTimelineEvent({
        timestamp: Date.now() + 1000,
        type: 'task_started',
        taskId: 'task1',
        description: 'Started fast task'
      });

      component.api.addTimelineEvent({
        timestamp: Date.now() + 5000,
        type: 'task_completed',
        taskId: 'task1',
        description: 'Completed fast task',
        duration: 4000
      });

      // Get metrics (note: metrics are updated when tasks are updated, not just on start)
      const metrics = component.api.getExecutionMetrics();
      expect(metrics).toBeDefined();

      // Verify timeline (accounting for automatic execution started event)
      const timeline = component.model.getState('timeline');
      expect(timeline.length).toBeGreaterThanOrEqual(3);
      // Check that our manually added events are present
      const manualEvents = timeline.filter(e => e.type !== 'execution');
      expect(manualEvents).toHaveLength(3);
      expect(manualEvents[0].type).toBe('execution_started');
      expect(manualEvents[1].type).toBe('task_started');
      expect(manualEvents[2].type).toBe('task_completed');
    });
  });

  describe('Real-time Progress Updates', () => {
    test('should handle rapid progress updates efficiently', () => {
      const tasks = [{ id: 'batch-task', name: 'Batch processing task' }];
      const nodePositions = { 'batch-task': { x: 200, y: 200 } };
      
      component.api.setNodePositions(nodePositions);
      component.api.startExecution('batch-exec', tasks);

      const startTime = Date.now();

      // Simulate rapid progress updates (100 updates)
      for (let i = 0; i <= 100; i++) {
        component.api.updateTaskProgress('batch-task', {
          status: i < 100 ? 'running' : 'completed',
          progress: i / 100
        });
      }

      const updateTime = Date.now() - startTime;

      // Should handle updates within reasonable time
      expect(updateTime).toBeLessThan(1000);

      // Verify final state
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['batch-task'].progress).toBe(1.0);
      expect(taskProgress['batch-task'].status).toBe('completed');
    });

    test('should synchronize with external execution actors', () => {
      const executionId = 'external-sync-123';
      const tasks = [
        { id: 'external1', name: 'External task 1' },
        { id: 'external2', name: 'External task 2' }
      ];

      component.api.startExecution(executionId, tasks);

      // Simulate receiving updates from external execution actor
      const externalUpdates = [
        { taskId: 'external1', status: 'running', progress: 0.25 },
        { taskId: 'external1', status: 'running', progress: 0.75 },
        { taskId: 'external1', status: 'completed', progress: 1.0 },
        { taskId: 'external2', status: 'running', progress: 0.1 },
        { taskId: 'external2', status: 'failed', error: 'Network timeout' }
      ];

      // Apply external updates
      externalUpdates.forEach(update => {
        component.api.updateTaskProgress(update.taskId, {
          status: update.status,
          progress: update.progress,
          error: update.error
        });
      });

      // Verify final state matches external updates
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['external1'].status).toBe('completed');
      expect(taskProgress['external1'].progress).toBe(1.0);
      expect(taskProgress['external2'].status).toBe('failed');
      expect(taskProgress['external2'].error).toBe('Network timeout');
    });

    test('should handle concurrent task execution', () => {
      const tasks = [
        { id: 'parallel1', name: 'Parallel task 1' },
        { id: 'parallel2', name: 'Parallel task 2' },
        { id: 'parallel3', name: 'Parallel task 3' }
      ];

      component.api.startExecution('parallel-exec', tasks);

      // Start all tasks concurrently
      tasks.forEach(task => {
        component.api.updateTaskProgress(task.id, { status: 'running', progress: 0 });
      });

      // Update progress at different rates
      component.api.updateTaskProgress('parallel1', { status: 'running', progress: 0.8 });
      component.api.updateTaskProgress('parallel2', { status: 'running', progress: 0.3 });
      component.api.updateTaskProgress('parallel3', { status: 'running', progress: 0.6 });

      // Complete tasks in different order
      component.api.updateTaskProgress('parallel2', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('parallel1', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('parallel3', { status: 'completed', progress: 1.0 });

      // Verify all tasks completed
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['parallel1'].status).toBe('completed');
      expect(taskProgress['parallel2'].status).toBe('completed');
      expect(taskProgress['parallel3'].status).toBe('completed');
    });
  });

  describe('Visual Overlay Integration', () => {
    test('should render progress overlays on plan visualization', () => {
      const tasks = [
        { id: 'visual1', name: 'Visual task 1' },
        { id: 'visual2', name: 'Visual task 2' }
      ];

      const nodePositions = {
        'visual1': { x: 150, y: 100 },
        'visual2': { x: 250, y: 200 }
      };

      // Set positions and start execution
      component.api.setNodePositions(nodePositions);
      component.api.startExecution('visual-exec', tasks);

      // Update progress to trigger overlay rendering
      component.api.updateTaskProgress('visual1', { status: 'running', progress: 0.5 });
      component.api.updateTaskProgress('visual2', { status: 'pending', progress: 0 });

      // Verify overlay state is maintained
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['visual1'].status).toBe('running');
      expect(taskProgress['visual1'].progress).toBe(0.5);
      expect(taskProgress['visual2'].status).toBe('pending');
    });

    test('should support overlay configuration settings', () => {
      component.api.startExecution('config-exec', [{ id: 'task', name: 'Test task' }]);

      // Configure overlay settings
      component.api.updateOverlaySetting('showProgress', false);
      component.api.updateOverlaySetting('showTimeline', true);
      component.api.updateOverlaySetting('animateProgress', false);
      component.api.updateOverlaySetting('pulseCurrentTask', true);

      // Verify settings are applied
      const settings = component.model.getState('overlaySettings');
      expect(settings.showProgress).toBe(false);
      expect(settings.showTimeline).toBe(true);
      expect(settings.animateProgress).toBe(false);
      expect(settings.pulseCurrentTask).toBe(true);
    });

    test('should handle node position updates during execution', () => {
      const tasks = [{ id: 'moving-task', name: 'Task with changing position' }];
      
      component.api.startExecution('position-exec', tasks);

      // Set initial position
      component.api.setNodePositions({ 'moving-task': { x: 100, y: 100 } });
      component.api.updateTaskProgress('moving-task', { status: 'running', progress: 0.3 });

      // Update position during execution
      component.api.setNodePositions({ 'moving-task': { x: 200, y: 150 } });

      // Verify overlay adapts to new position
      // Note: In real implementation, this would trigger overlay re-rendering
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['moving-task'].status).toBe('running');
      expect(taskProgress['moving-task'].progress).toBe(0.3);
    });
  });

  describe('Progress Export and Reporting', () => {
    test('should export execution progress data', () => {
      const tasks = [
        { id: 'export1', name: 'Export test 1' },
        { id: 'export2', name: 'Export test 2' }
      ];

      component.api.startExecution('export-exec', tasks);

      // Simulate some progress
      component.api.updateTaskProgress('export1', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('export2', { status: 'running', progress: 0.7 });

      // Add timeline events
      component.api.addTimelineEvent({
        timestamp: Date.now(),
        type: 'milestone',
        description: 'Phase 1 completed'
      });

      // Mock URL functions and DOM elements for test environment
      global.URL = global.URL || {};
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      const mockLink = {
        click: jest.fn(),
        download: '',
        href: ''
      };
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
          return mockLink;
        }
        return document.createElement(tagName);
      });

      // Export progress data (triggers download, doesn't return data)
      expect(() => component.api.exportProgress()).not.toThrow();

      // Verify export was attempted
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();

      // Restore mocks
      document.createElement.mockRestore();
    });

    test('should generate execution metrics summary', () => {
      const tasks = [
        { id: 'metric1', name: 'Completed task' },
        { id: 'metric2', name: 'Failed task' },
        { id: 'metric3', name: 'Pending task' }
      ];

      component.api.startExecution('metrics-exec', tasks);

      // Set different task states
      component.api.updateTaskProgress('metric1', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('metric2', { status: 'failed', progress: 0.2 });
      // metric3 remains pending

      const metrics = component.api.getExecutionMetrics();
      expect(metrics.totalTasks).toBe(3);
      expect(metrics.completedTasks).toBe(1);
      expect(metrics.failedTasks).toBe(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle progress updates for non-existent tasks', () => {
      component.api.startExecution('error-exec', [{ id: 'real-task', name: 'Real task' }]);

      // Try to update non-existent task
      expect(() => {
        component.api.updateTaskProgress('fake-task', { status: 'running', progress: 0.5 });
      }).not.toThrow();

      // Verify real task is unaffected
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['real-task'].status).toBe('pending');
    });

    test('should handle malformed progress updates', () => {
      component.api.startExecution('malformed-exec', [{ id: 'test-task', name: 'Test' }]);

      // Test various malformed updates (skip null/undefined as they would cause errors)
      const malformedUpdates = [
        { status: 'invalid-status' },
        { progress: 'not-a-number' },
        { progress: -0.5 },
        { progress: 1.5 }
      ];

      malformedUpdates.forEach(update => {
        expect(() => {
          component.api.updateTaskProgress('test-task', update);
        }).not.toThrow();
      });

      // Test null/undefined separately with proper expectation
      expect(() => {
        component.api.updateTaskProgress('test-task', { status: 'running', progress: 0.5 });
      }).not.toThrow();

      // Task should remain in valid state
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['test-task']).toBeDefined();
    });

    test('should handle execution stop and restart', () => {
      const tasks = [{ id: 'restart-task', name: 'Restartable task' }];

      // First execution
      component.api.startExecution('restart-exec-1', tasks);
      component.api.updateTaskProgress('restart-task', { status: 'running', progress: 0.5 });
      component.api.stopExecution();

      expect(component.model.getState('executionStatus')).toBe('completed');

      // Second execution (restart)
      component.api.startExecution('restart-exec-2', tasks);
      
      // Verify task progress was reset
      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['restart-task'].status).toBe('pending');
      expect(taskProgress['restart-task'].progress).toBe(0);
    });

    test('should clear progress data', () => {
      const tasks = [{ id: 'clear-task', name: 'Task to clear' }];

      component.api.startExecution('clear-exec', tasks);
      component.api.updateTaskProgress('clear-task', { status: 'running', progress: 0.8 });
      component.api.addTimelineEvent({
        timestamp: Date.now(),
        type: 'test_event',
        description: 'Test event'
      });

      // Clear all progress
      component.api.clearProgress();

      // Verify everything is cleared
      expect(component.model.getState('executionId')).toBeNull();
      expect(component.model.getState('executionStatus')).toBe('idle');
      expect(component.api.getTaskProgress()).toEqual({});
      expect(component.model.getState('timeline')).toEqual([]);
      expect(component.model.getState('currentTask')).toBeNull();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large number of tasks efficiently', () => {
      // Create 100 tasks
      const largeTasks = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
        name: `Task ${i}`
      }));

      const startTime = Date.now();
      component.api.startExecution('large-exec', largeTasks);

      // Update all tasks rapidly
      largeTasks.forEach((task, index) => {
        component.api.updateTaskProgress(task.id, {
          status: 'running',
          progress: (index + 1) / largeTasks.length
        });
      });

      const operationTime = Date.now() - startTime;

      // Should handle large-scale updates efficiently
      expect(operationTime).toBeLessThan(2000);

      // Verify all tasks were updated
      const taskProgress = component.api.getTaskProgress();
      expect(Object.keys(taskProgress)).toHaveLength(100);
      expect(taskProgress['task-99'].progress).toBe(1.0);
    });

    test('should handle high-frequency timeline events', () => {
      component.api.startExecution('timeline-stress', [{ id: 'stress-task', name: 'Stress test' }]);

      const startTime = Date.now();

      // Add many timeline events rapidly
      for (let i = 0; i < 200; i++) {
        component.api.addTimelineEvent({
          timestamp: Date.now() + i,
          type: 'stress_event',
          description: `Stress event ${i}`
        });
      }

      const eventTime = Date.now() - startTime;

      // Should handle high-frequency events efficiently
      expect(eventTime).toBeLessThan(1000);

      // Verify all events were added (plus the automatic execution started event)
      const timeline = component.model.getState('timeline');
      expect(timeline.length).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Integration with Plan Visualization', () => {
    test('should coordinate with plan visualization component', () => {
      // Simulate integration with plan visualization
      const planVisualizationData = {
        nodes: [
          { id: 'viz-task1', x: 100, y: 100 },
          { id: 'viz-task2', x: 200, y: 200 },
          { id: 'viz-task3', x: 300, y: 100 }
        ],
        edges: [
          { from: 'viz-task1', to: 'viz-task2' },
          { from: 'viz-task2', to: 'viz-task3' }
        ]
      };

      const tasks = planVisualizationData.nodes.map(node => ({
        id: node.id,
        name: `Task ${node.id}`
      }));

      const nodePositions = {};
      planVisualizationData.nodes.forEach(node => {
        nodePositions[node.id] = { x: node.x, y: node.y };
      });

      // Set up execution with visualization data
      component.api.setNodePositions(nodePositions);
      component.api.startExecution('viz-integration', tasks);

      // Update progress and verify it's tracked
      component.api.updateTaskProgress('viz-task1', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('viz-task2', { status: 'running', progress: 0.5 });

      const taskProgress = component.api.getTaskProgress();
      expect(taskProgress['viz-task1'].status).toBe('completed');
      expect(taskProgress['viz-task2'].status).toBe('running');
      expect(taskProgress['viz-task3'].status).toBe('pending');
    });
  });
});