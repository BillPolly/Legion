/**
 * HierarchyEditor Umbilical Protocol Tests
 */
import { createTestContainer, cleanupTestContainer, createMockUmbilical } from '../test-helpers.js';

describe('HierarchyEditor Umbilical Protocol', () => {
  let container;

  beforeEach(() => {
    container = createTestContainer();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Introspection Mode', () => {
    test('should describe component requirements', async () => {
      // Dynamic import to test the component
      const { HierarchyEditor } = await import('../../index.js');
      
      let requirements = null;
      HierarchyEditor.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });

      expect(requirements).toBeDefined();
      expect(requirements.dom).toBeDefined();
      expect(requirements.dom.type).toBe('HTMLElement');
      expect(requirements.dom.description).toContain('Container element');
      
      expect(requirements.content).toBeDefined();
      expect(requirements.format).toBeDefined();
      expect(requirements.editable).toBeDefined();
    });
  });

  describe('Validation Mode', () => {
    test('should validate umbilical capabilities', async () => {
      const { HierarchyEditor } = await import('../../index.js');
      
      const validation = HierarchyEditor.create({
        validate: (checks) => checks
      });

      expect(validation).toBeDefined();
      expect(validation.hasDomElement).toBeDefined();
      expect(validation.hasValidContent).toBeDefined();
      expect(validation.hasValidFormat).toBeDefined();
    });

    test('should validate DOM element correctly', async () => {
      const { HierarchyEditor } = await import('../../index.js');
      
      const validationWithValidDOM = HierarchyEditor.create({
        dom: container,
        validate: (checks) => checks
      });
      expect(validationWithValidDOM.hasDomElement).toBe(true);

      const validationWithInvalidDOM = HierarchyEditor.create({
        dom: 'not-an-element',
        validate: (checks) => checks
      });
      expect(validationWithInvalidDOM.hasDomElement).toBe(false);
    });
  });

  describe('Instance Creation Mode', () => {
    test('should create component instance with valid umbilical', async () => {
      const { HierarchyEditor } = await import('../../index.js');
      
      const umbilical = createMockUmbilical({ dom: container });
      const instance = HierarchyEditor.create(umbilical);

      expect(instance).toBeDefined();
      expect(typeof instance.destroy).toBe('function');
      expect(typeof instance.loadContent).toBe('function');
      expect(typeof instance.getContent).toBe('function');
      expect(typeof instance.setMode).toBe('function');
    });

    test('should throw error when DOM is missing', async () => {
      const { HierarchyEditor } = await import('../../index.js');
      
      expect(() => {
        HierarchyEditor.create({ content: '{}' });
      }).toThrow('DOM container element is required');
    });

    test('should call onMount callback', async () => {
      const { HierarchyEditor } = await import('../../index.js');
      
      const onMount = createMockUmbilical().onMount;
      const umbilical = createMockUmbilical({ 
        dom: container,
        onMount 
      });
      
      const instance = HierarchyEditor.create(umbilical);
      
      if (typeof jest !== 'undefined' && jest.fn) {
        expect(onMount).toHaveBeenCalledWith(instance);
      } else {
        expect(onMount.calls.length).toBe(1);
        expect(onMount.calls[0][0]).toBe(instance);
      }
    });
  });
});