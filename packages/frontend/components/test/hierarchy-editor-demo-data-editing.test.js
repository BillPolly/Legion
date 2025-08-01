/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('HierarchyEditorDemo Data Loading and Editing Tests', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '1000px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  // Helper to wait for rendering and editor initialization
  const waitForRender = () => new Promise(resolve => setTimeout(resolve, 300));
  
  describe('Data Loading Tests', () => {
    test('should load sample JSON data in basic demo', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Check the demo sections exist
      const basicSection = container.querySelector('[data-demo="basic"]');
      expect(basicSection).toBeTruthy();
      
      // BaseView creates a child container, so look deeper
      const basicEditorContainer = container.querySelector('[data-editor-container="basic"]');
      expect(basicEditorContainer).toBeTruthy();
      
      // Check that editor was initialized (mock editor renders content)
      const editorContent = basicEditorContainer.innerHTML;
      expect(editorContent).toBeTruthy();
      expect(editorContent.length).toBeGreaterThan(0);
      
      // Check for the real editor's rendered content
      expect(basicEditorContainer.textContent).toContain('Live Editor');
      expect(basicEditorContainer.textContent).toContain('json');
      
      demo.destroy();
    });
    
    test('should load different format when format card clicked', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Click XML format card
      const xmlCard = container.querySelector('[data-format="xml"]');
      expect(xmlCard).toBeTruthy();
      xmlCard.click();
      
      await waitForRender();
      
      // Check format editor updated
      const formatEditorContainer = container.querySelector('[data-editor-container="format"]');
      expect(formatEditorContainer).toBeTruthy();
      
      const formatContent = formatEditorContainer.textContent;
      expect(formatContent).toContain('Live Editor');
      // XML will show parse error since it's not valid JSON, so check for that instead
      expect(formatContent).toContain('xml');
      
      demo.destroy();
    });
    
    test('should switch between tree and source views', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      const basicEditorContainer = container.querySelector('[data-editor-container="basic"]');
      expect(basicEditorContainer).toBeTruthy();
      
      // Initially in tree view
      expect(basicEditorContainer.textContent).toContain('tree');
      
      // Click source mode button
      const sourceModeBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
      expect(sourceModeBtn).toBeTruthy();
      sourceModeBtn.click();
      
      await waitForRender();
      
      // Should now show source view
      const editor = demo.getEditorInstance('basic');
      expect(editor).toBeTruthy();
      expect(editor._mode).toBe('source');
      
      // Check DOM updated
      expect(basicEditorContainer.textContent).toContain('source');
      
      demo.destroy();
    });
  });
  
  describe('Data Editing Tests', () => {
    test('should update status when interacting with edit demo', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Check initial status
      const statusEl = container.querySelector('[data-status="edit"]');
      expect(statusEl).toBeTruthy();
      
      // Status should indicate sample data is loaded
      const statusText = statusEl.textContent;
      expect(statusText).toContain('Sample data loaded');
      
      // Click add node button
      const addBtn = container.querySelector('[data-action="add-node"]');
      expect(addBtn).toBeTruthy();
      addBtn.click();
      
      await waitForRender();
      
      // Check status was updated
      expect(statusEl.textContent).toContain('Added node');
      
      demo.destroy();
    });
    
    test('should handle bulk operations', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Clear first to start fresh
      const clearBtn = container.querySelector('[data-action="clear"]');
      expect(clearBtn).toBeTruthy();
      clearBtn.click();
      
      await waitForRender();
      
      // Click bulk add
      const bulkBtn = container.querySelector('[data-action="bulk-add"]');
      expect(bulkBtn).toBeTruthy();
      bulkBtn.click();
      
      await waitForRender();
      
      // Check that editor content was updated
      const editContainer = container.querySelector('[data-editor-container="edit"]');
      expect(editContainer).toBeTruthy();
      
      demo.destroy();
    });
    
    test('should update event log when performing actions', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      const eventLog = container.querySelector('[data-event-log]');
      expect(eventLog).toBeTruthy();
      
      // Clear log first
      const clearLogBtn = container.querySelector('[data-action="clear-log"]');
      expect(clearLogBtn).toBeTruthy();
      clearLogBtn.click();
      
      await waitForRender();
      
      // Perform a programmatic edit
      const editBtn = container.querySelector('[data-action="programmatic-edit"][data-editor="event"]');
      expect(editBtn).toBeTruthy();
      editBtn.click();
      
      await waitForRender();
      
      // Check event was logged (programmatic edit triggers onNodeEdit in mock)
      const events = eventLog.querySelectorAll('.event');
      expect(events.length).toBeGreaterThan(0);
      
      // Check event content
      const eventText = eventLog.textContent;
      expect(eventText).toContain('nodeEdit');
      
      demo.destroy();
    });
  });
  
  describe('File Operations Tests', () => {
    test('should handle file input changes', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Get file input
      const fileInput = container.querySelector('#basic-file-input');
      expect(fileInput).toBeTruthy();
      expect(fileInput.type).toBe('file');
      
      // Create a mock file
      const mockFile = new File(['{"loaded": "from file"}'], 'test.json', { type: 'application/json' });
      
      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });
      
      const changeEvent = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(changeEvent);
      
      // Wait for FileReader to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check status updated
      const statusEl = container.querySelector('[data-status="basic"]');
      expect(statusEl).toBeTruthy();
      expect(statusEl.textContent).toContain('Loaded: test.json');
      
      demo.destroy();
    });
    
    test('should handle download action', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Mock URL.createObjectURL and revokeObjectURL
      const mockUrl = 'blob:mock-url';
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      let objectUrlCreated = false;
      let objectUrlRevoked = false;
      
      URL.createObjectURL = () => {
        objectUrlCreated = true;
        return mockUrl;
      };
      URL.revokeObjectURL = () => {
        objectUrlRevoked = true;
      };
      
      // Mock anchor click
      let downloadTriggered = false;
      let downloadFilename = '';
      const originalCreateElement = document.createElement.bind(document);
      document.createElement = (tag) => {
        if (tag === 'a') {
          const anchor = originalCreateElement('a');
          const originalClick = anchor.click;
          anchor.click = function() {
            downloadTriggered = true;
            downloadFilename = this.download;
          };
          return anchor;
        }
        return originalCreateElement(tag);
      };
      
      // Click download button
      const downloadBtn = container.querySelector('[data-action="download"][data-editor="edit"]');
      expect(downloadBtn).toBeTruthy();
      downloadBtn.click();
      
      await waitForRender();
      
      // Check download was triggered
      expect(downloadTriggered).toBe(true);
      expect(downloadFilename).toContain('.json');
      expect(objectUrlCreated).toBe(true);
      expect(objectUrlRevoked).toBe(true);
      
      // Restore mocks
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement;
      
      demo.destroy();
    });
  });
  
  describe('Advanced Features Tests', () => {
    test('should toggle theme', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Find the demo element created by BaseView
      const demoEl = container.querySelector('.hierarchy-editor-demo');
      expect(demoEl).toBeTruthy();
      expect(demoEl.classList.contains('theme-light')).toBe(true);
      
      // Toggle theme
      const themeBtn = container.querySelector('[data-action="toggle-theme"]');
      expect(themeBtn).toBeTruthy();
      themeBtn.click();
      
      await waitForRender();
      
      // Check theme changed
      expect(demoEl.classList.contains('theme-dark')).toBe(true);
      expect(demoEl.classList.contains('theme-light')).toBe(false);
      
      demo.destroy();
    });
    
    test('should update status when validating', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Click validate button
      const validateBtn = container.querySelector('[data-action="validate"][data-editor="advanced"]');
      expect(validateBtn).toBeTruthy();
      validateBtn.click();
      
      await waitForRender();
      
      // Check status updated
      const statusEl = container.querySelector('[data-status="advanced"]');
      expect(statusEl).toBeTruthy();
      expect(statusEl.textContent).toContain('valid');
      
      demo.destroy();
    });
  });
  
  describe('Component Integration Tests', () => {
    test('should have all required demo sections', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Check all demo sections exist
      expect(container.querySelector('[data-demo="basic"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="format"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="edit"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="event"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="advanced"]')).toBeTruthy();
      
      // Check all editor containers exist
      expect(container.querySelector('[data-editor-container="basic"]')).toBeTruthy();
      expect(container.querySelector('[data-editor-container="format"]')).toBeTruthy();
      expect(container.querySelector('[data-editor-container="edit"]')).toBeTruthy();
      expect(container.querySelector('[data-editor-container="event"]')).toBeTruthy();
      expect(container.querySelector('[data-editor-container="advanced"]')).toBeTruthy();
      
      demo.destroy();
    });
    
    test('should properly initialize all editor instances', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Get all editor instances
      const editors = demo.getAllEditorInstances();
      
      // Should have 5 editors
      expect(editors.size).toBe(5);
      
      // Check each editor exists
      expect(demo.getEditorInstance('basic')).toBeTruthy();
      expect(demo.getEditorInstance('format')).toBeTruthy();
      expect(demo.getEditorInstance('edit')).toBeTruthy();
      expect(demo.getEditorInstance('event')).toBeTruthy();
      expect(demo.getEditorInstance('advanced')).toBeTruthy();
      
      demo.destroy();
    });
    
    test('should maintain state across operations', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Get initial state
      const initialState = demo.getState();
      expect(initialState.theme).toBe('light');
      expect(initialState.readOnly).toBe(false);
      
      // Change theme
      const themeBtn = container.querySelector('[data-action="toggle-theme"]');
      expect(themeBtn).toBeTruthy();
      themeBtn.click();
      
      await waitForRender();
      
      // Check state updated
      const updatedState = demo.getState();
      expect(updatedState.theme).toBe('dark');
      
      // Toggle read-only
      const readOnlyBtn = container.querySelector('[data-action="toggle-readonly"]');
      expect(readOnlyBtn).toBeTruthy();
      readOnlyBtn.click();
      
      await waitForRender();
      
      // Check state updated again
      const finalState = demo.getState();
      expect(finalState.readOnly).toBe(true);
      
      demo.destroy();
    });
  });
  
  describe('Mock Editor Interaction Tests', () => {
    test('should show tree view content correctly', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      const editContainer = container.querySelector('[data-editor-container="edit"]');
      expect(editContainer).toBeTruthy();
      
      // Real editor should render tree view
      const treeContent = editContainer.textContent;
      expect(treeContent).toContain('"name"'); // JSON format with quotes
      expect(treeContent).toContain('Click values to edit'); // New editor message
      
      demo.destroy();
    });
    
    test('should handle programmatic operations', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Get event editor instance
      const eventEditor = demo.getEditorInstance('event');
      expect(eventEditor).toBeTruthy();
      
      // Clear event log
      const clearLogBtn = container.querySelector('[data-action="clear-log"]');
      clearLogBtn.click();
      
      await waitForRender();
      
      // Perform programmatic add
      const addBtn = container.querySelector('[data-action="programmatic-add"][data-editor="event"]');
      addBtn.click();
      
      await waitForRender();
      
      // Check event log updated
      const eventLog = container.querySelector('[data-event-log]');
      const events = eventLog.querySelectorAll('.event');
      expect(events.length).toBeGreaterThan(0);
      
      // Should contain nodeAdd event
      expect(eventLog.textContent).toContain('nodeAdd');
      
      demo.destroy();
    });
  });
});