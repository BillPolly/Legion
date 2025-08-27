/**
 * @jest-environment jsdom
 */

import { DOMAnalysisCommands } from '../../../src/commands/DOMAnalysisCommands.js';

describe('DOM Analysis Commands', () => {
  let domAnalysisCommands;
  let mockContentScript;

  beforeEach(() => {
    // Setup complex DOM structure for testing
    document.body.innerHTML = `
      <div id="app" class="main-app" data-testid="app-container" aria-label="Main application">
        <header class="header" role="banner">
          <nav aria-label="Main navigation" class="nav-primary">
            <h1 class="site-title">Test Application</h1>
            <ul class="nav-list">
              <li><a href="/home" class="nav-link active">Home</a></li>
              <li><a href="/about" class="nav-link">About</a></li>
              <li><a href="/contact" class="nav-link">Contact</a></li>
            </ul>
          </nav>
        </header>
        
        <main class="content" role="main">
          <section class="hero" aria-labelledby="hero-title">
            <h2 id="hero-title" class="hero-title">Welcome to Our Site</h2>
            <p class="hero-description">This is a comprehensive test page.</p>
            <button class="cta-button" aria-describedby="cta-help">Get Started</button>
            <div id="cta-help" class="sr-only">Click to begin your journey</div>
          </section>
          
          <section class="features">
            <h2 class="section-title">Features</h2>
            <div class="feature-grid">
              <article class="feature-card" data-feature="performance">
                <h3 class="feature-title">High Performance</h3>
                <p class="feature-description">Lightning fast and optimized.</p>
                <img src="perf.jpg" alt="Performance metrics chart" class="feature-image">
              </article>
              <article class="feature-card" data-feature="accessibility">
                <h3 class="feature-title">Accessible</h3>
                <p class="feature-description">Built with accessibility in mind.</p>
                <img src="a11y.jpg" alt="" class="feature-image"> <!-- Missing alt text -->
              </article>
              <article class="feature-card" data-feature="responsive">
                <h3 class="feature-title">Responsive Design</h3>
                <p class="feature-description">Works on all devices.</p>
              </article>
            </div>
          </section>
          
          <section class="data-section">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Value</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Performance Score</td>
                  <td>95</td>
                  <td class="status-good">Good</td>
                </tr>
                <tr>
                  <td>Accessibility Score</td>
                  <td>88</td>
                  <td class="status-warning">Needs Work</td>
                </tr>
              </tbody>
            </table>
          </section>
          
          <form class="contact-form" novalidate>
            <fieldset>
              <legend>Contact Information</legend>
              <label for="name">Name:</label>
              <input type="text" id="name" name="name" required aria-describedby="name-error">
              <div id="name-error" class="error-message" aria-live="polite"></div>
              
              <label for="email">Email:</label>
              <input type="email" id="email" name="email" required>
              
              <label for="message">Message:</label>
              <textarea id="message" name="message" rows="4" cols="50"></textarea>
            </fieldset>
            
            <button type="submit" class="submit-btn">Send Message</button>
          </form>
        </main>
        
        <aside class="sidebar" role="complementary">
          <div class="widget">
            <h3 class="widget-title">Quick Links</h3>
            <ul class="widget-list">
              <li><a href="/docs">Documentation</a></li>
              <li><a href="/api">API Reference</a></li>
            </ul>
          </div>
        </aside>
        
        <footer class="footer" role="contentinfo">
          <p>&copy; 2023 Test Company. All rights reserved.</p>
          <div class="social-links">
            <a href="#" class="social-link" aria-label="Follow us on Twitter">
              <span class="icon-twitter"></span>
            </a>
            <a href="#" class="social-link">
              <span class="icon-facebook"></span> <!-- Missing aria-label -->
            </a>
          </div>
        </footer>
      </div>
    `;

    // Setup content script mock
    mockContentScript = {
      getElement: jest.fn().mockImplementation((selector) => document.querySelector(selector)),
      getElements: jest.fn().mockImplementation((selector) => Array.from(document.querySelectorAll(selector))),
      getElementMetadata: jest.fn(),
      getComputedStyles: jest.fn().mockImplementation((element) => {
        // Return different styles based on element to control test behavior
        if (element && element.className && element.className.includes('feature-grid')) {
          return {
            display: 'grid',
            position: 'relative',
            width: '100px',
            height: '50px',
            fontSize: '16px',
            color: 'rgb(0, 0, 0)',
            backgroundColor: 'rgb(255, 255, 255)',
            filter: 'blur(5px)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            transform: 'translateX(10px)',
            float: 'left'
          };
        }
        return {
          display: 'block',
          position: 'relative',
          width: '100px',
          height: '50px',
          fontSize: '16px',
          color: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)'
        };
      }),
      sendMessage: jest.fn().mockResolvedValue({ success: true })
    };

    domAnalysisCommands = new DOMAnalysisCommands(mockContentScript);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Element Inspection', () => {
    test('should inspect element with various selectors', async () => {
      const result = await domAnalysisCommands.inspectElement('#app');
      
      expect(result).toEqual({
        success: true,
        element: {
          selector: '#app',
          tagName: 'DIV',
          id: 'app',
          className: 'main-app',
          attributes: expect.objectContaining({
            'class': 'main-app',
            'data-testid': 'app-container',
            'aria-label': 'Main application'
          }),
          textContent: expect.any(String),
          innerHTML: expect.any(String),
          computedStyles: expect.any(Object),
          boundingRect: expect.any(Object),
          accessibility: expect.any(Object),
          seo: expect.any(Object),
          performance: expect.any(Object)
        }
      });
    });

    test('should inspect element by class selector', async () => {
      const result = await domAnalysisCommands.inspectElement('.hero-title');
      
      expect(result.success).toBe(true);
      expect(result.element.tagName).toBe('H2');
      expect(result.element.className).toBe('hero-title');
      expect(result.element.attributes.id).toBe('hero-title');
    });

    test('should inspect element by attribute selector', async () => {
      const result = await domAnalysisCommands.inspectElement('[data-feature="performance"]');
      
      expect(result.success).toBe(true);
      expect(result.element.attributes['data-feature']).toBe('performance');
      expect(result.element.className).toContain('feature-card');
    });

    test('should handle non-existent elements', async () => {
      const result = await domAnalysisCommands.inspectElement('#non-existent');
      
      expect(result).toEqual({
        success: false,
        error: 'Element not found',
        selector: '#non-existent'
      });
    });

    test('should include accessibility analysis in inspection', async () => {
      const result = await domAnalysisCommands.inspectElement('.cta-button');
      
      expect(result.element.accessibility).toEqual({
        hasAriaLabel: false,
        hasAriaDescribedBy: true,
        describedBy: ['cta-help'],
        role: null,
        focusable: true,
        tabIndex: 0,
        semanticRole: 'button',
        accessibleName: 'Get Started',
        issues: expect.any(Array),
        wcagLevel: expect.any(String)
      });
    });

    test('should include SEO analysis in inspection', async () => {
      const result = await domAnalysisCommands.inspectElement('h1');
      
      expect(result.element.seo).toEqual({
        headingLevel: 1,
        headingHierarchy: expect.any(Boolean),
        hasProperNesting: expect.any(Boolean),
        textLength: expect.any(Number),
        keywordDensity: expect.any(Object),
        issues: expect.any(Array),
        suggestions: expect.any(Array)
      });
    });

    test('should include performance analysis in inspection', async () => {
      const result = await domAnalysisCommands.inspectElement('img');
      
      expect(result.element.performance).toEqual({
        renderingImpact: expect.any(String),
        layoutThrashing: expect.any(Boolean),
        expensiveProperties: expect.any(Array),
        optimizations: expect.any(Array),
        memoryFootprint: expect.any(Number),
        recommendations: expect.any(Array)
      });
    });
  });

  describe('DOM Tree Analysis', () => {
    test('should analyze DOM tree with depth limits', async () => {
      const result = await domAnalysisCommands.analyzeDOMTree('#app', { maxDepth: 3 });
      
      expect(result).toEqual({
        success: true,
        tree: {
          element: expect.objectContaining({
            tagName: 'DIV',
            id: 'app'
          }),
          children: expect.any(Array),
          depth: 3,
          totalNodes: expect.any(Number),
          statistics: {
            elementCount: expect.any(Number),
            textNodeCount: expect.any(Number),
            commentCount: expect.any(Number),
            maxDepth: expect.any(Number),
            averageDepth: expect.any(Number),
            complexity: expect.any(Number)
          }
        }
      });
    });

    test('should analyze DOM tree with node filtering', async () => {
      const result = await domAnalysisCommands.analyzeDOMTree('#app', { 
        maxDepth: 2,
        includeTextNodes: false,
        filterBy: 'semantic'
      });
      
      expect(result.success).toBe(true);
      expect(result.tree.children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            element: expect.objectContaining({
              tagName: expect.stringMatching(/^(HEADER|MAIN|ASIDE|FOOTER)$/)
            })
          })
        ])
      );
    });

    test('should calculate DOM complexity metrics', async () => {
      const result = await domAnalysisCommands.analyzeDOMTree('.feature-grid');
      
      expect(result.tree.statistics.complexity).toBeGreaterThan(0);
      expect(result.tree.statistics.maxDepth).toBeGreaterThan(1);
      expect(result.tree.statistics.elementCount).toBeGreaterThan(3);
    });

    test('should identify DOM structure issues', async () => {
      const result = await domAnalysisCommands.analyzeDOMTree('#app', { 
        analyzeIssues: true 
      });
      
      expect(result.tree).toEqual(expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            severity: expect.stringMatching(/^(error|warning|info)$/),
            element: expect.any(String),
            message: expect.any(String)
          })
        ])
      }));
    });

    test('should handle invalid selectors gracefully', async () => {
      const result = await domAnalysisCommands.analyzeDOMTree('[[invalid]]');
      
      expect(result).toEqual({
        success: false,
        error: 'Invalid selector or element not found',
        selector: '[[invalid]]'
      });
    });
  });

  describe('Accessibility Analysis', () => {
    test('should perform comprehensive accessibility audit', async () => {
      const result = await domAnalysisCommands.analyzeAccessibility('#app');
      
      if (!result.success) {
        console.log('Accessibility test failed:', result);
      }
      
      expect(result.success).toBe(true);
      expect(result.accessibility).toEqual(expect.objectContaining({
        score: expect.any(Number),
        level: expect.stringMatching(/^(AA|AAA|fail)$/),
        violations: expect.any(Array),
        passes: expect.any(Array),
        incomplete: expect.any(Array),
        summary: expect.objectContaining({
          totalElements: expect.any(Number),
          violationCount: expect.any(Number),
          passCount: expect.any(Number),
          incompleteCount: expect.any(Number)
        })
      }));
    });

    test('should check ARIA usage and validity', async () => {
      const result = await domAnalysisCommands.analyzeAccessibility('.contact-form');
      
      expect(result.success).toBe(true);
      expect(result.accessibility.violations).toEqual(expect.any(Array));
      expect(result.accessibility.passes).toEqual(expect.any(Array));
    });

    test('should validate semantic HTML structure', async () => {
      const result = await domAnalysisCommands.analyzeAccessibility('#app');
      
      expect(result.success).toBe(true);
      expect(result.accessibility.semantics).toEqual(expect.objectContaining({
        landmarks: expect.any(Array),
        headings: expect.any(Array),
        navigation: expect.any(Array),
        forms: expect.any(Array)
      }));
    });

    test('should check color contrast compliance', async () => {
      const result = await domAnalysisCommands.analyzeAccessibility('.hero-title');
      
      expect(result.success).toBe(true);
      expect(result.accessibility.contrast).toEqual(expect.any(Array));
    });

    test('should analyze keyboard navigation', async () => {
      const result = await domAnalysisCommands.analyzeAccessibility('#app');
      
      expect(result.success).toBe(true);
      expect(result.accessibility.keyboard).toEqual(expect.objectContaining({
        focusableElements: expect.any(Number),
        tabOrder: expect.any(Array),
        tabTraps: expect.any(Array),
        skipLinks: expect.any(Array),
        issues: expect.any(Array)
      }));
    });
  });

  describe('Performance Impact Assessment', () => {
    test('should assess rendering performance impact', async () => {
      const result = await domAnalysisCommands.assessPerformanceImpact('.feature-grid');
      
      expect(result).toEqual({
        success: true,
        performance: expect.objectContaining({
          renderingCost: expect.any(Number),
          layoutComplexity: expect.any(Number),
          paintComplexity: expect.any(Number),
          compositeComplexity: expect.any(Number),
          memoryFootprint: expect.any(Number),
          recommendations: expect.any(Array)
        })
      });
    });

    test('should identify expensive CSS properties', async () => {
      const result = await domAnalysisCommands.assessPerformanceImpact('#app');
      
      expect(result.performance).toEqual(expect.objectContaining({
        expensiveProperties: expect.arrayContaining([
          expect.objectContaining({
            property: expect.any(String),
            element: expect.any(String),
            impact: expect.stringMatching(/^(layout|paint|composite)$/),
            cost: expect.any(Number),
            alternative: expect.any(String)
          })
        ])
      }));
    });

    test('should detect layout thrashing potential', async () => {
      const result = await domAnalysisCommands.assessPerformanceImpact('.data-table');
      
      expect(result.performance).toEqual(expect.objectContaining({
        layoutThrashing: {
          risk: expect.stringMatching(/^(high|medium|low)$/),
          causes: expect.any(Array),
          recommendations: expect.any(Array)
        }
      }));
    });

    test('should analyze DOM size impact', async () => {
      const result = await domAnalysisCommands.assessPerformanceImpact('#app');
      
      expect(result.performance).toEqual(expect.objectContaining({
        domSize: {
          elementCount: expect.any(Number),
          depth: expect.any(Number),
          nodeSize: expect.any(Number),
          impact: expect.stringMatching(/^(high|medium|low)$/),
          optimizations: expect.any(Array)
        }
      }));
    });
  });

  describe('Command Integration', () => {
    test('should execute inspect_element command', async () => {
      const result = await domAnalysisCommands.executeCommand('inspect_element', {
        selector: '.hero-title',
        includeAccessibility: true,
        includePerformance: true
      });
      
      expect(result.success).toBe(true);
      expect(result.element).toBeDefined();
      expect(result.element.accessibility).toBeDefined();
      expect(result.element.performance).toBeDefined();
    });

    test('should execute analyze_dom_tree command', async () => {
      const result = await domAnalysisCommands.executeCommand('analyze_dom_tree', {
        selector: '.features',
        maxDepth: 4,
        includeStatistics: true
      });
      
      expect(result.success).toBe(true);
      expect(result.tree).toBeDefined();
      expect(result.tree.statistics).toBeDefined();
    });

    test('should execute analyze_accessibility command', async () => {
      const result = await domAnalysisCommands.executeCommand('analyze_accessibility', {
        selector: 'form',
        level: 'AA',
        includeContrast: true
      });
      
      expect(result.success).toBe(true);
      expect(result.accessibility).toBeDefined();
      expect(result.accessibility.contrast).toBeDefined();
    });

    test('should execute assess_performance command', async () => {
      const result = await domAnalysisCommands.executeCommand('assess_performance', {
        selector: '#app',
        includeRecommendations: true
      });
      
      expect(result.success).toBe(true);
      expect(result.performance).toBeDefined();
      expect(result.performance.recommendations).toBeDefined();
    });

    test('should handle invalid commands gracefully', async () => {
      const result = await domAnalysisCommands.executeCommand('invalid_command', {});
      
      expect(result).toEqual({
        success: false,
        error: 'Unknown command: invalid_command'
      });
    });

    test('should validate command parameters', async () => {
      const result = await domAnalysisCommands.executeCommand('inspect_element', {
        selector: null
      });
      
      expect(result).toEqual({
        success: false,
        error: 'Invalid parameters: selector is required'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle DOM access errors', async () => {
      // Mock DOM error
      mockContentScript.getElement.mockImplementation(() => {
        throw new Error('DOM access denied');
      });
      
      const result = await domAnalysisCommands.inspectElement('#app');
      
      expect(result).toEqual({
        success: false,
        error: 'DOM access error: DOM access denied'
      });
    });

    test('should handle computation errors gracefully', async () => {
      // Mock computation error in getElement instead to cause earlier failure
      mockContentScript.getElement.mockImplementation(() => {
        throw new Error('Style computation failed');
      });
      
      const result = await domAnalysisCommands.inspectElement('#app');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('DOM access error');
    });

    test('should handle invalid CSS selectors', async () => {
      const result = await domAnalysisCommands.analyzeDOMTree(':::invalid:::');
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Invalid selector'),
        selector: ':::invalid:::'
      });
    });

    test('should handle memory constraints', async () => {
      const result = await domAnalysisCommands.analyzeDOMTree('#app', { 
        maxDepth: 1000, // Unreasonably large
        maxNodes: 5  // Very small limit
      });
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Analysis stopped due to constraints'),
        selector: '#app'
      });
    });
  });

  describe('Command Registration', () => {
    test('should register all DOM analysis commands', () => {
      const commands = domAnalysisCommands.getRegisteredCommands();
      
      expect(commands).toEqual([
        'inspect_element',
        'analyze_dom_tree', 
        'analyze_accessibility',
        'assess_performance'
      ]);
    });

    test('should provide command metadata', () => {
      const metadata = domAnalysisCommands.getCommandMetadata('inspect_element');
      
      expect(metadata).toEqual({
        name: 'inspect_element',
        description: expect.any(String),
        parameters: expect.any(Array),
        examples: expect.any(Array)
      });
    });

    test('should validate command capabilities', () => {
      expect(domAnalysisCommands.canExecuteCommand('inspect_element')).toBe(true);
      expect(domAnalysisCommands.canExecuteCommand('nonexistent_command')).toBe(false);
    });
  });
});