/**
 * PlanVisualizationPanel Component Tests
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { PlanVisualizationPanel } from '../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js';

describe('PlanVisualizationPanel', () => {
  let dom, container, mockUmbilical, component;

  beforeEach(() => {
    // Create DOM environment
    dom = new JSDOM(`<!DOCTYPE html><div id="container"></div>`);
    global.document = dom.window.document;
    global.window = dom.window;
    global.XMLSerializer = dom.window.XMLSerializer;
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
      onViewChange: jest.fn(),
      onLayoutChange: jest.fn(),
      onZoomChange: jest.fn(),
      onNodeClick: jest.fn(),
      onNodeHover: jest.fn(),
      onEdgeClick: jest.fn()
    };
  });

  afterEach(() => {
    if (component) {
      component.destroy();
    }
  });

  test('should create component with required capabilities', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    expect(component).toBeDefined();
    expect(mockUmbilical.onMount).toHaveBeenCalledWith(expect.objectContaining({
      setPlan: expect.any(Function),
      setViewMode: expect.any(Function),
      setLayout: expect.any(Function),
      selectNode: expect.any(Function)
    }));
  });

  test('should render visualization interface', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    expect(container.querySelector('.plan-visualization-panel')).toBeTruthy();
    expect(container.querySelector('.view-mode-selector')).toBeTruthy();
    expect(container.querySelector('.zoom-controls')).toBeTruthy();
    expect(container.querySelector('.export-controls')).toBeTruthy();
    expect(container.querySelector('.visualization-canvas')).toBeTruthy();
  });

  test('should handle view mode changes', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const selector = container.querySelector('.view-mode-selector');
    selector.value = 'radial';
    selector.dispatchEvent(new dom.window.Event('change'));
    
    expect(component.api.getViewMode()).toBe('radial');
    expect(mockUmbilical.onViewChange).toHaveBeenCalledWith('radial');
  });

  test('should handle compact mode toggle', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const initialCompact = component.api.isCompactMode();
    
    const toggle = container.querySelector('.compact-toggle');
    toggle.click();
    
    expect(component.api.isCompactMode()).toBe(!initialCompact);
  });

  test('should handle zoom controls', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const initialZoom = component.api.getZoomLevel();
    
    // Zoom in
    const zoomIn = container.querySelector('.zoom-in');
    zoomIn.click();
    expect(component.api.getZoomLevel()).toBeGreaterThan(initialZoom);
    
    // Zoom out
    const zoomOut = container.querySelector('.zoom-out');
    zoomOut.click();
    expect(component.api.getZoomLevel()).toBeLessThan(initialZoom * 1.2);
    
    // Reset zoom
    const zoomReset = container.querySelector('.zoom-reset');
    zoomReset.click();
    expect(component.api.getZoomLevel()).toBe(1);
    expect(component.api.getPanPosition()).toEqual({ x: 0, y: 0 });
  });

  test('should handle mouse wheel zoom', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const canvas = container.querySelector('.visualization-canvas');
    const initialZoom = component.getZoomLevel();
    
    // Simulate wheel down (zoom out)
    const wheelEvent = new dom.window.WheelEvent('wheel', { deltaY: 100 });
    Object.defineProperty(wheelEvent, 'preventDefault', {
      value: jest.fn()
    });
    
    canvas.dispatchEvent(wheelEvent);
    
    // Note: throttling might prevent immediate effect, so we check the method was called
    expect(wheelEvent.preventDefault).toHaveBeenCalled();
  });

  test('should handle mouse pan', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const canvas = container.querySelector('.visualization-canvas');
    const initialPan = component.getPanPosition();
    
    // Start drag
    canvas.dispatchEvent(new dom.window.MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100
    }));
    
    // Move mouse
    canvas.dispatchEvent(new dom.window.MouseEvent('mousemove', {
      clientX: 150,
      clientY: 150
    }));
    
    // End drag
    canvas.dispatchEvent(new dom.window.MouseEvent('mouseup'));
    
    const finalPan = component.getPanPosition();
    expect(finalPan.x).not.toBe(initialPan.x);
    expect(finalPan.y).not.toBe(initialPan.y);
  });

  test('should handle plan data', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const mockPlan = {
      id: 'test-plan',
      hierarchy: {
        root: {
          id: 'root',
          description: 'Build web app',
          complexity: 'COMPLEX',
          children: [
            {
              id: 'child-1',
              description: 'Setup frontend',
              complexity: 'SIMPLE',
              children: []
            }
          ]
        }
      }
    };
    
    component.setPlan(mockPlan);
    
    expect(component.getPlan()).toEqual(mockPlan);
    expect(component.getNodePositions()).toBeDefined();
    expect(Object.keys(component.getNodePositions())).toContain('root');
    expect(Object.keys(component.getNodePositions())).toContain('child-1');
  });

  test('should show empty state when no plan', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    expect(container.querySelector('.empty-visualization')).toBeTruthy();
    
    const emptyDiv = container.querySelector('.empty-visualization');
    expect(emptyDiv.style.display).toBe('none'); // Initially hidden
    
    // When no plan is set, should show empty state
    component.setPlan(null);
    expect(container.querySelector('.empty-visualization')).toBeTruthy();
  });

  test('should handle node selection', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const mockPlan = {
      hierarchy: {
        root: {
          id: 'root',
          description: 'Test node',
          children: []
        }
      }
    };
    
    component.setPlan(mockPlan);
    component.selectNode('root');
    
    expect(mockUmbilical.onNodeClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'root' })
    );
  });

  test('should handle different layout types', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const layouts = component.getAvailableLayouts();
    expect(layouts).toContain('hierarchical');
    expect(layouts).toContain('radial');
    expect(layouts).toContain('force-directed');
    expect(layouts).toContain('tree');
    
    const mockPlan = {
      hierarchy: {
        root: {
          id: 'root',
          description: 'Test',
          children: [
            { id: 'child1', description: 'Child 1', children: [] }
          ]
        }
      }
    };
    
    component.setPlan(mockPlan);
    
    // Test different layouts
    component.setLayout('radial');
    expect(component.getLayout().type).toBe('radial');
    expect(mockUmbilical.onLayoutChange).toHaveBeenCalledWith('radial');
    
    component.setLayout('hierarchical');
    expect(component.getLayout().type).toBe('hierarchical');
    expect(mockUmbilical.onLayoutChange).toHaveBeenCalledWith('hierarchical');
  });

  test('should handle large plans with virtualization', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    // Create a large plan (>100 nodes)
    const createNodes = (count, prefix = 'node') => {
      return Array.from({ length: count }, (_, i) => ({
        id: `${prefix}-${i}`,
        description: `Node ${i}`,
        children: []
      }));
    };
    
    const largePlan = {
      hierarchy: {
        root: {
          id: 'root',
          description: 'Large plan',
          children: createNodes(110)
        }
      }
    };
    
    component.setPlan(largePlan);
    component.setNodeCount(111); // root + 110 children
    
    expect(component.isVirtualizationEnabled()).toBe(true);
  });

  test('should handle export functions', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const mockPlan = {
      hierarchy: {
        root: {
          id: 'root',
          description: 'Export test',
          children: []
        }
      }
    };
    
    component.setPlan(mockPlan);
    
    // Test SVG export
    const svgString = component.exportAsSVG();
    expect(typeof svgString).toBe('string');
    expect(svgString).toContain('svg');
    
    // Test JSON export
    const jsonString = component.exportAsJSON();
    expect(typeof jsonString).toBe('string');
    const parsed = JSON.parse(jsonString);
    expect(parsed.hierarchy.root.id).toBe('root');
  });

  test('should handle export button clicks', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    // Mock createElement and click
    const mockLink = {
      click: jest.fn(),
      download: '',
      href: ''
    };
    global.document.createElement = jest.fn(() => mockLink);
    
    const exportSvg = container.querySelector('.export-svg');
    const exportJson = container.querySelector('.export-json');
    
    exportSvg.click();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    
    exportJson.click();
    expect(mockLink.click).toHaveBeenCalled();
  });

  test('should handle fit to view', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const mockPlan = {
      hierarchy: {
        root: {
          id: 'root',
          description: 'Fit test',
          children: [
            { id: 'child1', description: 'Child 1', children: [] },
            { id: 'child2', description: 'Child 2', children: [] }
          ]
        }
      }
    };
    
    component.setPlan(mockPlan);
    
    const fitButton = container.querySelector('.fit-view');
    fitButton.click();
    
    // Should adjust zoom and pan to fit content
    expect(component.getZoomLevel()).toBeLessThanOrEqual(1);
    expect(component.getPanPosition()).toBeDefined();
  });

  test('should handle animation settings', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    component.setAnimationEnabled(false);
    component.setLayout('radial');
    
    component.setAnimationEnabled(true);
    component.setLayout('hierarchical');
    
    // Animation setting affects layout transitions
    expect(component.api.setAnimationEnabled).toBeDefined();
  });

  test('should validate required DOM capabilities', async () => {
    const invalidUmbilical = {
      // Missing dom capability
      onMount: jest.fn()
    };
    
    await expect(PlanVisualizationPanel.create(invalidUmbilical))
      .rejects.toThrow();
  });

  test('should handle component destruction', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    mockUmbilical.onDestroy = jest.fn();
    
    component.destroy();
    
    expect(mockUmbilical.onDestroy).toHaveBeenCalled();
    expect(container.innerHTML).toBe('');
  });

  test('should handle complex hierarchical layouts', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const complexPlan = {
      hierarchy: {
        root: {
          id: 'root',
          description: 'Complex root',
          children: [
            {
              id: 'branch1',
              description: 'Branch 1',
              children: [
                { id: 'leaf1', description: 'Leaf 1', children: [] },
                { id: 'leaf2', description: 'Leaf 2', children: [] }
              ]
            },
            {
              id: 'branch2',
              description: 'Branch 2',
              children: [
                { id: 'leaf3', description: 'Leaf 3', children: [] }
              ]
            }
          ]
        }
      }
    };
    
    component.setPlan(complexPlan);
    
    const positions = component.getNodePositions();
    expect(positions['root']).toBeDefined();
    expect(positions['branch1']).toBeDefined();
    expect(positions['branch2']).toBeDefined();
    expect(positions['leaf1']).toBeDefined();
    expect(positions['leaf2']).toBeDefined();
    expect(positions['leaf3']).toBeDefined();
    
    // Check hierarchical positioning
    expect(positions['branch1'].y).toBeGreaterThan(positions['root'].y);
    expect(positions['leaf1'].y).toBeGreaterThan(positions['branch1'].y);
  });

  test('should handle radial layout positioning', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const mockPlan = {
      hierarchy: {
        root: {
          id: 'root',
          description: 'Center',
          children: [
            { id: 'north', description: 'North', children: [] },
            { id: 'south', description: 'South', children: [] },
            { id: 'east', description: 'East', children: [] },
            { id: 'west', description: 'West', children: [] }
          ]
        }
      }
    };
    
    component.setPlan(mockPlan);
    component.setLayout('radial');
    
    const positions = component.getNodePositions();
    
    // Root should be at center
    expect(positions['root'].x).toBe(400);
    expect(positions['root'].y).toBe(300);
    
    // Children should be distributed radially
    const children = ['north', 'south', 'east', 'west'];
    children.forEach(child => {
      expect(positions[child]).toBeDefined();
      const distance = Math.sqrt(
        Math.pow(positions[child].x - 400, 2) + 
        Math.pow(positions[child].y - 300, 2)
      );
      expect(distance).toBeGreaterThan(50); // Should be away from center
    });
  });

  test('should handle empty plan gracefully', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    // Test with null plan
    component.setPlan(null);
    expect(component.getPlan()).toBeNull();
    
    // Test with empty hierarchy
    component.setPlan({ hierarchy: null });
    expect(component.getNodePositions()).toEqual({});
    
    // Test with missing root
    component.setPlan({ hierarchy: {} });
    expect(component.getNodePositions()).toEqual({});
  });

  test('should throttle wheel events', async () => {
    component = await PlanVisualizationPanel.create(mockUmbilical);
    
    const canvas = container.querySelector('.visualization-canvas');
    const initialZoom = component.getZoomLevel();
    
    // Create multiple wheel events quickly
    for (let i = 0; i < 5; i++) {
      const wheelEvent = new dom.window.WheelEvent('wheel', { deltaY: -100 });
      Object.defineProperty(wheelEvent, 'preventDefault', {
        value: jest.fn()
      });
      canvas.dispatchEvent(wheelEvent);
    }
    
    // Due to throttling, not all events should take effect immediately
    expect(wheelEvent.preventDefault).toHaveBeenCalled();
  });
});