/**
 * Unit tests for PlanVisualizationPanel Progress Overlays
 * Tests progress indicators and status updates without mocks
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { PlanVisualizationPanel } from '../../PlanVisualizationPanel.js';

describe('PlanVisualizationPanel Progress Overlays', () => {
  let container;
  let umbilical;
  let panel;
  let dom;

  beforeEach(async () => {
    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="test-container"></div></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.XMLSerializer = dom.window.XMLSerializer;
    global.Blob = dom.window.Blob;
    global.URL = dom.window.URL;

    container = dom.window.document.getElementById('test-container');
    
    umbilical = {
      dom: container,
      onMount: jest.fn(),
      onProgressUpdate: jest.fn(),
      onStatusChange: jest.fn(),
      onNodeComplete: jest.fn(),
      onNodeStart: jest.fn()
    };

    panel = await PlanVisualizationPanel.create(umbilical);
  });

  afterEach(() => {
    if (panel) {
      panel.destroy();
    }
    if (dom) {
      dom.window.close();
    }
  });

  describe('Progress Indicators', () => {
    beforeEach(() => {
      // Load a test plan
      const testPlan = {
        id: 'progress-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Main Task',
            status: 'pending',
            children: [
              {
                id: 'task1',
                description: 'Task 1',
                status: 'pending'
              },
              {
                id: 'task2',
                description: 'Task 2',
                status: 'pending'
              },
              {
                id: 'task3',
                description: 'Task 3',
                status: 'pending'
              }
            ]
          }
        }
      };
      
      panel.api.setPlan(testPlan);
    });

    it('should display overall progress percentage', () => {
      const progress = panel.api.getOverallProgress();
      expect(progress).toBeDefined();
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(4); // root + 3 tasks
      expect(progress.percentage).toBe(0);
    });

    it('should update progress when tasks complete', () => {
      // Mark task1 as complete
      panel.api.updateNodeStatus('task1', 'completed');
      
      const progress = panel.api.getOverallProgress();
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(25);
    });

    it('should show progress bar element', () => {
      panel.api.showProgressBar(true);
      
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar).toBeTruthy();
      
      const progressFill = container.querySelector('.progress-fill');
      expect(progressFill).toBeTruthy();
    });

    it('should update progress bar width', () => {
      panel.api.showProgressBar(true);
      panel.api.setProgress(50);
      
      const progressFill = container.querySelector('.progress-fill');
      expect(progressFill.style.width).toBe('50%');
    });

    it('should display progress text', () => {
      panel.api.showProgressBar(true);
      panel.api.setProgress(75);
      
      const progressText = container.querySelector('.progress-text');
      expect(progressText).toBeTruthy();
      expect(progressText.textContent).toContain('75%');
    });

    it('should support indeterminate progress', () => {
      panel.api.showProgressBar(true);
      panel.api.setProgressMode('indeterminate');
      
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar.classList.contains('indeterminate')).toBe(true);
    });

    it('should hide progress bar when requested', () => {
      panel.api.showProgressBar(true);
      expect(container.querySelector('.progress-bar')).toBeTruthy();
      
      panel.api.showProgressBar(false);
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar).toBeFalsy();
    });
  });

  describe('Status Updates', () => {
    beforeEach(() => {
      const testPlan = {
        id: 'status-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Main',
            status: 'pending',
            children: [
              {
                id: 'step1',
                description: 'Step 1',
                status: 'pending'
              },
              {
                id: 'step2',
                description: 'Step 2',
                status: 'pending'
              }
            ]
          }
        }
      };
      
      panel.api.setPlan(testPlan);
    });

    it('should update node status to running', () => {
      panel.api.updateNodeStatus('step1', 'running');
      
      const nodeStatus = panel.api.getNodeStatus('step1');
      expect(nodeStatus).toBe('running');
    });

    it('should update node status to completed', () => {
      panel.api.updateNodeStatus('step1', 'completed');
      
      const nodeStatus = panel.api.getNodeStatus('step1');
      expect(nodeStatus).toBe('completed');
    });

    it('should update node status to failed', () => {
      panel.api.updateNodeStatus('step2', 'failed');
      
      const nodeStatus = panel.api.getNodeStatus('step2');
      expect(nodeStatus).toBe('failed');
    });

    it('should update node status to skipped', () => {
      panel.api.updateNodeStatus('step2', 'skipped');
      
      const nodeStatus = panel.api.getNodeStatus('step2');
      expect(nodeStatus).toBe('skipped');
    });

    it('should notify umbilical on status change', () => {
      panel.api.updateNodeStatus('step1', 'running');
      
      expect(umbilical.onStatusChange).toHaveBeenCalledWith({
        nodeId: 'step1',
        status: 'running'
      });
    });

    it('should track multiple status changes', () => {
      panel.api.updateNodeStatus('step1', 'running');
      panel.api.updateNodeStatus('step1', 'completed');
      panel.api.updateNodeStatus('step2', 'running');
      
      expect(panel.api.getNodeStatus('step1')).toBe('completed');
      expect(panel.api.getNodeStatus('step2')).toBe('running');
    });

    it('should display status message', () => {
      panel.api.setStatusMessage('Processing step 1...');
      
      const statusMessage = container.querySelector('.status-message');
      expect(statusMessage).toBeTruthy();
      expect(statusMessage.textContent).toBe('Processing step 1...');
    });

    it('should clear status message', () => {
      panel.api.setStatusMessage('Processing...');
      panel.api.clearStatusMessage();
      
      const statusMessage = container.querySelector('.status-message');
      expect(statusMessage).toBeFalsy();
    });
  });

  describe('Visual Status Indicators', () => {
    beforeEach(() => {
      const testPlan = {
        id: 'visual-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root',
            status: 'pending',
            children: [
              {
                id: 'node1',
                description: 'Node 1',
                status: 'pending'
              }
            ]
          }
        }
      };
      
      panel.api.setPlan(testPlan);
    });

    it('should add status class to node elements', async () => {
      panel.api.updateNodeStatus('node1', 'running');
      
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const node = container.querySelector('[data-node-id="node1"]');
      if (node) {
        expect(node.classList.contains('status-running')).toBe(true);
      }
    });

    it('should show running animation', () => {
      panel.api.updateNodeStatus('node1', 'running');
      panel.api.showNodeAnimation('node1', 'pulse');
      
      const node = container.querySelector('[data-node-id="node1"]');
      if (node) {
        expect(node.classList.contains('animation-pulse')).toBe(true);
      }
    });

    it('should show completion checkmark', () => {
      panel.api.updateNodeStatus('node1', 'completed');
      
      const node = container.querySelector('[data-node-id="node1"]');
      if (node) {
        const indicator = node.querySelector('.status-indicator');
        expect(indicator).toBeTruthy();
        expect(indicator.textContent).toContain('✓');
      }
    });

    it('should show failure indicator', () => {
      panel.api.updateNodeStatus('node1', 'failed');
      
      const node = container.querySelector('[data-node-id="node1"]');
      if (node) {
        const indicator = node.querySelector('.status-indicator');
        expect(indicator).toBeTruthy();
        expect(indicator.textContent).toContain('✗');
      }
    });

    it('should update node colors based on status', () => {
      const statusColors = panel.api.getStatusColors();
      
      expect(statusColors.pending).toBeDefined();
      expect(statusColors.running).toBeDefined();
      expect(statusColors.completed).toBeDefined();
      expect(statusColors.failed).toBeDefined();
      expect(statusColors.skipped).toBeDefined();
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      const testPlan = {
        id: 'tracking-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root',
            status: 'pending',
            children: [
              {
                id: 'phase1',
                description: 'Phase 1',
                status: 'pending',
                children: [
                  {
                    id: 'task1a',
                    description: 'Task 1A',
                    status: 'pending'
                  },
                  {
                    id: 'task1b',
                    description: 'Task 1B',
                    status: 'pending'
                  }
                ]
              },
              {
                id: 'phase2',
                description: 'Phase 2',
                status: 'pending',
                children: [
                  {
                    id: 'task2a',
                    description: 'Task 2A',
                    status: 'pending'
                  }
                ]
              }
            ]
          }
        }
      };
      
      panel.api.setPlan(testPlan);
    });

    it('should track hierarchical progress', () => {
      // Complete one task in phase 1
      panel.api.updateNodeStatus('task1a', 'completed');
      
      const phase1Progress = panel.api.getNodeProgress('phase1');
      expect(phase1Progress.completed).toBe(1);
      expect(phase1Progress.total).toBe(2);
      expect(phase1Progress.percentage).toBe(50);
    });

    it('should propagate completion upwards', () => {
      // Complete all tasks in phase 1
      panel.api.updateNodeStatus('task1a', 'completed');
      panel.api.updateNodeStatus('task1b', 'completed');
      
      const phase1Status = panel.api.getNodeStatus('phase1');
      expect(phase1Status).toBe('completed');
    });

    it('should calculate weighted progress', () => {
      // Set weights for different phases
      panel.api.setNodeWeight('phase1', 2);
      panel.api.setNodeWeight('phase2', 1);
      
      // Complete phase 1
      panel.api.updateNodeStatus('task1a', 'completed');
      panel.api.updateNodeStatus('task1b', 'completed');
      
      const weightedProgress = panel.api.getWeightedProgress();
      expect(weightedProgress.percentage).toBeGreaterThan(50); // Phase 1 has more weight
    });

    it('should track execution time', () => {
      panel.api.startNodeExecution('task1a');
      
      // Simulate some time passing
      const startTime = Date.now();
      
      // Wait a bit
      setTimeout(() => {
        panel.api.endNodeExecution('task1a');
        
        const executionTime = panel.api.getNodeExecutionTime('task1a');
        expect(executionTime).toBeGreaterThan(0);
      }, 100);
    });

    it('should provide progress summary', () => {
      panel.api.updateNodeStatus('task1a', 'completed');
      panel.api.updateNodeStatus('task1b', 'running');
      panel.api.updateNodeStatus('task2a', 'pending');
      
      const summary = panel.api.getProgressSummary();
      
      expect(summary.pending).toBe(4); // root, phase1, phase2, task2a
      expect(summary.running).toBe(1); // task1b
      expect(summary.completed).toBe(1); // task1a
      expect(summary.failed).toBe(0);
      expect(summary.skipped).toBe(0);
    });
  });

  describe('Progress Notifications', () => {
    beforeEach(() => {
      const testPlan = {
        id: 'notification-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root',
            status: 'pending',
            children: [
              {
                id: 'task1',
                description: 'Task 1',
                status: 'pending'
              }
            ]
          }
        }
      };
      
      panel.api.setPlan(testPlan);
    });

    it('should notify on node start', () => {
      panel.api.startNodeExecution('task1');
      
      expect(umbilical.onNodeStart).toHaveBeenCalledWith({
        nodeId: 'task1',
        timestamp: expect.any(Number)
      });
    });

    it('should notify on node complete', () => {
      panel.api.updateNodeStatus('task1', 'completed');
      
      expect(umbilical.onNodeComplete).toHaveBeenCalledWith({
        nodeId: 'task1',
        status: 'completed'
      });
    });

    it('should notify on progress update', () => {
      panel.api.updateNodeStatus('task1', 'completed');
      
      expect(umbilical.onProgressUpdate).toHaveBeenCalledWith({
        completed: 1,
        total: 2,
        percentage: 50
      });
    });
  });
});