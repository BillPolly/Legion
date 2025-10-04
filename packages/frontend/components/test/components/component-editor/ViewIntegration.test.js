/**
 * View Integration Tests - Phase 4.7
 *
 * Integration tests for ComponentEditorView with realistic user interactions
 * Tests complete UI workflows using real DOM (NO MOCKS)
 */

import { ComponentEditorView } from '../../../src/components/component-editor/src/view/ComponentEditorView.js';

describe('View Integration Tests - Phase 4.7', () => {
  let container;
  let view;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Rendering Complete Editor UI', () => {
    test('should render all major UI sections', () => {
      view = new ComponentEditorView({ dom: container });

      // Verify all major sections exist
      const toolbar = container.querySelector('.editor-toolbar');
      const browserPane = container.querySelector('.browser-pane');
      const editorPane = container.querySelector('.editor-pane');
      const previewPane = container.querySelector('.preview-pane');

      expect(toolbar).toBeTruthy();
      expect(browserPane).toBeTruthy();
      expect(editorPane).toBeTruthy();
      expect(previewPane).toBeTruthy();
    });

    test('should render all toolbar controls', () => {
      view = new ComponentEditorView({ dom: container });

      const saveBtn = container.querySelector('.btn-save');
      const testBtn = container.querySelector('.btn-test');
      const previewBtn = container.querySelector('.btn-preview');
      const formatSelector = container.querySelector('.format-selector');

      expect(saveBtn).toBeTruthy();
      expect(testBtn).toBeTruthy();
      expect(previewBtn).toBeTruthy();
      expect(formatSelector).toBeTruthy();

      // Verify button text
      expect(saveBtn.textContent).toBe('Save');
      expect(testBtn.textContent).toBe('Test');
      expect(previewBtn.textContent).toBe('Preview');
    });

    test('should render all editor format tabs', () => {
      view = new ComponentEditorView({ dom: container });

      const tabs = container.querySelectorAll('.editor-pane .tab');

      expect(tabs.length).toBe(4);
      expect(tabs[0].textContent).toBe('DSL');
      expect(tabs[1].textContent).toBe('CNL');
      expect(tabs[2].textContent).toBe('JSON');
      expect(tabs[3].textContent).toBe('Data Model');
    });

    test('should render browser with filter controls', () => {
      view = new ComponentEditorView({ dom: container });

      const browserHeader = container.querySelector('.browser-header');
      const nameFilter = container.querySelector('.filter-input');
      const tagFilter = container.querySelector('.filter-tag');
      const authorFilter = container.querySelector('.filter-author');
      const browserList = container.querySelector('.browser-list');

      expect(browserHeader.textContent).toBe('Component Library');
      expect(nameFilter.placeholder).toBe('Filter by name...');
      expect(tagFilter).toBeTruthy();
      expect(authorFilter).toBeTruthy();
      expect(browserList).toBeTruthy();
    });

    test('should render preview section with tabs', () => {
      view = new ComponentEditorView({ dom: container });

      const previewTabs = container.querySelectorAll('.preview-pane .tab');
      const previewContainer = container.querySelector('.preview-container');
      const testResults = container.querySelector('.test-results');

      expect(previewTabs.length).toBe(2);
      expect(previewTabs[0].textContent).toBe('Preview');
      expect(previewTabs[1].textContent).toBe('Tests');
      expect(previewContainer).toBeTruthy();
      expect(testResults).toBeTruthy();
    });

    test('should apply theme consistently across UI', () => {
      view = new ComponentEditorView({ dom: container, theme: 'dark' });

      const editorRoot = container.querySelector('.component-editor');

      expect(editorRoot.classList.contains('dark')).toBe(true);
    });
  });

  describe('Switching Between Editor Formats', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should display DSL editor by default', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      const cnlEditor = container.querySelector('.editor-cnl');

      // DSL should be visible
      expect(dslEditor.style.display).not.toBe('none');
      // CNL should be hidden
      expect(cnlEditor.style.display).toBe('none');
    });

    test('should load content into different editor formats', () => {
      // Load DSL content
      view.setEditorContent('dsl', 'TestComponent :: state => div { "Hello" }');

      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe('TestComponent :: state => div { "Hello" }');

      // Load CNL content
      view.setEditorContent('cnl', 'TestComponent with state shows div with "Hello"');

      const cnlEditor = container.querySelector('.editor-cnl');
      expect(cnlEditor.value).toBe('TestComponent with state shows div with "Hello"');

      // Load JSON content
      view.setEditorContent('json', '{"type": "div", "children": ["Hello"]}');

      const jsonEditor = container.querySelector('.editor-json');
      expect(jsonEditor.value).toBe('{"type": "div", "children": ["Hello"]}');
    });

    test('should retrieve content from different editor formats', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      const cnlEditor = container.querySelector('.editor-cnl');

      dslEditor.value = 'DSL Content';
      cnlEditor.value = 'CNL Content';

      expect(view.getEditorContent('dsl')).toBe('DSL Content');
      expect(view.getEditorContent('cnl')).toBe('CNL Content');
    });

    test('should handle format switching via selector', () => {
      const formatSelector = container.querySelector('.format-selector');
      let selectedFormat = null;

      view.onFormatChange((e) => {
        selectedFormat = e.target.value;
      });

      // Simulate user selecting CNL
      formatSelector.value = 'cnl';
      formatSelector.dispatchEvent(new Event('change'));

      expect(selectedFormat).toBe('cnl');

      // Simulate user selecting JSON
      formatSelector.value = 'json';
      formatSelector.dispatchEvent(new Event('change'));

      expect(selectedFormat).toBe('json');
    });
  });

  describe('Rendering Component List', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should render multiple components in browser', () => {
      const components = [
        { id: 'comp_1', name: 'Button Component', tags: ['ui', 'input'] },
        { id: 'comp_2', name: 'Form Component', tags: ['form', 'ui'] },
        { id: 'comp_3', name: 'Display Component', tags: ['display'] }
      ];

      view.renderComponentList(components);

      const items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(3);
    });

    test('should display component names correctly', () => {
      const components = [
        { id: 'comp_1', name: 'My Test Component', tags: [] }
      ];

      view.renderComponentList(components);

      const name = container.querySelector('.component-name');
      expect(name.textContent).toBe('My Test Component');
    });

    test('should display component tags correctly', () => {
      const components = [
        { id: 'comp_1', name: 'Test', tags: ['form', 'input', 'validation'] }
      ];

      view.renderComponentList(components);

      const tags = container.querySelector('.component-tags');
      expect(tags.textContent).toBe('form, input, validation');
    });

    test('should handle empty component list', () => {
      view.renderComponentList([]);

      const items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(0);

      const browserList = container.querySelector('.browser-list');
      expect(browserList.innerHTML).toBe('');
    });

    test('should update component list when called multiple times', () => {
      // Render first list
      view.renderComponentList([
        { id: 'comp_1', name: 'Component 1', tags: [] }
      ]);

      let items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(1);

      // Render second list
      view.renderComponentList([
        { id: 'comp_2', name: 'Component 2', tags: [] },
        { id: 'comp_3', name: 'Component 3', tags: [] }
      ]);

      items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(2);
    });

    test('should escape HTML in component names for security', () => {
      const components = [
        { id: 'comp_1', name: '<script>alert("xss")</script>', tags: [] }
      ];

      view.renderComponentList(components);

      const name = container.querySelector('.component-name');
      // HTML should be escaped, not executed
      expect(name.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('User Interaction Events', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should handle Save button click', () => {
      let saveClicked = false;

      view.onSaveClick(() => {
        saveClicked = true;
      });

      const saveBtn = container.querySelector('.btn-save');
      saveBtn.click();

      expect(saveClicked).toBe(true);
    });

    test('should handle Test button click', () => {
      let testClicked = false;

      view.onTestClick(() => {
        testClicked = true;
      });

      const testBtn = container.querySelector('.btn-test');
      testBtn.click();

      expect(testClicked).toBe(true);
    });

    test('should handle editor content changes', () => {
      let contentChanged = false;
      let changedContent = '';

      view.onEditorChange('dsl', (e) => {
        contentChanged = true;
        changedContent = e.target.value;
      });

      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'NewComponent :: s => div';
      dslEditor.dispatchEvent(new Event('input'));

      expect(contentChanged).toBe(true);
      expect(changedContent).toBe('NewComponent :: s => div');
    });

    test('should handle component selection from list', () => {
      const components = [
        { id: 'comp_123', name: 'Test Component', tags: ['test'] }
      ];
      view.renderComponentList(components);

      let selectedId = null;

      view.onComponentSelect((id) => {
        selectedId = id;
      });

      const item = container.querySelector('.component-item');
      item.click();

      expect(selectedId).toBe('comp_123');
    });

    test('should handle multiple button clicks', () => {
      let saveCount = 0;
      let testCount = 0;

      view.onSaveClick(() => { saveCount++; });
      view.onTestClick(() => { testCount++; });

      const saveBtn = container.querySelector('.btn-save');
      const testBtn = container.querySelector('.btn-test');

      saveBtn.click();
      saveBtn.click();
      testBtn.click();

      expect(saveCount).toBe(2);
      expect(testCount).toBe(1);
    });

    test('should handle format selector changes', () => {
      const formatChanges = [];

      view.onFormatChange((e) => {
        formatChanges.push(e.target.value);
      });

      const formatSelector = container.querySelector('.format-selector');

      formatSelector.value = 'cnl';
      formatSelector.dispatchEvent(new Event('change'));

      formatSelector.value = 'json';
      formatSelector.dispatchEvent(new Event('change'));

      expect(formatChanges).toEqual(['cnl', 'json']);
    });

    test('should handle rapid editor changes', () => {
      let changeCount = 0;

      view.onEditorChange('dsl', () => {
        changeCount++;
      });

      const dslEditor = container.querySelector('.editor-dsl');

      // Simulate rapid typing
      dslEditor.value = 'T';
      dslEditor.dispatchEvent(new Event('input'));

      dslEditor.value = 'Te';
      dslEditor.dispatchEvent(new Event('input'));

      dslEditor.value = 'Tes';
      dslEditor.dispatchEvent(new Event('input'));

      expect(changeCount).toBe(3);
    });
  });

  describe('Validation Feedback Display', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should display valid status when no errors', () => {
      view.showValidationErrors([]);

      const status = container.querySelector('.validation-status');

      expect(status.textContent).toContain('Valid');
      expect(status.classList.contains('valid')).toBe(true);
      expect(status.classList.contains('invalid')).toBe(false);
    });

    test('should display error count when errors exist', () => {
      view.showValidationErrors([
        'DSL: Missing separator',
        'Data model: Entity name required'
      ]);

      const status = container.querySelector('.validation-status');

      expect(status.textContent).toContain('2 error');
      expect(status.classList.contains('invalid')).toBe(true);
      expect(status.classList.contains('valid')).toBe(false);
    });

    test('should show error details in tooltip', () => {
      view.showValidationErrors([
        'Error 1: Invalid DSL syntax',
        'Error 2: Missing data model'
      ]);

      const status = container.querySelector('.validation-status');

      expect(status.title).toBe('Error 1: Invalid DSL syntax\nError 2: Missing data model');
    });

    test('should update validation status dynamically', () => {
      // Start with errors
      view.showValidationErrors(['Error 1', 'Error 2']);

      let status = container.querySelector('.validation-status');
      expect(status.classList.contains('invalid')).toBe(true);

      // Fix errors
      view.showValidationErrors([]);

      status = container.querySelector('.validation-status');
      expect(status.classList.contains('valid')).toBe(true);

      // Add error again
      view.showValidationErrors(['New error']);

      status = container.querySelector('.validation-status');
      expect(status.classList.contains('invalid')).toBe(true);
      expect(status.textContent).toContain('1 error');
    });

    test('should display test results', () => {
      const results = {
        passed: 3,
        failed: 1,
        tests: [
          { name: 'Test 1', passed: true, message: '' },
          { name: 'Test 2', passed: true, message: '' },
          { name: 'Test 3', passed: true, message: '' },
          { name: 'Test 4', passed: false, message: 'Expected true but got false' }
        ]
      };

      view.showTestResults(results);

      const summary = container.querySelector('.test-summary');
      expect(summary.textContent).toContain('3 passed');
      expect(summary.textContent).toContain('1 failed');

      const testElements = container.querySelectorAll('.test-result');
      expect(testElements.length).toBe(4);

      const passedTests = container.querySelectorAll('.test-result.pass');
      const failedTests = container.querySelectorAll('.test-result.fail');

      expect(passedTests.length).toBe(3);
      expect(failedTests.length).toBe(1);
    });
  });

  describe('Complete UI Workflow', () => {
    test('should handle complete editing session', () => {
      view = new ComponentEditorView({ dom: container });

      // 1. Load component list
      view.renderComponentList([
        { id: 'comp_1', name: 'Component 1', tags: ['ui'] },
        { id: 'comp_2', name: 'Component 2', tags: ['form'] }
      ]);

      let items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(2);

      // 2. Select component
      let selectedId = null;
      view.onComponentSelect((id) => { selectedId = id; });

      items[0].click();
      expect(selectedId).toBe('comp_1');

      // 3. Load content into editor
      view.setEditorContent('dsl', 'Component1 :: state => div { "Test" }');

      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe('Component1 :: state => div { "Test" }');

      // 4. Edit content
      dslEditor.value = 'Component1 :: state => span { "Updated" }';

      // 5. Validate (show no errors)
      view.showValidationErrors([]);

      const status = container.querySelector('.validation-status');
      expect(status.classList.contains('valid')).toBe(true);

      // 6. Save
      let saved = false;
      view.onSaveClick(() => { saved = true; });

      const saveBtn = container.querySelector('.btn-save');
      saveBtn.click();

      expect(saved).toBe(true);
    });

    test('should handle workflow with validation errors', () => {
      view = new ComponentEditorView({ dom: container });

      // Load invalid content
      view.setEditorContent('dsl', 'Invalid syntax here');

      // Show validation errors
      view.showValidationErrors([
        'DSL: Missing :: separator',
        'DSL: Missing => arrow'
      ]);

      const status = container.querySelector('.validation-status');
      expect(status.classList.contains('invalid')).toBe(true);
      expect(status.textContent).toContain('2 error');

      // Try to save (in real app, ViewModel would prevent this)
      let saveAttempted = false;
      view.onSaveClick(() => { saveAttempted = true; });

      const saveBtn = container.querySelector('.btn-save');
      saveBtn.click();

      expect(saveAttempted).toBe(true);
    });

    test('should handle theme switching', () => {
      // Create with light theme
      view = new ComponentEditorView({ dom: container, theme: 'light' });

      let editorRoot = container.querySelector('.component-editor');
      expect(editorRoot.classList.contains('light')).toBe(true);

      // Cleanup
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }

      // Recreate with dark theme
      container = document.createElement('div');
      document.body.appendChild(container);

      view = new ComponentEditorView({ dom: container, theme: 'dark' });

      editorRoot = container.querySelector('.component-editor');
      expect(editorRoot.classList.contains('dark')).toBe(true);
    });
  });
});
