/**
 * Unit tests for LayoutTransitionManager
 * Tests smooth transitions between different layout states with animations
 */

import { jest } from '@jest/globals';
import { LayoutTransitionManager } from '../../../../src/renderers/diagram/layout/LayoutTransitionManager.js';

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(callback => setTimeout(callback, 16));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

const createSamplePositions = (prefix = 'node', count = 4) => {
  const positions = new Map();
  
  for (let i = 0; i < count; i++) {
    positions.set(`${prefix}${i}`, {
      x: i * 100,
      y: i * 50,
      opacity: 1,
      scale: 1,
      rotation: 0
    });
  }
  
  return positions;
};

const createTargetPositions = (prefix = 'node', count = 4) => {
  const positions = new Map();
  
  for (let i = 0; i < count; i++) {
    positions.set(`${prefix}${i}`, {
      x: i * 150 + 200,
      y: i * 75 + 100,
      opacity: 1,
      scale: 1,
      rotation: Math.PI / 4
    });
  }
  
  return positions;
};

describe('LayoutTransitionManager', () => {
  let transitionManager;
  let fromPositions;
  let toPositions;

  beforeEach(() => {
    fromPositions = createSamplePositions();
    toPositions = createTargetPositions();
    jest.clearAllMocks();
    performance.now.mockReturnValue(1000);
  });

  afterEach(() => {
    if (transitionManager) {
      transitionManager.destroy();
      transitionManager = null;
    }
  });

  describe('Initialization', () => {
    test('should create transition manager with default configuration', () => {
      transitionManager = new LayoutTransitionManager();

      expect(transitionManager).toBeDefined();
      expect(transitionManager.config.duration).toBe(800);
      expect(transitionManager.config.delay).toBe(0);
      expect(transitionManager.config.easing).toBe('easeInOutCubic');
      expect(transitionManager.config.enableFade).toBe(true);
      expect(transitionManager.config.enableScale).toBe(true);
      expect(transitionManager.config.enableRotate).toBe(false);
      expect(transitionManager.activeTransition).toBeNull();
    });

    test('should accept custom configuration', () => {
      const onStart = jest.fn();
      const onComplete = jest.fn();

      transitionManager = new LayoutTransitionManager({
        duration: 1200,
        delay: 100,
        easing: 'easeOutBounce',
        enableFade: false,
        enableScale: false,
        enableRotate: true,
        staggerDelay: 50,
        batchSize: 25,
        onStart,
        onComplete
      });

      expect(transitionManager.config.duration).toBe(1200);
      expect(transitionManager.config.delay).toBe(100);
      expect(transitionManager.config.easing).toBe('easeOutBounce');
      expect(transitionManager.config.enableFade).toBe(false);
      expect(transitionManager.config.enableScale).toBe(false);
      expect(transitionManager.config.enableRotate).toBe(true);
      expect(transitionManager.config.staggerDelay).toBe(50);
      expect(transitionManager.config.batchSize).toBe(25);
      expect(transitionManager.config.onStart).toBe(onStart);
      expect(transitionManager.config.onComplete).toBe(onComplete);
    });

    test('should initialize with proper easing functions', () => {
      transitionManager = new LayoutTransitionManager();

      expect(transitionManager.easingFunctions.linear).toBeDefined();
      expect(transitionManager.easingFunctions.easeInOutCubic).toBeDefined();
      expect(transitionManager.easingFunctions.easeOutBounce).toBeDefined();
      expect(transitionManager.easingFunctions.easeInElastic).toBeDefined();
      expect(typeof transitionManager.easingFunctions.linear).toBe('function');

      // Test linear easing
      expect(transitionManager.easingFunctions.linear(0.5)).toBe(0.5);
      expect(transitionManager.easingFunctions.linear(0)).toBe(0);
      expect(transitionManager.easingFunctions.linear(1)).toBe(1);
    });
  });

  describe('Easing Functions', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager();
    });

    test('should provide various easing functions', () => {
      const easings = ['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutCubic', 
                      'easeOutBounce', 'easeInElastic', 'easeOutElastic'];

      easings.forEach(easing => {
        expect(transitionManager.easingFunctions[easing]).toBeDefined();
        expect(typeof transitionManager.easingFunctions[easing]).toBe('function');

        // Test boundary conditions
        const fn = transitionManager.easingFunctions[easing];
        expect(fn(0)).toBeCloseTo(0, 3);
        expect(fn(1)).toBeCloseTo(1, 3);
      });
    });

    test('should handle custom easing functions', () => {
      const customEasing = t => t * t * t; // cubic
      transitionManager.addEasingFunction('custom', customEasing);

      expect(transitionManager.easingFunctions.custom).toBe(customEasing);
      expect(transitionManager.easingFunctions.custom(0.5)).toBe(0.125);
    });

    test('should ignore invalid easing functions', () => {
      const initialCount = Object.keys(transitionManager.easingFunctions).length;

      transitionManager.addEasingFunction('invalid', 'not-a-function');
      transitionManager.addEasingFunction('invalid2', null);

      expect(Object.keys(transitionManager.easingFunctions).length).toBe(initialCount);
    });
  });

  describe('Basic Transition', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager({
        duration: 100,
        useRAF: false // Use setTimeout for predictable testing
      });
    });

    test('should execute basic transition successfully', async () => {
      const onStart = jest.fn();
      const onComplete = jest.fn();

      const result = await transitionManager.transition(fromPositions, toPositions, {
        onStart,
        onComplete
      });

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(toPositions.size);
      expect(onStart).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
      expect(transitionManager.stats.totalTransitions).toBe(1);
      expect(transitionManager.stats.completedTransitions).toBe(1);
    });

    test('should interpolate positions correctly', async () => {
      const onProgress = jest.fn();

      await transitionManager.transition(fromPositions, toPositions, {
        onProgress
      });

      expect(onProgress).toHaveBeenCalled();

      // Check that progress was called with values between 0 and 1
      const progressCalls = onProgress.mock.calls;
      expect(progressCalls.length).toBeGreaterThan(0);

      const progressValues = progressCalls.map(call => call[1]);
      expect(Math.min(...progressValues)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...progressValues)).toBeLessThanOrEqual(1);
    });

    test('should handle empty position maps', async () => {
      const emptyFrom = new Map();
      const emptyTo = new Map();

      const result = await transitionManager.transition(emptyFrom, emptyTo);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test('should handle single node transition', async () => {
      const singleFrom = new Map([['node1', { x: 0, y: 0 }]]);
      const singleTo = new Map([['node1', { x: 100, y: 100 }]]);

      const result = await transitionManager.transition(singleFrom, singleTo);

      expect(result.size).toBe(1);
      expect(result.get('node1')).toEqual({ x: 100, y: 100 });
    });
  });

  describe('Transition Options', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager({ useRAF: false });
    });

    test('should handle staggered delays', async () => {
      const onProgress = jest.fn();

      await transitionManager.transition(fromPositions, toPositions, {
        staggerDelay: 10,
        onProgress
      });

      expect(onProgress).toHaveBeenCalled();
      // With stagger delay, transition should take longer
      expect(transitionManager.stats.averageDuration).toBeGreaterThan(100);
    });

    test('should skip small movements when configured', async () => {
      const smallMovement = new Map([
        ['node1', { x: 100, y: 100 }]
      ]);
      const targetSmall = new Map([
        ['node1', { x: 102, y: 103 }] // Very small movement
      ]);

      await transitionManager.transition(smallMovement, targetSmall, {
        skipSmallMovements: true,
        minMovementThreshold: 10
      });

      // Should complete very quickly since movement is skipped
      expect(transitionManager.stats.averageDuration).toBeLessThan(50);
    });

    test('should handle fade effects', async () => {
      const onProgress = jest.fn();

      await transitionManager.transition(fromPositions, toPositions, {
        enableFade: true,
        onProgress
      });

      expect(onProgress).toHaveBeenCalled();

      // Check that positions include opacity values
      const progressCalls = onProgress.mock.calls;
      const lastCall = progressCalls[progressCalls.length - 1];
      const positions = lastCall[2]; // Third parameter is current positions

      positions.forEach(pos => {
        expect(pos.opacity).toBeDefined();
      });
    });

    test('should handle scale effects', async () => {
      const onProgress = jest.fn();

      await transitionManager.transition(fromPositions, toPositions, {
        enableScale: true,
        onProgress
      });

      expect(onProgress).toHaveBeenCalled();

      // Check that positions include scale values
      const progressCalls = onProgress.mock.calls;
      const lastCall = progressCalls[progressCalls.length - 1];
      const positions = lastCall[2];

      positions.forEach(pos => {
        expect(pos.scale).toBeDefined();
      });
    });

    test('should handle rotation effects', async () => {
      const onProgress = jest.fn();

      await transitionManager.transition(fromPositions, toPositions, {
        enableRotate: true,
        onProgress
      });

      expect(onProgress).toHaveBeenCalled();

      // Check that positions include rotation values
      const progressCalls = onProgress.mock.calls;
      const lastCall = progressCalls[progressCalls.length - 1];
      const positions = lastCall[2];

      positions.forEach(pos => {
        expect(pos.rotation).toBeDefined();
      });
    });
  });

  describe('Transition Interruption', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager({
        duration: 1000,
        useRAF: false
      });
    });

    test('should cancel existing transition when starting new one', async () => {
      const onCancel = jest.fn();

      // Start first transition
      const firstTransition = transitionManager.transition(fromPositions, toPositions, {
        onCancel
      });

      // Start second transition immediately
      const secondPositions = createTargetPositions('node', 4);
      await transitionManager.transition(toPositions, secondPositions);

      // First transition should be canceled
      await expect(firstTransition).rejects.toThrow('Transition cancelled');
      expect(transitionManager.stats.canceledTransitions).toBe(1);
    });

    test('should handle complete interruption behavior', async () => {
      const firstComplete = jest.fn();

      // Start first transition
      const firstTransition = transitionManager.transition(fromPositions, toPositions, {
        onComplete: firstComplete
      });

      // Immediately start second transition with complete behavior
      const secondPositions = createTargetPositions('node', 4);
      await transitionManager.transition(toPositions, secondPositions, {
        interruptionBehavior: 'complete'
      });

      // Wait for first transition to resolve
      await expect(firstTransition).rejects.toThrow();

      expect(transitionManager.stats.totalTransitions).toBe(2);
    });

    test('should allow manual cancellation', async () => {
      const onCancel = jest.fn();

      const transition = transitionManager.transition(fromPositions, toPositions, {
        onCancel
      });

      // Cancel transition manually
      transitionManager.cancelTransition();

      await expect(transition).rejects.toThrow('Transition cancelled');
      expect(transitionManager.isTransitioning()).toBe(false);
    });

    test('should handle cancel interruption behavior', async () => {
      // Start first transition
      const firstTransition = transitionManager.transition(fromPositions, toPositions);

      // Start second with cancel behavior
      const secondPositions = createTargetPositions('node', 4);
      await transitionManager.transition(toPositions, secondPositions, {
        interruptionBehavior: 'cancel'
      });

      await expect(firstTransition).rejects.toThrow('Transition cancelled');
      expect(transitionManager.stats.canceledTransitions).toBe(1);
    });
  });

  describe('Node State Management', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager({ useRAF: false });
    });

    test('should handle nodes appearing and disappearing', async () => {
      const fromNodes = new Map([
        ['node1', { x: 0, y: 0 }],
        ['node2', { x: 100, y: 0 }]
      ]);

      const toNodes = new Map([
        ['node2', { x: 200, y: 100 }],
        ['node3', { x: 300, y: 200 }]
      ]);

      const result = await transitionManager.transition(fromNodes, toNodes);

      expect(result.size).toBe(2);
      expect(result.has('node2')).toBe(true);
      expect(result.has('node3')).toBe(true);
    });

    test('should handle nodes with missing properties gracefully', async () => {
      const fromIncomplete = new Map([
        ['node1', { x: 0 }], // Missing y
        ['node2', { y: 100 }] // Missing x
      ]);

      const toComplete = new Map([
        ['node1', { x: 100, y: 100 }],
        ['node2', { x: 200, y: 200 }]
      ]);

      const result = await transitionManager.transition(fromIncomplete, toComplete);

      expect(result.size).toBe(2);
      // Should handle missing properties by defaulting to 0
      expect(result.get('node1').x).toBe(100);
      expect(result.get('node1').y).toBe(100);
    });

    test('should preserve additional node properties', async () => {
      const fromExtra = new Map([
        ['node1', { x: 0, y: 0, customProp: 'value1', size: 50 }]
      ]);

      const toExtra = new Map([
        ['node1', { x: 100, y: 100, customProp: 'value2', size: 75 }]
      ]);

      const onProgress = jest.fn();
      await transitionManager.transition(fromExtra, toExtra, { onProgress });

      // Check that custom properties are maintained
      expect(onProgress).toHaveBeenCalled();
      const progressCalls = onProgress.mock.calls;
      const finalPositions = progressCalls[progressCalls.length - 1][2];

      expect(finalPositions.get('node1').customProp).toBeDefined();
    });
  });

  describe('Performance and Statistics', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager({ useRAF: false });
    });

    test('should track transition statistics', async () => {
      expect(transitionManager.stats.totalTransitions).toBe(0);

      await transitionManager.transition(fromPositions, toPositions);

      expect(transitionManager.stats.totalTransitions).toBe(1);
      expect(transitionManager.stats.completedTransitions).toBe(1);
      expect(transitionManager.stats.averageDuration).toBeGreaterThan(0);
    });

    test('should track canceled transitions', async () => {
      const transition = transitionManager.transition(fromPositions, toPositions);
      transitionManager.cancelTransition();

      await expect(transition).rejects.toThrow();

      expect(transitionManager.stats.canceledTransitions).toBe(1);
    });

    test('should reset statistics', async () => {
      await transitionManager.transition(fromPositions, toPositions);

      expect(transitionManager.stats.totalTransitions).toBe(1);

      transitionManager.resetStats();

      expect(transitionManager.stats.totalTransitions).toBe(0);
      expect(transitionManager.stats.completedTransitions).toBe(0);
      expect(transitionManager.stats.averageDuration).toBe(0);
    });

    test('should provide performance stats', async () => {
      await transitionManager.transition(fromPositions, toPositions);

      const stats = transitionManager.getStats();

      expect(stats).toHaveProperty('totalTransitions');
      expect(stats).toHaveProperty('completedTransitions');
      expect(stats).toHaveProperty('canceledTransitions');
      expect(stats).toHaveProperty('averageDuration');
      expect(stats).toHaveProperty('totalDuration');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager();
    });

    test('should get current configuration', () => {
      const config = transitionManager.getConfig();

      expect(config).toHaveProperty('duration');
      expect(config).toHaveProperty('easing');
      expect(config).toHaveProperty('enableFade');
      expect(config.duration).toBe(800);
    });

    test('should update configuration', () => {
      transitionManager.updateConfig({
        duration: 1500,
        easing: 'easeOutBounce'
      });

      const config = transitionManager.getConfig();
      expect(config.duration).toBe(1500);
      expect(config.easing).toBe('easeOutBounce');
    });

    test('should merge configuration updates', () => {
      const originalDelay = transitionManager.config.delay;

      transitionManager.updateConfig({
        duration: 1500
      });

      expect(transitionManager.config.duration).toBe(1500);
      expect(transitionManager.config.delay).toBe(originalDelay); // Should be preserved
    });
  });

  describe('Transition State Queries', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager({ 
        duration: 1000,
        useRAF: false 
      });
    });

    test('should report transition status correctly', async () => {
      expect(transitionManager.isTransitioning()).toBe(false);
      expect(transitionManager.getTransitionProgress()).toBe(0);

      const transitionPromise = transitionManager.transition(fromPositions, toPositions);

      // Should be transitioning now
      expect(transitionManager.isTransitioning()).toBe(true);

      await transitionPromise;

      expect(transitionManager.isTransitioning()).toBe(false);
    });

    test('should report progress during transition', async () => {
      const progressValues = [];
      const onProgress = (id, progress) => {
        progressValues.push(progress);
      };

      await transitionManager.transition(fromPositions, toPositions, {
        onProgress
      });

      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[0]).toBeGreaterThanOrEqual(0);
      expect(progressValues[progressValues.length - 1]).toBeLessThanOrEqual(1);

      // Progress should generally increase
      const increasing = progressValues.every((val, i) => 
        i === 0 || val >= progressValues[i - 1]
      );
      expect(increasing).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager({ useRAF: false });
    });

    test('should handle zero duration transition', async () => {
      const result = await transitionManager.transition(fromPositions, toPositions, {
        duration: 0
      });

      expect(result).toEqual(toPositions);
    });

    test('should handle invalid easing function gracefully', async () => {
      await transitionManager.transition(fromPositions, toPositions, {
        easing: 'nonexistent-easing'
      });

      // Should fallback to default easing without crashing
      expect(transitionManager.stats.completedTransitions).toBe(1);
    });

    test('should handle positions with NaN or Infinity values', async () => {
      const invalidFrom = new Map([
        ['node1', { x: NaN, y: 0 }],
        ['node2', { x: Infinity, y: 100 }]
      ]);

      const validTo = new Map([
        ['node1', { x: 100, y: 100 }],
        ['node2', { x: 200, y: 200 }]
      ]);

      // Should not crash with invalid values
      await expect(transitionManager.transition(invalidFrom, validTo)).resolves.toBeDefined();
    });

    test('should handle extremely large position values', async () => {
      const largeFrom = new Map([
        ['node1', { x: 1e6, y: 1e6 }]
      ]);

      const largeTo = new Map([
        ['node1', { x: 2e6, y: 2e6 }]
      ]);

      const result = await transitionManager.transition(largeFrom, largeTo);

      expect(result.get('node1').x).toBe(2e6);
      expect(result.get('node1').y).toBe(2e6);
    });
  });

  describe('Cleanup', () => {
    test('should destroy cleanly', () => {
      transitionManager = new LayoutTransitionManager();

      const transitionPromise = transitionManager.transition(fromPositions, toPositions);
      
      transitionManager.destroy();

      expect(transitionManager.activeTransition).toBeNull();
      expect(transitionManager.animationFrame).toBeNull();
      expect(Object.keys(transitionManager.easingFunctions).length).toBe(0);

      // Original transition should be canceled
      return expect(transitionPromise).rejects.toThrow();
    });

    test('should handle multiple destroy calls', () => {
      transitionManager = new LayoutTransitionManager();

      expect(() => {
        transitionManager.destroy();
        transitionManager.destroy();
        transitionManager.destroy();
      }).not.toThrow();
    });
  });

  describe('Integration with Layout Systems', () => {
    beforeEach(() => {
      transitionManager = new LayoutTransitionManager({ 
        duration: 200,
        useRAF: false 
      });
    });

    test('should handle transitions between different layout types', async () => {
      // Simulate circular to grid layout transition
      const circularPositions = new Map([
        ['node1', { x: 200, y: 200 }], // center
        ['node2', { x: 300, y: 200 }], // right
        ['node3', { x: 200, y: 100 }], // top
        ['node4', { x: 100, y: 200 }]  // left
      ]);

      const gridPositions = new Map([
        ['node1', { x: 100, y: 100 }],
        ['node2', { x: 200, y: 100 }],
        ['node3', { x: 100, y: 200 }],
        ['node4', { x: 200, y: 200 }]
      ]);

      const result = await transitionManager.transition(circularPositions, gridPositions);

      expect(result).toEqual(gridPositions);
    });

    test('should handle complex hierarchy transitions', async () => {
      // Simulate tree-like to layered layout transition
      const treePositions = new Map([
        ['root', { x: 200, y: 50 }],
        ['child1', { x: 100, y: 150 }],
        ['child2', { x: 300, y: 150 }],
        ['leaf1', { x: 50, y: 250 }],
        ['leaf2', { x: 150, y: 250 }]
      ]);

      const layeredPositions = new Map([
        ['root', { x: 250, y: 50 }],
        ['child1', { x: 150, y: 150 }],
        ['child2', { x: 350, y: 150 }],
        ['leaf1', { x: 100, y: 250 }],
        ['leaf2', { x: 200, y: 250 }]
      ]);

      const result = await transitionManager.transition(treePositions, layeredPositions);

      expect(result).toEqual(layeredPositions);
      expect(transitionManager.stats.completedTransitions).toBe(1);
    });
  });
});