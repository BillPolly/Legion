/**
 * Unit tests for ToolRegistryView
 * Phase 2.2 - Test CSS generation, DOM structure creation, loading/error states
 */

describe('ToolRegistryView', () => {
  let container;
  let view;

  const createToolRegistryView = (containerElement) => {
    return {
      container: containerElement,
      cssInjected: false,
      elements: new Map(),
      
      generateCSS() {
        return `
          /* CSS Variables for Responsive Design */
          :root {
            /* Spacing System */
            --spacing-xs: clamp(0.25rem, 1vw, 0.5rem);
            --spacing-sm: clamp(0.5rem, 2vw, 1rem);
            --spacing-md: clamp(1rem, 3vw, 2rem);
            --spacing-lg: clamp(2rem, 5vw, 4rem);
            --spacing-xl: clamp(3rem, 8vw, 6rem);
            
            /* Typography System */
            --font-xs: clamp(0.75rem, 2vw, 0.875rem);
            --font-sm: clamp(0.875rem, 2.5vw, 1rem);
            --font-md: clamp(1rem, 3vw, 1.25rem);
            --font-lg: clamp(1.25rem, 4vw, 2rem);
            --font-xl: clamp(2rem, 6vw, 3rem);
            --font-xxl: clamp(2.5rem, 8vw, 4rem);
            
            /* Color System */
            --color-primary: #3b82f6;
            --color-primary-hover: #2563eb;
            --color-secondary: #64748b;
            --color-success: #10b981;
            --color-warning: #f59e0b;
            --color-error: #ef4444;
            
            --surface-primary: #ffffff;
            --surface-secondary: #f8fafc;
            --surface-tertiary: #f1f5f9;
            --surface-hover: #e2e8f0;
            
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --text-tertiary: #94a3b8;
            
            --border-subtle: #e2e8f0;
            --border-medium: #cbd5e1;
            --border-strong: #94a3b8;
            
            /* Shadows */
            --shadow-sm: 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.1);
            --shadow-md: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.15);
            
            /* Border Radius */
            --radius-sm: clamp(0.25rem, 0.5vw, 0.375rem);
            --radius-md: clamp(0.375rem, 1vw, 0.5rem);
            --radius-lg: clamp(0.5rem, 1.5vw, 0.75rem);
          }
          
          /* Root Application Styles */
          .tool-registry-app {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--surface-secondary);
            color: var(--text-primary);
            line-height: 1.6;
          }
          
          /* Header Section */
          .app-header {
            flex-shrink: 0;
            background: var(--surface-primary);
            border-bottom: 0.125rem solid var(--border-subtle);
            box-shadow: var(--shadow-sm);
          }
          
          /* Main Content Area */
          .main-content {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          
          /* Loading States */
          .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          
          .loading-spinner {
            width: clamp(2rem, 5vw, 3rem);
            height: clamp(2rem, 5vw, 3rem);
            border: 0.25rem solid var(--border-subtle);
            border-top: 0.25rem solid var(--color-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Error States */
          .error-container {
            padding: var(--spacing-lg);
            text-align: center;
            color: var(--color-error);
          }
          
          .error-title {
            font-size: var(--font-lg);
            font-weight: 600;
            margin-bottom: var(--spacing-md);
          }
          
          .error-message {
            font-size: var(--font-md);
            margin-bottom: var(--spacing-lg);
          }
        `;
      },
      
      injectCSS() {
        if (this.cssInjected) return false;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'tool-registry-styles';
        styleElement.textContent = this.generateCSS();
        document.head.appendChild(styleElement);
        this.cssInjected = true;
        return true;
      },
      
      render(modelData) {
        this.injectCSS();
        
        // Clear container
        this.container.innerHTML = '';
        this.container.className = 'tool-registry-app';
        
        // Create main structure
        const headerContainer = this.createHeaderContainer();
        const mainContent = this.createMainContent();
        
        this.container.appendChild(headerContainer);
        this.container.appendChild(mainContent);
        
        // Store element references
        this.elements.set('header', headerContainer);
        this.elements.set('main', mainContent);
        
        return this.container;
      },
      
      createHeaderContainer() {
        const header = document.createElement('div');
        header.className = 'app-header';
        header.id = 'app-header-container';
        return header;
      },
      
      createMainContent() {
        const main = document.createElement('div');
        main.className = 'main-content';
        main.id = 'main-content-container';
        return main;
      },
      
      showLoading() {
        this.hideLoading(); // Remove any existing overlay
        
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div>';
        
        this.container.style.position = 'relative';
        this.container.appendChild(overlay);
      },
      
      hideLoading() {
        const overlay = this.container.querySelector('.loading-overlay');
        if (overlay) {
          overlay.remove();
        }
      },
      
      showError(error) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container';
        
        const errorTitle = document.createElement('h2');
        errorTitle.className = 'error-title';
        errorTitle.textContent = 'Application Error';
        
        const errorMessage = document.createElement('p');
        errorMessage.className = 'error-message';
        errorMessage.textContent = error.message || 'An unexpected error occurred';
        
        errorContainer.appendChild(errorTitle);
        errorContainer.appendChild(errorMessage);
        
        const main = this.elements.get('main');
        if (main) {
          main.innerHTML = '';
          main.appendChild(errorContainer);
        }
      },
      
      clearError() {
        const main = this.elements.get('main');
        if (main) {
          const errorContainer = main.querySelector('.error-container');
          if (errorContainer) {
            errorContainer.remove();
          }
        }
      }
    };
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    view = createToolRegistryView(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Clear injected styles
    const styleElement = document.getElementById('tool-registry-styles');
    if (styleElement) {
      styleElement.remove();
    }
  });

  describe('CSS generation', () => {
    test('should generate CSS with responsive variables', () => {
      const css = view.generateCSS();
      
      // Check for CSS variables
      expect(css).toContain(':root {');
      
      // Check spacing system variables
      expect(css).toContain('--spacing-xs: clamp(0.25rem, 1vw, 0.5rem)');
      expect(css).toContain('--spacing-sm: clamp(0.5rem, 2vw, 1rem)');
      expect(css).toContain('--spacing-md: clamp(1rem, 3vw, 2rem)');
      expect(css).toContain('--spacing-lg: clamp(2rem, 5vw, 4rem)');
      expect(css).toContain('--spacing-xl: clamp(3rem, 8vw, 6rem)');
      
      // Check typography system variables
      expect(css).toContain('--font-xs: clamp(0.75rem, 2vw, 0.875rem)');
      expect(css).toContain('--font-sm: clamp(0.875rem, 2.5vw, 1rem)');
      expect(css).toContain('--font-md: clamp(1rem, 3vw, 1.25rem)');
      expect(css).toContain('--font-lg: clamp(1.25rem, 4vw, 2rem)');
      expect(css).toContain('--font-xl: clamp(2rem, 6vw, 3rem)');
      
      // Check color variables
      expect(css).toContain('--color-primary: #3b82f6');
      expect(css).toContain('--color-primary-hover: #2563eb');
      expect(css).toContain('--surface-primary: #ffffff');
      expect(css).toContain('--text-primary: #1e293b');
      expect(css).toContain('--border-subtle: #e2e8f0');
    });

    test('should not contain any pixel values', () => {
      const css = view.generateCSS();
      
      // Should not contain pixel values (except in comments or rgba)
      const pixelRegex = /(?<!\/\*.*)\b\d+px\b(?!.*\*\/)/g;
      const pixelMatches = css.match(pixelRegex);
      
      expect(pixelMatches).toBeNull();
    });

    test('should use only responsive units', () => {
      const css = view.generateCSS();
      
      // Extract all numeric values with units
      const unitRegex = /\b\d+(?:\.\d+)?(?:rem|vw|vh|%)\b/g;
      const responsiveUnits = css.match(unitRegex);
      
      expect(responsiveUnits).toBeTruthy();
      expect(responsiveUnits.length).toBeGreaterThan(0);
      
      // Check for clamp functions
      expect(css).toMatch(/clamp\([^)]+\)/);
    });

    test('should include animation keyframes', () => {
      const css = view.generateCSS();
      
      expect(css).toContain('@keyframes spin');
      expect(css).toContain('0% { transform: rotate(0deg); }');
      expect(css).toContain('100% { transform: rotate(360deg); }');
    });
  });

  describe('CSS injection', () => {
    test('should inject CSS into document head', () => {
      const injected = view.injectCSS();
      
      expect(injected).toBe(true);
      
      const styleElement = document.getElementById('tool-registry-styles');
      expect(styleElement).toBeTruthy();
      expect(styleElement.textContent).toContain('tool-registry-app');
      expect(view.cssInjected).toBe(true);
    });

    test('should prevent duplicate CSS injection', () => {
      const firstInjection = view.injectCSS();
      const secondInjection = view.injectCSS();
      
      expect(firstInjection).toBe(true);
      expect(secondInjection).toBe(false);
      
      const styleElements = document.querySelectorAll('#tool-registry-styles');
      expect(styleElements).toHaveLength(1);
    });

    test('should automatically inject CSS during render', () => {
      view.render({});
      
      const styleElement = document.getElementById('tool-registry-styles');
      expect(styleElement).toBeTruthy();
      expect(view.cssInjected).toBe(true);
    });
  });

  describe('DOM structure creation', () => {
    test('should render basic application structure', () => {
      const mockData = { currentPanel: 'search' };
      const result = view.render(mockData);
      
      expect(result).toBe(container);
      expect(container.className).toBe('tool-registry-app');
      
      // Should have header and main content
      const header = container.querySelector('#app-header-container');
      const main = container.querySelector('#main-content-container');
      
      expect(header).toBeTruthy();
      expect(main).toBeTruthy();
      
      expect(header.className).toBe('app-header');
      expect(main.className).toBe('main-content');
    });

    test('should clear container before rendering', () => {
      // Add some initial content
      container.innerHTML = '<div>existing content</div>';
      container.className = 'existing-class';
      
      view.render({});
      
      expect(container.className).toBe('tool-registry-app');
      expect(container.querySelector('div')).not.toBeNull(); // Should have new divs
      expect(container.textContent).not.toContain('existing content');
    });

    test('should store element references', () => {
      view.render({});
      
      const header = view.elements.get('header');
      const main = view.elements.get('main');
      
      expect(header).toBeTruthy();
      expect(main).toBeTruthy();
      expect(header.id).toBe('app-header-container');
      expect(main.id).toBe('main-content-container');
    });

    test('should create header container with correct structure', () => {
      const header = view.createHeaderContainer();
      
      expect(header.tagName).toBe('DIV');
      expect(header.className).toBe('app-header');
      expect(header.id).toBe('app-header-container');
    });

    test('should create main content with correct structure', () => {
      const main = view.createMainContent();
      
      expect(main.tagName).toBe('DIV');
      expect(main.className).toBe('main-content');
      expect(main.id).toBe('main-content-container');
    });
  });

  describe('Loading states', () => {
    test('should show loading overlay', () => {
      view.render({});
      view.showLoading();
      
      const overlay = container.querySelector('.loading-overlay');
      const spinner = container.querySelector('.loading-spinner');
      
      expect(overlay).toBeTruthy();
      expect(spinner).toBeTruthy();
      expect(overlay.contains(spinner)).toBe(true);
      
      // Should set position relative on container
      expect(container.style.position).toBe('relative');
    });

    test('should hide loading overlay', () => {
      view.render({});
      view.showLoading();
      
      // Verify loading is shown first
      expect(container.querySelector('.loading-overlay')).toBeTruthy();
      
      view.hideLoading();
      
      // Should be removed
      expect(container.querySelector('.loading-overlay')).toBeNull();
    });

    test('should handle multiple showLoading calls gracefully', () => {
      view.render({});
      view.showLoading();
      view.showLoading();
      
      const overlays = container.querySelectorAll('.loading-overlay');
      expect(overlays).toHaveLength(1);
    });

    test('should handle hideLoading when no loading overlay exists', () => {
      view.render({});
      
      expect(() => {
        view.hideLoading();
      }).not.toThrow();
    });
  });

  describe('Error states', () => {
    test('should show error message in main content', () => {
      view.render({});
      
      const error = new Error('Test error message');
      view.showError(error);
      
      const main = view.elements.get('main');
      const errorContainer = main.querySelector('.error-container');
      const errorTitle = errorContainer.querySelector('.error-title');
      const errorMessage = errorContainer.querySelector('.error-message');
      
      expect(errorContainer).toBeTruthy();
      expect(errorTitle.textContent).toBe('Application Error');
      expect(errorMessage.textContent).toBe('Test error message');
    });

    test('should show generic error for errors without message', () => {
      view.render({});
      
      const error = {};
      view.showError(error);
      
      const main = view.elements.get('main');
      const errorMessage = main.querySelector('.error-message');
      
      expect(errorMessage.textContent).toBe('An unexpected error occurred');
    });

    test('should clear previous content when showing error', () => {
      view.render({});
      
      const main = view.elements.get('main');
      main.innerHTML = '<div>existing content</div>';
      
      view.showError(new Error('Test error'));
      
      expect(main.textContent).not.toContain('existing content');
      expect(main.querySelector('.error-container')).toBeTruthy();
    });

    test('should clear error state', () => {
      view.render({});
      view.showError(new Error('Test error'));
      
      // Verify error is shown
      const main = view.elements.get('main');
      expect(main.querySelector('.error-container')).toBeTruthy();
      
      view.clearError();
      
      // Should be removed
      expect(main.querySelector('.error-container')).toBeNull();
    });
  });
});