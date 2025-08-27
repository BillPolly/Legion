/**
 * @jest-environment jsdom
 */

import { ElementInspector } from '../../../src/extension/ElementInspector.js';

describe('Element Inspection System', () => {
  let elementInspector;
  let mockContentScript;

  beforeEach(() => {
    // Setup DOM environment
    document.body.innerHTML = `
      <div id="app" class="main-app" data-testid="app-container">
        <header class="header" role="banner">
          <h1>Test Application</h1>
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="/home">Home</a></li>
              <li><a href="/about">About</a></li>
            </ul>
          </nav>
        </header>
        <main class="content" role="main">
          <article class="post" data-id="123">
            <h2>Sample Article</h2>
            <p class="description">This is a sample article description.</p>
            <div class="metadata">
              <span class="author">John Doe</span>
              <time datetime="2023-10-01">October 1, 2023</time>
            </div>
          </article>
        </main>
        <footer class="footer" role="contentinfo">
          <p>&copy; 2023 Test Company</p>
        </footer>
      </div>
    `;

    // Setup content script mock
    mockContentScript = {
      highlightElement: jest.fn(),
      removeHighlight: jest.fn(),
      getElement: jest.fn().mockImplementation((selector) => document.querySelector(selector)),
      getElementMetadata: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue({ success: true })
    };

    elementInspector = new ElementInspector(mockContentScript);
  });

  afterEach(() => {
    if (elementInspector) {
      elementInspector.destroy();
    }
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Element Selection and Highlighting', () => {
    test('should select and highlight elements', async () => {
      elementInspector.initialize();

      await elementInspector.selectElement('#app');

      expect(mockContentScript.highlightElement).toHaveBeenCalledWith('#app');
      expect(elementInspector.getSelectedElement()).toBe('#app');
    });

    test('should handle multiple element selection', async () => {
      elementInspector.initialize();

      await elementInspector.selectElement('.post');
      await elementInspector.selectElement('.header');

      expect(mockContentScript.highlightElement).toHaveBeenCalledWith('.post');
      expect(mockContentScript.highlightElement).toHaveBeenCalledWith('.header');
      
      const selected = elementInspector.getSelectedElements();
      expect(selected).toContain('.post');
      expect(selected).toContain('.header');
    });

    test('should clear element selection', async () => {
      elementInspector.initialize();
      
      await elementInspector.selectElement('#app');
      expect(elementInspector.getSelectedElement()).toBe('#app');

      elementInspector.clearSelection();
      
      expect(mockContentScript.removeHighlight).toHaveBeenCalledWith('#app');
      expect(elementInspector.getSelectedElement()).toBeNull();
    });

    test('should toggle element highlighting', async () => {
      elementInspector.initialize();

      await elementInspector.toggleHighlight('#app');
      expect(mockContentScript.highlightElement).toHaveBeenCalledWith('#app');

      await elementInspector.toggleHighlight('#app');
      expect(mockContentScript.removeHighlight).toHaveBeenCalledWith('#app');
    });

    test('should handle invalid selectors gracefully', async () => {
      elementInspector.initialize();

      await elementInspector.selectElement('#non-existent');
      expect(elementInspector.getSelectedElement()).toBeNull();
    });

    test('should support hover highlighting', async () => {
      elementInspector.initialize();
      elementInspector.enableHoverHighlight();

      const element = document.querySelector('#app');
      const mouseEvent = new MouseEvent('mouseover', { bubbles: true });
      element.dispatchEvent(mouseEvent);

      // Should highlight on hover
      expect(mockContentScript.highlightElement).toHaveBeenCalled();
    });

    test('should disable hover highlighting', async () => {
      elementInspector.initialize();
      elementInspector.enableHoverHighlight();
      elementInspector.disableHoverHighlight();

      const element = document.querySelector('#app');
      const mouseEvent = new MouseEvent('mouseover', { bubbles: true });
      element.dispatchEvent(mouseEvent);

      // Should not highlight after disabling
      expect(mockContentScript.highlightElement).not.toHaveBeenCalled();
    });
  });

  describe('Computed Style Extraction', () => {
    test('should extract computed styles', () => {
      elementInspector.initialize();

      const styles = elementInspector.extractComputedStyles('#app');
      
      expect(styles).toEqual({
        layout: expect.objectContaining({
          display: expect.any(String),
          position: expect.any(String),
          width: expect.any(String),
          height: expect.any(String)
        }),
        spacing: expect.objectContaining({
          margin: expect.any(String),
          padding: expect.any(String)
        }),
        typography: expect.objectContaining({
          fontSize: expect.any(String),
          fontFamily: expect.any(String),
          lineHeight: expect.any(String)
        }),
        visual: expect.objectContaining({
          color: expect.any(String),
          backgroundColor: expect.any(String),
          border: expect.any(String)
        }),
        positioning: expect.objectContaining({
          zIndex: expect.any(String),
          transform: expect.any(String)
        })
      });
    });

    test('should get effective styles vs declared styles', () => {
      // Add inline styles
      const element = document.querySelector('#app');
      element.style.color = 'red';
      element.style.backgroundColor = 'blue';

      elementInspector.initialize();

      const comparison = elementInspector.compareStyles('#app');
      
      expect(comparison).toEqual({
        declared: expect.any(Object),
        computed: expect.any(Object),
        overrides: expect.any(Array),
        inherited: expect.any(Array)
      });
    });

    test('should detect CSS cascade and inheritance', () => {
      elementInspector.initialize();

      const cascade = elementInspector.analyzeCascade('#app h1');
      
      expect(cascade).toEqual({
        inherited: expect.any(Array),
        cascaded: expect.any(Array),
        specificity: expect.any(Object),
        important: expect.any(Array)
      });
    });

    test('should identify responsive breakpoints', () => {
      elementInspector.initialize();

      const breakpoints = elementInspector.getResponsiveBreakpoints('#app');
      
      expect(breakpoints).toEqual({
        current: expect.any(Object),
        applicable: expect.any(Array),
        mediaQueries: expect.any(Array)
      });
    });
  });

  describe('Event Listener Analysis', () => {
    test('should detect attached event listeners', () => {
      const element = document.querySelector('#app');
      const clickHandler = () => {};
      const keyHandler = () => {};
      
      element.addEventListener('click', clickHandler);
      element.addEventListener('keydown', keyHandler);

      elementInspector.initialize();

      const listeners = elementInspector.analyzeEventListeners('#app');
      
      expect(listeners).toEqual({
        direct: expect.any(Array),
        delegated: expect.any(Array),
        inherited: expect.any(Array),
        total: expect.any(Number)
      });
    });

    test('should identify event delegation patterns', () => {
      const parent = document.querySelector('#app');
      const delegatedHandler = () => {};
      
      parent.addEventListener('click', delegatedHandler);

      elementInspector.initialize();

      const delegation = elementInspector.findEventDelegation('#app .post');
      
      expect(delegation).toEqual({
        delegates: expect.any(Array),
        handlers: expect.any(Array),
        bubbling: expect.any(Boolean)
      });
    });

    test('should analyze event propagation path', () => {
      elementInspector.initialize();

      const propagation = elementInspector.analyzePropagationPath('#app .post h2');
      
      expect(propagation).toEqual({
        capture: expect.any(Array),
        target: expect.any(String),
        bubble: expect.any(Array),
        stoppers: expect.any(Array)
      });
    });

    test('should detect passive event listeners', () => {
      const element = document.querySelector('#app');
      // Set onscroll to simulate a scroll listener
      element.onscroll = () => {};

      elementInspector.initialize();

      const passiveListeners = elementInspector.findPassiveListeners('#app');
      
      expect(passiveListeners).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'scroll',
            passive: true
          })
        ])
      );
    });
  });

  describe('Element Tree Traversal', () => {
    test('should traverse element tree with depth limit', () => {
      elementInspector.initialize();

      const tree = elementInspector.getElementTree('#app', 2);
      
      expect(tree).toEqual({
        element: expect.objectContaining({
          selector: '#app',
          tagName: 'DIV',
          classes: expect.any(Array),
          attributes: expect.any(Object)
        }),
        children: expect.arrayContaining([
          expect.objectContaining({
            element: expect.any(Object),
            children: expect.any(Array)
          })
        ]),
        depth: 2,
        totalNodes: expect.any(Number)
      });
    });

    test('should find parent elements', () => {
      elementInspector.initialize();

      const parents = elementInspector.getParentChain('#app .post h2');
      
      expect(parents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            selector: expect.stringContaining('article'),
            tagName: 'ARTICLE'
          }),
          expect.objectContaining({
            selector: expect.stringContaining('main'),
            tagName: 'MAIN'
          }),
          expect.objectContaining({
            selector: '#app',
            tagName: 'DIV'
          })
        ])
      );
    });

    test('should find sibling elements', () => {
      elementInspector.initialize();

      const siblings = elementInspector.getSiblings('#app .post h2');
      
      expect(siblings).toEqual({
        previous: expect.any(Array),
        next: expect.arrayContaining([
          expect.objectContaining({
            tagName: 'P',
            classes: expect.arrayContaining(['description'])
          })
        ]),
        all: expect.any(Array)
      });
    });

    test('should analyze element relationships', () => {
      elementInspector.initialize();

      const relationships = elementInspector.analyzeRelationships('#app .post');
      
      expect(relationships).toEqual({
        parent: expect.any(Object),
        children: expect.any(Array),
        siblings: expect.any(Object),
        ancestors: expect.any(Array),
        descendants: expect.any(Array)
      });
    });
  });

  describe('Accessibility Analysis', () => {
    test('should check ARIA attributes', () => {
      elementInspector.initialize();

      const ariaAnalysis = elementInspector.analyzeAccessibility('#app nav');
      
      expect(ariaAnalysis.aria).toEqual({
        labels: expect.arrayContaining([
          expect.objectContaining({
            attribute: 'aria-label',
            value: 'Main navigation'
          })
        ]),
        roles: expect.any(Array),
        states: expect.any(Array),
        properties: expect.any(Array)
      });
    });

    test('should validate semantic HTML', () => {
      elementInspector.initialize();

      const semantics = elementInspector.validateSemantics('#app');
      
      expect(semantics).toEqual({
        landmarks: expect.arrayContaining([
          expect.objectContaining({
            role: 'banner',
            element: 'header'
          }),
          expect.objectContaining({
            role: 'main',
            element: 'main'
          }),
          expect.objectContaining({
            role: 'contentinfo',
            element: 'footer'
          })
        ]),
        headings: expect.any(Array),
        violations: expect.any(Array),
        suggestions: expect.any(Array)
      });
    });

    test('should check color contrast', () => {
      elementInspector.initialize();

      const contrast = elementInspector.checkColorContrast('#app h1');
      
      expect(contrast).toEqual({
        foreground: expect.any(String),
        background: expect.any(String),
        ratio: expect.any(Number),
        wcagAA: expect.any(Boolean),
        wcagAAA: expect.any(Boolean),
        suggestions: expect.any(Array)
      });
    });

    test('should analyze keyboard navigation', () => {
      elementInspector.initialize();

      const keyboard = elementInspector.analyzeKeyboardNavigation('#app');
      
      expect(keyboard).toEqual({
        focusable: expect.any(Array),
        tabOrder: expect.any(Array),
        traps: expect.any(Array),
        skips: expect.any(Array),
        issues: expect.any(Array)
      });
    });
  });

  describe('Performance Impact Assessment', () => {
    test('should measure rendering performance', async () => {
      elementInspector.initialize();

      const performance = await elementInspector.measureRenderingPerformance('#app');
      
      expect(performance).toEqual({
        reflow: expect.any(Number),
        repaint: expect.any(Number),
        composite: expect.any(Number),
        layoutThrashing: expect.any(Boolean),
        suggestions: expect.any(Array)
      });
    });

    test('should analyze DOM complexity', () => {
      elementInspector.initialize();

      const complexity = elementInspector.analyzeDOMComplexity('#app');
      
      expect(complexity).toEqual({
        depth: expect.any(Number),
        breadth: expect.any(Number),
        nodes: expect.any(Number),
        selectors: expect.any(Number),
        score: expect.any(Number),
        issues: expect.any(Array)
      });
    });

    test('should detect expensive CSS properties', () => {
      elementInspector.initialize();

      const expensiveProps = elementInspector.findExpensiveProperties('#app');
      
      expect(expensiveProps).toEqual({
        triggers: expect.objectContaining({
          layout: expect.any(Array),
          paint: expect.any(Array),
          composite: expect.any(Array)
        }),
        alternatives: expect.any(Array),
        impact: expect.any(String)
      });
    });

    test('should analyze memory usage', () => {
      elementInspector.initialize();

      const memory = elementInspector.analyzeMemoryImpact('#app');
      
      expect(memory).toEqual({
        domNodes: expect.any(Number),
        eventListeners: expect.any(Number),
        styleRules: expect.any(Number),
        estimated: expect.any(Number),
        leaks: expect.any(Array)
      });
    });
  });

  describe('Inspector State Management', () => {
    test('should track inspection history', async () => {
      elementInspector.initialize();

      await elementInspector.selectElement('#app');
      await elementInspector.selectElement('.post');
      await elementInspector.selectElement('h1');

      const history = elementInspector.getInspectionHistory();
      
      expect(history).toEqual([
        expect.objectContaining({ selector: '#app', timestamp: expect.any(Number) }),
        expect.objectContaining({ selector: '.post', timestamp: expect.any(Number) }),
        expect.objectContaining({ selector: 'h1', timestamp: expect.any(Number) })
      ]);
    });

    test('should save and restore inspector state', () => {
      elementInspector.initialize();
      elementInspector.enableHoverHighlight();
      elementInspector.setInspectionMode('detailed');

      const state = elementInspector.getState();
      expect(state).toEqual({
        selectedElements: expect.any(Array),
        hoverEnabled: true,
        mode: 'detailed',
        history: expect.any(Array),
        settings: expect.any(Object)
      });

      const newInspector = new ElementInspector(mockContentScript);
      newInspector.initialize();
      newInspector.restoreState(state);

      expect(newInspector.getState()).toEqual(state);
    });

    test('should handle inspection mode changes', () => {
      elementInspector.initialize();

      elementInspector.setInspectionMode('basic');
      expect(elementInspector.getInspectionMode()).toBe('basic');

      elementInspector.setInspectionMode('detailed');
      expect(elementInspector.getInspectionMode()).toBe('detailed');

      elementInspector.setInspectionMode('performance');
      expect(elementInspector.getInspectionMode()).toBe('performance');
    });

    test('should filter elements by criteria', () => {
      elementInspector.initialize();

      const filters = {
        tagName: 'ARTICLE',
        hasClass: 'post',
        hasAttribute: 'data-id'
      };

      const filtered = elementInspector.filterElements(filters);
      
      expect(filtered).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tagName: 'ARTICLE',
            classes: expect.arrayContaining(['post']),
            attributes: expect.objectContaining({ 'data-id': '123' })
          })
        ])
      );
    });
  });

  describe('Inspector Lifecycle', () => {
    test('should initialize properly', () => {
      elementInspector.initialize();

      expect(elementInspector.isInitialized()).toBe(true);
      expect(elementInspector.getInspectionMode()).toBe('basic');
      expect(elementInspector.getSelectedElements()).toEqual([]);
    });

    test('should handle multiple initialize calls', () => {
      elementInspector.initialize();
      elementInspector.initialize(); // Second call should be ignored

      expect(elementInspector.isInitialized()).toBe(true);
    });

    test('should cleanup on destroy', () => {
      elementInspector.initialize();
      elementInspector.enableHoverHighlight();
      
      // Add some state
      elementInspector.selectElement('#app');
      
      elementInspector.destroy();

      expect(elementInspector.isInitialized()).toBe(false);
      expect(mockContentScript.removeHighlight).toHaveBeenCalled();
    });

    test('should handle destroy without initialization', () => {
      expect(() => {
        elementInspector.destroy();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing elements', () => {
      elementInspector.initialize();

      expect(() => {
        elementInspector.extractComputedStyles('#non-existent');
      }).not.toThrow();

      expect(elementInspector.extractComputedStyles('#non-existent')).toBeNull();
    });

    test('should handle DOM access errors', () => {
      elementInspector.initialize();

      // Mock DOM error
      const originalQuerySelector = document.querySelector;
      document.querySelector = jest.fn().mockImplementation(() => {
        throw new Error('DOM access denied');
      });

      expect(() => {
        elementInspector.getElementTree('#app');
      }).not.toThrow();

      // Restore
      document.querySelector = originalQuerySelector;
    });

    test('should handle computation errors gracefully', () => {
      elementInspector.initialize();

      // Mock getComputedStyle error
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = jest.fn().mockImplementation(() => {
        throw new Error('Style computation failed');
      });

      expect(() => {
        elementInspector.extractComputedStyles('#app');
      }).not.toThrow();

      // Restore
      window.getComputedStyle = originalGetComputedStyle;
    });
  });
});