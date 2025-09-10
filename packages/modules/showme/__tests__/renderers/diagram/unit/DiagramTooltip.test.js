/**
 * Unit tests for DiagramTooltip
 */

import { DiagramTooltip } from '../../../../src/renderers/diagram/view/DiagramTooltip.js';
import { createTestDOM, cleanupTestDOM } from '../test-setup.js';

describe('DiagramTooltip', () => {
  let dom;
  let container;
  let tooltip;

  beforeEach(() => {
    dom = createTestDOM();
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    container.style.position = 'relative';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (tooltip) {
      tooltip.destroy();
      tooltip = null;
    }
    cleanupTestDOM();
  });

  describe('Initialization', () => {
    test('should create tooltip element', () => {
      tooltip = new DiagramTooltip(container);

      const tooltipElement = container.querySelector('.diagram-tooltip');
      expect(tooltipElement).toBeDefined();
      expect(tooltipElement.style.display).toBe('none');
    });

    test('should accept configuration options', () => {
      tooltip = new DiagramTooltip(container, {
        delay: 200,
        maxWidth: 300,
        offset: { x: 20, y: 20 }
      });

      expect(tooltip.delay).toBe(200);
      expect(tooltip.maxWidth).toBe(300);
      expect(tooltip.offset.x).toBe(20);
      expect(tooltip.offset.y).toBe(20);
    });
  });

  describe('Node Tooltips', () => {
    test('should show tooltip for node', (done) => {
      tooltip = new DiagramTooltip(container, { delay: 10 });

      const nodeInfo = {
        id: 'node1',
        type: 'node',
        data: {
          id: 'node1',
          label: 'Test Node',
          type: 'process',
          description: 'This is a test node',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 }
        }
      };

      tooltip.show(nodeInfo, { x: 200, y: 200 });

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        expect(tooltipElement.style.display).toBe('block');
        expect(tooltipElement.innerHTML).toContain('Test Node');
        expect(tooltipElement.innerHTML).toContain('process');
        expect(tooltipElement.innerHTML).toContain('This is a test node');
        done();
      }, 20);
    });

    test('should show node metadata', (done) => {
      tooltip = new DiagramTooltip(container, { delay: 10 });

      const nodeInfo = {
        id: 'node1',
        type: 'node',
        data: {
          id: 'node1',
          label: 'Database',
          metadata: {
            connectionCount: 5,
            status: 'active',
            lastUpdate: '2024-01-01'
          },
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 }
        }
      };

      tooltip.show(nodeInfo, { x: 200, y: 200 });

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        expect(tooltipElement.innerHTML).toContain('Connection Count: 5');
        expect(tooltipElement.innerHTML).toContain('Status: active');
        expect(tooltipElement.innerHTML).toContain('Last Update: 2024-01-01');
        done();
      }, 20);
    });

    test('should show debug info when enabled', (done) => {
      tooltip = new DiagramTooltip(container, { 
        delay: 10,
        showDebugInfo: true 
      });

      const nodeInfo = {
        id: 'node1',
        type: 'node',
        data: {
          id: 'node1',
          label: 'Test Node',
          position: { x: 100, y: 150 },
          size: { width: 120, height: 60 }
        }
      };

      tooltip.show(nodeInfo, { x: 200, y: 200 });

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        expect(tooltipElement.innerHTML).toContain('Position: (100, 150)');
        expect(tooltipElement.innerHTML).toContain('Size: 120×60');
        done();
      }, 20);
    });
  });

  describe('Edge Tooltips', () => {
    test('should show tooltip for edge', (done) => {
      tooltip = new DiagramTooltip(container, { delay: 10 });

      const edgeInfo = {
        id: 'edge1',
        type: 'edge',
        data: {
          id: 'edge1',
          label: 'Data Flow',
          type: 'dataflow',
          source: 'node1',
          target: 'node2',
          description: 'Primary data connection'
        }
      };

      tooltip.show(edgeInfo, { x: 300, y: 300 });

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        expect(tooltipElement.style.display).toBe('block');
        expect(tooltipElement.innerHTML).toContain('Data Flow');
        expect(tooltipElement.innerHTML).toContain('dataflow');
        expect(tooltipElement.innerHTML).toContain('From: node1');
        expect(tooltipElement.innerHTML).toContain('To: node2');
        expect(tooltipElement.innerHTML).toContain('Primary data connection');
        done();
      }, 20);
    });

    test('should show edge metadata', (done) => {
      tooltip = new DiagramTooltip(container, { delay: 10 });

      const edgeInfo = {
        id: 'edge1',
        type: 'edge',
        data: {
          id: 'edge1',
          source: 'node1',
          target: 'node2',
          metadata: {
            bandwidth: '100 Mbps',
            latency: '5ms'
          }
        }
      };

      tooltip.show(edgeInfo, { x: 300, y: 300 });

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        expect(tooltipElement.innerHTML).toContain('Bandwidth: 100 Mbps');
        expect(tooltipElement.innerHTML).toContain('Latency: 5ms');
        done();
      }, 20);
    });
  });

  describe('Positioning', () => {
    test('should position tooltip near mouse', (done) => {
      tooltip = new DiagramTooltip(container, { delay: 10 });

      const nodeInfo = {
        id: 'node1',
        type: 'node',
        data: {
          id: 'node1',
          label: 'Test Node',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 }
        }
      };

      const mousePos = { x: 400, y: 300 };
      tooltip.show(nodeInfo, mousePos);

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        const left = parseInt(tooltipElement.style.left);
        const top = parseInt(tooltipElement.style.top);

        // Should be positioned near mouse with offset
        expect(left).toBeGreaterThan(0);
        expect(top).toBeGreaterThan(0);
        done();
      }, 20);
    });

    test('should keep tooltip within container bounds', (done) => {
      tooltip = new DiagramTooltip(container, { delay: 10 });

      const nodeInfo = {
        id: 'node1',
        type: 'node',
        data: {
          id: 'node1',
          label: 'Test Node with a very long label that might overflow',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 }
        }
      };

      // Position near right edge
      tooltip.show(nodeInfo, { x: 750, y: 300 });

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        const rect = tooltipElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Should not overflow container
        expect(rect.right).toBeLessThanOrEqual(containerRect.right);
        done();
      }, 20);
    });
  });

  describe('Show/Hide Behavior', () => {
    test('should hide tooltip', (done) => {
      tooltip = new DiagramTooltip(container, { delay: 10 });

      const nodeInfo = {
        id: 'node1',
        type: 'node',
        data: {
          id: 'node1',
          label: 'Test Node',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 }
        }
      };

      tooltip.show(nodeInfo, { x: 200, y: 200 });

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        expect(tooltipElement.style.display).toBe('block');

        tooltip.hide();

        setTimeout(() => {
          expect(tooltipElement.style.display).toBe('none');
          done();
        }, 150);
      }, 20);
    });

    test('should update tooltip when element changes', (done) => {
      tooltip = new DiagramTooltip(container, { delay: 10 });

      const node1Info = {
        id: 'node1',
        type: 'node',
        data: {
          id: 'node1',
          label: 'Node 1',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 }
        }
      };

      const node2Info = {
        id: 'node2',
        type: 'node',
        data: {
          id: 'node2',
          label: 'Node 2',
          position: { x: 200, y: 200 },
          size: { width: 120, height: 60 }
        }
      };

      tooltip.show(node1Info, { x: 200, y: 200 });

      setTimeout(() => {
        const tooltipElement = container.querySelector('.diagram-tooltip');
        expect(tooltipElement.innerHTML).toContain('Node 1');

        tooltip.update(node2Info, { x: 300, y: 300 });

        setTimeout(() => {
          expect(tooltipElement.innerHTML).toContain('Node 2');
          done();
        }, 20);
      }, 20);
    });
  });

  describe('Cleanup', () => {
    test('should destroy tooltip cleanly', () => {
      tooltip = new DiagramTooltip(container);
      
      const tooltipElement = container.querySelector('.diagram-tooltip');
      expect(tooltipElement).toBeDefined();

      tooltip.destroy();
      
      const afterDestroy = container.querySelector('.diagram-tooltip');
      expect(afterDestroy).toBeNull();
      
      // Should not throw when destroyed again
      expect(() => tooltip.destroy()).not.toThrow();
    });
  });
});