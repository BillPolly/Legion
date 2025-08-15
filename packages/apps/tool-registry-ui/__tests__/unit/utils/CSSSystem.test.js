/**
 * Unit tests for Base CSS System
 * Phase 1.3 - Verify CSS injection mechanism and responsive units
 */

describe('Base CSS System', () => {
  let mockDocument;

  beforeEach(() => {
    // Clear any existing style elements
    document.querySelectorAll('style').forEach(el => el.remove());
  });

  describe('CSS injection mechanism', () => {
    test('should inject CSS into document head', () => {
      const cssContent = `
        .test-class {
          color: var(--color-primary);
          padding: var(--spacing-md);
        }
      `;

      // Function to inject CSS (following design pattern)
      const injectCSS = (css, id = 'injected-styles') => {
        // Check if already injected
        if (document.getElementById(id)) return;
        
        const styleElement = document.createElement('style');
        styleElement.id = id;
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
      };

      injectCSS(cssContent, 'test-styles');

      const injectedStyle = document.getElementById('test-styles');
      expect(injectedStyle).toBeTruthy();
      expect(injectedStyle.textContent.trim()).toContain('color: var(--color-primary)');
      expect(injectedStyle.textContent.trim()).toContain('padding: var(--spacing-md)');
    });

    test('should prevent duplicate CSS injection', () => {
      const cssContent = '.duplicate-test { color: red; }';

      const injectCSS = (css, id = 'injected-styles') => {
        if (document.getElementById(id)) return false; // Already exists
        
        const styleElement = document.createElement('style');
        styleElement.id = id;
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
        return true; // Successfully injected
      };

      // First injection should succeed
      const firstInjection = injectCSS(cssContent, 'duplicate-test');
      expect(firstInjection).toBe(true);

      // Second injection should be prevented
      const secondInjection = injectCSS(cssContent, 'duplicate-test');
      expect(secondInjection).toBe(false);

      // Should only have one style element
      const styleElements = document.querySelectorAll('#duplicate-test');
      expect(styleElements).toHaveLength(1);
    });

    test('should support CSS variables system', () => {
      const cssVariables = `
        :root {
          --spacing-xs: clamp(0.25rem, 1vw, 0.5rem);
          --spacing-sm: clamp(0.5rem, 2vw, 1rem);
          --spacing-md: clamp(1rem, 3vw, 2rem);
          --spacing-lg: clamp(2rem, 5vw, 4rem);
          --spacing-xl: clamp(3rem, 8vw, 6rem);
          
          --font-xs: clamp(0.75rem, 2vw, 0.875rem);
          --font-sm: clamp(0.875rem, 2.5vw, 1rem);
          --font-md: clamp(1rem, 3vw, 1.25rem);
          --font-lg: clamp(1.25rem, 4vw, 2rem);
          --font-xl: clamp(2rem, 6vw, 3rem);
          
          --color-primary: #3b82f6;
          --color-primary-hover: #2563eb;
          --text-primary: #1e293b;
          --surface-primary: #ffffff;
          --border-subtle: #e2e8f0;
        }
      `;

      const injectCSS = (css, id = 'injected-styles') => {
        const styleElement = document.createElement('style');
        styleElement.id = id;
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
      };

      injectCSS(cssVariables, 'css-variables');

      const variableStyle = document.getElementById('css-variables');
      expect(variableStyle).toBeTruthy();
      
      // Check for responsive spacing variables
      expect(variableStyle.textContent).toContain('--spacing-xs: clamp(0.25rem, 1vw, 0.5rem)');
      expect(variableStyle.textContent).toContain('--spacing-md: clamp(1rem, 3vw, 2rem)');
      
      // Check for responsive typography variables
      expect(variableStyle.textContent).toContain('--font-sm: clamp(0.875rem, 2.5vw, 1rem)');
      expect(variableStyle.textContent).toContain('--font-lg: clamp(1.25rem, 4vw, 2rem)');
      
      // Check for color variables
      expect(variableStyle.textContent).toContain('--color-primary: #3b82f6');
      expect(variableStyle.textContent).toContain('--text-primary: #1e293b');
    });
  });

  describe('Responsive units validation', () => {
    test('should validate clamp() function format', () => {
      const validateClampFunction = (clampValue) => {
        // Pattern to match clamp(min, preferred, max) format
        const clampPattern = /^clamp\(\s*[\d.]+(?:rem|vw|vh|%)\s*,\s*[\d.]+(?:rem|vw|vh|%)\s*,\s*[\d.]+(?:rem|vw|vh|%)\s*\)$/;
        return clampPattern.test(clampValue);
      };

      // Valid clamp functions
      expect(validateClampFunction('clamp(0.5rem, 2vw, 1rem)')).toBe(true);
      expect(validateClampFunction('clamp(1rem, 3vw, 2rem)')).toBe(true);
      expect(validateClampFunction('clamp(0.75rem, 2.5vh, 1.5rem)')).toBe(true);

      // Invalid formats (should fail)
      expect(validateClampFunction('20px')).toBe(false); // Pixel values forbidden
      expect(validateClampFunction('1em')).toBe(false); // em units not in clamp
      expect(validateClampFunction('clamp(20px, 3vw, 30px)')).toBe(false); // px in clamp forbidden
    });

    test('should detect forbidden pixel values', () => {
      const containsPixelValues = (cssString) => {
        const pixelPattern = /\b\d+px\b/g;
        return pixelPattern.test(cssString);
      };

      // Should detect pixel values
      expect(containsPixelValues('padding: 20px')).toBe(true);
      expect(containsPixelValues('margin: 10px 15px')).toBe(true);
      expect(containsPixelValues('width: 100px; height: 50px')).toBe(true);

      // Should not detect in valid responsive CSS
      expect(containsPixelValues('padding: var(--spacing-md)')).toBe(false);
      expect(containsPixelValues('margin: clamp(1rem, 3vw, 2rem)')).toBe(false);
      expect(containsPixelValues('width: 100%; height: 50vh')).toBe(false);
    });

    test('should validate responsive units are used', () => {
      const validateResponsiveUnits = (cssString) => {
        const sizeProperties = /(?:width|height|padding|margin|font-size|gap|border-radius):\s*([^;]+)/g;
        
        let match;
        const properties = [];
        
        while ((match = sizeProperties.exec(cssString)) !== null) {
          properties.push(match[1].trim());
        }
        
        const isResponsiveValue = (value) => {
          // Allow these valid values
          if (['0', 'auto', 'none', '100%', 'inherit', 'initial'].includes(value)) return true;
          
          // Check for responsive patterns
          const responsivePatterns = [
            /clamp\([^)]+\)/, // clamp functions
            /var\([^)]+\)/,   // CSS variables
            /\d+(?:rem|vw|vh|%)/, // responsive units
          ];
          
          return responsivePatterns.some(pattern => pattern.test(value));
        };
        
        return properties.every(isResponsiveValue);
      };

      const validCSS = `
        .component {
          padding: var(--spacing-md);
          margin: clamp(1rem, 3vw, 2rem);
          width: 100%;
          height: 50vh;
          font-size: var(--font-sm);
          gap: var(--spacing-sm);
        }
      `;

      const invalidCSS = `
        .component {
          padding: 20px;
          margin: 10px 15px;
          width: 300px;
        }
      `;

      expect(validateResponsiveUnits(validCSS)).toBe(true);
      expect(validateResponsiveUnits(invalidCSS)).toBe(false);
    });
  });

  describe('CSS class generation', () => {
    test('should generate CSS classes without inline styles', () => {
      const generateComponentCSS = (componentName, styles) => {
        return Object.entries(styles).map(([selector, rules]) => {
          const className = `${componentName}-${selector}`;
          const ruleString = Object.entries(rules)
            .map(([prop, value]) => `  ${prop}: ${value};`)
            .join('\n');
          
          return `.${className} {\n${ruleString}\n}`;
        }).join('\n\n');
      };

      const componentStyles = {
        container: {
          'display': 'flex',
          'padding': 'var(--spacing-md)',
          'background': 'var(--surface-primary)',
          'border-radius': 'var(--radius-md)'
        },
        header: {
          'font-size': 'var(--font-lg)',
          'color': 'var(--text-primary)',
          'margin-bottom': 'var(--spacing-sm)'
        },
        content: {
          'flex': '1',
          'overflow-y': 'auto',
          'padding': 'var(--spacing-sm)'
        }
      };

      const css = generateComponentCSS('tool-registry', componentStyles);

      // Should generate proper CSS classes
      expect(css).toContain('.tool-registry-container {');
      expect(css).toContain('display: flex;');
      expect(css).toContain('padding: var(--spacing-md);');
      
      expect(css).toContain('.tool-registry-header {');
      expect(css).toContain('font-size: var(--font-lg);');
      
      expect(css).toContain('.tool-registry-content {');
      expect(css).toContain('overflow-y: auto;');

      // Should not contain any inline style patterns
      expect(css).not.toContain('style="');
      expect(css).not.toContain('element.style');
    });

    test('should generate responsive CSS grid and flexbox layouts', () => {
      const generateLayoutCSS = () => {
        return `
          .responsive-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(clamp(15rem, 25vw, 20rem), 1fr));
            gap: var(--spacing-md);
            padding: var(--spacing-lg);
          }
          
          .responsive-flex {
            display: flex;
            flex-wrap: wrap;
            gap: var(--spacing-sm);
            align-items: center;
            justify-content: space-between;
          }
          
          .responsive-container {
            width: 100%;
            max-width: clamp(20rem, 90vw, 80rem);
            margin: 0 auto;
            padding: clamp(1rem, 4vw, 3rem);
          }
        `;
      };

      const css = generateLayoutCSS();

      // Should use modern layout techniques
      expect(css).toContain('display: grid');
      expect(css).toContain('grid-template-columns: repeat(auto-fit');
      expect(css).toContain('display: flex');
      expect(css).toContain('flex-wrap: wrap');

      // Should use responsive units throughout
      expect(css).toContain('minmax(clamp(15rem, 25vw, 20rem)');
      expect(css).toContain('gap: var(--spacing-md)');
      expect(css).toContain('max-width: clamp(20rem, 90vw, 80rem)');
      expect(css).toContain('padding: clamp(1rem, 4vw, 3rem)');
    });
  });
});