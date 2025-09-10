/**
 * Tests for Force-Directed Layout Stabilization
 * 
 * Testing:
 * - Energy calculation
 * - Convergence detection
 * - Early termination when stable
 * - Configuration options
 * - Stabilization status reporting
 */

import { ForceDirectedLayout } from '../../../../src/renderers/diagram/layout/ForceDirectedLayout.js';

describe('ForceDirectedLayout - Stabilization', () => {
  let layout;
  
  beforeEach(() => {
    layout = new ForceDirectedLayout({
      stabilization: {
        enabled: true,
        threshold: 0.01,
        checkInterval: 5,
        minIterations: 10,
        maxIterations: 500,
        energyDecay: 0.95,
        convergenceRatio: 0.001
      }
    });
  });
  
  describe('Configuration', () => {
    it('should enable stabilization by default', () => {
      const defaultLayout = new ForceDirectedLayout();
      expect(defaultLayout.config.stabilization.enabled).toBe(true);
    });
    
    it('should accept custom stabilization parameters', () => {
      const customLayout = new ForceDirectedLayout({
        stabilization: {
          enabled: false,
          threshold: 0.05,
          checkInterval: 10
        }
      });
      
      expect(customLayout.config.stabilization.enabled).toBe(false);
      expect(customLayout.config.stabilization.threshold).toBe(0.05);
      expect(customLayout.config.stabilization.checkInterval).toBe(10);
    });
  });
  
  describe('Energy Calculation', () => {
    it('should calculate system energy based on node velocities', () => {
      // Create a simple graph
      const graphData = {
        nodes: [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 100, y: 0 },
          { id: 'c', x: 50, y: 86 }
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
          { id: 'e3', source: 'c', target: 'a' }
        ]
      };
      
      const result = layout.layout(graphData);
      
      // Check that stabilization info is included
      expect(result.metadata.stabilization).toBeDefined();
      expect(result.metadata.stabilization.enabled).toBe(true);
      expect(typeof result.metadata.stabilization.finalEnergy).toBe('number');
      expect(result.metadata.stabilization.convergenceIterations).toBeGreaterThan(0);
    });
    
    it('should track energy history during simulation', () => {
      const graphData = {
        nodes: [
          { id: 'a' },
          { id: 'b' }
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' }
        ]
      };
      
      layout.layout(graphData);
      const status = layout.getStabilizationStatus();
      
      expect(status.energyHistory).toBeDefined();
      expect(Array.isArray(status.energyHistory)).toBe(true);
      expect(status.energyHistory.length).toBeGreaterThan(0);
    });
  });
  
  describe('Convergence Detection', () => {
    it('should detect stabilization when energy drops below threshold', () => {
      // Create a simple stable configuration
      const graphData = {
        nodes: [
          { id: 'a', x: -50, y: 0, fx: -50, fy: 0 }, // Fixed
          { id: 'b', x: 50, y: 0, fx: 50, fy: 0 }    // Fixed
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' }
        ]
      };
      
      const result = layout.layout(graphData);
      
      // With fixed nodes, should stabilize quickly
      expect(result.metadata.stabilization.isStable).toBe(true);
      expect(result.metadata.stabilization.finalEnergy).toBeLessThan(0.1);
    });
    
    it('should detect stabilization based on convergence ratio', () => {
      const graphData = {
        nodes: [
          { id: 'a' },
          { id: 'b' },
          { id: 'c' },
          { id: 'd' }
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
          { id: 'e3', source: 'c', target: 'd' },
          { id: 'e4', source: 'd', target: 'a' }
        ]
      };
      
      layout.layout(graphData);
      const status = layout.getStabilizationStatus();
      
      expect(status.convergenceHistory).toBeDefined();
      expect(Array.isArray(status.convergenceHistory)).toBe(true);
      
      if (status.isStable && status.convergenceHistory.length > 0) {
        const avgConvergence = status.convergenceHistory.reduce((a, b) => a + b, 0) / 
                              status.convergenceHistory.length;
        // Convergence ratio is limited by alphaDecay (default 0.0228), so 0.025 is realistic
        expect(avgConvergence).toBeLessThan(0.025);
      }
    });
  });
  
  describe('Early Termination', () => {
    it('should terminate early when stabilized', () => {
      const maxIterations = 1000;
      const stableLayout = new ForceDirectedLayout({
        iterations: maxIterations,
        stabilization: {
          enabled: true,
          threshold: 0.1, // Higher threshold for faster stabilization
          minIterations: 20,
          maxIterations: maxIterations
        }
      });
      
      const graphData = {
        nodes: [
          { id: 'a' },
          { id: 'b' }
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' }
        ]
      };
      
      const result = stableLayout.layout(graphData);
      
      // Should terminate before max iterations
      expect(result.metadata.stats.iterations).toBeLessThan(maxIterations);
      expect(result.metadata.stabilization.isStable).toBe(true);
    });
    
    it('should respect minimum iterations before checking', () => {
      const minIterations = 50;
      const checkLayout = new ForceDirectedLayout({
        stabilization: {
          enabled: true,
          threshold: 10, // Very high threshold
          minIterations: minIterations,
          checkInterval: 1
        }
      });
      
      const graphData = {
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ id: 'e1', source: 'a', target: 'b' }]
      };
      
      const result = checkLayout.layout(graphData);
      
      // Should run at least minimum iterations
      expect(result.metadata.stabilization.convergenceIterations).toBeGreaterThanOrEqual(minIterations);
    });
  });
  
  describe('Stabilization Status', () => {
    it('should provide complete stabilization status', () => {
      const graphData = {
        nodes: [
          { id: 'a' },
          { id: 'b' },
          { id: 'c' }
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' }
        ]
      };
      
      layout.layout(graphData);
      const status = layout.getStabilizationStatus();
      
      expect(status).toHaveProperty('isStable');
      expect(status).toHaveProperty('energy');
      expect(status).toHaveProperty('iterations');
      expect(status).toHaveProperty('convergenceHistory');
      expect(status).toHaveProperty('energyHistory');
      
      expect(typeof status.isStable).toBe('boolean');
      expect(typeof status.energy).toBe('number');
      expect(typeof status.iterations).toBe('number');
      expect(Array.isArray(status.convergenceHistory)).toBe(true);
      expect(Array.isArray(status.energyHistory)).toBe(true);
    });
  });
  
  describe('Disabled Stabilization', () => {
    it('should run full iterations when stabilization is disabled', () => {
      const iterations = 100;
      const noStabilization = new ForceDirectedLayout({
        iterations: iterations,
        stabilization: {
          enabled: false
        }
      });
      
      const graphData = {
        nodes: [
          { id: 'a' },
          { id: 'b' }
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' }
        ]
      };
      
      const result = noStabilization.layout(graphData);
      
      expect(result.metadata.stabilization.enabled).toBe(false);
      expect(result.metadata.stabilization.isStable).toBe(false);
      // Should run close to full iterations (may stop early due to alpha)
      expect(result.metadata.stats.iterations).toBeGreaterThan(iterations * 0.8);
    });
  });
  
  describe('Complex Graph Stabilization', () => {
    it('should stabilize complex graphs efficiently', () => {
      // Create a more complex graph
      const nodes = [];
      const edges = [];
      const nodeCount = 20;
      
      // Create nodes
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({ id: `n${i}` });
      }
      
      // Create edges (ring with cross connections)
      for (let i = 0; i < nodeCount; i++) {
        edges.push({
          id: `e${i}`,
          source: `n${i}`,
          target: `n${(i + 1) % nodeCount}`
        });
        
        // Add some cross connections
        if (i % 3 === 0 && i + 5 < nodeCount) {
          edges.push({
            id: `ec${i}`,
            source: `n${i}`,
            target: `n${i + 5}`
          });
        }
      }
      
      const graphData = { nodes, edges };
      const result = layout.layout(graphData);
      
      expect(result.metadata.stabilization.convergenceIterations).toBeGreaterThan(0);
      expect(result.metadata.stabilization.convergenceIterations).toBeLessThan(500);
      
      // All nodes should have positions
      expect(result.positions.size).toBe(nodeCount);
      
      // Check that positions are reasonable
      result.positions.forEach((pos) => {
        expect(isFinite(pos.x)).toBe(true);
        expect(isFinite(pos.y)).toBe(true);
        expect(Math.abs(pos.x)).toBeLessThan(1000);
        expect(Math.abs(pos.y)).toBeLessThan(1000);
      });
    });
  });
});