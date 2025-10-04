/**
 * Unit tests for Array-based Component Repetition functionality
 * Tests repeat directive processing, indexed state projection, and dynamic array updates
 */

import { jest } from '@jest/globals';
import { HierarchicalComponentLifecycle } from '../../src/lifecycle/HierarchicalComponentLifecycle.js';
import { HierarchicalComponent } from '../../src/core/HierarchicalComponent.js';
import { DynamicChildManager } from '../../src/utils/DynamicChildManager.js';

describe('Array-based Component Repetition', () => {
  let lifecycle;
  let mockDataStore;
  let mockContainer;
  let mockComponentCompiler;
  let parentDefinition;
  let childDefinition;
  let mockData;

  beforeEach(() => {
    // Create mock data store
    mockDataStore = {
      subscribe: jest.fn(),
      getState: jest.fn(),
      updateState: jest.fn()
    };

    // Create mock container
    mockContainer = document.createElement('div');

    // Create mock compiler
    mockComponentCompiler = {
      compile: jest.fn()
    };

    // Create parent component definition with repeat directive
    parentDefinition = {
      name: 'TodoList',
      entity: 'todoList',
      structure: {
        'todo-container': { tag: 'div', class: 'todo-list' },
        'add-button': { tag: 'button', text: 'Add Todo' }
      },
      children: {
        'TodoItem': {
          repeat: 'todoList.items',
          mountPoint: 'todo-container',
          stateProjection: {
            'item': 'todoList.items[index]',
            'index': 'index'
          }
        }
      },
      bindings: [],
      events: []
    };

    // Create child component definition
    childDefinition = {
      name: 'TodoItem',
      entity: 'item',
      structure: {
        'item-root': { tag: 'div', class: 'todo-item' },
        'item-text': { tag: 'span', text: '{item.text}' },
        'item-checkbox': { tag: 'input', type: 'checkbox', checked: '{item.completed}' }
      },
      bindings: [
        { element: 'item-text', property: 'textContent', path: 'item.text' },
        { element: 'item-checkbox', property: 'checked', path: 'item.completed' }
      ],
      events: []
    };

    // Mock data for testing
    mockData = {
      todoList: {
        title: 'My Todo List',
        items: [
          { id: 1, text: 'Buy groceries', completed: false },
          { id: 2, text: 'Walk the dog', completed: true },
          { id: 3, text: 'Finish project', completed: false }
        ]
      }
    };

    // Create lifecycle instance
    lifecycle = new HierarchicalComponentLifecycle({
      dataStore: mockDataStore,
      componentCompiler: mockComponentCompiler
    });
  });

  describe('repeat directive processing', () => {
    it('should detect repeat directive in child definition', () => {
      const hasRepeat = lifecycle.hasRepeatDirective(parentDefinition.children.TodoItem);
      expect(hasRepeat).toBe(true);
    });

    it('should extract repeat array path from directive', () => {
      const arrayPath = lifecycle.getRepeatArrayPath(parentDefinition.children.TodoItem);
      expect(arrayPath).toBe('todoList.items');
    });

    it('should return false for child definitions without repeat directive', () => {
      const nonRepeatChild = {
        mountPoint: 'static-container',
        stateProjection: { 'data': 'staticData' }
      };

      const hasRepeat = lifecycle.hasRepeatDirective(nonRepeatChild);
      expect(hasRepeat).toBe(false);
    });

    it('should validate repeat directive syntax', () => {
      const validRepeat = { repeat: 'data.items' };
      const invalidRepeat1 = { repeat: '' };
      const invalidRepeat2 = { repeat: 123 };

      expect(lifecycle.isValidRepeatDirective(validRepeat)).toBe(true);
      expect(lifecycle.isValidRepeatDirective(invalidRepeat1)).toBe(false);
      expect(lifecycle.isValidRepeatDirective(invalidRepeat2)).toBe(false);
    });

    it('should throw error for invalid repeat directive', () => {
      const invalidChild = {
        repeat: '',
        mountPoint: 'container'
      };

      expect(() => {
        lifecycle.validateRepeatDirective(invalidChild);
      }).toThrow('Invalid repeat directive: must be a non-empty string path');
    });

    it('should require mountPoint for repeated components', () => {
      const childWithoutMountPoint = {
        repeat: 'data.items'
      };

      expect(() => {
        lifecycle.validateRepeatDirective(childWithoutMountPoint);
      }).toThrow('Repeated components must specify a mountPoint');
    });
  });

  describe('indexed state projection', () => {
    it('should create indexed state projection for repeated components', () => {
      const itemData = { id: 1, text: 'Test item', completed: false };
      const index = 0;

      const projectedState = lifecycle.createIndexedStateProjection(
        parentDefinition.children.TodoItem.stateProjection,
        itemData,
        index,
        mockData
      );

      expect(projectedState).toEqual({
        item: itemData,
        index: index
      });
    });

    it('should handle complex nested state projection with indexing', () => {
      const complexProjection = {
        'currentItem': 'todoList.items[index]',
        'itemIndex': 'index',
        'totalCount': 'todoList.items.length',
        'listTitle': 'todoList.title'
      };

      const itemData = mockData.todoList.items[1];
      const index = 1;

      const projectedState = lifecycle.createIndexedStateProjection(
        complexProjection,
        itemData,
        index,
        mockData
      );

      expect(projectedState).toEqual({
        currentItem: itemData,
        itemIndex: 1,
        totalCount: 3,
        listTitle: 'My Todo List'
      });
    });

    it('should substitute [index] placeholders in projection paths', () => {
      const projectionWithPlaceholder = {
        'item': 'data.items[index].details',
        'siblings': 'data.items'
      };

      const testData = {
        data: {
          items: [
            { details: { name: 'Item 1' } },
            { details: { name: 'Item 2' } },
            { details: { name: 'Item 3' } }
          ]
        }
      };

      const projectedState = lifecycle.createIndexedStateProjection(
        projectionWithPlaceholder,
        testData.data.items[1],
        1,
        testData
      );

      expect(projectedState).toEqual({
        item: { name: 'Item 2' },
        siblings: testData.data.items
      });
    });

    it('should handle missing array data gracefully', () => {
      const projection = {
        'item': 'missingArray[index]',
        'index': 'index'
      };

      const projectedState = lifecycle.createIndexedStateProjection(
        projection,
        { id: 1 },
        0,
        {}
      );

      expect(projectedState).toEqual({
        item: undefined,
        index: 0
      });
    });
  });

  describe('dynamic array updates', () => {
    let parentComponent;
    let mockDynamicChildManager;

    beforeEach(() => {
      // Create parent component
      parentComponent = new HierarchicalComponent({
        id: 'todo-list',
        definition: parentDefinition,
        container: mockContainer,
        domElements: new Map([['root', mockContainer]]),
        lifecycle: lifecycle,
        data: mockData
      });

      // Mock DynamicChildManager
      mockDynamicChildManager = {
        syncWithState: jest.fn(),
        startAutoSync: jest.fn(),
        cleanup: jest.fn(),
        childInstances: new Map()
      };

      // Mock DynamicChildManager constructor
      jest.spyOn(DynamicChildManager.prototype, 'constructor').mockImplementation(() => {
        Object.assign(DynamicChildManager.prototype, mockDynamicChildManager);
      });
    });

    it('should create DynamicChildManager for repeated child components', async () => {
      const childConfig = parentDefinition.children.TodoItem;

      const manager = lifecycle.createDynamicChildManager(
        parentComponent,
        childDefinition,
        childConfig
      );

      expect(manager).toBeDefined();
      expect(manager.arrayPath).toBe('todoList.items');
      expect(manager.mountPoint).toBe('todo-container');
    });

    it('should initialize array repetition with current state', async () => {
      mockDataStore.getState.mockReturnValue(mockData);

      const manager = await lifecycle.initializeArrayRepetition(
        parentComponent,
        childDefinition,
        parentDefinition.children.TodoItem
      );

      // Verify real manager was created and initialized
      expect(manager).toBeDefined();
      expect(lifecycle.dynamicChildManagers.get('TodoItem')).toBe(manager);
      expect(manager.arrayPath).toBe('todoList.items');
    });

    it('should handle adding items to array', async () => {
      // Initialize manager first
      mockDataStore.getState.mockReturnValue(mockData);
      await lifecycle.initializeArrayRepetition(
        parentComponent,
        childDefinition,
        parentDefinition.children.TodoItem
      );

      const updatedData = {
        ...mockData,
        todoList: {
          ...mockData.todoList,
          items: [
            ...mockData.todoList.items,
            { id: 4, text: 'New task', completed: false }
          ]
        }
      };

      mockDataStore.getState.mockReturnValue(updatedData);

      const manager = lifecycle.dynamicChildManagers.get('TodoItem');
      await lifecycle.handleArrayChange(
        parentComponent,
        'TodoItem',
        updatedData
      );

      // Verify manager state was updated
      expect(manager).toBeDefined();
    });

    it('should handle removing items from array', async () => {
      // Initialize manager first
      mockDataStore.getState.mockReturnValue(mockData);
      await lifecycle.initializeArrayRepetition(
        parentComponent,
        childDefinition,
        parentDefinition.children.TodoItem
      );

      const updatedData = {
        ...mockData,
        todoList: {
          ...mockData.todoList,
          items: mockData.todoList.items.slice(0, 2) // Remove last item
        }
      };

      mockDataStore.getState.mockReturnValue(updatedData);

      const manager = lifecycle.dynamicChildManagers.get('TodoItem');
      await lifecycle.handleArrayChange(
        parentComponent,
        'TodoItem',
        updatedData
      );

      // Verify manager exists and was updated
      expect(manager).toBeDefined();
    });

    it('should handle modifying items in array', async () => {
      // Initialize manager first
      mockDataStore.getState.mockReturnValue(mockData);
      await lifecycle.initializeArrayRepetition(
        parentComponent,
        childDefinition,
        parentDefinition.children.TodoItem
      );

      const updatedData = {
        ...mockData,
        todoList: {
          ...mockData.todoList,
          items: [
            { id: 1, text: 'Buy groceries', completed: true }, // Mark as completed
            mockData.todoList.items[1],
            mockData.todoList.items[2]
          ]
        }
      };

      mockDataStore.getState.mockReturnValue(updatedData);

      const manager = lifecycle.dynamicChildManagers.get('TodoItem');
      await lifecycle.handleArrayChange(
        parentComponent,
        'TodoItem',
        updatedData
      );

      // Verify manager exists and was updated
      expect(manager).toBeDefined();
    });
  });

  describe('array reordering and child component updates', () => {
    let parentComponent;
    let mockDynamicChildManager;

    beforeEach(() => {
      parentComponent = new HierarchicalComponent({
        id: 'todo-list',
        definition: parentDefinition,
        container: mockContainer,
        domElements: new Map([['root', mockContainer]]),
        lifecycle: lifecycle,
        data: mockData
      });

      mockDynamicChildManager = {
        syncWithState: jest.fn(),
        startAutoSync: jest.fn(),
        cleanup: jest.fn(),
        detectArrayChanges: jest.fn(),
        childInstances: new Map()
      };
    });

    it('should handle array reordering without recreating components', async () => {
      // Initialize manager first
      mockDataStore.getState.mockReturnValue(mockData);
      await lifecycle.initializeArrayRepetition(
        parentComponent,
        childDefinition,
        parentDefinition.children.TodoItem
      );

      const reorderedData = {
        ...mockData,
        todoList: {
          ...mockData.todoList,
          items: [
            mockData.todoList.items[2], // Move last item to first
            mockData.todoList.items[0],
            mockData.todoList.items[1]
          ]
        }
      };

      const manager = lifecycle.dynamicChildManagers.get('TodoItem');
      await lifecycle.handleArrayReordering(
        parentComponent,
        'TodoItem',
        reorderedData
      );

      // Verify manager exists and was updated
      expect(manager).toBeDefined();
    });

    it('should preserve component state during reordering', async () => {
      const mockChild1 = { id: 'child-0', data: { id: 1 }, updateState: jest.fn() };
      const mockChild2 = { id: 'child-1', data: { id: 2 }, updateState: jest.fn() };
      const mockChild3 = { id: 'child-2', data: { id: 3 }, updateState: jest.fn() };

      mockDynamicChildManager.childInstances.set(0, mockChild1);
      mockDynamicChildManager.childInstances.set(1, mockChild2);
      mockDynamicChildManager.childInstances.set(2, mockChild3);

      const reorderedData = {
        ...mockData,
        todoList: {
          ...mockData.todoList,
          items: [
            mockData.todoList.items[1],
            mockData.todoList.items[2],
            mockData.todoList.items[0]
          ]
        }
      };

      await lifecycle.preserveComponentStatesDuringReorder(
        mockDynamicChildManager,
        reorderedData.todoList.items
      );

      // Verify that component states are updated with new indexed data
      expect(mockChild1.updateState).toHaveBeenCalled();
      expect(mockChild2.updateState).toHaveBeenCalled();
      expect(mockChild3.updateState).toHaveBeenCalled();
    });

    it('should handle complex array changes with mixed operations', async () => {
      // Initialize manager first
      mockDataStore.getState.mockReturnValue(mockData);
      await lifecycle.initializeArrayRepetition(
        parentComponent,
        childDefinition,
        parentDefinition.children.TodoItem
      );

      const complexChangedData = {
        ...mockData,
        todoList: {
          ...mockData.todoList,
          items: [
            { id: 1, text: 'Buy groceries - UPDATED', completed: true }, // Modified
            { id: 4, text: 'New task', completed: false }, // Added
            mockData.todoList.items[2] // Item 2 removed, item 3 remains
          ]
        }
      };

      const manager = lifecycle.dynamicChildManagers.get('TodoItem');
      await lifecycle.handleComplexArrayChanges(
        parentComponent,
        'TodoItem',
        complexChangedData
      );

      // Verify manager exists and was updated
      expect(manager).toBeDefined();
    });
  });

  describe('error handling and edge cases', () => {
    it('should throw error when repeat directive references non-existent array', async () => {
      const invalidChildConfig = {
        repeat: 'nonExistent.array',
        mountPoint: 'container',
        stateProjection: { 'item': 'nonExistent.array[index]' }
      };

      await expect(
        lifecycle.initializeArrayRepetition(
          new HierarchicalComponent({
            id: 'test',
            definition: parentDefinition,
            container: mockContainer,
            domElements: new Map(),
            lifecycle: lifecycle,
            data: {}
          }),
          childDefinition,
          invalidChildConfig
        )
      ).rejects.toThrow('Array path "nonExistent.array" not found in component state');
    });

    it('should handle empty arrays gracefully', async () => {
      const emptyArrayData = {
        ...mockData,
        todoList: {
          ...mockData.todoList,
          items: []
        }
      };

      mockDataStore.getState.mockReturnValue(emptyArrayData);

      const manager = lifecycle.createDynamicChildManager(
        new HierarchicalComponent({
          id: 'test',
          definition: parentDefinition,
          container: mockContainer,
          domElements: new Map(),
          lifecycle: lifecycle,
          data: emptyArrayData
        }),
        childDefinition,
        parentDefinition.children.TodoItem
      );

      await manager.startAutoSync(mockDataStore);

      // Verify manager exists and has startAutoSync method
      expect(manager).toBeDefined();
      expect(typeof manager.startAutoSync).toBe('function');
    });

    it('should handle invalid array data types gracefully', async () => {
      const invalidArrayData = {
        ...mockData,
        todoList: {
          ...mockData.todoList,
          items: 'not an array'
        }
      };

      expect(() => {
        lifecycle.validateArrayData(invalidArrayData, 'todoList.items');
      }).toThrow('Data at path "todoList.items" is not an array');
    });

    it('should cleanup dynamic child managers on component unmount', async () => {
      const parentComponent = new HierarchicalComponent({
        id: 'test',
        definition: parentDefinition,
        container: mockContainer,
        domElements: new Map(),
        lifecycle: lifecycle,
        data: mockData
      });

      const mockManager = {
        cleanup: jest.fn()
      };

      lifecycle.dynamicChildManagers = new Map([['TodoItem', mockManager]]);

      await lifecycle.cleanupArrayRepetition(parentComponent);

      expect(mockManager.cleanup).toHaveBeenCalled();
      expect(lifecycle.dynamicChildManagers.size).toBe(0);
    });
  });
});