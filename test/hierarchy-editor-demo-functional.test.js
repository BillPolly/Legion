/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

// Mock functions using the manual mock pattern that works with ES modules
const mockFn = (impl) => {
  let calls = [];
  const fn = (...args) => {
    calls.push(args);
    if (impl) return impl(...args);
  };
  fn.calls = calls;
  fn.callCount = () => calls.length;
  fn.calledWith = (...args) => calls.some(call => 
    JSON.stringify(call) === JSON.stringify(args)
  );
  fn.lastCall = () => calls[calls.length - 1];
  fn.reset = () => { calls = []; fn.calls = calls; };
  return fn;
};

describe('HierarchyEditorDemo Functional Test', () => {
  let container;
  let mockEditors = new Map();
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockEditors.clear();
    
    // Override the HierarchyEditor import dynamically
    const originalImport = global.__import__;
    global.__import__ = async (path) => {
      if (path.includes('hierarchy-editor/index.js')) {
        return {
          HierarchyEditor: {
            create: (config) => {
              const mockEditor = {
                render: mockFn(),
                destroy: mockFn(),
                setMode: mockFn(),
                expandAll: mockFn(),
                collapseAll: mockFn(),
                loadContent: mockFn(),
                setContent: mockFn(),
                getContent: mockFn(() => '{"test": "data"}'),
                addNode: mockFn(),
                editNode: mockFn(),
                deleteNode: mockFn(),
                bulkOperation: mockFn((fn) => fn()),
                getTreeData: mockFn(() => ({ id: 'root', children: [] })),
                setTheme: mockFn(),
                setEditable: mockFn(),
                validate: mockFn(() => ({ valid: true }))
              };
              
              // Store reference for testing
              if (config.onMount) {
                config.onMount(mockEditor);
              }
              
              return mockEditor;
            }
          }
        };
      }
      return originalImport(path);
    };
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  test('should render hierarchy editor demo with all sections', () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    // Check main container
    const demoEl = container.querySelector('.hierarchy-editor-demo');
    expect(demoEl).toBeTruthy();
    
    // Check all demo sections are rendered
    expect(container.querySelector('[data-demo="basic"]')).toBeTruthy();
    expect(container.querySelector('[data-demo="format"]')).toBeTruthy();
    expect(container.querySelector('[data-demo="edit"]')).toBeTruthy();
    expect(container.querySelector('[data-demo="event"]')).toBeTruthy();
    expect(container.querySelector('[data-demo="advanced"]')).toBeTruthy();
    expect(container.querySelector('[data-demo="api"]')).toBeTruthy();
    
    // Check editor containers
    expect(container.querySelector('[data-editor-container="basic"]')).toBeTruthy();
    expect(container.querySelector('[data-editor-container="format"]')).toBeTruthy();
    expect(container.querySelector('[data-editor-container="edit"]')).toBeTruthy();
    expect(container.querySelector('[data-editor-container="event"]')).toBeTruthy();
    expect(container.querySelector('[data-editor-container="advanced"]')).toBeTruthy();
    
    demo.destroy();
  });
  
  test('should handle basic demo button clicks', () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    // Test tree mode button
    const treeModeBtn = container.querySelector('[data-action="tree-mode"][data-editor="basic"]');
    expect(treeModeBtn).toBeTruthy();
    treeModeBtn.click();
    
    // Test source mode button
    const sourceModeBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
    expect(sourceModeBtn).toBeTruthy();
    sourceModeBtn.click();
    
    // Test expand all button
    const expandBtn = container.querySelector('[data-action="expand-all"][data-editor="basic"]');
    expect(expandBtn).toBeTruthy();
    expandBtn.click();
    
    // Test collapse all button
    const collapseBtn = container.querySelector('[data-action="collapse-all"][data-editor="basic"]');
    expect(collapseBtn).toBeTruthy();
    collapseBtn.click();
    
    demo.destroy();
  });
  
  test('should handle format card clicks', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test clicking JSON format card
    const jsonCard = container.querySelector('[data-format="json"]');
    expect(jsonCard).toBeTruthy();
    jsonCard.click();
    
    // Wait for UI update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Should highlight the card
    expect(jsonCard.classList.contains('active')).toBe(true);
    
    // Test other format cards
    const xmlCard = container.querySelector('[data-format="xml"]');
    xmlCard.click();
    
    // Wait for UI update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(xmlCard.classList.contains('active')).toBe(true);
    expect(jsonCard.classList.contains('active')).toBe(false);
    
    demo.destroy();
  });
  
  test('should handle edit demo actions', () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    // Test add node button
    const addBtn = container.querySelector('[data-action="add-node"]');
    expect(addBtn).toBeTruthy();
    addBtn.click();
    
    // Test bulk add button
    const bulkBtn = container.querySelector('[data-action="bulk-add"]');
    expect(bulkBtn).toBeTruthy();
    bulkBtn.click();
    
    // Test clear button
    const clearBtn = container.querySelector('[data-action="clear"]');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    
    demo.destroy();
  });
  
  test('should handle event demo interactions', () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    // Check event log exists
    const eventLog = container.querySelector('[data-event-log]');
    expect(eventLog).toBeTruthy();
    
    // Test clear log button
    const clearLogBtn = container.querySelector('[data-action="clear-log"]');
    expect(clearLogBtn).toBeTruthy();
    clearLogBtn.click();
    
    expect(eventLog.innerHTML).toBe('');
    
    // Test programmatic actions
    const editBtn = container.querySelector('[data-action="programmatic-edit"][data-editor="event"]');
    expect(editBtn).toBeTruthy();
    editBtn.click();
    
    const addBtn = container.querySelector('[data-action="programmatic-add"][data-editor="event"]');
    expect(addBtn).toBeTruthy();
    addBtn.click();
    
    demo.destroy();
  });
  
  test('should handle advanced demo features', () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    // Test theme toggle
    const themeBtn = container.querySelector('[data-action="toggle-theme"]');
    const demoEl = container.querySelector('.hierarchy-editor-demo');
    
    expect(demoEl.classList.contains('theme-light')).toBe(true);
    
    themeBtn.click();
    expect(demoEl.classList.contains('theme-dark')).toBe(true);
    
    // Test read-only toggle
    const readOnlyBtn = container.querySelector('[data-action="toggle-readonly"]');
    const infoEl = container.querySelector('[data-info="advanced"]');
    
    expect(infoEl.textContent).toContain('Editable: true');
    
    readOnlyBtn.click();
    expect(infoEl.textContent).toContain('Editable: false');
    
    demo.destroy();
  });
  
  test('should handle umbilical protocol modes', () => {
    // Test introspection mode
    let requirements = null;
    HierarchyEditorDemo.create({
      describe: (reqs) => { requirements = reqs; }
    });
    
    expect(requirements).toBeTruthy();
    const reqList = requirements.getAll();
    expect(reqList.dom).toBeTruthy();
    expect(reqList.theme).toBeTruthy();
    expect(reqList.showApiExamples).toBeTruthy();
    
    // Test validation mode
    const validation = HierarchyEditorDemo.create({
      validate: (checks) => checks
    });
    
    expect(validation.hasValidTheme).toBeTruthy();
    expect(validation.hasValidMaxEntries).toBeTruthy();
    expect(validation.hasValidCallbacks).toBeTruthy();
  });
  
  test('should support custom configuration', () => {
    const demo = HierarchyEditorDemo.create({
      dom: container,
      theme: 'dark',
      showApiExamples: false,
      maxEventLogEntries: 50
    });
    
    // Check dark theme applied
    const demoEl = container.querySelector('.hierarchy-editor-demo');
    expect(demoEl.classList.contains('theme-dark')).toBe(true);
    
    // Check API examples not shown
    expect(container.querySelector('[data-demo="api"]')).toBeFalsy();
    
    demo.destroy();
  });
  
  test('should provide public API methods', () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    // Test public API methods exist
    expect(typeof demo.getEditorInstance).toBe('function');
    expect(typeof demo.getAllEditorInstances).toBe('function');
    expect(typeof demo.getEventLog).toBe('function');
    expect(typeof demo.loadSampleData).toBe('function');
    expect(typeof demo.clearEventLog).toBe('function');
    expect(typeof demo.setTheme).toBe('function');
    expect(typeof demo.getState).toBe('function');
    
    // Test getState
    const state = demo.getState();
    expect(state).toHaveProperty('editorCount');
    expect(state).toHaveProperty('theme');
    expect(state).toHaveProperty('readOnly');
    expect(state).toHaveProperty('nodeCounts');
    
    demo.destroy();
  });
});