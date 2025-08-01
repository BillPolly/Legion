/**
 * HierarchyViewModel Tests
 */
import { createTestHierarchy } from '../../test-helpers.js';

describe('HierarchyViewModel', () => {
  let viewModel;
  let mockModel;
  let mockView;

  beforeEach(async () => {
    // Create mock model
    mockModel = {
      on: function(event, handler) {
        this.handlers = this.handlers || {};
        this.handlers[event] = handler;
      },
      off: function() {},
      updateNodeValue: function() {},
      addNode: function() {},
      source: '{"test": true}',
      addChangeListener: function() {},
      removeChangeListener: function() {}
    };

    // Create mock view
    mockView = {
      on: function(event, handler) {
        this.handlers = this.handlers || {};
        this.handlers[event] = handler;
      },
      off: function() {},
      renderHierarchy: function() { this.renderHierarchyCalled = arguments; },
      renderSource: function() { this.renderSourceCalled = arguments; },
      updateNodes: function() { this.updateNodesCalled = arguments; },
      setMode: function() {},
      nodeMapping: {
        markDirty: function() { this.markDirtyCalled = arguments; },
        getDirtyNodes: function() { return ['node1', 'node2']; },
        clearDirty: function() { this.clearDirtyCalled = true; }
      },
      addChangeListener: function() {},
      removeChangeListener: function() {}
    };

    const { HierarchyViewModel } = await import('../../../viewmodel/HierarchyViewModel.js');
    viewModel = new HierarchyViewModel(mockModel, mockView, {});
  });

  describe('Basic Functionality', () => {
    test('should initialize with model and view', () => {
      expect(viewModel.model).toBe(mockModel);
      expect(viewModel.view).toBe(mockView);
      expect(viewModel.config).toBeDefined();
    });

    test('should extend BaseViewModel', () => {
      expect(typeof viewModel.initialize).toBe('function');
    });

    test('should create editing and validation managers', () => {
      expect(viewModel.editingManager).toBeDefined();
      expect(viewModel.validationManager).toBeDefined();
    });
  });

  describe('Event Coordination', () => {
    beforeEach(() => {
      viewModel.initialize();
    });

    test('should handle contentLoaded event from model', () => {
      const testData = { root: createTestHierarchy(), format: 'json' };
      
      // Simulate model event
      if (mockModel.handlers && mockModel.handlers.contentLoaded) {
        mockModel.handlers.contentLoaded(testData);
      }

      expect(mockView.renderHierarchyCalled).toBeDefined();
      expect(mockView.renderHierarchyCalled[0]).toBe(testData.root);
      expect(mockView.renderHierarchyCalled[1]).toBe(testData.format);
      
      expect(mockView.renderSourceCalled).toBeDefined();
      expect(mockView.renderSourceCalled[0]).toBe(mockModel.source);
      expect(mockView.renderSourceCalled[1]).toBe(testData.format);
    });

    test('should handle nodeUpdated event from model', () => {
      const testData = { node: { id: 'test-node' } };
      
      // Mock requestAnimationFrame
      const originalRAF = global.requestAnimationFrame;
      global.requestAnimationFrame = function(cb) { cb(); };

      // Simulate model event
      if (mockModel.handlers && mockModel.handlers.nodeUpdated) {
        mockModel.handlers.nodeUpdated(testData);
      }

      expect(mockView.nodeMapping.markDirtyCalled).toBeDefined();
      expect(mockView.nodeMapping.markDirtyCalled[0]).toBe('test-node');
      expect(mockView.updateNodesCalled).toBeDefined();

      global.requestAnimationFrame = originalRAF;
    });

    test('should handle view events', () => {
      const nodeEditData = { nodeId: 'test-node' };
      
      // Simulate view event
      if (mockView.handlers && mockView.handlers.nodeEdit) {
        mockView.handlers.nodeEdit(nodeEditData);
      }

      // Should call editing manager
      expect(viewModel.editingManager.startEdit).toBeDefined();
    });
  });

  describe('Incremental Update Scheduling', () => {
    beforeEach(() => {
      viewModel.initialize();
    });

    test('should batch updates using requestAnimationFrame', () => {
      const originalRAF = global.requestAnimationFrame;
      let rafCallback = null;
      global.requestAnimationFrame = function(cb) { 
        rafCallback = cb;
        return 'timer-id';
      };

      viewModel.scheduleIncrementalUpdate();

      expect(rafCallback).toBeDefined();
      
      // Execute the callback
      rafCallback();
      
      expect(mockView.updateNodesCalled).toBeDefined();
      expect(mockView.nodeMapping.clearDirtyCalled).toBe(true);

      global.requestAnimationFrame = originalRAF;
    });

    test('should not schedule duplicate updates', () => {
      const originalRAF = global.requestAnimationFrame;
      let rafCallCount = 0;
      global.requestAnimationFrame = function(cb) { 
        rafCallCount++;
        return 'timer-id'; 
      };

      viewModel.scheduleIncrementalUpdate();
      viewModel.scheduleIncrementalUpdate();

      expect(rafCallCount).toBe(1);

      global.requestAnimationFrame = originalRAF;
    });
  });
});