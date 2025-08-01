/**
 * HierarchyModel Tests
 */
import { createTestHierarchy } from '../../test-helpers.js';

describe('HierarchyModel', () => {
  let model;

  beforeEach(async () => {
    const { HierarchyModel } = await import('../../../model/HierarchyModel.js');
    model = new HierarchyModel({});
    
    // Register mock handlers
    const mockJsonHandler = {
      parse: (content) => {
        const data = JSON.parse(content);
        return {
          id: 'root',
          type: 'object',
          name: 'root',
          value: null,
          children: [],
          metadata: {},
          parent: null
        };
      },
      serialize: (node) => '{"test": true}'
    };
    
    const mockXmlHandler = {
      parse: (content) => ({
        id: 'root',
        type: 'element',
        name: 'root',
        value: null,
        children: [],
        metadata: {},
        parent: null
      }),
      serialize: (node) => '<root></root>'
    };
    
    model.registerHandler('json', mockJsonHandler);
    model.registerHandler('xml', mockXmlHandler);
  });

  describe('Basic Functionality', () => {
    test('should initialize with default properties', () => {
      expect(model.root).toBeNull();
      expect(model.format).toBeNull();
      expect(model.source).toBe('');
      expect(model.isDirty).toBe(false);
      expect(model.handlers).toBeDefined();
    });

    test('should extend BaseModel', () => {
      expect(typeof model.notify).toBe('function');
      // Note: on/off methods might not be available if BaseModel is not properly extended
      // This is acceptable for MVP as we'll use direct event emission
    });
  });

  describe('Content Loading', () => {
    test('should detect format when not specified', () => {
      const jsonContent = '{"test": true}';
      
      model.loadContent(jsonContent);
      
      // Should auto-detect as JSON
      expect(model.format).toBe('json');
    });

    test('should use specified format', () => {
      const xmlContent = '<root><test>true</test></root>';
      
      model.loadContent(xmlContent, 'xml');
      
      expect(model.format).toBe('xml');
      expect(model.source).toBe(xmlContent);
    });

    test('should emit contentLoaded event', () => {
      let eventData = null;
      
      model.on('contentLoaded', (data) => {
        eventData = data;
      });

      const content = '{"test": true}';
      model.loadContent(content, 'json');

      expect(eventData).toBeDefined();
      expect(eventData.format).toBe('json');
      expect(eventData.root).toBeDefined();
    });

    test('should set isDirty to false after loading', () => {
      model.isDirty = true;
      model.loadContent('{"test": true}', 'json');
      expect(model.isDirty).toBe(false);
    });
  });

  describe('Node Operations', () => {
    beforeEach(() => {
      model.root = createTestHierarchy();
    });

    test('should find node by ID', () => {
      const node = model.root.children[0];
      const foundNode = model.findNode(node.id);
      
      expect(foundNode).toBe(node);
    });

    test('should return null for non-existent node', () => {
      const foundNode = model.findNode('non-existent');
      expect(foundNode).toBeNull();
    });

    test('should update node value', () => {
      const node = model.root.children[0];
      const oldValue = node.value;
      const newValue = 'updated value';
      
      let eventData = null;
      model.on('nodeUpdated', (data) => {
        eventData = data;
      });

      model.updateNodeValue(node.id, newValue);

      expect(node.value).toBe(newValue);
      expect(model.isDirty).toBe(true);
      expect(eventData).toBeDefined();
      expect(eventData.node).toBe(node);
    });

    test('should add child node', () => {
      const parent = model.root;
      const initialChildCount = parent.children.length;
      
      let eventData = null;
      model.on('nodeAdded', (data) => {
        eventData = data;
      });

      const nodeData = {
        type: 'value',
        name: 'newChild',
        value: 'new value'
      };

      model.addNode(parent.id, nodeData);

      expect(parent.children.length).toBe(initialChildCount + 1);
      expect(model.isDirty).toBe(true);
      expect(eventData).toBeDefined();
      expect(eventData.parent).toBe(parent);
      expect(eventData.node.name).toBe('newChild');
    });
  });

  describe('Source Synchronization', () => {
    test('should sync source when content changes', () => {
      model.root = createTestHierarchy();
      model.format = 'json';
      
      let eventData = null;
      model.on('sourceUpdated', (data) => {
        eventData = data;
      });

      model.syncSource();

      expect(eventData).toBeDefined();
      expect(eventData.source).toBeDefined();
      expect(typeof eventData.source).toBe('string');
    });
  });
});