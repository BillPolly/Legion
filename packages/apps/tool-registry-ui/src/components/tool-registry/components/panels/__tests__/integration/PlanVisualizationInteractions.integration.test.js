/**
 * Integration tests for PlanVisualizationPanel Interactive Controls
 * Tests real user interactions with actual DOM and event propagation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { PlanVisualizationPanel } from '../../PlanVisualizationPanel.js';
import { GoalInputInterface } from '../../GoalInputInterface.js';

describe('PlanVisualizationPanel Interactive Controls Integration', () => {
  let container;
  let goalInput;
  let planViz;
  let dom;
  let umbilical;

  beforeEach(async () => {
    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="test-container"></div></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.XMLSerializer = dom.window.XMLSerializer;
    global.Blob = dom.window.Blob;
    global.URL = dom.window.URL;
    global.Image = dom.window.Image;

    container = dom.window.document.getElementById('test-container');
    
    // Create goal input interface
    const goalContainer = dom.window.document.createElement('div');
    container.appendChild(goalContainer);
    
    const goalUmbilical = {
      dom: goalContainer,
      onSubmit: jest.fn()
    };
    
    goalInput = await GoalInputInterface.create(goalUmbilical);
    
    // Create plan visualization panel
    const vizContainer = dom.window.document.createElement('div');
    container.appendChild(vizContainer);
    
    umbilical = {
      dom: vizContainer,
      onMount: jest.fn(),
      onZoomChange: jest.fn(),
      onPanChange: jest.fn(),
      onNodeSelect: jest.fn(),
      onNodeClick: jest.fn(),
      onNodeHover: jest.fn(),
      onViewChange: jest.fn(),
      onLayoutChange: jest.fn()
    };
    
    planViz = await PlanVisualizationPanel.create(umbilical);
  });

  afterEach(() => {
    if (planViz) {
      planViz.destroy();
    }
    if (goalInput) {
      goalInput.destroy();
    }
    if (dom) {
      dom.window.close();
    }
  });

  describe('Goal to Visualization Flow', () => {
    it('should display plan after goal submission', async () => {
      // Set a goal
      goalInput.setGoal('Build a REST API with user authentication');
      
      // Create mock plan data
      const mockPlan = {
        id: 'plan-1',
        goal: 'Build a REST API with user authentication',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build REST API',
            complexity: 'HIGH',
            children: [
              {
                id: 'auth',
                description: 'Setup Authentication',
                complexity: 'MEDIUM',
                children: [
                  {
                    id: 'jwt',
                    description: 'Implement JWT tokens',
                    complexity: 'LOW'
                  },
                  {
                    id: 'login',
                    description: 'Create login endpoint',
                    complexity: 'LOW'
                  }
                ]
              },
              {
                id: 'api',
                description: 'Build API endpoints',
                complexity: 'MEDIUM',
                children: [
                  {
                    id: 'crud',
                    description: 'CRUD operations',
                    complexity: 'LOW'
                  }
                ]
              }
            ]
          }
        }
      };
      
      // Set the plan in visualization
      planViz.setPlan(mockPlan);
      
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify plan is displayed
      const svg = vizContainer.querySelector('svg');
      expect(svg).toBeTruthy();
      
      const nodes = svg.querySelectorAll('[data-node-id]');
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe('User Interaction Workflow', () => {
    beforeEach(async () => {
      // Load a test plan
      const testPlan = {
        id: 'test-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Main Task',
            children: [
              {
                id: 'task1',
                description: 'Sub Task 1',
                children: []
              },
              {
                id: 'task2',
                description: 'Sub Task 2',
                children: []
              }
            ]
          }
        }
      };
      
      planViz.setPlan(testPlan);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should handle complete zoom workflow', async () => {
      const vizContainer = umbilical.dom;
      
      // Initial zoom level
      expect(planViz.getZoomLevel()).toBe(1);
      
      // Click zoom in button
      const zoomInBtn = vizContainer.querySelector('.zoom-in');
      expect(zoomInBtn).toBeTruthy();
      zoomInBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify zoom increased
      expect(planViz.getZoomLevel()).toBeGreaterThan(1);
      expect(umbilical.onZoomChange).toHaveBeenCalled();
      
      // Use mouse wheel to zoom out
      const svg = vizContainer.querySelector('svg');
      const wheelEvent = new dom.window.WheelEvent('wheel', {
        deltaY: 100,
        ctrlKey: true
      });
      svg.dispatchEvent(wheelEvent);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify zoom decreased
      expect(planViz.getZoomLevel()).toBeLessThan(1.2);
      
      // Reset zoom
      const resetBtn = vizContainer.querySelector('.zoom-reset');
      resetBtn.click();
      
      expect(planViz.getZoomLevel()).toBe(1);
    });

    it('should handle node selection and highlighting', async () => {
      const vizContainer = umbilical.dom;
      const svg = vizContainer.querySelector('svg');
      
      // Find a node
      const nodes = svg.querySelectorAll('[data-node-id]');
      expect(nodes.length).toBeGreaterThan(0);
      
      const firstNode = nodes[0];
      const nodeId = firstNode.getAttribute('data-node-id');
      
      // Click to select
      firstNode.dispatchEvent(new dom.window.MouseEvent('click', {
        bubbles: true
      }));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify selection
      expect(planViz.model.getState('selectedNodeId')).toBe(nodeId);
      expect(firstNode.classList.contains('selected')).toBe(true);
      
      // Click another node with ctrl for multi-select
      if (nodes.length > 1) {
        const secondNode = nodes[1];
        const secondNodeId = secondNode.getAttribute('data-node-id');
        
        secondNode.dispatchEvent(new dom.window.MouseEvent('click', {
          bubbles: true,
          ctrlKey: true
        }));
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const selectedNodes = planViz.model.getState('selectedNodes');
        expect(selectedNodes).toContain(secondNodeId);
      }
      
      // Deselect with escape
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        key: 'Escape'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(planViz.model.getState('selectedNodeId')).toBeNull();
    });

    it('should handle pan interactions', async () => {
      const vizContainer = umbilical.dom;
      const svg = vizContainer.querySelector('svg');
      
      // Initial pan position
      expect(planViz.getPanPosition()).toEqual({ x: 0, y: 0 });
      
      // Simulate drag to pan
      svg.dispatchEvent(new dom.window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0
      }));
      
      svg.dispatchEvent(new dom.window.MouseEvent('mousemove', {
        clientX: 150,
        clientY: 120
      }));
      
      svg.dispatchEvent(new dom.window.MouseEvent('mouseup'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify pan changed
      const panPos = planViz.getPanPosition();
      expect(panPos.x).not.toBe(0);
      expect(umbilical.onPanChange).toHaveBeenCalled();
      
      // Reset with double click
      svg.dispatchEvent(new dom.window.MouseEvent('dblclick'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(planViz.getPanPosition()).toEqual({ x: 0, y: 0 });
    });

    it('should change view modes', async () => {
      const vizContainer = umbilical.dom;
      
      // Find view mode selector
      const selector = vizContainer.querySelector('.view-mode-selector');
      expect(selector).toBeTruthy();
      
      // Change to graph mode
      selector.value = 'graph';
      selector.dispatchEvent(new dom.window.Event('change'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(planViz.getViewMode()).toBe('graph');
      expect(umbilical.onViewChange).toHaveBeenCalledWith('graph');
      
      // Change to radial mode
      selector.value = 'radial';
      selector.dispatchEvent(new dom.window.Event('change'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(planViz.getViewMode()).toBe('radial');
    });

    it('should handle keyboard shortcuts', async () => {
      // Ctrl+F for fit to view
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true
      }));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have calculated optimal zoom/pan
      const zoom = planViz.getZoomLevel();
      const pan = planViz.getPanPosition();
      expect(zoom).toBeDefined();
      expect(pan).toBeDefined();
      
      // Arrow keys for panning
      const initialPan = planViz.getPanPosition();
      
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const newPan = planViz.getPanPosition();
      expect(newPan.x).toBeGreaterThan(initialPan.x);
    });

    it('should show tooltips on hover', async () => {
      const vizContainer = umbilical.dom;
      const svg = vizContainer.querySelector('svg');
      
      // Find a node
      const node = svg.querySelector('[data-node-id]');
      if (node) {
        // Hover over node
        node.dispatchEvent(new dom.window.MouseEvent('mouseenter', {
          bubbles: true,
          clientX: 100,
          clientY: 100
        }));
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Check for tooltip
        const tooltip = vizContainer.querySelector('.node-tooltip');
        expect(tooltip).toBeTruthy();
        expect(tooltip.style.display).not.toBe('none');
        
        // Leave node
        node.dispatchEvent(new dom.window.MouseEvent('mouseleave', {
          bubbles: true
        }));
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Tooltip should hide
        expect(tooltip.style.display).toBe('none');
      }
    });
  });

  describe('Touch Interactions', () => {
    beforeEach(async () => {
      // Load a simple plan
      const testPlan = {
        id: 'touch-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Touch Test'
          }
        }
      };
      
      planViz.setPlan(testPlan);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should handle pinch to zoom on touch devices', async () => {
      const vizContainer = umbilical.dom;
      const svg = vizContainer.querySelector('svg');
      
      // Initial zoom
      const initialZoom = planViz.getZoomLevel();
      
      // Simulate pinch start
      const touch1 = { clientX: 100, clientY: 100 };
      const touch2 = { clientX: 200, clientY: 200 };
      
      svg.dispatchEvent(new dom.window.TouchEvent('touchstart', {
        touches: [touch1, touch2]
      }));
      
      // Simulate pinch out (zoom in)
      svg.dispatchEvent(new dom.window.TouchEvent('touchmove', {
        touches: [
          { clientX: 50, clientY: 50 },
          { clientX: 250, clientY: 250 }
        ]
      }));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify zoom changed
      const newZoom = planViz.getZoomLevel();
      expect(newZoom).not.toBe(initialZoom);
      
      // End touch
      svg.dispatchEvent(new dom.window.TouchEvent('touchend', {
        touches: []
      }));
    });

    it('should handle touch drag to pan', async () => {
      const vizContainer = umbilical.dom;
      const svg = vizContainer.querySelector('svg');
      
      // Initial pan
      const initialPan = planViz.getPanPosition();
      
      // Simulate single touch drag
      svg.dispatchEvent(new dom.window.TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }]
      }));
      
      svg.dispatchEvent(new dom.window.TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 120 }]
      }));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify pan changed
      const newPan = planViz.getPanPosition();
      expect(newPan.x).not.toBe(initialPan.x);
      
      // End touch
      svg.dispatchEvent(new dom.window.TouchEvent('touchend', {
        touches: []
      }));
    });
  });

  describe('Export Functions', () => {
    beforeEach(async () => {
      const testPlan = {
        id: 'export-test',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Export Test'
          }
        }
      };
      
      planViz.setPlan(testPlan);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should export as SVG', () => {
      const svgString = planViz.exportAsSVG();
      expect(svgString).toBeTruthy();
      expect(svgString).toContain('<svg');
      expect(svgString).toContain('</svg>');
    });

    it('should export as JSON', () => {
      const jsonString = planViz.exportAsJSON();
      expect(jsonString).toBeTruthy();
      
      const parsed = JSON.parse(jsonString);
      expect(parsed.id).toBe('export-test');
      expect(parsed.hierarchy).toBeDefined();
    });
  });
});