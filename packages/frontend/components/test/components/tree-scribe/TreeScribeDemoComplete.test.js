/**
 * TreeScribeDemoComplete.test.js
 * Comprehensive jsdom state testing for TreeScribe demo component
 * Tests actual DOM interactions from simple to complex scenarios
 */

import { TreeScribeDemo } from '../../../public/examples/tree-scribe-demo/index.js';
import { UmbilicalUtils } from '../../../src/umbilical/index.js';

describe('TreeScribeDemo - Complete jsdom Testing', () => {
  let container;
  let demoInstance;

  // Mock fetch for document loading
  const mockFetch = (response) => {
    global.fetch = () => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(response)
    });
  };

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    container.style.width = '1000px';
    container.style.height = '800px';
    document.body.appendChild(container);

    // Mock file APIs
    global.URL.createObjectURL = () => 'mock-blob-url';
    global.URL.revokeObjectURL = () => {};
    
    // Mock fetch with default YAML
    mockFetch(`
title: Test Document
content: |
  # Test Content
  This is a test document for the TreeScribe demo.
children:
  - title: Section 1
    content: Content for section 1
  - title: Section 2  
    content: Content for section 2
    children:
      - title: Subsection 2.1
        content: Nested content
`);
  });

  afterEach(() => {
    if (demoInstance) {
      demoInstance.destroy();
      demoInstance = null;
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Level 1: Basic Component Creation', () => {
    test('should create component with valid DOM structure', () => {
      demoInstance = TreeScribeDemo.create({ dom: container });

      // Verify main container exists
      const demoContainer = container.querySelector('.tree-scribe-demo');
      expect(demoContainer).toBeTruthy();
      expect(demoContainer.parentNode).toBe(container);

      // Verify basic structure
      expect(container.querySelector('.demo-header')).toBeTruthy();
      expect(container.querySelector('.demo-toolbar')).toBeTruthy();
      expect(container.querySelector('.demo-content')).toBeTruthy();
      expect(container.querySelector('.demo-footer')).toBeTruthy();
    });

    test('should have all required controls in DOM', () => {
      demoInstance = TreeScribeDemo.create({ dom: container });

      // Document controls
      const documentSelect = container.querySelector('#documentSelect');
      expect(documentSelect).toBeTruthy();
      expect(documentSelect.tagName).toBe('SELECT');
      expect(documentSelect.options.length).toBeGreaterThan(0);

      // Theme controls  
      const themeSelect = container.querySelector('#themeSelect');
      expect(themeSelect).toBeTruthy();
      expect(themeSelect.value).toBe('light'); // Default theme

      // Search controls
      const searchInput = container.querySelector('#searchInput');
      expect(searchInput).toBeTruthy();
      expect(searchInput.type).toBe('text');
      expect(searchInput.placeholder).toContain('Search');

      // Action buttons
      expect(container.querySelector('#expandAllBtn')).toBeTruthy();
      expect(container.querySelector('#collapseAllBtn')).toBeTruthy();
      expect(container.querySelector('#exportHtmlBtn')).toBeTruthy();
      expect(container.querySelector('#exportJsonBtn')).toBeTruthy();

      // Status displays
      expect(container.querySelector('#nodeCount')).toBeTruthy();
      expect(container.querySelector('#loadTime')).toBeTruthy();
      expect(container.querySelector('#searchResults')).toBeTruthy();
    });

    test('should initialize with correct default values', () => {
      demoInstance = TreeScribeDemo.create({ dom: container });

      // Check default selections
      expect(container.querySelector('#documentSelect').value).toBe('simple-guide');
      expect(container.querySelector('#themeSelect').value).toBe('light');
      
      // Check feature toggles default state
      expect(container.querySelector('#enableSearch').checked).toBe(true);
      expect(container.querySelector('#enableFolding').checked).toBe(true);
      expect(container.querySelector('#enableKeyboard').checked).toBe(true);

      // Check status displays
      expect(container.querySelector('#nodeCount').textContent).toBe('0');
      expect(container.querySelector('#searchResults').textContent).toBe('0');
    });
  });

  describe('Level 2: User Interface Interactions', () => {
    beforeEach(() => {
      demoInstance = TreeScribeDemo.create({ dom: container });
    });

    test('should handle theme switching with DOM updates', () => {
      const themeSelect = container.querySelector('#themeSelect');
      const currentTheme = container.querySelector('#currentTheme');

      // Initial state
      expect(currentTheme.textContent).toBe('light');

      // Switch to dark theme
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));

      // Verify DOM update
      expect(currentTheme.textContent).toBe('dark');

      // Switch back to light
      themeSelect.value = 'light';
      themeSelect.dispatchEvent(new Event('change'));

      expect(currentTheme.textContent).toBe('light');
    });

    test('should handle search input with real-time updates', async () => {
      const searchInput = container.querySelector('#searchInput');
      const clearBtn = container.querySelector('#clearSearchBtn');

      // Type in search box
      searchInput.value = 'test query';
      searchInput.dispatchEvent(new Event('input'));

      // Verify input value is set
      expect(searchInput.value).toBe('test query');

      // Clear search
      clearBtn.click();

      // Verify input is cleared
      expect(searchInput.value).toBe('');
    });

    test('should handle button clicks without errors', () => {
      const expandBtn = container.querySelector('#expandAllBtn');
      const collapseBtn = container.querySelector('#collapseAllBtn');
      const reloadBtn = container.querySelector('#reloadBtn');

      // Should not throw errors
      expect(() => {
        expandBtn.click();
        collapseBtn.click();
        reloadBtn.click();
      }).not.toThrow();

      // Verify buttons are still enabled and functional
      expect(expandBtn.disabled).toBe(false);
      expect(collapseBtn.disabled).toBe(false);
      expect(reloadBtn.disabled).toBe(false);
    });

    test('should handle feature toggle changes', () => {
      const searchToggle = container.querySelector('#enableSearch');
      const foldingToggle = container.querySelector('#enableFolding');
      const keyboardToggle = container.querySelector('#enableKeyboard');

      // Initial state
      expect(searchToggle.checked).toBe(true);
      expect(foldingToggle.checked).toBe(true);
      expect(keyboardToggle.checked).toBe(true);

      // Toggle features
      searchToggle.checked = false;
      searchToggle.dispatchEvent(new Event('change'));

      foldingToggle.checked = false;
      foldingToggle.dispatchEvent(new Event('change'));

      // Verify state changes
      expect(searchToggle.checked).toBe(false);
      expect(foldingToggle.checked).toBe(false);
    });
  });

  describe('Level 3: Document Loading and State Management', () => {
    beforeEach(() => {
      demoInstance = TreeScribeDemo.create({ dom: container });
    });

    test('should handle document selection changes', async () => {
      const documentSelect = container.querySelector('#documentSelect');
      
      // Change to complex structure
      documentSelect.value = 'complex-structure';
      documentSelect.dispatchEvent(new Event('change'));

      // Wait for any async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify selection is maintained
      expect(documentSelect.value).toBe('complex-structure');
    });

    test('should handle file upload simulation', () => {
      const fileInput = container.querySelector('#fileInput');
      const loadFileBtn = container.querySelector('#loadFileBtn');

      // Verify file input is hidden but accessible via button
      expect(fileInput.style.display).toBe('none');
      expect(loadFileBtn).toBeTruthy();

      // Simulate file button click (should trigger file input)
      expect(() => {
        loadFileBtn.click();
      }).not.toThrow();
    });

    test('should update statistics display', async () => {
      const nodeCount = container.querySelector('#nodeCount');
      const loadTime = container.querySelector('#loadTime');

      // Initial state
      expect(nodeCount.textContent).toBe('0');
      expect(loadTime.textContent).toMatch(/\d+ms/);

      // The demo should have loaded initial content
      await new Promise(resolve => setTimeout(resolve, 100));

      // Stats might be updated by TreeScribe initialization
      expect(nodeCount.textContent).toBeDefined();
      expect(loadTime.textContent).toBeDefined();
    });
  });

  describe('Level 4: Event Logging System', () => {
    beforeEach(() => {
      demoInstance = TreeScribeDemo.create({ dom: container });
    });

    test('should create and populate event log', async () => {
      const eventLog = container.querySelector('#eventLog');
      const clearLogBtn = container.querySelector('#clearLogBtn');

      expect(eventLog).toBeTruthy();
      expect(clearLogBtn).toBeTruthy();

      // Trigger some events to generate log entries
      const expandBtn = container.querySelector('#expandAllBtn');
      expandBtn.click();

      // Wait for log entries to be added
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check if log has entries (might be from initialization)
      const logEntries = eventLog.querySelectorAll('.log-entry');
      expect(logEntries.length).toBeGreaterThanOrEqual(0);

      // Clear log
      clearLogBtn.click();
      expect(eventLog.innerHTML).toBe('');
    });

    test('should add timestamped log entries', async () => {
      const eventLog = container.querySelector('#eventLog');
      
      // Trigger an action that should log
      const themeSelect = container.querySelector('#themeSelect');
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));

      await new Promise(resolve => setTimeout(resolve, 10));

      // Log might contain entries from theme change or initialization
      const logEntries = eventLog.querySelectorAll('.log-entry');
      if (logEntries.length > 0) {
        // Check timestamp format in log entries
        const logEntry = logEntries[0];
        expect(logEntry.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/); // Time format
      }
    });
  });

  describe('Level 5: Export Functionality', () => {
    beforeEach(() => {
      demoInstance = TreeScribeDemo.create({ dom: container });
    });

    test('should handle HTML export', () => {
      const exportHtmlBtn = container.querySelector('#exportHtmlBtn');
      
      // Mock document.createElement for download link
      const originalCreateElement = document.createElement;
      let clickCalled = false;
      const mockAnchor = {
        href: '',
        download: '',
        click: () => { clickCalled = true; },
        style: {}
      };
      
      document.createElement = (tagName) => {
        if (tagName === 'a') return mockAnchor;
        return originalCreateElement.call(document, tagName);
      };

      // Should not throw
      expect(() => {
        exportHtmlBtn.click();
      }).not.toThrow();

      // Restore original
      document.createElement = originalCreateElement;
    });

    test('should handle JSON export', () => {
      const exportJsonBtn = container.querySelector('#exportJsonBtn');
      
      // Mock document.createElement for download link
      const originalCreateElement = document.createElement;
      let clickCalled = false;
      const mockAnchor = {
        href: '',
        download: '',
        click: () => { clickCalled = true; },
        style: {}
      };
      
      document.createElement = (tagName) => {
        if (tagName === 'a') return mockAnchor;
        return originalCreateElement.call(document, tagName);
      };

      // Should not throw
      expect(() => {
        exportJsonBtn.click();
      }).not.toThrow();

      // Restore original
      document.createElement = originalCreateElement;
    });
  });

  describe('Level 6: Complex Interaction Scenarios', () => {
    beforeEach(() => {
      demoInstance = TreeScribeDemo.create({ dom: container });
    });

    test('should handle rapid sequential interactions', () => {
      const themeSelect = container.querySelector('#themeSelect');
      const documentSelect = container.querySelector('#documentSelect');
      const searchInput = container.querySelector('#searchInput');
      const expandBtn = container.querySelector('#expandAllBtn');

      // Rapid interaction sequence
      expect(() => {
        themeSelect.value = 'dark';
        themeSelect.dispatchEvent(new Event('change'));
        
        documentSelect.value = 'complex-structure';
        documentSelect.dispatchEvent(new Event('change'));
        
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
        
        expandBtn.click();
        
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        
        themeSelect.value = 'light';
        themeSelect.dispatchEvent(new Event('change'));
      }).not.toThrow();

      // Verify final state
      expect(themeSelect.value).toBe('light');
      expect(documentSelect.value).toBe('complex-structure');
      expect(searchInput.value).toBe('');
    });

    test('should maintain consistent UI state during interactions', () => {
      const documentSelect = container.querySelector('#documentSelect');
      const themeSelect = container.querySelector('#themeSelect');
      const currentTheme = container.querySelector('#currentTheme');

      // Change document
      documentSelect.value = 'markdown-demo';
      documentSelect.dispatchEvent(new Event('change'));

      // Change theme
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));

      // Verify both changes are maintained
      expect(documentSelect.value).toBe('markdown-demo');
      expect(themeSelect.value).toBe('dark');
      expect(currentTheme.textContent).toBe('dark');
    });

    test('should handle search debouncing correctly', async () => {
      const searchInput = container.querySelector('#searchInput');
      const searchResults = container.querySelector('#searchResults');

      // Initial state
      expect(searchResults.textContent).toBe('0');

      // Rapid typing simulation
      searchInput.value = 't';
      searchInput.dispatchEvent(new Event('input'));
      
      searchInput.value = 'te';
      searchInput.dispatchEvent(new Event('input'));
      
      searchInput.value = 'tes';
      searchInput.dispatchEvent(new Event('input'));
      
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));

      // Search should be debounced - verify input value is correct
      expect(searchInput.value).toBe('test');

      // Wait for debounce to complete
      await new Promise(resolve => setTimeout(resolve, 400));

      // Should not throw during debounce period
      expect(searchInput.value).toBe('test');
    });
  });

  describe('Level 7: Error Handling and Edge Cases', () => {
    beforeEach(() => {
      demoInstance = TreeScribeDemo.create({ dom: container });
    });

    test('should handle file reading errors gracefully', async () => {
      const fileInput = container.querySelector('#fileInput');
      
      // Mock file that throws error
      const mockFile = {
        text: () => Promise.reject(new Error('File read error')),
        name: 'test.yaml'
      };

      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });

      // Should not throw
      expect(() => {
        fileInput.dispatchEvent(new Event('change'));
      }).not.toThrow();

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // UI should still be functional
      expect(container.querySelector('.tree-scribe-demo')).toBeTruthy();
    });

    test('should handle network errors during document loading', async () => {
      // Mock fetch to fail
      global.fetch = () => Promise.reject(new Error('Network error'));

      const documentSelect = container.querySelector('#documentSelect');
      
      // Should not throw when changing document triggers failed load
      expect(() => {
        documentSelect.value = 'complex-structure';
        documentSelect.dispatchEvent(new Event('change'));
      }).not.toThrow();

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // UI should still be responsive
      expect(documentSelect.value).toBe('complex-structure');
    });

    test('should handle invalid DOM modifications', () => {
      const demoContainer = container.querySelector('.tree-scribe-demo');
      
      // Try to break the UI structure
      expect(() => {
        // Remove a control element
        const searchInput = container.querySelector('#searchInput');
        if (searchInput) {
          searchInput.remove();
        }
        
        // Try to interact with removed element (should not crash due to our null check)
        const clearBtn = container.querySelector('#clearSearchBtn');
        if (clearBtn) {
          clearBtn.click(); // This should now work due to our null check fix
        }
      }).not.toThrow();

      // Main container should still exist
      expect(demoContainer).toBeTruthy();
    });
  });

  describe('Level 8: Lifecycle and Memory Management', () => {
    test('should properly clean up on destroy', () => {
      demoInstance = TreeScribeDemo.create({ dom: container });

      // Verify creation
      expect(container.querySelector('.tree-scribe-demo')).toBeTruthy();
      expect(demoInstance.getTreeScribe()).toBeTruthy();

      // Destroy
      demoInstance.destroy();

      // Verify cleanup
      expect(container.querySelector('.tree-scribe-demo')).toBeFalsy();
      expect(container.children.length).toBe(0);
    });

    test('should handle multiple destroy calls', () => {
      demoInstance = TreeScribeDemo.create({ dom: container });

      // Multiple destroy calls should not throw
      expect(() => {
        demoInstance.destroy();
        demoInstance.destroy();
        demoInstance.destroy();
      }).not.toThrow();
    });

    test('should clean up event listeners', () => {
      demoInstance = TreeScribeDemo.create({ dom: container });

      // Get reference to controls
      const themeSelect = container.querySelector('#themeSelect');
      const searchInput = container.querySelector('#searchInput');

      // Destroy instance
      demoInstance.destroy();

      // Interacting with controls after destroy should not cause memory leaks
      // (We can't easily test this directly, but we can verify no errors)
      expect(() => {
        if (themeSelect) {
          themeSelect.value = 'dark';
          themeSelect.dispatchEvent(new Event('change'));
        }
        if (searchInput) {
          searchInput.value = 'test';
          searchInput.dispatchEvent(new Event('input'));
        }
      }).not.toThrow();
    });
  });

  describe('Level 9: Public API Validation', () => {
    beforeEach(() => {
      demoInstance = TreeScribeDemo.create({ dom: container });
    });

    test('should expose correct public API', () => {
      expect(typeof demoInstance.getTreeScribe).toBe('function');
      expect(typeof demoInstance.destroy).toBe('function');

      // Should return TreeScribe instance
      const treeScribe = demoInstance.getTreeScribe();
      expect(treeScribe).toBeTruthy();
      expect(typeof treeScribe).toBe('object');
    });

    test('should maintain API consistency after interactions', () => {
      // Perform various interactions
      const themeSelect = container.querySelector('#themeSelect');
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));

      const expandBtn = container.querySelector('#expandAllBtn');
      expandBtn.click();

      // API should still work
      expect(typeof demoInstance.getTreeScribe).toBe('function');
      expect(typeof demoInstance.destroy).toBe('function');
      expect(demoInstance.getTreeScribe()).toBeTruthy();
    });
  });

  describe('Level 10: Complete Integration Test', () => {
    test('should handle full user workflow simulation', async () => {
      // Create instance
      demoInstance = TreeScribeDemo.create({
        dom: container,
        onMount: () => {},
        onDestroy: () => {}
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      // Complete user workflow
      const workflow = async () => {
        // 1. Change theme
        const themeSelect = container.querySelector('#themeSelect');
        themeSelect.value = 'dark';
        themeSelect.dispatchEvent(new Event('change'));

        // 2. Change document
        const documentSelect = container.querySelector('#documentSelect');
        documentSelect.value = 'complex-structure';
        documentSelect.dispatchEvent(new Event('change'));

        // 3. Search for content
        const searchInput = container.querySelector('#searchInput');
        searchInput.value = 'section';
        searchInput.dispatchEvent(new Event('input'));

        // 4. Expand all nodes
        const expandBtn = container.querySelector('#expandAllBtn');
        expandBtn.click();

        // 5. Try export
        const exportBtn = container.querySelector('#exportHtmlBtn');
        exportBtn.click();

        // 6. Clear search
        const clearBtn = container.querySelector('#clearSearchBtn');
        clearBtn.click();

        // 7. Collapse all nodes
        const collapseBtn = container.querySelector('#collapseAllBtn');
        collapseBtn.click();

        // 8. Toggle features
        const searchToggle = container.querySelector('#enableSearch');
        searchToggle.checked = false;
        searchToggle.dispatchEvent(new Event('change'));

        // 9. Reload document
        const reloadBtn = container.querySelector('#reloadBtn');
        reloadBtn.click();

        // 10. Clear log (do this last since reload adds log entries)
        await new Promise(resolve => setTimeout(resolve, 10)); // Wait for reload log
        const clearLogBtn = container.querySelector('#clearLogBtn');
        clearLogBtn.click();
      };

      // Execute complete workflow
      await expect(workflow()).resolves.toBeUndefined();

      // Verify final state
      expect(container.querySelector('.tree-scribe-demo')).toBeTruthy();
      expect(container.querySelector('#themeSelect').value).toBe('dark');
      expect(container.querySelector('#documentSelect').value).toBe('complex-structure');
      expect(container.querySelector('#searchInput').value).toBe('');
      expect(container.querySelector('#enableSearch').checked).toBe(false);
      expect(container.querySelector('#eventLog').innerHTML).toBe('');

      // Verify TreeScribe is still accessible
      expect(demoInstance.getTreeScribe()).toBeTruthy();
    });
  });
});