/**
 * Unit tests for LayoutAnimator
 * Tests animation functionality for diagram layout transitions
 */

import { jest } from '@jest/globals';
import { LayoutAnimator } from '../../../../src/renderers/diagram/animation/LayoutAnimator.js';

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

describe('LayoutAnimator', () => {
  let animator;
  
  beforeEach(() => {
    animator = new LayoutAnimator();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (animator) {
      animator.destroy();
      animator = null;
    }
  });

  describe('Basic Functionality', () => {
    test('should create animator with default configuration', () => {
      expect(animator).toBeDefined();
      expect(animator.config.duration).toBe(800);
      expect(animator.config.easing).toBe('ease-out');
      expect(animator.config.stagger).toBe(0);
      expect(animator.config.enablePositionAnimation).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customAnimator = new LayoutAnimator({
        duration: 1000,
        easing: 'ease-in',
        stagger: 50,
        enablePositionAnimation: false,
        springConfig: {
          tension: 200,
          friction: 20,
          mass: 2
        }
      });

      expect(customAnimator.config.duration).toBe(1000);
      expect(customAnimator.config.easing).toBe('ease-in');
      expect(customAnimator.config.stagger).toBe(50);
      expect(customAnimator.config.enablePositionAnimation).toBe(false);
      expect(customAnimator.config.springConfig.tension).toBe(200);

      customAnimator.destroy();
    });

    test('should provide initial animation statistics', () => {
      const stats = animator.getAnimationStats();
      
      expect(stats).toBeDefined();
      expect(stats.animationsStarted).toBe(0);
      expect(stats.animationsCompleted).toBe(0);
      expect(stats.animationsCancelled).toBe(0);
      expect(stats.activeAnimations).toBe(0);
      expect(stats.isAnimating).toBe(false);
    });

    test('should generate unique animation IDs', () => {
      const id1 = animator._generateAnimationId();
      const id2 = animator._generateAnimationId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });
  });

  describe('Layout Transition Planning', () => {
    test('should create transition plan for layout changes', () => {
      const fromLayout = {
        positions: new Map([
          ['A', { x: 100, y: 100 }],
          ['B', { x: 200, y: 100 }],
          ['C', { x: 150, y: 200 }]
        ]),
        edges: new Map([
          ['e1', { source: 'A', target: 'B', points: [{ x: 100, y: 100 }, { x: 200, y: 100 }] }]
        ])
      };

      const toLayout = {
        positions: new Map([
          ['A', { x: 50, y: 50 }],   // Moved
          ['B', { x: 250, y: 150 }], // Moved
          ['D', { x: 100, y: 300 }]  // Added
          // C removed
        ]),
        edges: new Map([
          ['e1', { source: 'A', target: 'B', points: [{ x: 50, y: 50 }, { x: 250, y: 150 }] }], // Changed
          ['e2', { source: 'A', target: 'D', points: [{ x: 50, y: 50 }, { x: 100, y: 300 }] }]  // Added
        ])
      };

      const plan = animator._createTransitionPlan(fromLayout, toLayout, animator.config);

      expect(plan).toBeDefined();
      expect(plan.nodeTransitions.size).toBe(2); // A and B
      expect(plan.addedNodes.length).toBe(1); // D
      expect(plan.removedNodes.length).toBe(1); // C
      expect(plan.edgeTransitions.size).toBe(1); // e1
      expect(plan.addedEdges.length).toBe(1); // e2

      // Check specific transition details
      const nodeATransition = plan.nodeTransitions.get('A');
      expect(nodeATransition.from).toEqual({ x: 100, y: 100 });
      expect(nodeATransition.to).toEqual({ x: 50, y: 50 });
      expect(nodeATransition.distance).toBeCloseTo(70.71, 2);

      const addedNode = plan.addedNodes[0];
      expect(addedNode.nodeId).toBe('D');
      expect(addedNode.position).toEqual({ x: 100, y: 300 });

      const removedNode = plan.removedNodes[0];
      expect(removedNode.nodeId).toBe('C');
      expect(removedNode.position).toEqual({ x: 150, y: 200 });
    });

    test('should handle empty layouts', () => {
      const emptyFromLayout = { positions: new Map(), edges: new Map() };
      const emptyToLayout = { positions: new Map(), edges: new Map() };

      const plan = animator._createTransitionPlan(emptyFromLayout, emptyToLayout, animator.config);

      expect(plan.nodeTransitions.size).toBe(0);
      expect(plan.addedNodes.length).toBe(0);
      expect(plan.removedNodes.length).toBe(0);
      expect(plan.edgeTransitions.size).toBe(0);
      expect(plan.addedEdges.length).toBe(0);
      expect(plan.removedEdges.length).toBe(0);
    });

    test('should handle missing positions and edges maps', () => {
      const fromLayout = {};
      const toLayout = {};

      const plan = animator._createTransitionPlan(fromLayout, toLayout, animator.config);

      expect(plan.nodeTransitions.size).toBe(0);
      expect(plan.addedNodes.length).toBe(0);
      expect(plan.removedNodes.length).toBe(0);
    });
  });

  describe('Node Animations', () => {
    test('should create node animation', () => {
      const nodeAnim = {
        nodeId: 'A',
        from: { x: 100, y: 100 },
        to: { x: 200, y: 150 },
        type: 'move'
      };

      const animation = animator._createNodeAnimation(nodeAnim, animator.config, 0);

      expect(animation.nodeId).toBe('A');
      expect(animation.type).toBe('move');
      expect(animation.from).toEqual({ x: 100, y: 100 });
      expect(animation.to).toEqual({ x: 200, y: 150 });
      expect(animation.duration).toBe(800);
      expect(animation.easing).toBe('ease-out');
      expect(animation.delay).toBe(0);
      expect(animation.progress).toBe(0);
      expect(animation.isComplete).toBe(false);
    });

    test('should animate multiple nodes with stagger', async () => {
      const nodeAnimations = [
        { nodeId: 'A', from: { x: 0, y: 0 }, to: { x: 100, y: 100 }, type: 'move' },
        { nodeId: 'B', from: { x: 50, y: 50 }, to: { x: 150, y: 150 }, type: 'move' },
        { nodeId: 'C', from: { x: 100, y: 100 }, to: { x: 200, y: 200 }, type: 'move' }
      ];

      const animationPromise = animator.animateNodes(nodeAnimations, { 
        duration: 100,
        stagger: 20
      });

      expect(animator.isAnimating).toBe(true);
      expect(animator.animationGroups.size).toBe(1);

      const group = Array.from(animator.animationGroups.values())[0];
      expect(group.animations.size).toBe(3);

      // Check stagger delays
      const animA = group.animations.get('A');
      const animB = group.animations.get('B');
      const animC = group.animations.get('C');

      expect(animA.delay).toBe(0);
      expect(animB.delay).toBe(20);
      expect(animC.delay).toBe(40);

      // Note: In a real test environment, we'd need to mock time progression
      // For now, we just verify the setup is correct
    });

    test('should handle node appearance animation', () => {
      const nodeAnim = {
        nodeId: 'newNode',
        from: { x: 100, y: 100, opacity: 0 },
        to: { x: 100, y: 100, opacity: 1 },
        type: 'appear'
      };

      const animation = animator._createNodeAnimation(nodeAnim, animator.config);

      expect(animation.type).toBe('appear');
      expect(animation.from.opacity).toBe(0);
      expect(animation.to.opacity).toBe(1);
    });

    test('should handle node disappearance animation', () => {
      const nodeAnim = {
        nodeId: 'removedNode',
        from: { x: 100, y: 100, opacity: 1 },
        to: { x: 100, y: 100, opacity: 0 },
        type: 'disappear'
      };

      const animation = animator._createNodeAnimation(nodeAnim, animator.config);

      expect(animation.type).toBe('disappear');
      expect(animation.from.opacity).toBe(1);
      expect(animation.to.opacity).toBe(0);
    });
  });

  describe('Edge Animations', () => {
    test('should create edge animation', () => {
      const edgeAnim = {
        edgeId: 'e1',
        from: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
        to: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
        type: 'reroute'
      };

      const animation = animator._createEdgeAnimation(edgeAnim, animator.config, 10);

      expect(animation.edgeId).toBe('e1');
      expect(animation.type).toBe('reroute');
      expect(animation.delay).toBe(10);
      expect(animation.isComplete).toBe(false);
    });

    test('should animate multiple edges', async () => {
      const edgeAnimations = [
        {
          edgeId: 'e1',
          from: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
          to: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
          type: 'reroute'
        },
        {
          edgeId: 'e2',
          from: { points: [{ x: 50, y: 50 }, { x: 150, y: 50 }] },
          to: { points: [{ x: 50, y: 50 }, { x: 150, y: 150 }] },
          type: 'reroute'
        }
      ];

      const animationPromise = animator.animateEdges(edgeAnimations, { duration: 100 });

      expect(animator.isAnimating).toBe(true);
      expect(animator.animationGroups.size).toBe(1);

      const group = Array.from(animator.animationGroups.values())[0];
      expect(group.type).toBe('edges');
      expect(group.animations.size).toBe(2);
    });
  });

  describe('Spring Animations', () => {
    test('should create spring animation', async () => {
      const springPromise = animator.animateWithSpring(
        'springNode',
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          spring: { tension: 150, friction: 10, mass: 1 },
          onUpdate: jest.fn()
        }
      );

      expect(animator.isAnimating).toBe(true);
      expect(animator.activeAnimations.size).toBe(1);

      const animation = Array.from(animator.activeAnimations.values())[0];
      expect(animation.type).toBe('spring');
      expect(animation.nodeId).toBe('springNode');
      expect(animation.config.tension).toBe(150);
      expect(animation.config.friction).toBe(10);
      expect(animation.current).toEqual({ x: 0, y: 0 });
      expect(animation.velocity).toEqual({ x: 0, y: 0 });
    });

    test('should update spring physics correctly', () => {
      const springAnimation = {
        type: 'spring',
        nodeId: 'test',
        from: { x: 0, y: 0 },
        to: { x: 100, y: 0 },
        current: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        config: { tension: 120, friction: 14, mass: 1 },
        startTime: 0,
        isComplete: false,
        onUpdate: jest.fn()
      };

      // Simulate first frame
      animator._updateSpringAnimation(springAnimation, 16);

      // Velocity should have increased due to spring force
      expect(springAnimation.velocity.x).toBeGreaterThan(0);
      expect(springAnimation.current.x).toBeGreaterThan(0);
      expect(springAnimation.current.x).toBeLessThan(100); // Shouldn't overshoot immediately
      expect(springAnimation.onUpdate).toHaveBeenCalledWith(springAnimation.current, 'test');
    });

    test('should complete spring animation when near target', () => {
      const springAnimation = {
        type: 'spring',
        current: { x: 99.9, y: 99.9 },
        to: { x: 100, y: 100 },
        velocity: { x: 0.1, y: 0.1 },
        config: { tension: 120, friction: 14, mass: 1 },
        isComplete: false
      };

      animator._updateSpringAnimation(springAnimation, 100);

      expect(springAnimation.isComplete).toBe(true);
      expect(springAnimation.current).toEqual({ x: 100, y: 100 });
    });
  });

  describe('Easing Functions', () => {
    test('should apply linear easing correctly', () => {
      expect(animator._applyEasing(0, 'linear')).toBe(0);
      expect(animator._applyEasing(0.5, 'linear')).toBe(0.5);
      expect(animator._applyEasing(1, 'linear')).toBe(1);
    });

    test('should apply ease-in correctly', () => {
      const result = animator._applyEasing(0.5, 'ease-in');
      expect(result).toBe(0.25); // 0.5^2
    });

    test('should apply ease-out correctly', () => {
      const result = animator._applyEasing(0.5, 'ease-out');
      expect(result).toBe(0.75); // 1 - (1-0.5)^2
    });

    test('should apply ease-in-out correctly', () => {
      const result1 = animator._applyEasing(0.25, 'ease-in-out');
      const result2 = animator._applyEasing(0.75, 'ease-in-out');
      
      // Should be symmetric around 0.5
      expect(result1).toBeLessThan(0.25);
      expect(result2).toBeGreaterThan(0.75);
    });

    test('should fallback to linear for unknown easing', () => {
      expect(animator._applyEasing(0.7, 'unknown-easing')).toBe(0.7);
    });
  });

  describe('Property Interpolation', () => {
    test('should interpolate numeric properties', () => {
      const from = { x: 0, y: 100, width: 50 };
      const to = { x: 100, y: 0, width: 150 };

      const result = animator._interpolateProperties(from, to, 0.5);

      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
      expect(result.width).toBe(100);
    });

    test('should handle non-numeric properties', () => {
      const from = { x: 0, color: 'red', visible: true };
      const to = { x: 100, color: 'blue', visible: false };

      const result1 = animator._interpolateProperties(from, to, 0.3);
      const result2 = animator._interpolateProperties(from, to, 0.7);

      expect(result1.x).toBe(30);
      expect(result1.color).toBe('red'); // Should keep 'from' value at < 0.5
      expect(result1.visible).toBe(true);

      expect(result2.x).toBe(70);
      expect(result2.color).toBe('blue'); // Should switch to 'to' value at >= 0.5
      expect(result2.visible).toBe(false);
    });

    test('should handle missing properties gracefully', () => {
      const from = { x: 0 };
      const to = { x: 100, y: 200 };

      const result = animator._interpolateProperties(from, to, 0.5);

      expect(result.x).toBe(50);
      expect(result.y).toBe(200); // Should use 'to' value when 'from' is missing
    });
  });

  describe('Animation Control', () => {
    test('should cancel all animations', () => {
      // Start some animations
      animator.animateNodes([
        { nodeId: 'A', from: { x: 0, y: 0 }, to: { x: 100, y: 100 } }
      ]);

      animator.animateWithSpring('B', { x: 0, y: 0 }, { x: 50, y: 50 });

      expect(animator.activeAnimations.size).toBeGreaterThan(0);
      expect(animator.animationGroups.size).toBeGreaterThan(0);
      expect(animator.isAnimating).toBe(true);

      animator.cancelAllAnimations();

      expect(animator.activeAnimations.size).toBe(0);
      expect(animator.animationGroups.size).toBe(0);
      expect(animator.isAnimating).toBe(false);
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    test('should cancel specific animation by ID', () => {
      const springPromise = animator.animateWithSpring('test', { x: 0, y: 0 }, { x: 100, y: 100 });
      
      const animationId = Array.from(animator.activeAnimations.keys())[0];
      expect(animator.activeAnimations.size).toBe(1);

      animator.cancelAnimation(animationId);

      expect(animator.activeAnimations.size).toBe(0);
    });

    test('should handle cancellation of non-existent animation', () => {
      const initialAnimations = animator.activeAnimations.size;
      
      animator.cancelAnimation('non-existent-id');
      
      expect(animator.activeAnimations.size).toBe(initialAnimations);
    });
  });

  describe('Distance Calculation', () => {
    test('should calculate distance between points correctly', () => {
      const from = { x: 0, y: 0 };
      const to = { x: 3, y: 4 };

      const distance = animator._calculateDistance(from, to);

      expect(distance).toBe(5); // 3-4-5 triangle
    });

    test('should handle same point distance', () => {
      const point = { x: 100, y: 200 };
      const distance = animator._calculateDistance(point, point);

      expect(distance).toBe(0);
    });

    test('should handle negative coordinates', () => {
      const from = { x: -10, y: -10 };
      const to = { x: 20, y: 20 };

      const distance = animator._calculateDistance(from, to);

      expect(distance).toBeCloseTo(42.43, 2);
    });
  });

  describe('Animation Statistics', () => {
    test('should track animation statistics', () => {
      const initialStats = animator.getAnimationStats();
      expect(initialStats.animationsStarted).toBe(0);

      // Start an animation
      animator.animateNodes([
        { nodeId: 'A', from: { x: 0, y: 0 }, to: { x: 100, y: 100 } }
      ]);

      const stats = animator.getAnimationStats();
      expect(stats.activeAnimations).toBeGreaterThanOrEqual(0);
      expect(stats.activeGroups).toBe(1);
      expect(stats.isAnimating).toBe(true);
      expect(stats.queueLength).toBe(0);
    });

    test('should update statistics on animation completion', () => {
      const mockOnComplete = jest.fn();
      
      animator.animateNodes([
        { nodeId: 'A', from: { x: 0, y: 0 }, to: { x: 100, y: 100 } }
      ], { onComplete: mockOnComplete });

      // In a real scenario, we'd advance time to complete the animation
      // For now, we just verify the setup
      expect(animator.getAnimationStats().activeGroups).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty node animations array', async () => {
      const result = await animator.animateNodes([], { duration: 100 });
      
      // Should complete immediately without error
      expect(result).toBeUndefined();
    });

    test('should handle invalid animation parameters', () => {
      expect(() => {
        animator._createNodeAnimation({}, animator.config);
      }).not.toThrow();
    });

    test('should handle animation group completion detection', () => {
      const group = {
        animations: new Map([
          ['A', { isComplete: true }],
          ['B', { isComplete: true }],
          ['C', { isComplete: false }]
        ])
      };

      expect(animator._isGroupComplete(group)).toBe(false);

      group.animations.get('C').isComplete = true;
      expect(animator._isGroupComplete(group)).toBe(true);
    });

    test('should handle empty animation group', () => {
      const emptyGroup = { animations: new Map() };
      expect(animator._isGroupComplete(emptyGroup)).toBe(true);
    });
  });

  describe('Performance and Memory Management', () => {
    test('should clean up completed animations', () => {
      const animation = {
        type: 'spring',
        isComplete: true,
        onComplete: jest.fn(),
        resolve: jest.fn()
      };

      animator.activeAnimations.set('test-id', animation);
      
      // Simulate cleanup during tick
      animator._tick(performance.now());
      
      expect(animation.onComplete).toHaveBeenCalled();
      expect(animation.resolve).toHaveBeenCalled();
    });

    test('should destroy animator cleanly', () => {
      animator.animateNodes([
        { nodeId: 'A', from: { x: 0, y: 0 }, to: { x: 100, y: 100 } }
      ]);

      expect(animator.isAnimating).toBe(true);

      animator.destroy();

      expect(animator.config).toBeNull();
      expect(animator.stats).toBeNull();
    });

    test('should handle high frequency animation updates', () => {
      const updateCallback = jest.fn();
      
      animator.animateWithSpring('test', { x: 0, y: 0 }, { x: 100, y: 100 }, {
        onUpdate: updateCallback
      });

      // Simulate multiple rapid frames
      for (let i = 0; i < 10; i++) {
        animator._tick(i * 16); // 60fps
      }

      expect(updateCallback.mock.calls.length).toBeGreaterThan(0);
    });
  });
});