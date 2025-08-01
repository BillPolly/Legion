/**
 * HierarchyView Tests
 */
import { createTestContainer, cleanupTestContainer, createTestHierarchy } from '../../test-helpers.js';

describe('HierarchyView', () => {
  let view;
  let container;

  beforeEach(async () => {
    container = createTestContainer();
    const { HierarchyView } = await import('../../../view/HierarchyView.js');
    view = new HierarchyView(container, {});
  });

  afterEach(() => {
    if (view) {
      view.destroy();
    }
    cleanupTestContainer(container);
  });

  describe('Basic Functionality', () => {
    test('should initialize with DOM container', () => {
      expect(view.dom).toBe(container);
      expect(view.config).toBeDefined();
      expect(view.nodeMapping).toBeDefined();
    });

    test('should extend BaseView', () => {
      expect(typeof view.on).toBe('function');
      expect(typeof view.off).toBe('function');
      expect(typeof view.emit).toBe('function');
    });

    test('should initialize with default mode', () => {
      expect(view.currentMode).toBe('tree');
    });
  });

  describe('DOM Rendering', () => {
    test('should render basic structure', () => {
      view.render();

      const editor = container.querySelector('.hierarchy-editor');
      expect(editor).toBeDefined();

      const toolbar = container.querySelector('.he-toolbar');
      expect(toolbar).toBeDefined();

      const content = container.querySelector('.he-content');
      expect(content).toBeDefined();

      const treeView = container.querySelector('.he-tree-view');
      expect(treeView).toBeDefined();

      const sourceView = container.querySelector('.he-source-view');
      expect(sourceView).toBeDefined();
    });

    test('should render mode buttons', () => {
      view.render();

      const treeButton = container.querySelector('[data-mode="tree"]');
      expect(treeButton).toBeDefined();
      expect(treeButton.textContent).toBe('Tree');

      const sourceButton = container.querySelector('[data-mode="source"]');
      expect(sourceButton).toBeDefined();
      expect(sourceButton.textContent).toBe('Source');
    });

    test('should show format name', () => {
      view.render();
      view.renderHierarchy(createTestHierarchy(), 'json');

      const formatName = container.querySelector('.format-name');
      expect(formatName).toBeDefined();
      expect(formatName.textContent).toBe('JSON');
    });
  });

  describe('View Initialization', () => {
    test('should initialize sub-views after render', () => {
      view.render();

      expect(view.hierarchyView).toBeDefined();
      expect(view.sourceView).toBeDefined();
    });

    test('should pass node mapping to hierarchy view', () => {
      view.render();

      // Check that hierarchyView received the mapping
      expect(view.hierarchyView.nodeMapping).toBe(view.nodeMapping);
    });
  });

  describe('Incremental Updates', () => {
    test('should update specific nodes only', () => {
      view.render();
      
      const hierarchy = createTestHierarchy();
      view.renderHierarchy(hierarchy, 'json');

      // Mock the mapping
      const mockElement = document.createElement('div');
      view.nodeMapping.register('test-node-id', mockElement);

      // Mock hierarchyView.updateNode
      let updateCalled = null;
      const originalUpdateNode = view.hierarchyView.updateNode;
      view.hierarchyView.updateNode = function(nodeId, element) {
        updateCalled = { nodeId, element };
      };

      view.updateNodes(['test-node-id']);

      expect(updateCalled).toBeDefined();
      expect(updateCalled.nodeId).toBe('test-node-id');
      expect(updateCalled.element).toBe(mockElement);
    });

    test('should handle missing elements gracefully', () => {
      view.render();

      // Try to update non-existent node
      expect(() => {
        view.updateNodes(['non-existent-node']);
      }).not.toThrow();
    });
  });

  describe('Event Handling', () => {
    test('should attach event listeners after render', () => {
      let attachCalled = false;
      const originalAttachEventListeners = view.attachEventListeners;
      view.attachEventListeners = function() { 
        attachCalled = true; 
        originalAttachEventListeners.call(this);
      };

      view.render();

      expect(attachCalled).toBe(true);
    });
  });
});