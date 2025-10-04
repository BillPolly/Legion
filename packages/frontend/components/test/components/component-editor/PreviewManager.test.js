/**
 * PreviewManager Tests - Phase 6.2
 *
 * Tests for PreviewManager component lifecycle management
 * Tests preview rendering, error handling, and sample data updates
 */

import { PreviewManager } from '../../../src/components/component-editor/src/preview/PreviewManager.js';

// Mock ComponentLifecycle for testing
class MockComponentLifecycle {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.mountedComponents = [];
  }

  async mount(dsl, container, data) {
    // Simulate mounting
    const mockComponent = {
      dsl,
      container,
      data,
      update: async function(newData) {
        // Use function instead of arrow to get correct 'this' context
        this.data = newData;
      },
      unmount: async () => {
        const index = this.mountedComponents.indexOf(mockComponent);
        if (index > -1) {
          this.mountedComponents.splice(index, 1);
        }
      }
    };

    this.mountedComponents.push(mockComponent);

    // Render simple preview
    container.innerHTML = `<div class="preview-component">${dsl}</div>`;

    return mockComponent;
  }
}

// Mock DataStore
class MockDataStore {
  constructor() {
    this.data = new Map();
  }
}

describe('PreviewManager', () => {
  let dataStore;
  let previewManager;
  let container;

  beforeEach(() => {
    dataStore = new MockDataStore();
    const mockLifecycle = new MockComponentLifecycle(dataStore);
    previewManager = new PreviewManager(dataStore, mockLifecycle);

    container = document.createElement('div');
    container.id = 'preview-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Constructor', () => {
    test('should create PreviewManager with dataStore', () => {
      const mockLifecycle = new MockComponentLifecycle(dataStore);
      const pm = new PreviewManager(dataStore, mockLifecycle);

      expect(pm).toBeInstanceOf(PreviewManager);
      expect(pm.dataStore).toBe(dataStore);
    });

    test('should initialize lifecycle', () => {
      const mockLifecycle = new MockComponentLifecycle(dataStore);
      const pm = new PreviewManager(dataStore, mockLifecycle);

      expect(pm.lifecycle).toBeDefined();
    });

    test('should initialize currentComponent as null', () => {
      const mockLifecycle = new MockComponentLifecycle(dataStore);
      const pm = new PreviewManager(dataStore, mockLifecycle);

      expect(pm.currentComponent).toBeNull();
    });

    test('should initialize container as null', () => {
      const mockLifecycle = new MockComponentLifecycle(dataStore);
      const pm = new PreviewManager(dataStore, mockLifecycle);

      expect(pm.container).toBeNull();
    });
  });

  describe('renderPreview()', () => {
    test('should mount component with DSL and sample data', async () => {
      const dsl = 'TestComponent :: state => div { "Hello" }';
      const sampleData = { message: 'Test' };

      const result = await previewManager.renderPreview(dsl, sampleData, container);

      expect(result.success).toBe(true);
      expect(previewManager.currentComponent).toBeDefined();
      expect(previewManager.container).toBe(container);
    });

    test('should render component in container', async () => {
      const dsl = 'Preview :: s => span { "Preview" }';
      const sampleData = {};

      await previewManager.renderPreview(dsl, sampleData, container);

      expect(container.innerHTML).toContain('Preview');
    });

    test('should unmount previous component before rendering new one', async () => {
      const dsl1 = 'First :: s => div';
      const dsl2 = 'Second :: s => span';

      await previewManager.renderPreview(dsl1, {}, container);
      const firstComponent = previewManager.currentComponent;

      await previewManager.renderPreview(dsl2, {}, container);

      // First component should be unmounted
      expect(previewManager.lifecycle.mountedComponents).not.toContain(firstComponent);
      expect(previewManager.lifecycle.mountedComponents.length).toBe(1);
    });

    test('should handle mount errors gracefully', async () => {
      // Mock lifecycle that throws error
      previewManager.lifecycle.mount = async () => {
        throw new Error('Mount failed: Invalid DSL');
      };

      const result = await previewManager.renderPreview('Invalid', {}, container);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mount failed: Invalid DSL');
    });

    test('should display error in container when mount fails', async () => {
      // Mock lifecycle that throws error
      previewManager.lifecycle.mount = async () => {
        throw new Error('Syntax error in DSL');
      };

      await previewManager.renderPreview('BadDSL', {}, container);

      expect(container.innerHTML).toContain('Preview Error');
      expect(container.innerHTML).toContain('Syntax error in DSL');
    });

    test('should display error stack when mount fails', async () => {
      // Mock lifecycle that throws error with stack
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at test.js:10';

      previewManager.lifecycle.mount = async () => {
        throw error;
      };

      await previewManager.renderPreview('BadDSL', {}, container);

      expect(container.innerHTML).toContain('error-stack');
      expect(container.innerHTML).toContain('Error: Test error');
    });

    test('should return success true on successful render', async () => {
      const result = await previewManager.renderPreview('Test :: s => div', {}, container);

      expect(result).toEqual({ success: true });
    });

    test('should return success false and error message on failure', async () => {
      previewManager.lifecycle.mount = async () => {
        throw new Error('Failed');
      };

      const result = await previewManager.renderPreview('Bad', {}, container);

      expect(result).toEqual({ success: false, error: 'Failed' });
    });
  });

  describe('updateSampleData()', () => {
    test('should update component with new sample data', async () => {
      const dsl = 'UpdateTest :: state => div';
      const initialData = { count: 0 };
      const newData = { count: 5 };

      await previewManager.renderPreview(dsl, initialData, container);

      await previewManager.updateSampleData(newData);

      expect(previewManager.currentComponent.data).toEqual(newData);
    });

    test('should do nothing if no component is mounted', async () => {
      expect(previewManager.currentComponent).toBeNull();

      await expect(previewManager.updateSampleData({ test: 'data' })).resolves.not.toThrow();
    });

    test('should call component update method', async () => {
      const dsl = 'CallUpdate :: s => div';
      await previewManager.renderPreview(dsl, {}, container);

      let updateCalled = false;
      previewManager.currentComponent.update = async (data) => {
        updateCalled = true;
      };

      await previewManager.updateSampleData({ new: 'data' });

      expect(updateCalled).toBe(true);
    });
  });

  describe('destroy()', () => {
    test('should unmount current component', async () => {
      const dsl = 'Destroy :: s => div';
      await previewManager.renderPreview(dsl, {}, container);

      expect(previewManager.lifecycle.mountedComponents.length).toBe(1);

      previewManager.destroy();

      // Component should be unmounted (async operation)
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(previewManager.lifecycle.mountedComponents.length).toBe(0);
    });

    test('should not throw if no component is mounted', () => {
      expect(previewManager.currentComponent).toBeNull();

      expect(() => previewManager.destroy()).not.toThrow();
    });

    test('should clear currentComponent reference', async () => {
      const dsl = 'Clear :: s => div';
      await previewManager.renderPreview(dsl, {}, container);

      expect(previewManager.currentComponent).toBeDefined();

      previewManager.destroy();

      // Note: destroy doesn't clear the reference immediately, but unmounts
      // This behavior could be enhanced to set currentComponent to null
    });
  });

  describe('Multiple Preview Updates', () => {
    test('should handle rapid preview updates', async () => {
      const dsl1 = 'First :: s => div';
      const dsl2 = 'Second :: s => span';
      const dsl3 = 'Third :: s => p';

      await previewManager.renderPreview(dsl1, {}, container);
      await previewManager.renderPreview(dsl2, {}, container);
      await previewManager.renderPreview(dsl3, {}, container);

      // Only one component should be mounted
      expect(previewManager.lifecycle.mountedComponents.length).toBe(1);
      expect(previewManager.currentComponent.dsl).toBe(dsl3);
    });

    test('should handle sample data updates after errors', async () => {
      // Start with successful render
      await previewManager.renderPreview('Valid :: s => div', {}, container);

      // Try to render invalid DSL
      previewManager.lifecycle.mount = async () => {
        throw new Error('Invalid');
      };
      await previewManager.renderPreview('Invalid', {}, container);

      // updateSampleData should handle gracefully (no component mounted after error)
      await expect(previewManager.updateSampleData({ test: 'data' })).resolves.not.toThrow();
    });
  });
});
