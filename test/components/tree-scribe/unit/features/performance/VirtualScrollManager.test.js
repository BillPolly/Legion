/**
 * VirtualScrollManager Tests
 * 
 * Testing virtual scrolling for large tree documents
 */

import { VirtualScrollManager } from '../../../../../../src/components/tree-scribe/features/performance/VirtualScrollManager.js';

describe('VirtualScrollManager', () => {
  let manager;
  let container;
  let scrollContainer;

  beforeEach(() => {
    // Create mock DOM structure
    container = document.createElement('div');
    container.style.height = '500px';
    container.style.overflow = 'auto';
    
    scrollContainer = document.createElement('div');
    container.appendChild(scrollContainer);
    
    document.body.appendChild(container);
    
    // Mock getBoundingClientRect
    container.getBoundingClientRect = () => ({
      top: 0,
      bottom: 500,
      height: 500,
      left: 0,
      right: 800,
      width: 800
    });
  });

  afterEach(() => {
    if (manager && !manager.destroyed) {
      manager.destroy();
    }
    document.body.removeChild(container);
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000
      });

      expect(manager.destroyed).toBe(false);
      expect(manager.options.itemHeight).toBe(30);
      expect(manager.options.totalItems).toBe(1000);
      expect(manager.options.buffer).toBe(5);
      expect(manager.options.overscan).toBe(3);
    });

    test('should accept custom options', () => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 50,
        totalItems: 500,
        buffer: 10,
        overscan: 5,
        onVisibleRangeChange: () => {}
      });

      expect(manager.options.itemHeight).toBe(50);
      expect(manager.options.totalItems).toBe(500);
      expect(manager.options.buffer).toBe(10);
      expect(manager.options.overscan).toBe(5);
      expect(manager.options.onVisibleRangeChange).toBeDefined();
    });

    test('should calculate initial viewport', () => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000
      });

      const viewport = manager.getViewport();
      expect(viewport.height).toBe(500);
      expect(viewport.scrollTop).toBe(0);
      expect(viewport.visibleStart).toBe(0);
      expect(viewport.visibleEnd).toBeGreaterThan(0);
    });

    test('should set total scroll height', () => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000
      });

      const spacer = container.querySelector('.virtual-scroll-spacer');
      expect(spacer).toBeTruthy();
      expect(spacer.style.height).toBe('30000px'); // 1000 * 30
    });
  });

  describe('Scroll Handling', () => {
    beforeEach(() => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000
      });
    });

    test('should update visible range on scroll', (done) => {
      let rangeChanges = [];
      manager.onVisibleRangeChange((range) => {
        rangeChanges.push(range);
      });

      // Simulate scroll
      container.scrollTop = 300; // 10 items down
      container.dispatchEvent(new Event('scroll'));

      // Wait for RAF
      requestAnimationFrame(() => {
        expect(rangeChanges.length).toBeGreaterThan(0);
        expect(rangeChanges[0].start).toBeLessThanOrEqual(10);
        expect(rangeChanges[0].end).toBeGreaterThan(10);
        done();
      });
    });

    test('should include buffer in visible range', (done) => {
      manager.options.buffer = 5;
      
      let visibleRange = null;
      manager.onVisibleRangeChange((range) => {
        visibleRange = range;
      });

      // Scroll to item 20
      container.scrollTop = 600; // 20 * 30
      container.dispatchEvent(new Event('scroll'));

      // Wait for RAF
      requestAnimationFrame(() => {
        // Should include buffer items before and after
        expect(visibleRange).toBeTruthy();
        expect(visibleRange.start).toBeLessThanOrEqual(15); // 20 - 5
        expect(visibleRange.end).toBeGreaterThanOrEqual(25 + Math.ceil(500/30)); // visible items + buffer
        done();
      });
    });

    test('should debounce scroll events', (done) => {
      let changeCount = 0;
      manager.onVisibleRangeChange(() => {
        changeCount++;
      });

      // Fire multiple scroll events rapidly
      for (let i = 0; i < 10; i++) {
        container.scrollTop = i * 30;
        container.dispatchEvent(new Event('scroll'));
      }

      // Initial callback happens in RAF, then debounced callback
      // Wait for both
      setTimeout(() => {
        // Should have fired for initial RAF and maybe one debounced
        expect(changeCount).toBeLessThanOrEqual(2);
        done();
      }, 100);
    });

    test('should handle scroll to bottom', () => {
      let visibleRange = null;
      manager.onVisibleRangeChange((range) => {
        visibleRange = range;
      });

      // Scroll to bottom
      container.scrollTop = 30000 - 500; // total height - viewport height
      container.dispatchEvent(new Event('scroll'));

      expect(visibleRange.end).toBe(999); // Last item (0-indexed)
    });
  });

  describe('Item Rendering', () => {
    beforeEach(() => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 100
      });
    });

    test('should get item position', () => {
      const pos0 = manager.getItemPosition(0);
      expect(pos0.top).toBe(0);
      expect(pos0.height).toBe(30);

      const pos10 = manager.getItemPosition(10);
      expect(pos10.top).toBe(300); // 10 * 30
      expect(pos10.height).toBe(30);
    });

    test('should check if item is visible', () => {
      // First items should be visible
      expect(manager.isItemVisible(0)).toBe(true);
      expect(manager.isItemVisible(5)).toBe(true);

      // Items far down should not be visible
      expect(manager.isItemVisible(50)).toBe(false);
      expect(manager.isItemVisible(99)).toBe(false);

      // Scroll down
      container.scrollTop = 1500; // Show items around 50
      container.dispatchEvent(new Event('scroll'));

      // Update visibility checks
      expect(manager.isItemVisible(0)).toBe(false);
      expect(manager.isItemVisible(50)).toBe(true);
    });

    test('should render visible items only', () => {
      const items = [];
      for (let i = 0; i < 100; i++) {
        items.push({ id: i, content: `Item ${i}` });
      }

      const renderInfo = manager.getRenderInfo(items);
      
      // Should only include visible items plus overscan
      expect(renderInfo.visibleItems.length).toBeLessThan(30); // Much less than 100
      expect(renderInfo.offsetY).toBe(0);
      expect(renderInfo.visibleItems[0].id).toBe(0);
    });

    test('should apply transform offset for scrolled items', () => {
      container.scrollTop = 300; // Scroll to item 10
      container.dispatchEvent(new Event('scroll'));

      const items = [];
      for (let i = 0; i < 100; i++) {
        items.push({ id: i, content: `Item ${i}` });
      }

      const renderInfo = manager.getRenderInfo(items);
      
      // Should have offset for proper positioning
      expect(renderInfo.offsetY).toBeGreaterThan(0);
      expect(renderInfo.visibleItems[0].id).toBeGreaterThanOrEqual(5); // With buffer
    });
  });

  describe('Dynamic Updates', () => {
    beforeEach(() => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 100
      });
    });

    test('should update total items', () => {
      manager.updateTotalItems(200);
      
      const spacer = scrollContainer.querySelector('.virtual-scroll-spacer');
      expect(spacer.style.height).toBe('6000px'); // 200 * 30
      
      expect(manager.options.totalItems).toBe(200);
    });

    test('should update item height', () => {
      manager.updateItemHeight(50);
      
      const spacer = scrollContainer.querySelector('.virtual-scroll-spacer');
      expect(spacer.style.height).toBe('5000px'); // 100 * 50
      
      expect(manager.options.itemHeight).toBe(50);
    });

    test('should force recalculation', () => {
      let changeCount = 0;
      manager.onVisibleRangeChange(() => {
        changeCount++;
      });

      manager.recalculate();
      
      expect(changeCount).toBe(1);
    });

    test('should handle container resize', () => {
      // Change container size
      container.getBoundingClientRect = () => ({
        top: 0,
        bottom: 800,
        height: 800,
        left: 0,
        right: 800,
        width: 800
      });

      container.dispatchEvent(new Event('resize'));

      const viewport = manager.getViewport();
      expect(viewport.height).toBe(800);
    });
  });

  describe('Performance Optimizations', () => {
    test('should use RAF for scroll updates', (done) => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 10000
      });

      let frameCount = 0;
      const originalRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = (callback) => {
        frameCount++;
        return originalRAF(callback);
      };

      // Trigger multiple scrolls
      for (let i = 0; i < 5; i++) {
        container.scrollTop = i * 100;
        container.dispatchEvent(new Event('scroll'));
      }

      setTimeout(() => {
        expect(frameCount).toBeGreaterThan(0);
        window.requestAnimationFrame = originalRAF;
        done();
      }, 100);
    });

    test('should handle large item counts efficiently', () => {
      const startTime = performance.now();
      
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000000 // 1 million items
      });

      const initTime = performance.now() - startTime;
      expect(initTime).toBeLessThan(100); // Should initialize quickly

      // Scroll operations should also be fast
      const scrollStart = performance.now();
      container.scrollTop = 15000000; // Middle of list
      container.dispatchEvent(new Event('scroll'));
      
      const scrollTime = performance.now() - scrollStart;
      expect(scrollTime).toBeLessThan(50); // Should handle scroll quickly
    });

    test('should cache calculations', () => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000
      });

      const viewport1 = manager.getViewport();
      const viewport2 = manager.getViewport();
      
      // Should return cached value
      expect(viewport1).toBe(viewport2);

      // After scroll, should update cache
      container.scrollTop = 100;
      container.dispatchEvent(new Event('scroll'));
      
      const viewport3 = manager.getViewport();
      expect(viewport3).not.toBe(viewport1);
      expect(viewport3.scrollTop).toBe(100);
    });
  });

  describe('Smooth Scrolling', () => {
    beforeEach(() => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000,
        smoothScroll: true
      });
    });

    test('should scroll to item smoothly', (done) => {
      const startScrollTop = container.scrollTop;
      
      manager.scrollToItem(50, { smooth: true });
      
      // Should start animation
      setTimeout(() => {
        expect(container.scrollTop).toBeGreaterThan(startScrollTop);
        expect(container.scrollTop).toBeLessThanOrEqual(50 * 30);
        done();
      }, 100);
    });

    test('should scroll to item instantly when smooth is false', () => {
      manager.scrollToItem(50, { smooth: false });
      
      expect(container.scrollTop).toBe(50 * 30);
    });

    test('should ensure item is visible', () => {
      // Item 20 should not be visible initially
      expect(manager.isItemVisible(20)).toBe(false);
      
      manager.ensureVisible(20);
      
      // Should scroll to make item 20 visible
      expect(manager.isItemVisible(20)).toBe(true);
    });

    test('should cancel ongoing scroll animation', (done) => {
      manager.scrollToItem(100, { smooth: true });
      
      setTimeout(() => {
        const midScrollTop = container.scrollTop;
        
        // Start new scroll
        manager.scrollToItem(10, { smooth: true });
        
        setTimeout(() => {
          // Should be scrolling to new target
          expect(container.scrollTop).toBeLessThan(midScrollTop);
          done();
        }, 50);
      }, 50);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 100
      });
    });

    test('should maintain focus during virtual scrolling', () => {
      const focusedIndex = 10;
      let focusRestored = false;
      
      manager.onFocusRestore((index) => {
        focusRestored = true;
        expect(index).toBe(focusedIndex);
      });

      manager.setFocusedItem(focusedIndex);
      
      // Trigger scroll that would cause re-render
      container.scrollTop = 300;
      container.dispatchEvent(new Event('scroll'));
      
      expect(focusRestored).toBe(true);
    });

    test('should announce scroll position to screen readers', () => {
      const announcements = [];
      manager.onAnnouncement((text) => {
        announcements.push(text);
      });

      container.scrollTop = 1500; // Scroll to ~50th item
      container.dispatchEvent(new Event('scroll'));

      expect(announcements.length).toBeGreaterThan(0);
      expect(announcements[0]).toContain('50'); // Should mention approximate position
    });
  });

  describe('Integration Helpers', () => {
    beforeEach(() => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 100
      });
    });

    test('should provide render props for items', () => {
      const renderProps = manager.getItemRenderProps(10);
      
      expect(renderProps.style.position).toBe('absolute');
      expect(renderProps.style.top).toBe('300px');
      expect(renderProps.style.height).toBe('30px');
      expect(renderProps['data-index']).toBe(10);
    });

    test('should batch item updates', (done) => {
      let updateCount = 0;
      manager.onBatchUpdate(() => {
        updateCount++;
      });

      // Queue multiple updates
      manager.batchUpdate(() => manager.updateItemHeight(35));
      manager.batchUpdate(() => manager.updateTotalItems(200));
      manager.batchUpdate(() => manager.recalculate());

      // Should batch into single update
      setTimeout(() => {
        expect(updateCount).toBe(1);
        expect(manager.options.itemHeight).toBe(35);
        expect(manager.options.totalItems).toBe(200);
        done();
      }, 50);
    });
  });

  describe('Memory Management', () => {
    test('should cleanup on destroy', () => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000
      });

      const spacer = scrollContainer.querySelector('.virtual-scroll-spacer');
      expect(spacer).toBeDefined();

      manager.destroy();
      
      expect(manager.destroyed).toBe(true);
      expect(scrollContainer.querySelector('.virtual-scroll-spacer')).toBeNull();
    });

    test('should remove event listeners on destroy', () => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000
      });

      let scrollFired = false;
      manager.onVisibleRangeChange(() => {
        scrollFired = true;
      });

      manager.destroy();
      
      // Scroll should not trigger callback
      container.scrollTop = 100;
      container.dispatchEvent(new Event('scroll'));
      
      expect(scrollFired).toBe(false);
    });

    test('should handle multiple destroy calls', () => {
      manager = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000
      });

      expect(() => {
        manager.destroy();
        manager.destroy();
        manager.destroy();
      }).not.toThrow();
    });
  });
});