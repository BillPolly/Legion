/**
 * @jest-environment jsdom
 */

// Mock the HierarchyEditor module before importing
jest.mock('../src/components/hierarchy-editor/index.js', () => ({
  HierarchyEditor: {
    create: jest.fn((config) => {
      const mockEditor = {
        render: jest.fn(),
        destroy: jest.fn(),
        setMode: jest.fn(),
        expandAll: jest.fn(),
        collapseAll: jest.fn(),
        loadContent: jest.fn(),
        setContent: jest.fn(),
        getContent: jest.fn(() => '{"test": "data"}'),
        addNode: jest.fn(),
        editNode: jest.fn(),
        deleteNode: jest.fn(),
        bulkOperation: jest.fn((fn) => fn()),
        getTreeData: jest.fn(() => ({ id: 'root', children: [] })),
        setTheme: jest.fn(),
        setEditable: jest.fn(),
        validate: jest.fn(() => ({ valid: true }))
      };
      
      // Call mount callback if provided
      if (config.onMount) {
        config.onMount(mockEditor);
      }
      
      return mockEditor;
    })
  }
}));

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';
import { HierarchyEditor } from '../src/components/hierarchy-editor/index.js';

describe('HierarchyEditorDemo Component', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    jest.clearAllMocks();
  });
  
  describe('Umbilical Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      HierarchyEditorDemo.create({
        describe: (reqs) => { requirements = reqs; }
      });
      
      expect(requirements).toBeDefined();
      const reqList = requirements.getAll();
      
      expect(reqList.dom).toBeDefined();
      expect(reqList.theme).toBeDefined();
      expect(reqList.showApiExamples).toBeDefined();
      expect(reqList.maxEventLogEntries).toBeDefined();
      expect(reqList.sampleData).toBeDefined();
    });
    
    test('should support validation mode', () => {
      const validation = HierarchyEditorDemo.create({
        validate: (checks) => checks
      });
      
      expect(validation.hasValidTheme).toBeDefined();
      expect(validation.hasValidMaxEntries).toBeDefined();
      expect(validation.hasValidCallbacks).toBeDefined();
    });
    
    test('should validate theme values', () => {
      const validLight = HierarchyEditorDemo.create({
        validate: (checks) => checks
      }, { theme: 'light' });
      expect(validLight.hasValidTheme).toBe(true);
      
      const validDark = HierarchyEditorDemo.create({
        validate: (checks) => checks
      }, { theme: 'dark' });
      expect(validDark.hasValidTheme).toBe(true);
      
      const invalid = HierarchyEditorDemo.create({
        validate: (checks) => checks
      }, { theme: 'invalid' });
      expect(invalid.hasValidTheme).toBe(false);
    });
  });
  
  describe('Component Creation and Initialization', () => {
    test('should create demo component with default config', () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      expect(demo).toBeDefined();
      expect(typeof demo.destroy).toBe('function');
      expect(typeof demo.getEditorInstance).toBe('function');
      expect(typeof demo.getAllEditorInstances).toBe('function');
      
      // Check that DOM was populated
      expect(container.querySelector('.hierarchy-editor-demo')).toBeTruthy();
      
      demo.destroy();
    });
    
    test('should create demo with custom configuration', () => {
      const demo = HierarchyEditorDemo.create({
        dom: container,
        theme: 'dark',
        showApiExamples: false,
        maxEventLogEntries: 50
      });
      
      expect(demo).toBeDefined();
      
      // Check theme applied
      const demoEl = container.querySelector('.hierarchy-editor-demo');
      expect(demoEl.classList.contains('theme-dark')).toBe(true);
      
      // Check API examples section not rendered
      expect(container.querySelector('[data-demo="api"]')).toBeFalsy();
      
      demo.destroy();
    });
    
    test('should initialize all editor instances', () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      // HierarchyEditor.create should be called 5 times (one for each demo section)
      expect(HierarchyEditor.create).toHaveBeenCalledTimes(5);
      
      // Check that all editors were registered
      const allEditors = demo.getAllEditorInstances();
      expect(allEditors.length).toBe(5);
      expect(allEditors.map(([name]) => name)).toEqual(
        expect.arrayContaining(['basic', 'format', 'edit', 'event', 'advanced'])
      );
      
      demo.destroy();
    });
  });
  
  describe('Demo Section Rendering', () => {
    let demo;
    
    beforeEach(() => {
      demo = HierarchyEditorDemo.create({
        dom: container
      });
    });
    
    afterEach(() => {
      if (demo) {
        demo.destroy();
      }
    });
    
    test('should render all demo sections', () => {
      expect(container.querySelector('[data-demo="basic"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="format"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="edit"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="event"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="advanced"]')).toBeTruthy();
      expect(container.querySelector('[data-demo="api"]')).toBeTruthy();
    });
    
    test('should render editor containers', () => {
      expect(container.querySelector('[data-editor-container="basic"]')).toBeTruthy();
      expect(container.querySelector('[data-editor-container="format"]')).toBeTruthy();
      expect(container.querySelector('[data-editor-container="edit"]')).toBeTruthy();
      expect(container.querySelector('[data-editor-container="event"]')).toBeTruthy();
      expect(container.querySelector('[data-editor-container="advanced"]')).toBeTruthy();
    });
    
    test('should render control buttons', () => {
      const buttons = container.querySelectorAll('button[data-action]');
      expect(buttons.length).toBeGreaterThan(0);
      
      // Check for specific actions
      const actions = Array.from(buttons).map(btn => btn.dataset.action);
      expect(actions).toEqual(expect.arrayContaining([
        'tree-mode', 'source-mode', 'expand-all', 'collapse-all',
        'add-node', 'delete-selected', 'bulk-add', 'clear',
        'clear-log', 'programmatic-edit', 'programmatic-add',
        'toggle-theme', 'toggle-readonly', 'export-data', 'validate', 'large-dataset'
      ]));
    });
  });
  
  describe('Basic Demo Interactions', () => {
    let demo;
    
    beforeEach(() => {
      demo = HierarchyEditorDemo.create({
        dom: container
      });
    });
    
    afterEach(() => {
      if (demo) {
        demo.destroy();
      }
    });
    
    test('should handle tree/source mode switching', () => {
      const basicEditor = demo.getEditorInstance('basic');
      
      // Click tree mode button
      const treeModeBtn = container.querySelector('[data-action="tree-mode"][data-editor="basic"]');
      treeModeBtn.click();
      expect(basicEditor.setMode).toHaveBeenCalledWith('tree');
      
      // Click source mode button
      const sourceModeBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
      sourceModeBtn.click();
      expect(basicEditor.setMode).toHaveBeenCalledWith('source');
    });
    
    test('should handle expand/collapse all', () => {
      const basicEditor = demo.getEditorInstance('basic');
      
      // Click expand all button
      const expandBtn = container.querySelector('[data-action="expand-all"][data-editor="basic"]');
      expandBtn.click();
      expect(basicEditor.expandAll).toHaveBeenCalled();
      
      // Click collapse all button
      const collapseBtn = container.querySelector('[data-action="collapse-all"][data-editor="basic"]');
      collapseBtn.click();
      expect(basicEditor.collapseAll).toHaveBeenCalled();
    });
  });
  
  describe('Format Demo Interactions', () => {
    let demo;
    
    beforeEach(() => {
      demo = HierarchyEditorDemo.create({
        dom: container
      });
    });
    
    afterEach(() => {
      if (demo) {
        demo.destroy();
      }
    });
    
    test('should load sample data when format card clicked', () => {
      const formatEditor = demo.getEditorInstance('format');
      
      // Click JSON format card
      const jsonCard = container.querySelector('[data-format="json"]');
      jsonCard.click();
      
      expect(formatEditor.loadContent).toHaveBeenCalled();
      const [content, format] = formatEditor.loadContent.mock.calls[0];
      expect(format).toBe('json');
      expect(content).toContain('hierarchy-editor');
      
      // Check card highlighting
      expect(jsonCard.classList.contains('active')).toBe(true);
    });
    
    test('should switch between different formats', () => {
      const formatEditor = demo.getEditorInstance('format');
      
      // Test all formats
      const formats = ['json', 'xml', 'yaml', 'markdown'];
      formats.forEach(format => {
        const card = container.querySelector(`[data-format="${format}"]`);
        card.click();
        
        expect(formatEditor.loadContent).toHaveBeenCalled();
        const lastCall = formatEditor.loadContent.mock.calls[formatEditor.loadContent.mock.calls.length - 1];
        expect(lastCall[1]).toBe(format);
      });
    });
  });
  
  describe('Edit Demo Interactions', () => {
    let demo;
    
    beforeEach(() => {
      demo = HierarchyEditorDemo.create({
        dom: container
      });
    });
    
    afterEach(() => {
      if (demo) {
        demo.destroy();
      }
    });
    
    test('should add new node when button clicked', () => {
      const editEditor = demo.getEditorInstance('edit');
      
      const addBtn = container.querySelector('[data-action="add-node"]');
      addBtn.click();
      
      expect(editEditor.addNode).toHaveBeenCalled();
      const [path, value] = editEditor.addNode.mock.calls[0];
      expect(path).toBe('items');
      expect(value).toHaveProperty('id');
      expect(value).toHaveProperty('created');
    });
    
    test('should bulk add nodes', () => {
      const editEditor = demo.getEditorInstance('edit');
      
      const bulkBtn = container.querySelector('[data-action="bulk-add"]');
      bulkBtn.click();
      
      expect(editEditor.bulkOperation).toHaveBeenCalled();
      expect(editEditor.addNode).toHaveBeenCalledTimes(5);
    });
    
    test('should clear content', () => {
      const editEditor = demo.getEditorInstance('edit');
      
      const clearBtn = container.querySelector('[data-action="clear"]');
      clearBtn.click();
      
      expect(editEditor.setContent).toHaveBeenCalledWith('{"items": []}');
    });
    
    test('should update node count', () => {
      const nodeCountEl = container.querySelector('[data-node-count="edit"] .count');
      expect(nodeCountEl).toBeTruthy();
      expect(nodeCountEl.textContent).toBe('1'); // Mock returns single root node
    });
  });
  
  describe('Event Demo Interactions', () => {
    let demo;
    
    beforeEach(() => {
      demo = HierarchyEditorDemo.create({
        dom: container
      });
    });
    
    afterEach(() => {
      if (demo) {
        demo.destroy();
      }
    });
    
    test('should log events to event log', () => {
      const eventLog = container.querySelector('[data-event-log]');
      expect(eventLog).toBeTruthy();
      
      // Should have mount event logged
      const events = eventLog.querySelectorAll('.event');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].textContent).toContain('mount');
    });
    
    test('should clear event log', () => {
      const eventLog = container.querySelector('[data-event-log]');
      const clearBtn = container.querySelector('[data-action="clear-log"]');
      
      clearBtn.click();
      
      expect(eventLog.innerHTML).toBe('');
    });
    
    test('should handle programmatic edit', () => {
      const eventEditor = demo.getEditorInstance('event');
      
      const editBtn = container.querySelector('[data-action="programmatic-edit"][data-editor="event"]');
      editBtn.click();
      
      expect(eventEditor.editNode).toHaveBeenCalledWith('name', 'Jane Doe');
    });
    
    test('should handle programmatic add', () => {
      const eventEditor = demo.getEditorInstance('event');
      
      const addBtn = container.querySelector('[data-action="programmatic-add"][data-editor="event"]');
      addBtn.click();
      
      expect(eventEditor.addNode).toHaveBeenCalledWith('skills', 'TypeScript');
    });
  });
  
  describe('Advanced Demo Interactions', () => {
    let demo;
    
    beforeEach(() => {
      demo = HierarchyEditorDemo.create({
        dom: container
      });
    });
    
    afterEach(() => {
      if (demo) {
        demo.destroy();
      }
    });
    
    test('should toggle theme', () => {
      const themeBtn = container.querySelector('[data-action="toggle-theme"]');
      const demoEl = container.querySelector('.hierarchy-editor-demo');
      
      // Initially light theme
      expect(demoEl.classList.contains('theme-light')).toBe(true);
      
      // Toggle to dark
      themeBtn.click();
      expect(demoEl.classList.contains('theme-dark')).toBe(true);
      
      // All editors should update theme
      const allEditors = demo.getAllEditorInstances();
      allEditors.forEach(([name, editor]) => {
        expect(editor.setTheme).toHaveBeenCalledWith('dark');
      });
    });
    
    test('should toggle read-only mode', () => {
      const readOnlyBtn = container.querySelector('[data-action="toggle-readonly"]');
      const infoEl = container.querySelector('[data-info="advanced"]');
      
      // Initially editable
      expect(infoEl.textContent).toContain('Editable: true');
      
      // Toggle to read-only
      readOnlyBtn.click();
      expect(infoEl.textContent).toContain('Editable: false');
      
      // All editors should update editable state
      const allEditors = demo.getAllEditorInstances();
      allEditors.forEach(([name, editor]) => {
        expect(editor.setEditable).toHaveBeenCalledWith(false);
      });
    });
    
    test('should export data', () => {
      // Mock URL and blob APIs
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      global.Blob = jest.fn();
      
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn()
      };
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') return mockAnchor;
        return document.createElement(tag);
      });
      
      const exportBtn = container.querySelector('[data-action="export-data"][data-editor="advanced"]');
      exportBtn.click();
      
      expect(mockAnchor.download).toBe('hierarchy-data.json');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
    
    test('should validate content', () => {
      const advancedEditor = demo.getEditorInstance('advanced');
      const validateBtn = container.querySelector('[data-action="validate"][data-editor="advanced"]');
      const statusEl = container.querySelector('[data-status="advanced"]');
      
      validateBtn.click();
      
      expect(advancedEditor.validate).toHaveBeenCalled();
      expect(statusEl.textContent).toBe('Content is valid');
    });
    
    test('should load large dataset', () => {
      const advancedEditor = demo.getEditorInstance('advanced');
      const largeBtn = container.querySelector('[data-action="large-dataset"][data-editor="advanced"]');
      const statusEl = container.querySelector('[data-status="advanced"]');
      
      largeBtn.click();
      
      expect(advancedEditor.loadContent).toHaveBeenCalled();
      const [content] = advancedEditor.loadContent.mock.calls[advancedEditor.loadContent.mock.calls.length - 1];
      expect(content).toContain('items');
      expect(statusEl.textContent).toBe('Loaded 1000 items');
    });
  });
  
  describe('Public API Methods', () => {
    let demo;
    
    beforeEach(() => {
      demo = HierarchyEditorDemo.create({
        dom: container
      });
    });
    
    afterEach(() => {
      if (demo) {
        demo.destroy();
      }
    });
    
    test('should get specific editor instance', () => {
      const basicEditor = demo.getEditorInstance('basic');
      expect(basicEditor).toBeDefined();
      expect(basicEditor.render).toBeDefined();
    });
    
    test('should get all editor instances', () => {
      const allEditors = demo.getAllEditorInstances();
      expect(allEditors).toHaveLength(5);
      
      const editorNames = allEditors.map(([name]) => name);
      expect(editorNames).toEqual(['basic', 'format', 'edit', 'event', 'advanced']);
    });
    
    test('should get event log', () => {
      const eventLog = demo.getEventLog();
      expect(Array.isArray(eventLog)).toBe(true);
      expect(eventLog.length).toBeGreaterThan(0);
      expect(eventLog[0]).toHaveProperty('type');
      expect(eventLog[0]).toHaveProperty('data');
    });
    
    test('should load sample data programmatically', () => {
      demo.loadSampleData('format', 'yaml');
      
      const formatEditor = demo.getEditorInstance('format');
      expect(formatEditor.loadContent).toHaveBeenCalled();
      const [content, format] = formatEditor.loadContent.mock.calls[formatEditor.loadContent.mock.calls.length - 1];
      expect(format).toBe('yaml');
      expect(content).toContain('name: hierarchy-editor');
    });
    
    test('should clear event log programmatically', () => {
      const eventLogEl = container.querySelector('[data-event-log]');
      
      // Add some events first
      const eventBtn = container.querySelector('[data-action="programmatic-edit"][data-editor="event"]');
      eventBtn.click();
      
      expect(eventLogEl.children.length).toBeGreaterThan(0);
      
      // Clear log
      demo.clearEventLog();
      
      expect(eventLogEl.innerHTML).toBe('');
      expect(demo.getEventLog()).toHaveLength(0);
    });
    
    test('should set theme programmatically', () => {
      demo.setTheme('dark');
      
      const demoEl = container.querySelector('.hierarchy-editor-demo');
      expect(demoEl.classList.contains('theme-dark')).toBe(true);
    });
    
    test('should get demo state', () => {
      const state = demo.getState();
      
      expect(state).toHaveProperty('editorCount', 5);
      expect(state).toHaveProperty('eventLogCount');
      expect(state).toHaveProperty('theme', 'light');
      expect(state).toHaveProperty('readOnly', false);
      expect(state).toHaveProperty('nodeCounts');
    });
  });
  
  describe('Cleanup and Lifecycle', () => {
    test('should clean up all editors on destroy', () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      const allEditors = demo.getAllEditorInstances();
      const destroySpies = allEditors.map(([name, editor]) => editor.destroy);
      
      demo.destroy();
      
      // All editor destroy methods should be called
      destroySpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
      
      // DOM should be cleaned up
      expect(container.innerHTML).toBe('');
    });
    
    test('should call lifecycle callbacks', () => {
      const onEditorCreate = jest.fn();
      const onEditorDestroy = jest.fn();
      
      const demo = HierarchyEditorDemo.create({
        dom: container,
        onEditorCreate,
        onEditorDestroy
      });
      
      // Should have called onEditorCreate for each editor
      expect(onEditorCreate).toHaveBeenCalledTimes(5);
      
      demo.destroy();
      
      // Should have called onEditorDestroy for each editor
      expect(onEditorDestroy).toHaveBeenCalledTimes(5);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle missing editor gracefully', () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      // Try to get non-existent editor
      const editor = demo.getEditorInstance('nonexistent');
      expect(editor).toBeUndefined();
      
      // Try to load data to non-existent editor
      expect(() => {
        demo.loadSampleData('nonexistent', 'json');
      }).not.toThrow();
      
      demo.destroy();
    });
    
    test('should handle invalid theme gracefully', () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      // Try to set invalid theme
      demo.setTheme('invalid');
      
      // Theme should remain unchanged
      const state = demo.getState();
      expect(state.theme).toBe('light');
      
      demo.destroy();
    });
  });
});