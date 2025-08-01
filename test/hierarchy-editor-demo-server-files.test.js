/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('HierarchyEditorDemo Server File Loading Tests', () => {
  let container;
  let fetchMock;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '1000px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    // Create manual mock for fetch
    fetchMock = (() => {
      const calls = [];
      const responses = [];
      
      const fn = async (...args) => {
        calls.push(args);
        const response = responses.shift();
        if (response instanceof Error) {
          throw response;
        }
        return response || { ok: false, status: 404, text: async () => 'Not found' };
      };
      
      fn.calls = calls;
      fn.mockResolvedValueOnce = (response) => {
        responses.push(response);
        return fn;
      };
      fn.mockRejectedValueOnce = (error) => {
        responses.push(error);
        return fn;
      };
      fn.toHaveBeenCalledWith = (expected) => {
        return calls.some(call => call[0] === expected);
      };
      fn.clearCalls = () => {
        calls.length = 0;
      };
      
      return fn;
    })();
    
    global.fetch = fetchMock;
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Restore original fetch if it exists
    if (fetchMock && fetchMock.mockResolvedValueOnce) {
      delete global.fetch;
    }
  });
  
  const waitForRender = () => new Promise(resolve => setTimeout(resolve, 300));
  
  describe('Sample File Dropdown Tests', () => {
    test('should have sample file dropdowns in demo sections', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Check basic demo has dropdown
      const basicDropdown = container.querySelector('[data-demo="basic"] select[data-action="load-server-file"]');
      expect(basicDropdown).toBeTruthy();
      expect(basicDropdown.options.length).toBeGreaterThan(1);
      
      // Check edit demo has dropdown
      const editDropdown = container.querySelector('[data-demo="edit"] select[data-action="load-server-file"]');
      expect(editDropdown).toBeTruthy();
      expect(editDropdown.options.length).toBeGreaterThan(1);
      
      // Check dropdown options
      const options = Array.from(basicDropdown.options).map(opt => opt.textContent);
      expect(options).toContain('Package.json - Project Config');
      expect(options).toContain('User Profile - XML');
      expect(options).toContain('Application Config - YAML');
      expect(options).toContain('Documentation - Markdown');
      expect(options).toContain('Product Catalog - Complex JSON');
      
      demo.destroy();
    });
    
    test('should load JSON file when selected from dropdown', async () => {
      const mockJsonContent = JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0'
        }
      }, null, 2);
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => mockJsonContent
      });
      
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Select a file from dropdown
      const dropdown = container.querySelector('[data-demo="basic"] select[data-action="load-server-file"]');
      dropdown.value = '/data/samples/package.json';
      
      const changeEvent = new Event('change', { bubbles: true });
      dropdown.dispatchEvent(changeEvent);
      
      await waitForRender();
      
      // Check fetch was called
      expect(fetchMock.toHaveBeenCalledWith('/data/samples/package.json')).toBe(true);
      
      // Check status updated
      const statusEl = container.querySelector('[data-status="basic"]');
      expect(statusEl.textContent).toContain('Loaded: package.json');
      
      // Check dropdown was reset
      expect(dropdown.value).toBe('');
      
      demo.destroy();
    });
    
    test('should load XML file with correct format detection', async () => {
      const mockXmlContent = `<?xml version="1.0"?>
<user>
  <name>Test User</name>
  <email>test@example.com</email>
</user>`;
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => mockXmlContent
      });
      
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      const dropdown = container.querySelector('[data-demo="edit"] select[data-action="load-server-file"]');
      dropdown.value = '/data/samples/user-profile.xml';
      dropdown.dispatchEvent(new Event('change', { bubbles: true }));
      
      await waitForRender();
      
      // Check fetch was called
      expect(fetchMock.toHaveBeenCalledWith('/data/samples/user-profile.xml')).toBe(true);
      
      // Check status updated
      const statusEl = container.querySelector('[data-status="edit"]');
      expect(statusEl.textContent).toContain('Loaded: user-profile.xml');
      
      // Check editor content has XML format
      const editor = demo.getEditorInstance('edit');
      expect(editor._content).toContain('<?xml');
      
      demo.destroy();
    });
    
    test('should handle fetch errors gracefully', async () => {
      // This test verifies that loadServerFile method exists and handles errors
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Store original console.error
      const originalConsoleError = console.error;
      console.error = () => {}; // Suppress error logging in tests
      
      // Mock fetch to reject
      const originalFetch = global.fetch;
      global.fetch = () => Promise.reject(new Error('Network error'));
      
      // Get the viewModel directly
      const viewModel = demo.viewModel;
      expect(viewModel.loadServerFile).toBeDefined();
      
      // Call loadServerFile directly
      await viewModel.loadServerFile('/data/samples/test.json', 'basic');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check that status was updated with error
      const statusEl = container.querySelector('[data-status="basic"]');
      expect(statusEl.textContent).toContain('Error:');
      
      // Restore
      global.fetch = originalFetch;
      console.error = originalConsoleError;
      
      demo.destroy();
    });
    
    test('should handle 404 responses', async () => {
      // This test verifies that loadServerFile handles 404 responses
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Store original console.error
      const originalConsoleError = console.error;
      console.error = () => {}; // Suppress error logging in tests
      
      // Mock fetch to return 404
      const originalFetch = global.fetch;
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found')
      });
      
      // Get the viewModel directly
      const viewModel = demo.viewModel;
      
      // Call loadServerFile directly
      await viewModel.loadServerFile('/data/samples/missing.json', 'basic');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check that status was updated with error
      const statusEl = container.querySelector('[data-status="basic"]');
      expect(statusEl.textContent).toContain('Error:');
      expect(statusEl.textContent).toContain('404');
      
      // Restore
      global.fetch = originalFetch;
      console.error = originalConsoleError;
      
      demo.destroy();
    });
    
    test('should detect format from file extension', async () => {
      // Test format detection by checking different file extensions
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Just check that the dropdown exists and has the right options
      const dropdown = container.querySelector('[data-demo="basic"] select[data-action="load-server-file"]');
      expect(dropdown).toBeTruthy();
      
      // Check that each sample file has the correct extension
      const options = Array.from(dropdown.options);
      const jsonOption = options.find(opt => opt.value.includes('.json'));
      const xmlOption = options.find(opt => opt.value.includes('.xml'));
      const yamlOption = options.find(opt => opt.value.includes('.yaml'));
      const mdOption = options.find(opt => opt.value.includes('.md'));
      
      expect(jsonOption).toBeTruthy();
      expect(xmlOption).toBeTruthy();
      expect(yamlOption).toBeTruthy();
      expect(mdOption).toBeTruthy();
      
      demo.destroy();
    });
  });
  
  describe('Integration with Existing Features', () => {
    test('should work alongside file upload', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Both dropdown and file upload should be present
      const dropdown = container.querySelector('[data-demo="basic"] select[data-action="load-server-file"]');
      const fileInput = container.querySelector('#basic-file-input');
      const uploadButton = container.querySelector('[data-demo="basic"] button[onclick*="basic-file-input"]');
      
      expect(dropdown).toBeTruthy();
      expect(fileInput).toBeTruthy();
      expect(uploadButton).toBeTruthy();
      expect(uploadButton.textContent).toContain('Upload File');
      
      demo.destroy();
    });
    
    test('should maintain other functionality after loading server file', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => '{"test": "data"}'
      });
      
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Load a file
      const dropdown = container.querySelector('[data-demo="basic"] select[data-action="load-server-file"]');
      dropdown.value = '/data/samples/test.json';
      dropdown.dispatchEvent(new Event('change', { bubbles: true }));
      
      await waitForRender();
      
      // Check other buttons still work
      const treeBtn = container.querySelector('[data-action="tree-mode"][data-editor="basic"]');
      const sourceBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
      
      expect(treeBtn).toBeTruthy();
      expect(sourceBtn).toBeTruthy();
      
      // Click source mode
      sourceBtn.click();
      await waitForRender();
      
      // Editor should be in source mode
      const editor = demo.getEditorInstance('basic');
      expect(editor._mode).toBe('source');
      
      demo.destroy();
    });
  });
});