/**
 * Unit tests for DynamicChildManager class
 * Tests dynamic child component management including array state change detection,
 * dynamic child creation/removal, and state synchronization
 */

import { jest } from '@jest/globals';
import { DynamicChildManager } from '../../src/utils/DynamicChildManager.js';
import { HierarchicalComponent } from '../../src/core/HierarchicalComponent.js';

describe('DynamicChildManager', () => {
  let dynamicChildManager;
  let mockParentComponent;
  let mockLifecycle;
  let mockDefinition;
  let mockContainer;
  let mockDomElements;
  let mockData;

  beforeEach(() => {
    // Create mock parent component
    mockParentComponent = {
      id: 'parent',
      children: new Map(),
      addChild: jest.fn(),
      removeChild: jest.fn(),
      getChild: jest.fn(),
      hasChild: jest.fn()
    };

    // Create mock dependencies
    mockDefinition = {
      name: 'DynamicChild',
      entity: 'child',
      structure: {},
      bindings: [],
      events: []
    };

    mockContainer = document.createElement('div');
    mockDomElements = new Map([['root', document.createElement('div')]]);
    mockLifecycle = {
      getComponent: jest.fn(),
      mountedComponents: new Map()
    };

    mockData = {
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ]
    };

    dynamicChildManager = new DynamicChildManager({
      parentComponent: mockParentComponent,
      childDefinition: mockDefinition,
      arrayPath: 'items',
      mountPoint: 'list-container',
      lifecycle: mockLifecycle
    });
  });

  afterEach(() => {
    if (dynamicChildManager) {
      dynamicChildManager.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create DynamicChildManager with required options', () => {
      expect(dynamicChildManager.parentComponent).toBe(mockParentComponent);
      expect(dynamicChildManager.childDefinition).toBe(mockDefinition);
      expect(dynamicChildManager.arrayPath).toBe('items');
      expect(dynamicChildManager.mountPoint).toBe('list-container');
      expect(dynamicChildManager.lifecycle).toBe(mockLifecycle);
    });

    it('should initialize with empty childInstances Map', () => {
      expect(dynamicChildManager.childInstances).toBeInstanceOf(Map);
      expect(dynamicChildManager.childInstances.size).toBe(0);
    });

    it('should initialize with empty arrayStateCache array', () => {
      expect(dynamicChildManager.arrayStateCache).toEqual([]);
    });

    it('should initialize with null stateSubscription', () => {
      expect(dynamicChildManager.stateSubscription).toBeNull();
    });

    it('should throw error if parentComponent is missing', () => {
      expect(() => {
        new DynamicChildManager({
          childDefinition: mockDefinition,
          arrayPath: 'items',
          mountPoint: 'list-container',
          lifecycle: mockLifecycle
        });
      }).toThrow('Parent component is required for dynamic child management');
    });

    it('should throw error if childDefinition is missing', () => {
      expect(() => {
        new DynamicChildManager({
          parentComponent: mockParentComponent,
          arrayPath: 'items',
          mountPoint: 'list-container',
          lifecycle: mockLifecycle
        });
      }).toThrow('Child definition is required for dynamic child management');
    });

    it('should throw error if arrayPath is missing', () => {
      expect(() => {
        new DynamicChildManager({
          parentComponent: mockParentComponent,
          childDefinition: mockDefinition,
          mountPoint: 'list-container',
          lifecycle: mockLifecycle
        });
      }).toThrow('Array path is required for dynamic child management');
    });

    it('should throw error if lifecycle is missing', () => {
      expect(() => {
        new DynamicChildManager({
          parentComponent: mockParentComponent,
          childDefinition: mockDefinition,
          arrayPath: 'items',
          mountPoint: 'list-container'
        });
      }).toThrow('Lifecycle is required for dynamic child management');
    });

    it('should use default mountPoint if not provided', () => {
      const manager = new DynamicChildManager({
        parentComponent: mockParentComponent,
        childDefinition: mockDefinition,
        arrayPath: 'items',
        lifecycle: mockLifecycle
      });

      expect(manager.mountPoint).toBe('dynamic-children');
    });
  });

  describe('array state change detection', () => {
    describe('detectArrayChanges', () => {
      it('should detect no changes when arrays are identical', () => {
        const previousArray = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];
        const currentArray = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];

        const changes = dynamicChildManager.detectArrayChanges(previousArray, currentArray);

        expect(changes).toEqual({
          added: [],
          removed: [],
          modified: [],
          reordered: false
        });
      });

      it('should detect added items', () => {
        const previousArray = [
          { id: 1, name: 'Item 1' }
        ];
        const currentArray = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];

        const changes = dynamicChildManager.detectArrayChanges(previousArray, currentArray);

        expect(changes.added).toEqual([{ index: 1, item: { id: 2, name: 'Item 2' } }]);
        expect(changes.removed).toEqual([]);
        expect(changes.modified).toEqual([]);
        expect(changes.reordered).toBe(false);
      });

      it('should detect removed items', () => {
        const previousArray = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];
        const currentArray = [
          { id: 1, name: 'Item 1' }
        ];

        const changes = dynamicChildManager.detectArrayChanges(previousArray, currentArray);

        expect(changes.added).toEqual([]);
        expect(changes.removed).toEqual([{ index: 1, item: { id: 2, name: 'Item 2' } }]);
        expect(changes.modified).toEqual([]);
        expect(changes.reordered).toBe(false);
      });

      it('should detect modified items', () => {
        const previousArray = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];
        const currentArray = [
          { id: 1, name: 'Item 1 Updated' },
          { id: 2, name: 'Item 2' }
        ];

        const changes = dynamicChildManager.detectArrayChanges(previousArray, currentArray);

        expect(changes.added).toEqual([]);
        expect(changes.removed).toEqual([]);
        expect(changes.modified).toEqual([{
          index: 0,
          previousItem: { id: 1, name: 'Item 1' },
          currentItem: { id: 1, name: 'Item 1 Updated' }
        }]);
        expect(changes.reordered).toBe(false);
      });

      it('should detect reordered items', () => {
        const previousArray = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];
        const currentArray = [
          { id: 2, name: 'Item 2' },
          { id: 1, name: 'Item 1' }
        ];

        const changes = dynamicChildManager.detectArrayChanges(previousArray, currentArray);

        expect(changes.added).toEqual([]);
        expect(changes.removed).toEqual([]);
        expect(changes.modified).toEqual([]);
        expect(changes.reordered).toBe(true);
      });

      it('should detect complex changes (add, remove, modify)', () => {
        const previousArray = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3' }
        ];
        const currentArray = [
          { id: 1, name: 'Item 1 Updated' },
          { id: 4, name: 'Item 4' }
        ];

        const changes = dynamicChildManager.detectArrayChanges(previousArray, currentArray);

        expect(changes.added).toEqual([{ index: 1, item: { id: 4, name: 'Item 4' } }]);
        expect(changes.removed).toEqual([
          { index: 1, item: { id: 2, name: 'Item 2' } },
          { index: 2, item: { id: 3, name: 'Item 3' } }
        ]);
        expect(changes.modified).toEqual([{
          index: 0,
          previousItem: { id: 1, name: 'Item 1' },
          currentItem: { id: 1, name: 'Item 1 Updated' }
        }]);
      });
    });

    describe('getArrayFromState', () => {
      it('should extract array from state using simple path', () => {
        const state = { items: [1, 2, 3] };
        const result = dynamicChildManager.getArrayFromState(state, 'items');

        expect(result).toEqual([1, 2, 3]);
      });

      it('should extract array from state using nested path', () => {
        const state = {
          data: {
            nested: {
              items: [1, 2, 3]
            }
          }
        };
        const result = dynamicChildManager.getArrayFromState(state, 'data.nested.items');

        expect(result).toEqual([1, 2, 3]);
      });

      it('should return empty array if path does not exist', () => {
        const state = { items: [1, 2, 3] };
        const result = dynamicChildManager.getArrayFromState(state, 'nonexistent');

        expect(result).toEqual([]);
      });

      it('should return empty array if path value is not an array', () => {
        const state = { items: 'not an array' };
        const result = dynamicChildManager.getArrayFromState(state, 'items');

        expect(result).toEqual([]);
      });

      it('should return empty array if state is null or undefined', () => {
        expect(dynamicChildManager.getArrayFromState(null, 'items')).toEqual([]);
        expect(dynamicChildManager.getArrayFromState(undefined, 'items')).toEqual([]);
      });
    });
  });

  describe('dynamic child creation', () => {
    describe('createChildComponent', () => {
      it('should create new child component with correct configuration', () => {
        const itemData = { id: 1, name: 'Item 1' };
        const index = 0;

        const mockChildComponent = {
          id: 'child-0',
          mount: jest.fn(),
          unmount: jest.fn(),
          updateState: jest.fn()
        };

        // Mock lifecycle.getComponent to return our mock component
        mockLifecycle.getComponent.mockReturnValue(mockChildComponent);

        const result = dynamicChildManager.createChildComponent(itemData, index);

        expect(mockLifecycle.getComponent).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'parent-child-0',
            definition: mockDefinition
          })
        );
        expect(result).toBe(mockChildComponent);
      });

      it('should generate unique child ID based on parent and index', () => {
        const itemData = { id: 1, name: 'Item 1' };
        const index = 0;

        const mockChildComponent = {
          id: 'child-0',
          mount: jest.fn(),
          unmount: jest.fn(),
          updateState: jest.fn()
        };

        mockLifecycle.getComponent.mockReturnValue(mockChildComponent);

        dynamicChildManager.createChildComponent(itemData, index);

        expect(mockLifecycle.getComponent).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'parent-child-0'
          })
        );
      });

      it('should throw error if child component creation fails', () => {
        const itemData = { id: 1, name: 'Item 1' };
        const index = 0;

        mockLifecycle.getComponent.mockImplementation(() => {
          throw new Error('Component creation failed');
        });

        expect(() => {
          dynamicChildManager.createChildComponent(itemData, index);
        }).toThrow('Failed to create child component at index 0: Component creation failed');
      });
    });

    describe('addChildAtIndex', () => {
      it('should add child component at specified index', async () => {
        const itemData = { id: 1, name: 'Item 1' };
        const index = 0;

        const mockChildComponent = {
          id: 'child-0',
          mount: jest.fn(),
          unmount: jest.fn(),
          updateState: jest.fn()
        };

        mockLifecycle.getComponent.mockReturnValue(mockChildComponent);

        await dynamicChildManager.addChildAtIndex(itemData, index);

        expect(dynamicChildManager.childInstances.get(index)).toBe(mockChildComponent);
        expect(mockParentComponent.addChild).toHaveBeenCalledWith('parent-child-0', mockChildComponent);
      });

      it('should mount child component after adding', async () => {
        const itemData = { id: 1, name: 'Item 1' };
        const index = 0;

        const mockChildComponent = {
          id: 'child-0',
          mount: jest.fn(),
          unmount: jest.fn(),
          updateState: jest.fn()
        };

        mockLifecycle.getComponent.mockReturnValue(mockChildComponent);

        await dynamicChildManager.addChildAtIndex(itemData, index);

        expect(mockChildComponent.mount).toHaveBeenCalled();
      });

      it('should throw error if index is invalid', async () => {
        const itemData = { id: 1, name: 'Item 1' };

        await expect(dynamicChildManager.addChildAtIndex(itemData, -1)).rejects.toThrow('Invalid index: -1');
        await expect(dynamicChildManager.addChildAtIndex(itemData, 'invalid')).rejects.toThrow('Invalid index: invalid');
      });
    });

    describe('createChildrenFromArray', () => {
      it('should create children for all items in array', async () => {
        const arrayData = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];

        const mockChild1 = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild1.mount = jest.fn();

        const mockChild2 = new HierarchicalComponent({
          id: 'child-1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild2.mount = jest.fn();

        mockLifecycle.getComponent
          .mockReturnValueOnce(mockChild1)
          .mockReturnValueOnce(mockChild2);

        await dynamicChildManager.createChildrenFromArray(arrayData);

        expect(dynamicChildManager.childInstances.size).toBe(2);
        expect(dynamicChildManager.childInstances.get(0)).toBe(mockChild1);
        expect(dynamicChildManager.childInstances.get(1)).toBe(mockChild2);
        expect(mockParentComponent.addChild).toHaveBeenCalledTimes(2);
      });

      it('should handle empty array gracefully', async () => {
        await dynamicChildManager.createChildrenFromArray([]);

        expect(dynamicChildManager.childInstances.size).toBe(0);
        expect(mockParentComponent.addChild).not.toHaveBeenCalled();
      });

      it('should handle errors in child creation gracefully', async () => {
        const arrayData = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];

        mockLifecycle.getComponent
          .mockImplementationOnce(() => {
            throw new Error('Creation failed');
          })
          .mockReturnValueOnce(new HierarchicalComponent({
            id: 'child-1',
            definition: mockDefinition,
            container: mockContainer,
            domElements: mockDomElements,
            lifecycle: mockLifecycle,
            data: mockData
          }));

        // Should continue with other children even if one fails
        await expect(dynamicChildManager.createChildrenFromArray(arrayData)).rejects.toThrow('Failed to create child component at index 0');
      });
    });
  });

  describe('dynamic child removal', () => {
    describe('removeChildAtIndex', () => {
      it('should remove child component at specified index', async () => {
        // First add a child
        const itemData = { id: 1, name: 'Item 1' };
        const index = 0;

        const mockChildComponent = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChildComponent.mount = jest.fn();
        mockChildComponent.unmount = jest.fn();

        mockLifecycle.getComponent.mockReturnValue(mockChildComponent);
        await dynamicChildManager.addChildAtIndex(itemData, index);

        // Now remove it
        mockParentComponent.removeChild.mockResolvedValue(true);

        const result = await dynamicChildManager.removeChildAtIndex(index);

        expect(result).toBe(true);
        expect(dynamicChildManager.childInstances.has(index)).toBe(false);
        expect(mockParentComponent.removeChild).toHaveBeenCalledWith('parent-child-0');
      });

      it('should return false if child does not exist at index', async () => {
        const result = await dynamicChildManager.removeChildAtIndex(5);
        expect(result).toBe(false);
      });

      it('should unmount child component before removal', async () => {
        // Add a child first
        const itemData = { id: 1, name: 'Item 1' };
        const index = 0;

        const mockChildComponent = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChildComponent.mount = jest.fn();
        mockChildComponent.unmount = jest.fn();

        mockLifecycle.getComponent.mockReturnValue(mockChildComponent);
        await dynamicChildManager.addChildAtIndex(itemData, index);

        // Remove it
        mockParentComponent.removeChild.mockResolvedValue(true);

        await dynamicChildManager.removeChildAtIndex(index);

        expect(mockChildComponent.unmount).toHaveBeenCalled();
      });
    });

    describe('removeAllChildren', () => {
      it('should remove all child components', async () => {
        // Add multiple children first
        const arrayData = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];

        const mockChild1 = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild1.mount = jest.fn();
        mockChild1.unmount = jest.fn();

        const mockChild2 = new HierarchicalComponent({
          id: 'child-1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild2.mount = jest.fn();
        mockChild2.unmount = jest.fn();

        mockLifecycle.getComponent
          .mockReturnValueOnce(mockChild1)
          .mockReturnValueOnce(mockChild2);

        await dynamicChildManager.createChildrenFromArray(arrayData);

        // Now remove all
        mockParentComponent.removeChild.mockResolvedValue(true);

        await dynamicChildManager.removeAllChildren();

        expect(dynamicChildManager.childInstances.size).toBe(0);
        expect(mockParentComponent.removeChild).toHaveBeenCalledTimes(2);
        expect(mockChild1.unmount).toHaveBeenCalled();
        expect(mockChild2.unmount).toHaveBeenCalled();
      });

      it('should handle empty children map gracefully', async () => {
        await dynamicChildManager.removeAllChildren();

        expect(dynamicChildManager.childInstances.size).toBe(0);
        expect(mockParentComponent.removeChild).not.toHaveBeenCalled();
      });
    });
  });

  describe('state synchronization', () => {
    describe('syncWithState', () => {
      it('should create children when state changes from empty to populated', async () => {
        const newState = {
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' }
          ]
        };

        const mockChild1 = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild1.mount = jest.fn();

        const mockChild2 = new HierarchicalComponent({
          id: 'child-1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild2.mount = jest.fn();

        mockLifecycle.getComponent
          .mockReturnValueOnce(mockChild1)
          .mockReturnValueOnce(mockChild2);

        await dynamicChildManager.syncWithState(newState);

        expect(dynamicChildManager.childInstances.size).toBe(2);
        expect(dynamicChildManager.arrayStateCache).toEqual(newState.items);
      });

      it('should add new children when items are added to array', async () => {
        // Initialize with some children
        const initialState = {
          items: [{ id: 1, name: 'Item 1' }]
        };

        const mockChild1 = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild1.mount = jest.fn();

        mockLifecycle.getComponent.mockReturnValue(mockChild1);
        await dynamicChildManager.syncWithState(initialState);

        // Add more items
        const updatedState = {
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' }
          ]
        };

        const mockChild2 = new HierarchicalComponent({
          id: 'child-1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild2.mount = jest.fn();

        mockLifecycle.getComponent.mockReturnValue(mockChild2);
        await dynamicChildManager.syncWithState(updatedState);

        expect(dynamicChildManager.childInstances.size).toBe(2);
        expect(dynamicChildManager.arrayStateCache).toEqual(updatedState.items);
      });

      it('should remove children when items are removed from array', async () => {
        // Initialize with children
        const initialState = {
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' }
          ]
        };

        const mockChild1 = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild1.mount = jest.fn();
        mockChild1.unmount = jest.fn();

        const mockChild2 = new HierarchicalComponent({
          id: 'child-1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild2.mount = jest.fn();
        mockChild2.unmount = jest.fn();

        mockLifecycle.getComponent
          .mockReturnValueOnce(mockChild1)
          .mockReturnValueOnce(mockChild2);

        await dynamicChildManager.syncWithState(initialState);

        // Remove one item
        const updatedState = {
          items: [{ id: 1, name: 'Item 1' }]
        };

        mockParentComponent.removeChild.mockResolvedValue(true);

        await dynamicChildManager.syncWithState(updatedState);

        expect(dynamicChildManager.childInstances.size).toBe(1);
        expect(mockChild2.unmount).toHaveBeenCalled();
        expect(mockParentComponent.removeChild).toHaveBeenCalledWith('parent-child-1');
      });
    });

    describe('updateChildState', () => {
      it('should update child component state with projected data', async () => {
        const itemData = { id: 1, name: 'Item 1', status: 'active' };
        const index = 0;

        const mockChildComponent = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChildComponent.mount = jest.fn();
        mockChildComponent.updateState = jest.fn();

        mockLifecycle.getComponent.mockReturnValue(mockChildComponent);
        await dynamicChildManager.addChildAtIndex(itemData, index);

        // Update the child state
        const updatedData = { id: 1, name: 'Item 1 Updated', status: 'inactive' };
        await dynamicChildManager.updateChildState(index, updatedData);

        expect(mockChildComponent.updateState).toHaveBeenCalledWith({
          [mockDefinition.entity]: updatedData,
          index: index
        });
      });

      it('should throw error if child does not exist at index', async () => {
        const itemData = { id: 1, name: 'Item 1' };

        await expect(dynamicChildManager.updateChildState(5, itemData))
          .rejects.toThrow('No child component found at index 5');
      });
    });
  });

  describe('cleanup and resource management', () => {
    describe('cleanup', () => {
      it('should remove all children and clear state', async () => {
        // Add some children first
        const arrayData = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];

        const mockChild1 = new HierarchicalComponent({
          id: 'child-0',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild1.mount = jest.fn();
        mockChild1.unmount = jest.fn();

        const mockChild2 = new HierarchicalComponent({
          id: 'child-1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        mockChild2.mount = jest.fn();
        mockChild2.unmount = jest.fn();

        mockLifecycle.getComponent
          .mockReturnValueOnce(mockChild1)
          .mockReturnValueOnce(mockChild2);

        await dynamicChildManager.createChildrenFromArray(arrayData);

        // Add state subscription
        dynamicChildManager.stateSubscription = { unsubscribe: jest.fn() };

        // Now cleanup
        mockParentComponent.removeChild.mockResolvedValue(true);

        await dynamicChildManager.cleanup();

        expect(dynamicChildManager.childInstances.size).toBe(0);
        expect(dynamicChildManager.arrayStateCache).toEqual([]);
        expect(dynamicChildManager.stateSubscription).toBeNull();
        expect(mockChild1.unmount).toHaveBeenCalled();
        expect(mockChild2.unmount).toHaveBeenCalled();
      });

      it('should handle cleanup when already clean', async () => {
        await expect(dynamicChildManager.cleanup()).resolves.not.toThrow();
      });

      it('should unsubscribe from state changes', async () => {
        const mockSubscription = { unsubscribe: jest.fn() };
        dynamicChildManager.stateSubscription = mockSubscription;

        await dynamicChildManager.cleanup();

        expect(mockSubscription.unsubscribe).toHaveBeenCalled();
        expect(dynamicChildManager.stateSubscription).toBeNull();
      });
    });
  });

  describe('error handling', () => {
    it('should handle lifecycle getComponent failures gracefully', () => {
      const itemData = { id: 1, name: 'Item 1' };
      const index = 0;

      mockLifecycle.getComponent.mockImplementation(() => {
        throw new Error('Component creation failed');
      });

      expect(() => {
        dynamicChildManager.createChildComponent(itemData, index);
      }).toThrow('Failed to create child component at index 0: Component creation failed');
    });

    it('should handle mounting failures gracefully', async () => {
      const itemData = { id: 1, name: 'Item 1' };
      const index = 0;

      const mockChildComponent = {
        id: 'child-0',
        mount: jest.fn().mockRejectedValue(new Error('Mount failed')),
        unmount: jest.fn(),
        updateState: jest.fn()
      };

      mockLifecycle.getComponent.mockReturnValue(mockChildComponent);

      await expect(dynamicChildManager.addChildAtIndex(itemData, index))
        .rejects.toThrow('Mount failed');
    });

    it('should handle removal failures gracefully', async () => {
      const itemData = { id: 1, name: 'Item 1' };
      const index = 0;

      // Create a simple mock object instead of real HierarchicalComponent
      const mockChildComponent = {
        id: 'child-0',
        mount: jest.fn(),
        unmount: jest.fn(),
        updateState: jest.fn()
      };

      mockLifecycle.getComponent.mockReturnValue(mockChildComponent);
      
      // First add the child successfully
      await dynamicChildManager.addChildAtIndex(itemData, index);

      // Then set up the removal to fail
      mockParentComponent.removeChild.mockReset();
      mockParentComponent.removeChild.mockImplementation(() => {
        return Promise.reject(new Error('Removal failed'));
      });

      await expect(dynamicChildManager.removeChildAtIndex(index))
        .rejects.toThrow('Removal failed');

      // Reset the mock to prevent issues during cleanup
      mockParentComponent.removeChild.mockReset();
      mockParentComponent.removeChild.mockResolvedValue(true);
    });
  });
});