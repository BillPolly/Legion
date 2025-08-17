/**
 * ProgressOverlayPanel Component Tests
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ProgressOverlayPanel } from '../../src/components/tool-registry/components/panels/ProgressOverlayPanel.js';

describe('ProgressOverlayPanel', () => {
  let dom, container, mockUmbilical, component;

  beforeEach(() => {
    // Create DOM environment
    dom = new JSDOM(`<!DOCTYPE html><div id="container"></div>`);
    global.document = dom.window.document;
    global.window = dom.window;
    global.URL = {
      createObjectURL: jest.fn(() => 'mock-url'),
      revokeObjectURL: jest.fn()
    };
    global.Blob = jest.fn();
    
    container = dom.window.document.getElementById('container');

    // Mock umbilical
    mockUmbilical = {
      dom: container,
      onMount: jest.fn(),
      onExecutionStart: jest.fn(),
      onExecutionComplete: jest.fn(),
      onTaskProgress: jest.fn(),
      onProgressCleared: jest.fn()
    };
  });

  afterEach(() => {
    if (component) {
      component.destroy();
    }
  });

  test('should create component with required capabilities', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    expect(component).toBeDefined();
    expect(mockUmbilical.onMount).toHaveBeenCalledWith(expect.objectContaining({
      startExecution: expect.any(Function),
      stopExecution: expect.any(Function),
      updateTaskProgress: expect.any(Function),
      clearProgress: expect.any(Function)
    }));
  });

  test('should render progress overlay interface', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    expect(container.querySelector('.progress-overlay-panel')).toBeTruthy();
    expect(container.querySelector('.progress-overlay-canvas')).toBeTruthy();
    expect(container.querySelector('.progress-controls')).toBeTruthy();
    expect(container.querySelector('.metrics-panel')).toBeTruthy();
    expect(container.querySelector('.timeline-panel')).toBeTruthy();
  });

  test('should handle execution start', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const tasks = [
      { id: 'task1', name: 'First Task' },
      { id: 'task2', name: 'Second Task' }
    ];
    
    component.api.startExecution('exec-123', tasks);
    
    expect(mockUmbilical.onExecutionStart).toHaveBeenCalledWith('exec-123');
    
    const taskProgress = component.api.getTaskProgress();
    expect(taskProgress['task1']).toEqual({
      status: 'pending',
      progress: 0,
      startTime: null,
      endTime: null,
      error: null
    });
    expect(taskProgress['task2']).toEqual({
      status: 'pending',
      progress: 0,
      startTime: null,
      endTime: null,
      error: null
    });
  });

  test('should handle execution stop', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    component.api.startExecution('exec-123', []);
    component.api.stopExecution();
    
    expect(mockUmbilical.onExecutionComplete).toHaveBeenCalledWith('exec-123');
  });

  test('should update task progress', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const tasks = [{ id: 'task1', name: 'Test Task' }];
    component.api.startExecution('exec-123', tasks);
    
    const progress = {
      status: 'running',
      progress: 50,
      startTime: new Date().toISOString()
    };
    
    component.api.updateTaskProgress('task1', progress);
    
    expect(mockUmbilical.onTaskProgress).toHaveBeenCalledWith('task1', progress);
    
    const taskProgress = component.api.getTaskProgress();
    expect(taskProgress['task1'].status).toBe('running');
    expect(taskProgress['task1'].progress).toBe(50);
  });

  test('should update metrics when tasks progress', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const tasks = [
      { id: 'task1' },
      { id: 'task2' },
      { id: 'task3' }
    ];
    
    component.api.startExecution('exec-123', tasks);
    
    // Complete first task
    component.api.updateTaskProgress('task1', {
      status: 'completed',
      progress: 100,
      startTime: new Date(Date.now() - 5000).toISOString(),
      endTime: new Date().toISOString()
    });
    
    // Fail second task
    component.api.updateTaskProgress('task2', {
      status: 'failed',
      progress: 30,
      error: 'Task failed'
    });
    
    const metrics = component.api.getExecutionMetrics();
    expect(metrics.totalTasks).toBe(3);
    expect(metrics.completedTasks).toBe(1);
    expect(metrics.failedTasks).toBe(1);
    expect(metrics.avgTaskDuration).toBeGreaterThan(0);
  });

  test('should handle timeline events', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    component.api.addTimelineEvent({
      type: 'execution',
      message: 'Test event'
    });
    
    // Check that timeline was updated in DOM
    const timelineEvents = container.querySelector('.timeline-events');
    expect(timelineEvents.innerHTML).toContain('Test event');
  });

  test('should handle overlay setting changes', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    // Test show progress toggle
    const showProgressToggle = container.querySelector('.show-progress-toggle');
    showProgressToggle.checked = false;
    showProgressToggle.dispatchEvent(new dom.window.Event('change'));
    
    // Test show timeline toggle
    const showTimelineToggle = container.querySelector('.show-timeline-toggle');
    showTimelineToggle.checked = false;
    showTimelineToggle.dispatchEvent(new dom.window.Event('change'));
    
    const timelinePanel = container.querySelector('.timeline-panel');
    expect(timelinePanel.style.display).toBe('none');
    
    // Test show metrics toggle
    const showMetricsToggle = container.querySelector('.show-metrics-toggle');
    showMetricsToggle.checked = false;
    showMetricsToggle.dispatchEvent(new dom.window.Event('change'));
    
    const metricsPanel = container.querySelector('.metrics-panel');
    expect(metricsPanel.style.display).toBe('none');
  });

  test('should clear progress', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    // Set up some progress
    component.api.startExecution('exec-123', [{ id: 'task1' }]);
    component.api.updateTaskProgress('task1', { status: 'running', progress: 50 });
    
    // Clear progress
    const clearButton = container.querySelector('.clear-progress-button');
    clearButton.click();
    
    expect(mockUmbilical.onProgressCleared).toHaveBeenCalled();
    
    const taskProgress = component.api.getTaskProgress();
    expect(Object.keys(taskProgress)).toHaveLength(0);
  });

  test('should export progress', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    // Mock createElement and click
    const mockLink = {
      click: jest.fn(),
      download: '',
      href: ''
    };
    global.document.createElement = jest.fn(() => mockLink);
    
    // Set up some progress data
    component.api.startExecution('exec-123', [{ id: 'task1' }]);
    component.api.updateTaskProgress('task1', { status: 'completed', progress: 100 });
    
    const exportButton = container.querySelector('.export-progress-button');
    exportButton.click();
    
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toContain('execution-progress-exec-123.json');
  });

  test('should handle current task updates', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const task = {
      id: 'task1',
      name: 'Current Task',
      status: 'running',
      progress: 75
    };
    
    component.api.setCurrentTask(task);
    
    const indicator = container.querySelector('.current-task-indicator');
    expect(indicator.style.display).toBe('block');
    expect(indicator.querySelector('.task-name').textContent).toBe('Current Task');
    expect(indicator.querySelector('.task-status').textContent).toBe('running');
  });

  test('should handle node positions for overlay rendering', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    // Mock the view update method to avoid SVG DOM issues in tests
    component.view.updateProgressOverlay = jest.fn();
    
    const nodePositions = {
      'task1': { x: 100, y: 200 },
      'task2': { x: 300, y: 400 }
    };
    
    const tasks = [
      { id: 'task1' },
      { id: 'task2' }
    ];
    
    component.api.startExecution('exec-123', tasks);
    component.api.setNodePositions(nodePositions);
    
    // Update task progress to trigger overlay rendering
    component.api.updateTaskProgress('task1', {
      status: 'running',
      progress: 50
    });
    
    // Check that setNodePositions was called and nodePositions are stored
    expect(component.nodePositions).toEqual(nodePositions);
    
    // Check that updateProgressOverlay was called
    expect(component.view.updateProgressOverlay).toHaveBeenCalled();
    
    // Check that progress indicators container exists
    const progressIndicators = container.querySelector('.progress-indicators');
    expect(progressIndicators).toBeTruthy();
  });

  test('should handle different task statuses', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const tasks = [{ id: 'task1' }];
    component.api.startExecution('exec-123', tasks);
    
    // Test different status transitions without SVG rendering
    component.api.updateTaskProgress('task1', { status: 'pending', progress: 0 });
    component.api.updateTaskProgress('task1', { status: 'running', progress: 50 });
    component.api.updateTaskProgress('task1', { status: 'paused', progress: 50 });
    component.api.updateTaskProgress('task1', { status: 'running', progress: 75 });
    component.api.updateTaskProgress('task1', { status: 'completed', progress: 100 });
    
    const taskProgress = component.api.getTaskProgress();
    expect(taskProgress['task1'].status).toBe('completed');
    expect(taskProgress['task1'].progress).toBe(100);
  });

  test('should handle failed task status', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const tasks = [{ id: 'task1' }];
    component.api.startExecution('exec-123', tasks);
    
    component.api.updateTaskProgress('task1', {
      status: 'failed',
      progress: 30,
      error: 'Task execution failed'
    });
    
    const taskProgress = component.api.getTaskProgress();
    expect(taskProgress['task1'].status).toBe('failed');
    expect(taskProgress['task1'].error).toBe('Task execution failed');
    
    const metrics = component.api.getExecutionMetrics();
    expect(metrics.failedTasks).toBe(1);
  });

  test('should calculate estimated completion time', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const tasks = [
      { id: 'task1' },
      { id: 'task2' },
      { id: 'task3' }
    ];
    
    component.api.startExecution('exec-123', tasks);
    
    // Complete first task with known duration
    const startTime = new Date(Date.now() - 10000); // 10 seconds ago
    const endTime = new Date();
    
    component.api.updateTaskProgress('task1', {
      status: 'completed',
      progress: 100,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
    
    const metrics = component.api.getExecutionMetrics();
    expect(metrics.avgTaskDuration).toBeGreaterThan(0);
    expect(metrics.estimatedCompletion).toBeTruthy();
  });

  test('should handle animation settings', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const animateToggle = container.querySelector('.animate-progress-toggle');
    animateToggle.checked = false;
    animateToggle.dispatchEvent(new dom.window.Event('change'));
    
    // Test that animation setting is updated
    component.api.updateOverlaySetting('animateProgress', false);
    
    expect(component.model.getState('overlaySettings').animateProgress).toBe(false);
  });

  test('should validate required DOM capabilities', async () => {
    const invalidUmbilical = {
      // Missing dom capability
      onMount: jest.fn()
    };
    
    await expect(ProgressOverlayPanel.create(invalidUmbilical))
      .rejects.toThrow();
  });

  test('should handle component destruction', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    mockUmbilical.onDestroy = jest.fn();
    
    component.destroy();
    
    expect(mockUmbilical.onDestroy).toHaveBeenCalled();
    expect(container.innerHTML).toBe('');
  });

  test('should update progress bar display', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    const tasks = [
      { id: 'task1' },
      { id: 'task2' }
    ];
    
    component.api.startExecution('exec-123', tasks);
    
    // Complete one task
    component.api.updateTaskProgress('task1', {
      status: 'completed',
      progress: 100
    });
    
    // Force metrics update and DOM update
    const metrics = component.api.getExecutionMetrics();
    expect(metrics.totalTasks).toBe(2);
    expect(metrics.completedTasks).toBe(1);
    
    // Manually trigger view update
    component.view.updateMetrics(metrics);
    
    // Check progress bar shows 50%
    const progressText = container.querySelector('.progress-text');
    expect(progressText.textContent).toBe('50%');
    
    const progressFill = container.querySelector('.progress-fill');
    expect(progressFill.style.width).toBe('50%');
  });

  test('should handle timeline event types', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    // Add different types of events
    component.api.addTimelineEvent({
      type: 'execution',
      message: 'Execution started'
    });
    
    component.api.addTimelineEvent({
      type: 'task',
      message: 'Task completed',
      taskId: 'task1'
    });
    
    component.api.addTimelineEvent({
      type: 'error',
      message: 'An error occurred'
    });
    
    const timelineEvents = container.querySelector('.timeline-events');
    expect(timelineEvents.children.length).toBe(3);
    expect(timelineEvents.innerHTML).toContain('Execution started');
    expect(timelineEvents.innerHTML).toContain('Task completed');
    expect(timelineEvents.innerHTML).toContain('An error occurred');
  });

  test('should limit timeline events display', async () => {
    component = await ProgressOverlayPanel.create(mockUmbilical);
    
    // Add more than 10 events
    for (let i = 0; i < 15; i++) {
      component.api.addTimelineEvent({
        type: 'test',
        message: `Event ${i}`
      });
    }
    
    const timelineEvents = container.querySelector('.timeline-events');
    // Should only show last 10 events
    expect(timelineEvents.children.length).toBe(10);
    expect(timelineEvents.innerHTML).toContain('Event 14');
    expect(timelineEvents.innerHTML).not.toContain('Event 4');
  });
});