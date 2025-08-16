/**
 * ToolRegistryView - View layer for ToolRegistry application  
 * Handles DOM structure creation, CSS generation, and visual states
 * Following MVVM architecture pattern from design document
 */

export class ToolRegistryView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
    this.elements = new Map();
  }
  
  /**
   * Generate complete CSS for the application
   * Uses only responsive units (clamp, vw, vh, rem) and CSS variables
   * @returns {string} CSS content
   */
  generateCSS() {
    return `
      /* Reset and base styles */
      * {
        box-sizing: border-box;
      }
      
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
      }
      
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
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: var(--surface-secondary);
        color: var(--text-primary);
        line-height: 1.6;
        overflow: hidden;
        box-sizing: border-box;
      }
      
      /* Header Section */
      .app-header {
        flex-shrink: 0;
        background: var(--surface-primary);
        border-bottom: 1px solid var(--border-subtle);
        box-shadow: var(--shadow-sm);
        z-index: 10;
      }
      
      /* Main Content Area */
      .main-content {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: 100%;
        box-sizing: border-box;
      }
      
      /* Navigation Tabs - fixed height */
      .main-content #navigation-tabs-container {
        flex-shrink: 0;
        height: 4rem;
      }
      
      /* Tab Content Area - fills remaining space exactly */
      .main-content .tab-content {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        background: var(--surface-primary);
        /* Remove hardcoded height - let flexbox handle it */
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
      
      /* Utility Classes */
      .visually-hidden {
        position: absolute;
        width: 0.0625rem;
        height: 0.0625rem;
        padding: 0;
        margin: -0.0625rem;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      
      .scroll-container {
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--border-medium) transparent;
      }
      
      .scroll-container::-webkit-scrollbar {
        width: 0.5rem;
      }
      
      .scroll-container::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .scroll-container::-webkit-scrollbar-thumb {
        background: var(--border-medium);
        border-radius: var(--radius-sm);
      }
      
      .scroll-container::-webkit-scrollbar-thumb:hover {
        background: var(--border-strong);
      }
    `;
  }
  
  /**
   * Inject CSS into document head (once only)
   * @returns {boolean} True if CSS was injected, false if already present
   */
  injectCSS() {
    if (this.cssInjected) return false;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'tool-registry-styles';
    styleElement.textContent = this.generateCSS();
    document.head.appendChild(styleElement);
    this.cssInjected = true;
    return true;
  }
  
  /**
   * Render the complete application structure
   * @param {Object} modelData - State data from the model
   * @returns {HTMLElement} The rendered container element
   */
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
  }
  
  /**
   * Create header container element
   * @returns {HTMLElement} Header container
   */
  createHeaderContainer() {
    const header = document.createElement('div');
    header.className = 'app-header';
    header.id = 'app-header-container';
    return header;
  }
  
  /**
   * Create main content container element
   * @returns {HTMLElement} Main content container
   */
  createMainContent() {
    const main = document.createElement('div');
    main.className = 'main-content';
    main.id = 'main-content-container';
    return main;
  }
  
  /**
   * Show loading overlay
   */
  showLoading() {
    this.hideLoading(); // Remove any existing overlay
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    
    this.container.style.position = 'relative';
    this.container.appendChild(overlay);
  }
  
  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = this.container.querySelector('.loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
  
  /**
   * Show error message in main content area
   * @param {Error} error - Error object to display
   */
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
  }
  
  /**
   * Clear error state from main content area
   */
  clearError() {
    const main = this.elements.get('main');
    if (main) {
      const errorContainer = main.querySelector('.error-container');
      if (errorContainer) {
        errorContainer.remove();
      }
    }
  }
  
  /**
   * Get stored DOM element reference
   * @param {string} key - Element key
   * @returns {HTMLElement|null} Element or null if not found
   */
  getElement(key) {
    return this.elements.get(key);
  }
  
  /**
   * Update container CSS class
   * @param {string} className - New CSS class name
   */
  updateContainerClass(className) {
    this.container.className = className;
  }
  
  /**
   * Clean up resources and remove styles
   */
  destroy() {
    this.elements.clear();
    
    if (this.cssInjected) {
      const styleElement = document.getElementById('tool-registry-styles');
      if (styleElement) {
        styleElement.remove();
      }
    }
    
    this.container = null;
    this.cssInjected = false;
  }
}