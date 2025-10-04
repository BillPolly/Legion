/**
 * ComponentEditorView Tests - Phase 4.2
 *
 * Tests for ComponentEditorView DOM rendering and user interface
 * Manages UI structure, element references, and visual updates
 */

import { ComponentEditorView } from '../../../src/components/component-editor/src/view/ComponentEditorView.js';

describe('ComponentEditorView', () => {
  let container;
  let view;

  beforeEach(() => {
    // Jest provides JSDOM environment via testEnvironment: 'jsdom'
    // Create a container element
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Cleanup
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Constructor', () => {
    test('should create view with DOM container', () => {
      view = new ComponentEditorView({ dom: container });

      expect(view).toBeInstanceOf(ComponentEditorView);
      expect(view.container).toBe(container);
    });

    test('should default to light theme', () => {
      view = new ComponentEditorView({ dom: container });

      expect(view.theme).toBe('light');
    });

    test('should support dark theme', () => {
      view = new ComponentEditorView({ dom: container, theme: 'dark' });

      expect(view.theme).toBe('dark');
    });

    test('should initialize elements cache', () => {
      view = new ComponentEditorView({ dom: container });

      expect(view.elements).toBeDefined();
      expect(typeof view.elements).toBe('object');
    });

    test('should automatically render on construction', () => {
      view = new ComponentEditorView({ dom: container });

      // Should have rendered content
      expect(container.querySelector('.component-editor')).toBeTruthy();
    });
  });

  describe('render()', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should render main editor structure', () => {
      const editorRoot = container.querySelector('.component-editor');
      expect(editorRoot).toBeTruthy();
    });

    test('should apply theme class', () => {
      const editorRoot = container.querySelector('.component-editor');
      expect(editorRoot.classList.contains('light')).toBe(true);
    });

    test('should render toolbar', () => {
      const toolbar = container.querySelector('.editor-toolbar');
      expect(toolbar).toBeTruthy();
    });

    test('should render toolbar buttons', () => {
      const saveBtn = container.querySelector('.btn-save');
      const testBtn = container.querySelector('.btn-test');
      const previewBtn = container.querySelector('.btn-preview');

      expect(saveBtn).toBeTruthy();
      expect(testBtn).toBeTruthy();
      expect(previewBtn).toBeTruthy();
    });

    test('should render format selector', () => {
      const formatSelector = container.querySelector('.format-selector');
      expect(formatSelector).toBeTruthy();

      const options = formatSelector.querySelectorAll('option');
      expect(options.length).toBe(4);
      expect(options[0].value).toBe('dsl');
      expect(options[1].value).toBe('cnl');
      expect(options[2].value).toBe('json');
      expect(options[3].value).toBe('dataModel');
    });

    test('should render 3-pane layout', () => {
      const layout = container.querySelector('.editor-layout');
      expect(layout).toBeTruthy();

      const browserPane = container.querySelector('.browser-pane');
      const editorPane = container.querySelector('.editor-pane');
      const previewPane = container.querySelector('.preview-pane');

      expect(browserPane).toBeTruthy();
      expect(editorPane).toBeTruthy();
      expect(previewPane).toBeTruthy();
    });

    test('should render browser pane components', () => {
      const browserHeader = container.querySelector('.browser-header');
      const browserFilter = container.querySelector('.browser-filter');
      const browserList = container.querySelector('.browser-list');

      expect(browserHeader).toBeTruthy();
      expect(browserFilter).toBeTruthy();
      expect(browserList).toBeTruthy();
    });

    test('should render browser filter controls', () => {
      const nameFilter = container.querySelector('.filter-input');
      const tagFilter = container.querySelector('.filter-tag');
      const authorFilter = container.querySelector('.filter-author');

      expect(nameFilter).toBeTruthy();
      expect(tagFilter).toBeTruthy();
      expect(authorFilter).toBeTruthy();
    });

    test('should render editor tabs', () => {
      const tabs = container.querySelectorAll('.editor-pane .tab');
      expect(tabs.length).toBe(4);

      expect(tabs[0].dataset.tab).toBe('dsl');
      expect(tabs[1].dataset.tab).toBe('cnl');
      expect(tabs[2].dataset.tab).toBe('json');
      expect(tabs[3].dataset.tab).toBe('dataModel');
    });

    test('should render editor content areas', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      const cnlEditor = container.querySelector('.editor-cnl');
      const jsonEditor = container.querySelector('.editor-json');
      const dataModelEditor = container.querySelector('.editor-datamodel');

      expect(dslEditor).toBeTruthy();
      expect(cnlEditor).toBeTruthy();
      expect(jsonEditor).toBeTruthy();
      expect(dataModelEditor).toBeTruthy();
    });

    test('should show DSL editor by default', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      const cnlEditor = container.querySelector('.editor-cnl');

      expect(dslEditor.style.display).not.toBe('none');
      expect(cnlEditor.style.display).toBe('none');
    });

    test('should render validation status area', () => {
      const validationStatus = container.querySelector('.validation-status');
      expect(validationStatus).toBeTruthy();
    });

    test('should render preview tabs', () => {
      const previewTabs = container.querySelectorAll('.preview-pane .tab');
      expect(previewTabs.length).toBe(2);

      expect(previewTabs[0].dataset.tab).toBe('preview');
      expect(previewTabs[1].dataset.tab).toBe('tests');
    });

    test('should render preview container', () => {
      const previewContainer = container.querySelector('.preview-container');
      const testResults = container.querySelector('.test-results');

      expect(previewContainer).toBeTruthy();
      expect(testResults).toBeTruthy();
    });

    test('should cache DOM element references', () => {
      expect(view.elements.toolbar).toBe(container.querySelector('.editor-toolbar'));
      expect(view.elements.editorPane).toBe(container.querySelector('.editor-pane'));
      expect(view.elements.previewPane).toBe(container.querySelector('.preview-pane'));
      expect(view.elements.browserPane).toBe(container.querySelector('.browser-pane'));
    });
  });

  describe('setEditorContent()', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should set DSL editor content', () => {
      view.setEditorContent('dsl', 'Test :: s => div');

      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe('Test :: s => div');
    });

    test('should set CNL editor content', () => {
      view.setEditorContent('cnl', 'Test with s shows div');

      const cnlEditor = container.querySelector('.editor-cnl');
      expect(cnlEditor.value).toBe('Test with s shows div');
    });

    test('should set JSON editor content', () => {
      view.setEditorContent('json', '{"type": "div"}');

      const jsonEditor = container.querySelector('.editor-json');
      expect(jsonEditor.value).toBe('{"type": "div"}');
    });

    test('should handle invalid format gracefully', () => {
      expect(() => {
        view.setEditorContent('invalid', 'content');
      }).not.toThrow();
    });
  });

  describe('getEditorContent()', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should get DSL editor content', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Test :: s => div';

      const content = view.getEditorContent('dsl');
      expect(content).toBe('Test :: s => div');
    });

    test('should get CNL editor content', () => {
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'Test with s shows div';

      const content = view.getEditorContent('cnl');
      expect(content).toBe('Test with s shows div');
    });

    test('should get JSON editor content', () => {
      const jsonEditor = container.querySelector('.editor-json');
      jsonEditor.value = '{"type": "div"}';

      const content = view.getEditorContent('json');
      expect(content).toBe('{"type": "div"}');
    });

    test('should return empty string for invalid format', () => {
      const content = view.getEditorContent('invalid');
      expect(content).toBe('');
    });
  });

  describe('renderComponentList()', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should render component list', () => {
      const components = [
        { id: 'comp_1', name: 'Component 1', tags: ['form', 'input'] },
        { id: 'comp_2', name: 'Component 2', tags: ['display'] }
      ];

      view.renderComponentList(components);

      const items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(2);
    });

    test('should render component names', () => {
      const components = [
        { id: 'comp_1', name: 'Test Component', tags: [] }
      ];

      view.renderComponentList(components);

      const name = container.querySelector('.component-name');
      expect(name.textContent).toBe('Test Component');
    });

    test('should render component tags', () => {
      const components = [
        { id: 'comp_1', name: 'Test', tags: ['tag1', 'tag2'] }
      ];

      view.renderComponentList(components);

      const tags = container.querySelector('.component-tags');
      expect(tags.textContent).toBe('tag1, tag2');
    });

    test('should set data-id attribute on items', () => {
      const components = [
        { id: 'comp_123', name: 'Test', tags: [] }
      ];

      view.renderComponentList(components);

      const item = container.querySelector('.component-item');
      expect(item.dataset.id).toBe('comp_123');
    });

    test('should handle empty component list', () => {
      view.renderComponentList([]);

      const items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(0);
    });
  });

  describe('showValidationErrors()', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should show valid status when no errors', () => {
      view.showValidationErrors([]);

      const status = container.querySelector('.validation-status');
      expect(status.textContent).toContain('Valid');
      expect(status.classList.contains('valid')).toBe(true);
    });

    test('should show error count when errors exist', () => {
      view.showValidationErrors(['Error 1', 'Error 2']);

      const status = container.querySelector('.validation-status');
      expect(status.textContent).toContain('2 error');
      expect(status.classList.contains('invalid')).toBe(true);
    });

    test('should show error details in title', () => {
      view.showValidationErrors(['Error 1', 'Error 2']);

      const status = container.querySelector('.validation-status');
      expect(status.title).toBe('Error 1\nError 2');
    });

    test('should clear previous validation state', () => {
      view.showValidationErrors(['Error 1']);
      view.showValidationErrors([]);

      const status = container.querySelector('.validation-status');
      expect(status.classList.contains('valid')).toBe(true);
      expect(status.classList.contains('invalid')).toBe(false);
    });
  });

  describe('Event Handler Setup', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('onSaveClick() should attach click handler', () => {
      let called = false;
      view.onSaveClick(() => { called = true; });

      const saveBtn = container.querySelector('.btn-save');
      saveBtn.click();

      expect(called).toBe(true);
    });

    test('onTestClick() should attach click handler', () => {
      let called = false;
      view.onTestClick(() => { called = true; });

      const testBtn = container.querySelector('.btn-test');
      testBtn.click();

      expect(called).toBe(true);
    });

    test('onFormatChange() should attach change handler', () => {
      let selectedFormat = null;
      view.onFormatChange((e) => { selectedFormat = e.target.value; });

      const formatSelector = container.querySelector('.format-selector');
      formatSelector.value = 'cnl';
      formatSelector.dispatchEvent(new Event('change'));

      expect(selectedFormat).toBe('cnl');
    });

    test('onEditorChange() should attach input handler for DSL', () => {
      let changed = false;
      view.onEditorChange('dsl', () => { changed = true; });

      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.dispatchEvent(new Event('input'));

      expect(changed).toBe(true);
    });

    test('onComponentSelect() should handle component item clicks', () => {
      const components = [
        { id: 'comp_123', name: 'Test', tags: [] }
      ];
      view.renderComponentList(components);

      let selectedId = null;
      view.onComponentSelect((id) => { selectedId = id; });

      const item = container.querySelector('.component-item');
      item.click();

      expect(selectedId).toBe('comp_123');
    });

    test('onComponentSelect() should ignore clicks outside items', () => {
      let clickCount = 0;
      view.onComponentSelect(() => { clickCount++; });

      const browserList = container.querySelector('.browser-list');
      browserList.click();

      expect(clickCount).toBe(0);
    });
  });

  describe('showTestResults()', () => {
    beforeEach(() => {
      view = new ComponentEditorView({ dom: container });
    });

    test('should render test results summary', () => {
      const results = {
        passed: 5,
        failed: 2,
        tests: []
      };

      view.showTestResults(results);

      const summary = container.querySelector('.test-summary');
      expect(summary.textContent).toContain('5 passed');
      expect(summary.textContent).toContain('2 failed');
    });

    test('should render individual test results', () => {
      const results = {
        passed: 1,
        failed: 1,
        tests: [
          { name: 'Test 1', passed: true, message: '' },
          { name: 'Test 2', passed: false, message: 'Error message' }
        ]
      };

      view.showTestResults(results);

      const testResults = container.querySelectorAll('.test-result');
      expect(testResults.length).toBe(2);

      expect(testResults[0].classList.contains('pass')).toBe(true);
      expect(testResults[1].classList.contains('fail')).toBe(true);
    });

    test('should render test names and messages', () => {
      const results = {
        passed: 0,
        failed: 1,
        tests: [
          { name: 'Failed Test', passed: false, message: 'Something went wrong' }
        ]
      };

      view.showTestResults(results);

      const testName = container.querySelector('.test-name');
      const testMessage = container.querySelector('.test-message');

      expect(testName.textContent).toBe('Failed Test');
      expect(testMessage.textContent).toBe('Something went wrong');
    });
  });

  describe('Theme Support', () => {
    test('should apply light theme by default', () => {
      view = new ComponentEditorView({ dom: container });

      const editorRoot = container.querySelector('.component-editor');
      expect(editorRoot.classList.contains('light')).toBe(true);
    });

    test('should apply dark theme when specified', () => {
      view = new ComponentEditorView({ dom: container, theme: 'dark' });

      const editorRoot = container.querySelector('.component-editor');
      expect(editorRoot.classList.contains('dark')).toBe(true);
    });
  });
});
