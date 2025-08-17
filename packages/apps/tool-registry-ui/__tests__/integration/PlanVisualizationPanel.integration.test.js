/**
 * PlanVisualizationPanel Integration Tests
 * Tests plan display, interaction, and progress tracking integration
 */

import { jest } from '@jest/globals';
import { PlanVisualizationPanel } from '../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js';

describe('PlanVisualizationPanel Integration Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '800px';
    dom.style.height = '600px';
    document.body.appendChild(dom);

    // Create mock umbilical with visualization event handlers
    mockUmbilical = {
      dom,
      onMount: jest.fn(),
      onNodeSelect: jest.fn(),
      onNodeHover: jest.fn(),
      onViewModeChange: jest.fn(),
      onZoomChange: jest.fn(),
      onProgressUpdate: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await PlanVisualizationPanel.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.api.destroy) {
      component.api.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Plan Display Integration', () => {
    test('should load and visualize hierarchical plan from planning system', () => {
      const complexPlan = {
        id: 'ecommerce-plan',
        name: 'Build E-commerce Platform',
        goal: 'Create a full-featured e-commerce platform',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build E-commerce Platform',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'backend',
                description: 'Backend Services',
                complexity: 'COMPLEX',
                children: [
                  {
                    id: 'api',
                    description: 'REST API Development',
                    complexity: 'SIMPLE',
                    children: []
                  },
                  {
                    id: 'database',
                    description: 'Database Design',
                    complexity: 'SIMPLE',
                    children: []
                  }
                ]
              },
              {
                id: 'frontend',
                description: 'Frontend Application',
                complexity: 'COMPLEX',
                children: [
                  {
                    id: 'components',
                    description: 'React Components',
                    complexity: 'SIMPLE',
                    children: []
                  },
                  {
                    id: 'routing',
                    description: 'Navigation Setup',
                    complexity: 'SIMPLE',
                    children: []
                  }
                ]
              },
              {
                id: 'deployment',
                description: 'Deployment Setup',
                complexity: 'SIMPLE',
                children: []
              }
            ]
          }
        },
        metadata: {
          createdAt: new Date().toISOString(),
          estimatedDuration: '4 weeks'
        }
      };

      // Load the plan
      component.api.setPlan(complexPlan);

      // Verify plan is loaded
      const loadedPlan = component.api.getPlan();
      expect(loadedPlan).toEqual(complexPlan);

      // Verify node count calculation
      const nodeCount = component.model.getState('nodeCount');
      expect(nodeCount).toBe(8); // root + 3 level1 + 4 level2 = 8 total

      // Check if virtualization is enabled for large plans
      const virtualizationEnabled = component.api.isVirtualizationEnabled();
      expect(virtualizationEnabled).toBe(false); // 8 nodes < 100 threshold
    });

    test('should support multiple visualization modes', () => {
      const simplePlan = {
        id: 'simple-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Simple Project',
            complexity: 'COMPLEX',
            children: [
              { id: 'task1', description: 'Task 1', complexity: 'SIMPLE', children: [] },
              { id: 'task2', description: 'Task 2', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      };

      component.api.api.setPlan(simplePlan);

      // Test different view modes
      const availableLayouts = component.api.api.getAvailableLayouts();
      expect(availableLayouts).toContain('hierarchical');

      // Set hierarchical view
      component.api.api.setViewMode('hierarchical');
      expect(component.api.api.getViewMode()).toBe('hierarchical');

      // Set graph view
      component.api.api.setViewMode('graph');
      expect(component.api.api.getViewMode()).toBe('graph');

      // Set tree view
      component.api.api.setViewMode('tree');
      expect(component.api.api.getViewMode()).toBe('tree');

      // Set radial view
      component.api.api.setViewMode('radial');
      expect(component.api.api.getViewMode()).toBe('radial');

      // Verify callbacks
      expect(mockUmbilical.onViewModeChange).toHaveBeenCalledTimes(4);
    });

    test('should handle dynamic plan updates from streaming decomposition', () => {
      // Start with partial plan
      const initialPlan = {
        id: 'streaming-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Growing Project',
            complexity: 'COMPLEX',
            children: []
          }
        }
      };

      component.api.setPlan(initialPlan);
      expect(component.api.model.getState('nodeCount')).toBe(1);

      // Add first level nodes
      const expandedPlan = {
        id: 'streaming-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Growing Project',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'module1',
                description: 'Module 1',
                complexity: 'COMPLEX',
                children: []
              },
              {
                id: 'module2',
                description: 'Module 2',
                complexity: 'COMPLEX',
                children: []
              }
            ]
          }
        }
      };

      component.api.setPlan(expandedPlan);
      expect(component.api.model.getState('nodeCount')).toBe(3);

      // Add deeper levels
      const fullyExpandedPlan = {
        id: 'streaming-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Growing Project',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'module1',
                description: 'Module 1',
                complexity: 'COMPLEX',
                children: [
                  { id: 'task1', description: 'Task 1', complexity: 'SIMPLE', children: [] },
                  { id: 'task2', description: 'Task 2', complexity: 'SIMPLE', children: [] }
                ]
              },
              {
                id: 'module2',
                description: 'Module 2',
                complexity: 'COMPLEX',
                children: [
                  { id: 'task3', description: 'Task 3', complexity: 'SIMPLE', children: [] }
                ]
              }
            ]
          }
        }
      };

      component.api.setPlan(fullyExpandedPlan);
      expect(component.api.model.getState('nodeCount')).toBe(6);
    });
  });

  describe('Interactive Features Integration', () => {
    test('should handle node selection and notify umbilical', () => {
      const testPlan = {
        id: 'interactive-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Interactive Test',
            complexity: 'COMPLEX',
            children: [
              { id: 'node1', description: 'Node 1', complexity: 'SIMPLE', children: [] },
              { id: 'node2', description: 'Node 2', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      };

      component.api.setPlan(testPlan);

      // Select nodes
      component.api.selectNode('node1');
      expect(mockUmbilical.onNodeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'node1', description: 'Node 1' })
      );

      component.api.selectNode('node2');
      expect(mockUmbilical.onNodeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'node2', description: 'Node 2' })
      );

      expect(mockUmbilical.onNodeSelect).toHaveBeenCalledTimes(2);
    });

    test('should support zoom and pan operations', () => {
      const plan = {
        id: 'zoom-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Zoom Test',
            complexity: 'SIMPLE',
            children: []
          }
        }
      };

      component.api.setPlan(plan);

      // Test zoom operations
      expect(component.api.getZoomLevel()).toBe(1);

      component.api.setZoomLevel(1.5);
      expect(component.api.getZoomLevel()).toBe(1.5);
      expect(mockUmbilical.onZoomChange).toHaveBeenCalledWith(1.5);

      component.api.setZoomLevel(0.5);
      expect(component.api.getZoomLevel()).toBe(0.5);

      // Test pan operations
      const initialPan = component.api.getPanPosition();
      expect(initialPan).toEqual({ x: 0, y: 0 });

      // Test fit to view
      component.api.fitToView();
      // Note: Actual implementation would calculate optimal zoom/pan
    });

    test('should support compact mode toggle', () => {
      const plan = {
        id: 'compact-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Compact Test',
            complexity: 'COMPLEX',
            children: [
              { id: 'child1', description: 'Child 1', complexity: 'SIMPLE', children: [] },
              { id: 'child2', description: 'Child 2', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      };

      component.api.setPlan(plan);

      // Toggle compact mode
      expect(component.api.isCompactMode()).toBe(false);

      component.api.setCompactMode(true);
      expect(component.api.isCompactMode()).toBe(true);

      component.api.setCompactMode(false);
      expect(component.api.isCompactMode()).toBe(false);
    });
  });

  describe('Progress Tracking Integration', () => {
    test('should track and visualize execution progress', () => {
      const executionPlan = {
        id: 'execution-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Execution Test',
            complexity: 'COMPLEX',
            children: [
              { id: 'step1', description: 'Step 1', complexity: 'SIMPLE', children: [] },
              { id: 'step2', description: 'Step 2', complexity: 'SIMPLE', children: [] },
              { id: 'step3', description: 'Step 3', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      };

      component.api.setPlan(executionPlan);

      // Set node weights for progress calculation
      component.api.setNodeWeight('step1', 0.3);
      component.api.setNodeWeight('step2', 0.5);
      component.api.setNodeWeight('step3', 0.2);

      // Start execution tracking
      component.api.showProgressBar(true);
      component.api.setProgressMode('determinate');

      // Simulate step execution
      component.api.startNodeExecution('step1');
      component.api.updateNodeStatus('step1', 'running');

      expect(component.api.getNodeStatus('step1')).toBe('running');

      // Complete step 1
      component.api.endNodeExecution('step1');
      component.api.updateNodeStatus('step1', 'completed');

      expect(component.api.getNodeStatus('step1')).toBe('completed');

      // Start step 2
      component.api.startNodeExecution('step2');
      component.api.updateNodeStatus('step2', 'running');

      // Get overall progress
      const progress = component.api.getOverallProgress();
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(1);

      // Get weighted progress
      const weightedProgress = component.api.getWeightedProgress();
      expect(weightedProgress).toBeGreaterThan(0.3); // Step 1 completed (30%)

      // Complete all steps
      component.api.endNodeExecution('step2');
      component.api.updateNodeStatus('step2', 'completed');
      component.api.startNodeExecution('step3');
      component.api.endNodeExecution('step3');
      component.api.updateNodeStatus('step3', 'completed');

      const finalProgress = component.api.getOverallProgress();
      expect(finalProgress).toBe(1);
    });

    test('should handle progress updates and status messages', () => {
      const plan = {
        id: 'progress-test',
        hierarchy: {
          root: { id: 'root', description: 'Progress Test', complexity: 'SIMPLE', children: [] }
        }
      };

      component.api.setPlan(plan);

      // Test progress bar visibility
      component.api.showProgressBar(true);
      expect(component.api.model.getState('progressBarVisible')).toBe(true);

      // Set progress value
      component.api.setProgress(0.75);
      expect(component.api.model.getState('progressValue')).toBe(0.75);

      // Set status message
      component.api.setStatusMessage('Processing step 3 of 4...');
      expect(component.api.model.getState('statusMessage')).toBe('Processing step 3 of 4...');

      // Clear status message
      component.api.clearStatusMessage();
      expect(component.api.model.getState('statusMessage')).toBe('');

      // Test indeterminate mode
      component.api.setProgressMode('indeterminate');
      expect(component.api.model.getState('progressMode')).toBe('indeterminate');
    });

    test('should calculate node execution times', () => {
      const plan = {
        id: 'timing-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Timing Test',
            complexity: 'COMPLEX',
            children: [
              { id: 'task1', description: 'Task 1', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      };

      component.api.setPlan(plan);

      // Start and end execution with delay
      component.api.startNodeExecution('task1');
      
      // Simulate time passing
      setTimeout(() => {
        component.api.endNodeExecution('task1');
        
        const executionTime = component.api.getNodeExecutionTime('task1');
        expect(executionTime).toBeGreaterThan(0);
      }, 10);
    });

    test('should provide progress summary with status breakdown', () => {
      const plan = {
        id: 'summary-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Summary Test',
            complexity: 'COMPLEX',
            children: [
              { id: 'task1', description: 'Task 1', complexity: 'SIMPLE', children: [] },
              { id: 'task2', description: 'Task 2', complexity: 'SIMPLE', children: [] },
              { id: 'task3', description: 'Task 3', complexity: 'SIMPLE', children: [] },
              { id: 'task4', description: 'Task 4', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      };

      component.api.setPlan(plan);

      // Set various node statuses
      component.api.updateNodeStatus('task1', 'completed');
      component.api.updateNodeStatus('task2', 'running');
      component.api.updateNodeStatus('task3', 'failed');
      // task4 remains 'pending'

      const summary = component.api.getProgressSummary();
      expect(summary.completed).toBe(1);
      expect(summary.running).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.pending).toBe(2); // root + task4
    });
  });

  describe('Export and Serialization', () => {
    test('should export visualization as SVG', () => {
      const plan = {
        id: 'export-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Export Test',
            complexity: 'SIMPLE',
            children: []
          }
        }
      };

      component.api.setPlan(plan);

      const svgData = component.api.exportAsSVG();
      expect(svgData).toContain('<svg');
      expect(svgData).toContain('</svg>');
    });

    test('should export visualization as PNG', async () => {
      const plan = {
        id: 'png-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'PNG Test',
            complexity: 'SIMPLE',
            children: []
          }
        }
      };

      component.api.setPlan(plan);

      // Mock canvas context since it's not available in test environment
      const mockCanvas = {
        getContext: jest.fn(() => ({
          drawImage: jest.fn(),
          getImageData: jest.fn()
        })),
        toDataURL: jest.fn(() => 'data:image/png;base64,mock-png-data')
      };
      
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return mockCanvas;
        }
        return document.createElement(tagName);
      });

      const pngData = await component.api.exportAsPNG();
      expect(pngData).toBeDefined();
      
      // Restore mock
      document.createElement.mockRestore();
    });

    test('should export plan data as JSON', () => {
      const plan = {
        id: 'json-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'JSON Test',
            complexity: 'SIMPLE',
            children: []
          }
        }
      };

      component.api.setPlan(plan);

      const jsonData = component.api.exportAsJSON();
      expect(jsonData).toEqual(plan);
    });

    test('should preserve node positions for export', () => {
      const plan = {
        id: 'position-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Position Test',
            complexity: 'COMPLEX',
            children: [
              { id: 'child1', description: 'Child 1', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      };

      component.api.setPlan(plan);

      // Allow layout calculation
      setTimeout(() => {
        const positions = component.api.getNodePositions();
        expect(positions).toHaveProperty('root');
        expect(positions).toHaveProperty('child1');
        expect(positions.root).toHaveProperty('x');
        expect(positions.root).toHaveProperty('y');
      }, 100);
    });
  });

  describe('Performance and Scalability', () => {
    test('should enable virtualization for large plans', () => {
      // Create a large plan with > 100 nodes
      const createLargePlan = (depth, breadth) => {
        const createNode = (id, level) => {
          const node = {
            id: `node-${id}`,
            description: `Node ${id}`,
            complexity: level % 2 === 0 ? 'COMPLEX' : 'SIMPLE',
            children: []
          };

          if (level < depth) {
            for (let i = 0; i < breadth; i++) {
              node.children.push(createNode(`${id}-${i}`, level + 1));
            }
          }

          return node;
        };

        return {
          id: 'large-plan',
          hierarchy: {
            root: createNode('root', 0)
          }
        };
      };

      const largePlan = createLargePlan(4, 3); // Should create 121 nodes

      const startTime = Date.now();
      component.api.setPlan(largePlan);
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time
      expect(loadTime).toBeLessThan(1000);

      // Should enable virtualization
      expect(component.api.isVirtualizationEnabled()).toBe(true);
      expect(component.api.model.getState('nodeCount')).toBeGreaterThan(100);
    });

    test('should handle rapid zoom and pan operations efficiently', () => {
      const plan = {
        id: 'performance-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Performance Test',
            complexity: 'COMPLEX',
            children: Array.from({ length: 20 }, (_, i) => ({
              id: `node-${i}`,
              description: `Node ${i}`,
              complexity: 'SIMPLE',
              children: []
            }))
          }
        }
      };

      component.api.setPlan(plan);

      const startTime = Date.now();

      // Rapid zoom operations
      for (let i = 0; i < 50; i++) {
        component.api.setZoomLevel(0.5 + (i % 10) * 0.1);
      }

      const operationTime = Date.now() - startTime;
      expect(operationTime).toBeLessThan(500);

      // Verify final zoom level
      expect(component.api.getZoomLevel()).toBeCloseTo(0.9); // Last zoom value
    });

    test('should handle animation settings for performance', () => {
      const plan = {
        id: 'animation-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Animation Test',
            complexity: 'SIMPLE',
            children: []
          }
        }
      };

      component.api.setPlan(plan);

      // Test animation enable/disable
      component.api.setAnimationEnabled(false);
      expect(component.api.model.getState('animationEnabled')).toBe(false);

      component.api.setAnimationEnabled(true);
      expect(component.api.model.getState('animationEnabled')).toBe(true);

      // Test node animations
      component.api.showNodeAnimation('root', 'pulse');
      const animations = component.api.model.getState('nodeAnimations');
      expect(animations.root).toBe('pulse');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty or null plans gracefully', () => {
      // Test with null plan
      component.api.setPlan(null);
      expect(component.api.getPlan()).toBeNull();
      expect(component.api.model.getState('nodeCount')).toBe(0);

      // Test with empty plan
      component.api.setPlan({});
      expect(component.api.model.getState('nodeCount')).toBe(0);

      // Test with plan without hierarchy
      component.api.setPlan({ id: 'no-hierarchy' });
      expect(component.api.model.getState('nodeCount')).toBe(0);
    });

    test('should handle malformed plan structures', () => {
      const malformedPlan = {
        id: 'malformed',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root',
            children: [
              { description: 'No ID', complexity: 'SIMPLE', children: [] },
              { id: 'no-desc', complexity: 'SIMPLE', children: [] },
              null,
              undefined
            ]
          }
        }
      };

      // Should not throw
      expect(() => {
        component.api.setPlan(malformedPlan);
      }).not.toThrow();

      // Should still count valid nodes
      expect(component.api.model.getState('nodeCount')).toBeGreaterThan(0);
    });

    test('should handle operations on non-existent nodes', () => {
      const plan = {
        id: 'test-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Test',
            complexity: 'SIMPLE',
            children: []
          }
        }
      };

      component.api.setPlan(plan);

      // Operations on non-existent nodes should not crash
      component.api.selectNode('non-existent');
      component.api.updateNodeStatus('non-existent', 'completed');
      component.api.startNodeExecution('non-existent');
      component.api.endNodeExecution('non-existent');

      // Should still work for valid nodes
      component.api.selectNode('root');
      expect(mockUmbilical.onNodeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'root' })
      );
    });

    test('should handle invalid zoom and pan values', () => {
      const plan = {
        id: 'bounds-test',
        hierarchy: {
          root: { id: 'root', description: 'Test', complexity: 'SIMPLE', children: [] }
        }
      };

      component.api.setPlan(plan);

      // Test boundary values
      component.api.setZoomLevel(-1); // Negative zoom
      expect(component.api.getZoomLevel()).toBeGreaterThan(0);

      component.api.setZoomLevel(0); // Zero zoom
      expect(component.api.getZoomLevel()).toBeGreaterThan(0);

      component.api.setZoomLevel(Infinity); // Infinite zoom
      expect(component.api.getZoomLevel()).toBeLessThan(Infinity);

      component.api.setZoomLevel(NaN); // NaN zoom
      expect(component.api.getZoomLevel()).not.toBeNaN();
    });
  });

  describe('Layout and Positioning', () => {
    test('should calculate appropriate layouts for different view modes', () => {
      const hierarchicalPlan = {
        id: 'layout-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Layout Test',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'branch1',
                description: 'Branch 1',
                complexity: 'COMPLEX',
                children: [
                  { id: 'leaf1', description: 'Leaf 1', complexity: 'SIMPLE', children: [] },
                  { id: 'leaf2', description: 'Leaf 2', complexity: 'SIMPLE', children: [] }
                ]
              },
              {
                id: 'branch2',
                description: 'Branch 2',
                complexity: 'SIMPLE',
                children: []
              }
            ]
          }
        }
      };

      component.api.setPlan(hierarchicalPlan);

      // Test different layouts
      component.api.setLayout({ type: 'hierarchical', direction: 'top-down' });
      expect(component.api.getLayout().type).toBe('hierarchical');

      component.api.setLayout({ type: 'tree', orientation: 'vertical' });
      expect(component.api.getLayout().type).toBe('tree');

      component.api.setLayout({ type: 'radial', center: 'root' });
      expect(component.api.getLayout().type).toBe('radial');

      // Verify positions are calculated
      setTimeout(() => {
        const positions = component.api.getNodePositions();
        expect(Object.keys(positions).length).toBe(5); // All nodes have positions
      }, 100);
    });
  });
});