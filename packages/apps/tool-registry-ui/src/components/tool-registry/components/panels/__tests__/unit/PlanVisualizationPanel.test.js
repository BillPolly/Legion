/**
 * Unit tests for PlanVisualizationPanel Component
 * Tests visualization modes, graph rendering, and interactions
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the UmbilicalUtils
jest.mock('/legion/frontend-components/src/umbilical/index.js', () => ({
  UmbilicalUtils: {
    validateCapabilities: jest.fn((umbilical, requirements) => {
      return true;
    }),
    createRequirements: () => ({
      add: jest.fn(),
      validate: jest.fn()
    })
  }
}));

describe('PlanVisualizationPanel', () => {
  let mockUmbilical;
  let mockContainer;
  let component;

  beforeEach(() => {
    // Create mock DOM container
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    // Create mock umbilical  
    mockUmbilical = {
      dom: mockContainer,
      onNodeClick: jest.fn(),
      onNodeHover: jest.fn(),
      onEdgeClick: jest.fn(),
      onViewChange: jest.fn(),
      onZoomChange: jest.fn(),
      onLayoutChange: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    document.body.removeChild(mockContainer);
    jest.clearAllMocks();
  });

  describe('Visualization Modes', () => {
    it('should initialize with default view mode', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const mode = component.getViewMode();
      expect(mode).toBe('hierarchical');
    });

    it('should switch between view modes', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      component.setViewMode('graph');
      expect(component.getViewMode()).toBe('graph');
      
      component.setViewMode('tree');
      expect(component.getViewMode()).toBe('tree');
      
      component.setViewMode('hierarchical');
      expect(component.getViewMode()).toBe('hierarchical');
    });

    it('should render mode selector', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const selector = mockContainer.querySelector('.view-mode-selector');
      expect(selector).toBeTruthy();
      
      const options = selector.querySelectorAll('option');
      expect(options.length).toBeGreaterThanOrEqual(3);
    });

    it('should apply different layouts for each mode', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: { id: 'root', children: [{ id: 'child1' }, { id: 'child2' }] }
        }
      };

      component.setPlan(plan);
      
      component.setViewMode('graph');
      const graphLayout = component.getLayout();
      expect(graphLayout.type).toBe('force-directed');
      
      component.setViewMode('tree');
      const treeLayout = component.getLayout();
      expect(treeLayout.type).toBe('tree');
    });

    it('should support compact mode', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      component.setCompactMode(true);
      expect(component.isCompactMode()).toBe(true);
      
      const container = mockContainer.querySelector('.visualization-container');
      expect(container.classList.contains('compact')).toBe(true);
    });
  });

  describe('Graph Rendering', () => {
    it('should render SVG canvas', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const svg = mockContainer.querySelector('svg.visualization-canvas');
      expect(svg).toBeTruthy();
    });

    it('should render nodes from plan hierarchy', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            description: 'Main task',
            children: [
              { id: 'task1', description: 'Subtask 1' },
              { id: 'task2', description: 'Subtask 2' }
            ]
          }
        }
      };

      component.setPlan(plan);
      
      const nodes = mockContainer.querySelectorAll('.node');
      expect(nodes.length).toBe(3);
    });

    it('should render edges between nodes', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            children: [
              { id: 'task1' },
              { id: 'task2' }
            ]
          }
        }
      };

      component.setPlan(plan);
      
      const edges = mockContainer.querySelectorAll('.edge');
      expect(edges.length).toBe(2); // root->task1, root->task2
    });

    it('should apply complexity styling to nodes', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            complexity: 'COMPLEX',
            children: [
              { id: 'task1', complexity: 'SIMPLE' }
            ]
          }
        }
      };

      component.setPlan(plan);
      
      const complexNode = mockContainer.querySelector('.node.complex');
      const simpleNode = mockContainer.querySelector('.node.simple');
      
      expect(complexNode).toBeTruthy();
      expect(simpleNode).toBeTruthy();
    });

    it('should display node labels', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build API'
          }
        }
      };

      component.setPlan(plan);
      
      const label = mockContainer.querySelector('.node-label');
      expect(label).toBeTruthy();
      expect(label.textContent).toContain('Build API');
    });

    it('should handle empty plan gracefully', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      component.setPlan(null);
      
      const emptyState = mockContainer.querySelector('.empty-visualization');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No plan to visualize');
    });

    it('should update when plan changes', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan1 = {
        hierarchy: { root: { id: 'root' } }
      };
      
      component.setPlan(plan1);
      expect(mockContainer.querySelectorAll('.node').length).toBe(1);
      
      const plan2 = {
        hierarchy: {
          root: {
            id: 'root',
            children: [{ id: 'child1' }, { id: 'child2' }]
          }
        }
      };
      
      component.setPlan(plan2);
      expect(mockContainer.querySelectorAll('.node').length).toBe(3);
    });
  });

  describe('Node Interactions', () => {
    it('should handle node click', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: { id: 'root', description: 'Task' }
        }
      };

      component.setPlan(plan);
      
      const node = mockContainer.querySelector('.node');
      node.click();
      
      expect(mockUmbilical.onNodeClick).toHaveBeenCalledWith({
        id: 'root',
        description: 'Task'
      });
    });

    it('should highlight selected node', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: { id: 'root' }
        }
      };

      component.setPlan(plan);
      component.selectNode('root');
      
      const node = mockContainer.querySelector('[data-node-id="root"]');
      expect(node.classList.contains('selected')).toBe(true);
    });

    it('should handle node hover', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: { id: 'root', description: 'Task' }
        }
      };

      component.setPlan(plan);
      
      const node = mockContainer.querySelector('.node');
      node.dispatchEvent(new MouseEvent('mouseenter'));
      
      expect(mockUmbilical.onNodeHover).toHaveBeenCalledWith({
        id: 'root',
        description: 'Task'
      });
    });

    it('should show node tooltip on hover', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            description: 'Main task',
            complexity: 'COMPLEX'
          }
        }
      };

      component.setPlan(plan);
      
      const node = mockContainer.querySelector('.node');
      node.dispatchEvent(new MouseEvent('mouseenter'));
      
      const tooltip = mockContainer.querySelector('.node-tooltip');
      expect(tooltip).toBeTruthy();
      expect(tooltip.textContent).toContain('Main task');
      expect(tooltip.textContent).toContain('COMPLEX');
    });

    it('should handle edge click', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            children: [{ id: 'child' }]
          }
        }
      };

      component.setPlan(plan);
      
      const edge = mockContainer.querySelector('.edge');
      edge.click();
      
      expect(mockUmbilical.onEdgeClick).toHaveBeenCalledWith({
        source: 'root',
        target: 'child'
      });
    });

    it('should highlight connected nodes on selection', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            children: [
              { id: 'child1' },
              { id: 'child2' }
            ]
          }
        }
      };

      component.setPlan(plan);
      component.selectNode('root');
      
      const child1 = mockContainer.querySelector('[data-node-id="child1"]');
      const child2 = mockContainer.querySelector('[data-node-id="child2"]');
      
      expect(child1.classList.contains('connected')).toBe(true);
      expect(child2.classList.contains('connected')).toBe(true);
    });
  });

  describe('Zoom and Pan Controls', () => {
    it('should render zoom controls', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const zoomIn = mockContainer.querySelector('.zoom-in');
      const zoomOut = mockContainer.querySelector('.zoom-out');
      const zoomReset = mockContainer.querySelector('.zoom-reset');
      
      expect(zoomIn).toBeTruthy();
      expect(zoomOut).toBeTruthy();
      expect(zoomReset).toBeTruthy();
    });

    it('should handle zoom in', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const initialZoom = component.getZoomLevel();
      
      const zoomIn = mockContainer.querySelector('.zoom-in');
      zoomIn.click();
      
      expect(component.getZoomLevel()).toBeGreaterThan(initialZoom);
      expect(mockUmbilical.onZoomChange).toHaveBeenCalled();
    });

    it('should handle zoom out', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const initialZoom = component.getZoomLevel();
      
      const zoomOut = mockContainer.querySelector('.zoom-out');
      zoomOut.click();
      
      expect(component.getZoomLevel()).toBeLessThan(initialZoom);
    });

    it('should reset zoom', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      component.setZoomLevel(2);
      
      const zoomReset = mockContainer.querySelector('.zoom-reset');
      zoomReset.click();
      
      expect(component.getZoomLevel()).toBe(1);
    });

    it('should support mouse wheel zoom', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const canvas = mockContainer.querySelector('.visualization-canvas');
      const wheelEvent = new WheelEvent('wheel', { deltaY: -100 });
      canvas.dispatchEvent(wheelEvent);
      
      expect(component.getZoomLevel()).toBeGreaterThan(1);
    });

    it('should support pan navigation', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const initialPan = component.getPanPosition();
      
      const canvas = mockContainer.querySelector('.visualization-canvas');
      
      // Simulate drag
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 }));
      canvas.dispatchEvent(new MouseEvent('mouseup'));
      
      const newPan = component.getPanPosition();
      expect(newPan.x).not.toBe(initialPan.x);
      expect(newPan.y).not.toBe(initialPan.y);
    });

    it('should fit view to content', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            children: Array(10).fill(null).map((_, i) => ({ id: `task${i}` }))
          }
        }
      };

      component.setPlan(plan);
      component.fitToView();
      
      // Should adjust zoom and pan to fit all nodes
      const zoom = component.getZoomLevel();
      expect(zoom).toBeLessThanOrEqual(1);
    });
  });

  describe('Layout Options', () => {
    it('should support different layout algorithms', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const layouts = component.getAvailableLayouts();
      expect(layouts).toContain('hierarchical');
      expect(layouts).toContain('force-directed');
      expect(layouts).toContain('radial');
      expect(layouts).toContain('tree');
    });

    it('should apply hierarchical layout', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            children: [{ id: 'child1' }, { id: 'child2' }]
          }
        }
      };

      component.setPlan(plan);
      component.setLayout('hierarchical');
      
      const positions = component.getNodePositions();
      expect(positions.root.y).toBeLessThan(positions.child1.y);
      expect(positions.root.y).toBeLessThan(positions.child2.y);
    });

    it('should apply force-directed layout', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      component.setLayout('force-directed');
      expect(component.getLayout().type).toBe('force-directed');
      expect(mockUmbilical.onLayoutChange).toHaveBeenCalledWith('force-directed');
    });

    it('should apply radial layout', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: {
          root: {
            id: 'root',
            children: Array(6).fill(null).map((_, i) => ({ id: `task${i}` }))
          }
        }
      };

      component.setPlan(plan);
      component.setLayout('radial');
      
      const positions = component.getNodePositions();
      // Children should be arranged in a circle around root
      const distances = Object.keys(positions)
        .filter(id => id !== 'root')
        .map(id => {
          const dx = positions[id].x - positions.root.x;
          const dy = positions[id].y - positions.root.y;
          return Math.sqrt(dx * dx + dy * dy);
        });
      
      // All children should be roughly equidistant from root
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      distances.forEach(d => {
        expect(Math.abs(d - avgDistance)).toBeLessThan(10);
      });
    });

    it('should animate layout transitions', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      component.setAnimationEnabled(true);
      component.setLayout('hierarchical');
      
      const transition = mockContainer.querySelector('.layout-transition');
      expect(transition).toBeTruthy();
    });
  });

  describe('Export and Sharing', () => {
    it('should export as SVG', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: { root: { id: 'root' } }
      };
      component.setPlan(plan);
      
      const svgString = component.exportAsSVG();
      expect(svgString).toContain('<svg');
      expect(svgString).toContain('</svg>');
    });

    it('should export as PNG', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: { root: { id: 'root' } }
      };
      component.setPlan(plan);
      
      const dataUrl = await component.exportAsPNG();
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should export as JSON', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const plan = {
        hierarchy: { root: { id: 'root' } }
      };
      component.setPlan(plan);
      
      const json = component.exportAsJSON();
      const parsed = JSON.parse(json);
      expect(parsed.hierarchy.root.id).toBe('root');
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      // Create a large hierarchy
      const createLargeHierarchy = (depth, breadth) => {
        if (depth === 0) return null;
        return {
          id: `node-${depth}-${breadth}`,
          children: Array(breadth).fill(null).map((_, i) => 
            createLargeHierarchy(depth - 1, breadth)
          ).filter(Boolean)
        };
      };

      const plan = {
        hierarchy: { root: createLargeHierarchy(4, 3) } // 40 nodes
      };

      const startTime = Date.now();
      component.setPlan(plan);
      const renderTime = Date.now() - startTime;
      
      expect(renderTime).toBeLessThan(1000); // Should render in under 1 second
    });

    it('should use virtualization for very large graphs', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      component.setNodeCount(1000);
      expect(component.isVirtualizationEnabled()).toBe(true);
    });

    it('should throttle zoom events', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      const canvas = mockContainer.querySelector('.visualization-canvas');
      
      // Fire many wheel events rapidly
      for (let i = 0; i < 10; i++) {
        canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -10 }));
      }
      
      // Should be throttled
      expect(mockUmbilical.onZoomChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration', () => {
    it('should expose API through onMount', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      expect(mockUmbilical.onMount).toHaveBeenCalledWith(
        expect.objectContaining({
          setPlan: expect.any(Function),
          setViewMode: expect.any(Function),
          setLayout: expect.any(Function),
          selectNode: expect.any(Function),
          getZoomLevel: expect.any(Function),
          setZoomLevel: expect.any(Function),
          fitToView: expect.any(Function),
          exportAsSVG: expect.any(Function),
          exportAsPNG: expect.any(Function),
          exportAsJSON: expect.any(Function)
        })
      );
    });

    it('should clean up on destroy', async () => {
      const { PlanVisualizationPanel } = await import('../../PlanVisualizationPanel.js');
      component = await PlanVisualizationPanel.create(mockUmbilical);

      component.destroy();
      
      expect(mockUmbilical.onDestroy).toHaveBeenCalled();
      expect(mockContainer.innerHTML).toBe('');
    });
  });
});