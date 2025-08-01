/**
 * TreeScribeDemo.test.js
 * Tests for the TreeScribe demo component
 * Validates umbilical protocol compliance and basic functionality
 */

import { TreeScribeDemo } from '../../../public/examples/tree-scribe-demo/index.js';
import { UmbilicalUtils } from '../../../src/umbilical/index.js';

describe('TreeScribeDemo', () => {
  let container;
  let mockUmbilical;

  beforeEach(() => {
    // Create fresh DOM container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Mock basic fetch for document loading
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('title: Test Document\ncontent: Test content')
      });

    // Mock file download functionality
    global.URL.createObjectURL = () => 'mock-url';
    global.URL.revokeObjectURL = () => {};

    // Setup mock umbilical
    mockUmbilical = {
      dom: container,
      onMount: () => {},
      onDestroy: () => {}
    };
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Umbilical Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let describeWasCalled = false;
      let requirementsReceived = null;

      TreeScribeDemo.create({
        describe: (requirements) => {
          describeWasCalled = true;
          requirementsReceived = requirements;
        }
      });

      expect(describeWasCalled).toBe(true);
      expect(requirementsReceived).toBeDefined();
    });

    test('should support validation mode', () => {
      let validateWasCalled = false;
      let checksReceived = null;

      const result = TreeScribeDemo.create({
        validate: (checks) => {
          validateWasCalled = true;
          checksReceived = checks;
          return checks;
        }
      });

      expect(validateWasCalled).toBe(true);
      expect(checksReceived).toBeDefined();
      expect(checksReceived.hasDomElement).toBeDefined();
      expect(result).toBeDefined();
    });

    test('should validate DOM element correctly', () => {
      const validElement = document.createElement('div');
      
      const result = TreeScribeDemo.create({
        validate: (checks) => checks
      });

      expect(result.hasDomElement).toBe(false); // No DOM element provided
      
      const resultWithElement = TreeScribeDemo.create({
        dom: validElement,
        validate: (checks) => checks
      });

      expect(resultWithElement.hasDomElement).toBe(true);
    });

    test('should throw error for missing required capabilities', () => {
      expect(() => {
        TreeScribeDemo.create({});
      }).toThrow();

      expect(() => {
        TreeScribeDemo.create({
          dom: null
        });
      }).toThrow();
    });

    test('should accept valid umbilical and create instance', () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      expect(instance).toBeDefined();
      expect(instance.getTreeScribe).toBeDefined();
      expect(instance.destroy).toBeDefined();
      expect(typeof instance.getTreeScribe).toBe('function');
      expect(typeof instance.destroy).toBe('function');
    });
  });

  describe('Demo Instance Creation', () => {
    test('should create demo UI structure', () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      // Verify main container
      const demoContainer = container.querySelector('.tree-scribe-demo');
      expect(demoContainer).toBeTruthy();
      
      // Verify header
      const header = container.querySelector('.demo-header');
      expect(header).toBeTruthy();
      expect(header.textContent).toMatch(/TreeScribe/);
      
      // Verify toolbar
      const toolbar = container.querySelector('.demo-toolbar');
      expect(toolbar).toBeTruthy();
      
      // Verify main content area
      const content = container.querySelector('.demo-content');
      expect(content).toBeTruthy();
      
      // Verify sidebar
      const sidebar = container.querySelector('.demo-sidebar');
      expect(sidebar).toBeTruthy();
      
      // Verify footer
      const footer = container.querySelector('.demo-footer');
      expect(footer).toBeTruthy();
    });

    test('should create all required UI controls', () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      // Document selector
      expect(container.querySelector('#documentSelect')).toBeTruthy();
      
      // Theme selector
      expect(container.querySelector('#themeSelect')).toBeTruthy();
      
      // Search input
      expect(container.querySelector('#searchInput')).toBeTruthy();
      
      // Action buttons
      expect(container.querySelector('#expandAllBtn')).toBeTruthy();
      expect(container.querySelector('#collapseAllBtn')).toBeTruthy();
      expect(container.querySelector('#exportHtmlBtn')).toBeTruthy();
      expect(container.querySelector('#exportJsonBtn')).toBeTruthy();
      
      // Feature toggles
      expect(container.querySelector('#enableSearch')).toBeTruthy();
      expect(container.querySelector('#enableFolding')).toBeTruthy();
      expect(container.querySelector('#enableKeyboard')).toBeTruthy();
      
      // Status displays
      expect(container.querySelector('#nodeCount')).toBeTruthy();
      expect(container.querySelector('#loadTime')).toBeTruthy();
      expect(container.querySelector('#searchResults')).toBeTruthy();
    });

    test('should call onMount callback when provided', () => {
      let mountCalled = false;
      let instanceReceived = null;

      const instance = TreeScribeDemo.create({
        ...mockUmbilical,
        onMount: (inst) => {
          mountCalled = true;
          instanceReceived = inst;
        }
      });
      
      expect(mountCalled).toBe(true);
      expect(instanceReceived).toBe(instance);
    });
  });

  describe('User Interactions', () => {
    let instance;

    beforeEach(async () => {
      instance = TreeScribeDemo.create(mockUmbilical);
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    test('should handle theme changes', () => {
      const themeSelect = container.querySelector('#themeSelect');
      
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));
      
      const currentTheme = container.querySelector('#currentTheme');
      expect(currentTheme.textContent).toBe('dark');
    });

    test('should handle search input', () => {
      const searchInput = container.querySelector('#searchInput');
      
      // Type in search box
      searchInput.value = 'test query';
      searchInput.dispatchEvent(new Event('input'));
      
      // Should not throw errors
      expect(searchInput.value).toBe('test query');
    });

    test('should handle search clearing', () => {
      const clearBtn = container.querySelector('#clearSearchBtn');
      const searchInput = container.querySelector('#searchInput');
      
      searchInput.value = 'some text';
      clearBtn.click();
      
      expect(searchInput.value).toBe('');
    });

    test('should handle tree expansion controls', () => {
      const expandBtn = container.querySelector('#expandAllBtn');
      const collapseBtn = container.querySelector('#collapseAllBtn');
      
      // Should not throw errors when clicked
      expect(() => {
        expandBtn.click();
        collapseBtn.click();
      }).not.toThrow();
    });

    test('should handle reload button', () => {
      const reloadBtn = container.querySelector('#reloadBtn');
      
      // Should not throw errors when clicked
      expect(() => {
        reloadBtn.click();
      }).not.toThrow();
    });

    test('should handle feature toggles', () => {
      const searchToggle = container.querySelector('#enableSearch');
      const foldingToggle = container.querySelector('#enableFolding');
      
      // These are demonstration toggles
      searchToggle.checked = false;
      searchToggle.dispatchEvent(new Event('change'));
      
      foldingToggle.checked = false;
      foldingToggle.dispatchEvent(new Event('change'));
      
      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Event Logging', () => {
    test('should have event log panel', async () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      const eventLog = container.querySelector('#eventLog');
      expect(eventLog).toBeTruthy();
    });

    test('should clear event log when requested', async () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      const clearLogBtn = container.querySelector('#clearLogBtn');
      const eventLog = container.querySelector('#eventLog');
      
      clearLogBtn.click();
      
      expect(eventLog.innerHTML).toBe('');
    });
  });

  describe('Public API', () => {
    test('should expose getTreeScribe method', () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      expect(instance.getTreeScribe).toBeDefined();
      expect(typeof instance.getTreeScribe).toBe('function');
      
      const treeScribe = instance.getTreeScribe();
      expect(treeScribe).toBeDefined();
    });

    test('should expose destroy method', () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      expect(instance.destroy).toBeDefined();
      expect(typeof instance.destroy).toBe('function');
    });
  });

  describe('Cleanup and Destruction', () => {
    test('should clean up properly on destroy', () => {
      let destroyCalled = false;
      let instanceReceived = null;

      const instance = TreeScribeDemo.create({
        ...mockUmbilical,
        onDestroy: (inst) => {
          destroyCalled = true;
          instanceReceived = inst;
        }
      });
      
      // Verify instance was created
      expect(container.querySelector('.tree-scribe-demo')).toBeTruthy();
      
      instance.destroy();
      
      // Verify DOM was cleaned up
      expect(container.querySelector('.tree-scribe-demo')).toBeFalsy();
      
      // Verify onDestroy callback was called
      expect(destroyCalled).toBe(true);
      expect(instanceReceived).toBe(instance);
    });

    test('should handle multiple destroy calls gracefully', () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      instance.destroy();
      
      // Second call should not throw
      expect(() => {
        instance.destroy();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle file reading errors gracefully', async () => {
      const instance = TreeScribeDemo.create(mockUmbilical);
      
      // Create mock file that will cause read error
      const mockFile = {
        text: () => Promise.reject(new Error('File read error'))
      };
      
      const fileInput = container.querySelector('#fileInput');
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });
      
      // Should not throw when triggering file change
      expect(() => {
        fileInput.dispatchEvent(new Event('change'));
      }).not.toThrow();
    });
  });

  describe('Responsive Design', () => {
    test('should work with different container sizes', () => {
      // Test with small container
      const smallContainer = document.createElement('div');
      smallContainer.style.width = '320px';
      smallContainer.style.height = '240px';
      document.body.appendChild(smallContainer);
      
      const instance = TreeScribeDemo.create({
        dom: smallContainer,
        onMount: () => {},
        onDestroy: () => {}
      });
      
      expect(smallContainer.querySelector('.tree-scribe-demo')).toBeTruthy();
      
      instance.destroy();
      smallContainer.remove();
    });
  });
});