/**
 * AccessibilityManager Tests
 * 
 * Testing comprehensive accessibility features for TreeScribe
 */

import { AccessibilityManager } from '../../../../../../src/components/tree-scribe/features/accessibility/AccessibilityManager.js';

describe('AccessibilityManager', () => {
  let manager;
  let container;
  let announcer;

  beforeEach(() => {
    // Create mock DOM structure
    container = document.createElement('div');
    container.setAttribute('role', 'tree');
    document.body.appendChild(container);

    // Create announcer element
    announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);

    manager = new AccessibilityManager({
      container,
      announcer
    });
  });

  afterEach(() => {
    if (manager && !manager.destroyed) {
      manager.destroy();
    }
    document.body.removeChild(container);
    document.body.removeChild(announcer);
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(manager.destroyed).toBe(false);
      expect(manager.options.enableAnnouncements).toBe(true);
      expect(manager.options.enableFocusTrap).toBe(true);
      expect(manager.options.enableHighContrast).toBe(true);
      expect(manager.options.announceDelay).toBe(100);
    });

    test('should set initial ARIA attributes', () => {
      expect(container.getAttribute('role')).toBe('tree');
      expect(container.getAttribute('aria-label')).toBeTruthy();
      expect(container.hasAttribute('tabindex')).toBe(true);
    });

    test('should detect screen reader', () => {
      const isScreenReaderActive = manager.isScreenReaderActive();
      expect(typeof isScreenReaderActive).toBe('boolean');
    });

    test('should detect reduced motion preference', () => {
      const prefersReducedMotion = manager.prefersReducedMotion();
      expect(typeof prefersReducedMotion).toBe('boolean');
    });
  });

  describe('ARIA Attributes', () => {
    test('should set node ARIA attributes', () => {
      const node = document.createElement('div');
      const nodeData = {
        id: 'node1',
        level: 2,
        expanded: true,
        hasChildren: true,
        selected: false,
        index: 5,
        totalSiblings: 10
      };

      manager.setNodeAttributes(node, nodeData);

      expect(node.getAttribute('role')).toBe('treeitem');
      expect(node.getAttribute('aria-level')).toBe('2');
      expect(node.getAttribute('aria-expanded')).toBe('true');
      expect(node.getAttribute('aria-selected')).toBe('false');
      expect(node.getAttribute('aria-posinset')).toBe('6'); // index + 1
      expect(node.getAttribute('aria-setsize')).toBe('10');
      expect(node.getAttribute('id')).toBe('treeitem-node1');
    });

    test('should update expanded state', () => {
      const node = document.createElement('div');
      manager.setNodeAttributes(node, { id: 'node1', hasChildren: true });

      manager.updateExpanded(node, true);
      expect(node.getAttribute('aria-expanded')).toBe('true');

      manager.updateExpanded(node, false);
      expect(node.getAttribute('aria-expanded')).toBe('false');
    });

    test('should update selected state', () => {
      const node = document.createElement('div');
      manager.setNodeAttributes(node, { id: 'node1' });

      manager.updateSelected(node, true);
      expect(node.getAttribute('aria-selected')).toBe('true');

      manager.updateSelected(node, false);
      expect(node.getAttribute('aria-selected')).toBe('false');
    });

    test('should handle loading state', () => {
      const node = document.createElement('div');
      
      manager.setLoadingState(node, true);
      expect(node.getAttribute('aria-busy')).toBe('true');
      expect(node.getAttribute('aria-label')).toContain('Loading');

      manager.setLoadingState(node, false);
      expect(node.getAttribute('aria-busy')).toBe('false');
    });

    test('should set describedby for complex nodes', () => {
      const node = document.createElement('div');
      const description = document.createElement('div');
      description.id = 'desc-node1';
      description.textContent = 'Complex node with 5 children';

      manager.setNodeDescription(node, description);
      expect(node.getAttribute('aria-describedby')).toBe('desc-node1');
    });
  });

  describe('Screen Reader Announcements', () => {
    test('should announce messages', (done) => {
      manager.announce('Test announcement');

      setTimeout(() => {
        expect(announcer.textContent).toBe('Test announcement');
        done();
      }, 150);
    });

    test('should clear announcements after delay', (done) => {
      manager.announce('Temporary message');

      setTimeout(() => {
        expect(announcer.textContent).toBe('');
        done();
      }, 1100); // Default clear delay is 1000ms
    });

    test('should debounce rapid announcements', (done) => {
      manager.announce('First');
      manager.announce('Second');
      manager.announce('Third');

      setTimeout(() => {
        expect(announcer.textContent).toBe('Third');
        done();
      }, 150);
    });

    test('should announce with priority levels', () => {
      manager.announce('Normal message', 'polite');
      expect(announcer.getAttribute('aria-live')).toBe('polite');

      manager.announce('Urgent message', 'assertive');
      expect(announcer.getAttribute('aria-live')).toBe('assertive');
    });

    test('should format node announcements', () => {
      const nodeData = {
        title: 'Project Files',
        level: 2,
        expanded: true,
        childCount: 5
      };

      const announcement = manager.formatNodeAnnouncement(nodeData);
      expect(announcement).toContain('Project Files');
      expect(announcement).toContain('level 2');
      expect(announcement).toContain('expanded');
      expect(announcement).toContain('5 items');
    });

    test('should announce navigation context', () => {
      manager.announceNavigation('down', {
        currentNode: 'File 1',
        currentLevel: 3,
        parentNode: 'src folder'
      });

      expect(announcer.textContent).toContain('File 1');
      expect(announcer.textContent).toContain('level 3');
    });
  });

  describe('Focus Management', () => {
    test('should track focus within container', () => {
      const node1 = document.createElement('div');
      const node2 = document.createElement('div');
      
      node1.tabIndex = 0;
      node2.tabIndex = -1;
      
      container.appendChild(node1);
      container.appendChild(node2);

      manager.setFocus(node1);
      expect(manager.getCurrentFocus()).toBe(node1);
      expect(node1.tabIndex).toBe(0);
      expect(node2.tabIndex).toBe(-1);

      manager.setFocus(node2);
      expect(manager.getCurrentFocus()).toBe(node2);
      expect(node1.tabIndex).toBe(-1);
      expect(node2.tabIndex).toBe(0);
    });

    test('should restore focus after operations', () => {
      const node = document.createElement('div');
      node.tabIndex = 0;
      container.appendChild(node);

      manager.setFocus(node);
      manager.saveFocusState();

      // Simulate losing focus
      const otherElement = document.createElement('button');
      document.body.appendChild(otherElement);
      otherElement.focus();

      manager.restoreFocusState();
      expect(document.activeElement).toBe(node);

      document.body.removeChild(otherElement);
    });

    test('should handle focus trap', () => {
      manager.enableFocusTrap();

      const firstFocusable = document.createElement('button');
      const lastFocusable = document.createElement('button');
      
      container.appendChild(firstFocusable);
      container.appendChild(lastFocusable);

      // Simulate tab from last element
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false
      });

      lastFocusable.focus();
      manager.handleFocusTrap(tabEvent);

      expect(tabEvent.defaultPrevented).toBe(true);
    });

    test('should find next focusable element', () => {
      const node1 = document.createElement('div');
      const node2 = document.createElement('div');
      const node3 = document.createElement('div');

      node1.tabIndex = 0;
      node2.tabIndex = -1;
      node3.tabIndex = 0;

      container.appendChild(node1);
      container.appendChild(node2);
      container.appendChild(node3);

      const next = manager.getNextFocusable(node1);
      expect(next).toBe(node3); // Skips node2 with tabIndex -1
    });

    test('should find previous focusable element', () => {
      const node1 = document.createElement('div');
      const node2 = document.createElement('div');
      const node3 = document.createElement('div');

      node1.tabIndex = 0;
      node2.tabIndex = -1;
      node3.tabIndex = 0;

      container.appendChild(node1);
      container.appendChild(node2);
      container.appendChild(node3);

      const prev = manager.getPreviousFocusable(node3);
      expect(prev).toBe(node1); // Skips node2 with tabIndex -1
    });
  });

  describe('Keyboard Navigation Helpers', () => {
    test('should provide navigation instructions', () => {
      const instructions = manager.getNavigationInstructions();
      
      expect(instructions).toContain('arrow keys');
      expect(instructions).toContain('Enter');
      expect(instructions).toContain('Space');
      expect(instructions).toContain('Home');
      expect(instructions).toContain('End');
    });

    test('should handle keyboard shortcuts with modifiers', () => {
      const shortcuts = manager.getKeyboardShortcuts();
      
      expect(shortcuts['Ctrl+A']).toBe('Select all');
      expect(shortcuts['Ctrl+Shift+E']).toBe('Expand all');
      expect(shortcuts['Ctrl+Shift+C']).toBe('Collapse all');
    });

    test('should provide context-sensitive help', () => {
      const context = {
        nodeType: 'folder',
        expanded: false,
        hasChildren: true
      };

      const help = manager.getContextualHelp(context);
      
      expect(help).toContain('expand');
      expect(help).toContain('Enter or Right arrow');
    });
  });

  describe('High Contrast Mode', () => {
    test('should detect high contrast mode', () => {
      const isHighContrast = manager.isHighContrastMode();
      expect(typeof isHighContrast).toBe('boolean');
    });

    test('should apply high contrast styles', () => {
      manager.applyHighContrastMode(true);
      
      expect(container.classList.contains('high-contrast')).toBe(true);
      expect(container.getAttribute('data-high-contrast')).toBe('true');

      manager.applyHighContrastMode(false);
      
      expect(container.classList.contains('high-contrast')).toBe(false);
      expect(container.hasAttribute('data-high-contrast')).toBe(false);
    });

    test('should provide high contrast color adjustments', () => {
      const colors = manager.getHighContrastColors();
      
      expect(colors.foreground).toBeDefined();
      expect(colors.background).toBeDefined();
      expect(colors.border).toBeDefined();
      expect(colors.focus).toBeDefined();
    });
  });

  describe('Live Regions', () => {
    test('should create status region', () => {
      const statusRegion = manager.createStatusRegion();
      
      expect(statusRegion.getAttribute('role')).toBe('status');
      expect(statusRegion.getAttribute('aria-live')).toBe('polite');
      expect(statusRegion.getAttribute('aria-relevant')).toBe('additions text');
    });

    test('should update status', () => {
      const statusRegion = manager.createStatusRegion();
      container.appendChild(statusRegion);

      manager.updateStatus('5 items selected');
      expect(statusRegion.textContent).toBe('5 items selected');
    });

    test('should create alert region', () => {
      const alertRegion = manager.createAlertRegion();
      
      expect(alertRegion.getAttribute('role')).toBe('alert');
      expect(alertRegion.getAttribute('aria-live')).toBe('assertive');
    });

    test('should show alerts', (done) => {
      const alertRegion = manager.createAlertRegion();
      container.appendChild(alertRegion);

      manager.showAlert('Error: Invalid operation');
      
      expect(alertRegion.textContent).toBe('Error: Invalid operation');
      
      // Alert should auto-dismiss
      setTimeout(() => {
        expect(alertRegion.textContent).toBe('');
        done();
      }, 3100);
    });
  });

  describe('Form Controls', () => {
    test('should enhance search input', () => {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';

      manager.enhanceSearchInput(searchInput);

      expect(searchInput.getAttribute('role')).toBe('searchbox');
      expect(searchInput.getAttribute('aria-label')).toContain('Search');
      expect(searchInput.getAttribute('aria-describedby')).toBeTruthy();
    });

    test('should add search results announcement', () => {
      const searchInput = document.createElement('input');
      manager.enhanceSearchInput(searchInput);

      manager.announceSearchResults(searchInput, {
        query: 'test',
        resultCount: 5,
        currentIndex: 0
      });

      const describedBy = searchInput.getAttribute('aria-describedby');
      const description = document.getElementById(describedBy);
      
      expect(description.textContent).toContain('5 results');
      expect(description.textContent).toContain('test');
    });

    test('should enhance filter controls', () => {
      const filterGroup = document.createElement('div');
      const checkbox1 = document.createElement('input');
      checkbox1.type = 'checkbox';
      checkbox1.id = 'filter1';
      
      const label1 = document.createElement('label');
      label1.htmlFor = 'filter1';
      label1.textContent = 'Show hidden files';

      filterGroup.appendChild(checkbox1);
      filterGroup.appendChild(label1);

      manager.enhanceFilterGroup(filterGroup, 'File filters');

      expect(filterGroup.getAttribute('role')).toBe('group');
      expect(filterGroup.getAttribute('aria-label')).toBe('File filters');
    });
  });

  describe('Touch Accessibility', () => {
    test('should enhance touch targets', () => {
      const button = document.createElement('button');
      button.style.width = '20px';
      button.style.height = '20px';

      manager.enhanceTouchTarget(button);

      const styles = getComputedStyle(button);
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
    });

    test('should add touch exploration support', () => {
      const node = document.createElement('div');
      
      manager.enableTouchExploration(node);

      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }]
      });

      node.dispatchEvent(touchEvent);
      
      // Should have exploration attributes
      expect(node.hasAttribute('data-touch-explored')).toBe(true);
    });
  });

  describe('Reading Order', () => {
    test('should set logical reading order', () => {
      const nodes = [];
      for (let i = 0; i < 5; i++) {
        const node = document.createElement('div');
        node.textContent = `Item ${i}`;
        nodes.push(node);
        container.appendChild(node);
      }

      manager.setReadingOrder(nodes);

      nodes.forEach((node, index) => {
        expect(node.getAttribute('aria-flowto')).toBe(
          index < nodes.length - 1 ? nodes[index + 1].id : null
        );
      });
    });

    test('should handle nested reading order', () => {
      const parent = document.createElement('div');
      const child1 = document.createElement('div');
      const child2 = document.createElement('div');

      parent.appendChild(child1);
      parent.appendChild(child2);
      container.appendChild(parent);

      manager.setNestedReadingOrder(parent);

      expect(child1.getAttribute('aria-flowto')).toBe(child2.id);
    });
  });

  describe('Landmark Regions', () => {
    test('should create navigation landmark', () => {
      const nav = manager.createNavigationLandmark('Tree navigation');
      
      expect(nav.getAttribute('role')).toBe('navigation');
      expect(nav.getAttribute('aria-label')).toBe('Tree navigation');
    });

    test('should create main content landmark', () => {
      const main = manager.createMainLandmark('Tree content');
      
      expect(main.getAttribute('role')).toBe('main');
      expect(main.getAttribute('aria-label')).toBe('Tree content');
    });

    test('should create toolbar landmark', () => {
      const toolbar = manager.createToolbarLandmark('Tree actions');
      
      expect(toolbar.getAttribute('role')).toBe('toolbar');
      expect(toolbar.getAttribute('aria-label')).toBe('Tree actions');
      expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
    });
  });

  describe('Error Handling', () => {
    test('should announce errors accessibly', () => {
      manager.announceError('Failed to load data');
      
      expect(announcer.getAttribute('aria-live')).toBe('assertive');
      expect(announcer.textContent).toContain('Error');
      expect(announcer.textContent).toContain('Failed to load data');
    });

    test('should provide error recovery instructions', () => {
      const errorData = {
        type: 'network',
        message: 'Connection failed',
        recoverable: true
      };

      const instructions = manager.getErrorRecoveryInstructions(errorData);
      
      expect(instructions).toContain('try again');
      expect(instructions).toContain('refresh');
    });
  });

  describe('Settings', () => {
    test('should get accessibility preferences', () => {
      const prefs = manager.getAccessibilityPreferences();
      
      expect(prefs.announcements).toBeDefined();
      expect(prefs.animations).toBeDefined();
      expect(prefs.highContrast).toBeDefined();
      expect(prefs.fontSize).toBeDefined();
    });

    test('should apply accessibility preferences', () => {
      const prefs = {
        announcements: false,
        animations: false,
        highContrast: true,
        fontSize: 'large'
      };

      manager.applyAccessibilityPreferences(prefs);

      expect(manager.options.enableAnnouncements).toBe(false);
      expect(container.classList.contains('no-animations')).toBe(true);
      expect(container.classList.contains('high-contrast')).toBe(true);
      expect(container.classList.contains('font-size-large')).toBe(true);
    });
  });

  describe('Integration Support', () => {
    test('should provide accessibility tree data', () => {
      const treeData = {
        nodes: [
          { id: '1', title: 'Root', level: 1, children: ['2', '3'] },
          { id: '2', title: 'Child 1', level: 2, parent: '1' },
          { id: '3', title: 'Child 2', level: 2, parent: '1' }
        ]
      };

      const a11yTree = manager.buildAccessibilityTree(treeData);
      
      expect(a11yTree.root).toBeDefined();
      expect(a11yTree.root.children).toHaveLength(2);
      expect(a11yTree.flatList).toHaveLength(3);
    });

    test('should export accessibility report', () => {
      const report = manager.generateAccessibilityReport();
      
      expect(report.compliance).toBeDefined();
      expect(report.wcagLevel).toBe('AA');
      expect(report.issues).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup on destroy', () => {
      const statusRegion = manager.createStatusRegion();
      container.appendChild(statusRegion);

      manager.destroy();

      expect(manager.destroyed).toBe(true);
      expect(manager.focusHistory.length).toBe(0);
      expect(container.querySelector('[role="status"]')).toBeNull();
    });

    test('should remove event listeners on destroy', () => {
      const node = document.createElement('div');
      container.appendChild(node);

      manager.setFocus(node);
      manager.destroy();

      // Focus operations should not work after destroy
      const newNode = document.createElement('div');
      container.appendChild(newNode);
      
      manager.setFocus(newNode);
      expect(manager.getCurrentFocus()).toBeNull();
    });
  });
});