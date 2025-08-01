/**
 * Comprehensive tests for pluggable hierarchy editor architecture
 */

import { jest } from '@jest/globals';
import { BaseFormatHandler } from '../src/components/hierarchy-editor/handlers/BaseFormatHandler.js';
import { JsonHandler } from '../src/components/hierarchy-editor/handlers/JsonHandler.js';
import { XmlHandler } from '../src/components/hierarchy-editor/handlers/XmlHandler.js';
import { YamlHandler } from '../src/components/hierarchy-editor/handlers/YamlHandler.js';
import { MarkdownHandler } from '../src/components/hierarchy-editor/handlers/MarkdownHandler.js';
import { HierarchyRenderer } from '../src/components/hierarchy-editor/renderer/HierarchyRenderer.js';
import { ExpansionStateManager } from '../src/components/hierarchy-editor/state/ExpansionStateManager.js';
import { HierarchyNode } from '../src/components/hierarchy-editor/model/HierarchyNode.js';

describe('Pluggable Hierarchy Editor Architecture', () => {
  beforeEach(() => {
    // Clear registry before each test
    BaseFormatHandler.registry.clear();
    
    // Re-register handlers
    BaseFormatHandler.register('json', JsonHandler);
    BaseFormatHandler.register('xml', XmlHandler);
    BaseFormatHandler.register('yaml', YamlHandler);
    BaseFormatHandler.register('markdown', MarkdownHandler);
  });

  describe('BaseFormatHandler', () => {
    test('should register and retrieve format handlers', () => {
      const formats = BaseFormatHandler.getFormats();
      expect(formats).toContain('json');
      expect(formats).toContain('xml');
      expect(formats).toContain('yaml');
      expect(formats).toContain('markdown');
    });

    test('should create handler instances', () => {
      const jsonHandler = BaseFormatHandler.getHandler('json');
      expect(jsonHandler).toBeInstanceOf(JsonHandler);
      
      const xmlHandler = BaseFormatHandler.getHandler('xml');
      expect(xmlHandler).toBeInstanceOf(XmlHandler);
    });

    test('should throw error for unknown format', () => {
      expect(() => BaseFormatHandler.getHandler('unknown')).toThrow('No handler registered for format: unknown');
    });

    test('should support custom handler registration', () => {
      class CustomHandler extends BaseFormatHandler {
        parse(content) { return new HierarchyNode({ type: 'custom' }); }
        serialize(node) { return 'custom'; }
      }
      
      BaseFormatHandler.register('custom', CustomHandler);
      const handler = BaseFormatHandler.getHandler('custom');
      expect(handler).toBeInstanceOf(CustomHandler);
    });
  });

  describe('JsonHandler', () => {
    let handler;

    beforeEach(() => {
      handler = new JsonHandler();
    });

    test('should parse JSON object', () => {
      const json = '{"name": "John", "age": 30, "active": true}';
      const node = handler.parse(json);
      
      expect(node.type).toBe('object');
      expect(node.children).toHaveLength(3);
      expect(node.children[0].name).toBe('name');
      expect(node.children[0].value).toBe('John');
      expect(node.children[1].name).toBe('age');
      expect(node.children[1].value).toBe(30);
      expect(node.children[2].name).toBe('active');
      expect(node.children[2].value).toBe(true);
    });

    test('should parse JSON array', () => {
      const json = '[1, "two", true, null]';
      const node = handler.parse(json);
      
      expect(node.type).toBe('array');
      expect(node.children).toHaveLength(4);
      expect(node.children[0].value).toBe(1);
      expect(node.children[1].value).toBe('two');
      expect(node.children[2].value).toBe(true);
      expect(node.children[3].value).toBe(null);
    });

    test('should serialize hierarchy back to JSON', () => {
      const json = '{"items": [1, 2, 3], "count": 3}';
      const node = handler.parse(json);
      const serialized = handler.serialize(node);
      
      expect(JSON.parse(serialized)).toEqual(JSON.parse(json));
    });

    test('should detect JSON format', () => {
      expect(handler.detect('{"test": true}')).toBe(true);
      expect(handler.detect('[1, 2, 3]')).toBe(true);
      expect(handler.detect('<xml>test</xml>')).toBe(false);
      expect(handler.detect('key: value')).toBe(false);
    });

    test('should validate JSON content', () => {
      expect(handler.validate('{"valid": true}')).toEqual({ valid: true, errors: [] });
      expect(handler.validate('{"invalid": true,}')).toEqual({
        valid: false,
        errors: expect.arrayContaining([expect.stringContaining('Invalid JSON')])
      });
    });
  });

  describe('XmlHandler', () => {
    let handler;

    beforeEach(() => {
      handler = new XmlHandler();
    });

    test('should parse XML elements', () => {
      const xml = '<root><name>John</name><age>30</age></root>';
      const node = handler.parse(xml);
      
      expect(node.type).toBe('element');
      expect(node.name).toBe('root');
      expect(node.children).toHaveLength(2);
      expect(node.children[0].name).toBe('name');
      expect(node.children[0].children[0].value).toBe('John');
    });

    test('should parse XML attributes', () => {
      const xml = '<person name="John" age="30" active="true"/>';
      const node = handler.parse(xml);
      
      expect(node.attributes).toEqual({
        name: 'John',
        age: '30',
        active: 'true'
      });
    });

    test('should serialize hierarchy back to XML', () => {
      const xml = '<root><item>Test</item></root>';
      const node = handler.parse(xml);
      const serialized = handler.serialize(node);
      
      expect(serialized).toContain('<root>');
      expect(serialized).toContain('<item>Test</item>');
      expect(serialized).toContain('</root>');
    });

    test('should detect XML format', () => {
      expect(handler.detect('<xml>test</xml>')).toBe(true);
      expect(handler.detect('<?xml version="1.0"?><root/>')).toBe(true);
      expect(handler.detect('{"test": true}')).toBe(false);
    });
  });

  describe('YamlHandler', () => {
    let handler;

    beforeEach(() => {
      handler = new YamlHandler();
    });

    test('should parse YAML key-value pairs', () => {
      const yaml = `name: John
age: 30
active: true`;
      const node = handler.parse(yaml);
      
      expect(node.type).toBe('object');
      expect(node.children).toHaveLength(3);
      expect(node.children.find(c => c.name === 'name').value).toBe('John');
      expect(node.children.find(c => c.name === 'age').value).toBe(30);
      expect(node.children.find(c => c.name === 'active').value).toBe(true);
    });

    test('should parse YAML lists', () => {
      const yaml = `items:
  - apple
  - banana
  - cherry`;
      const node = handler.parse(yaml);
      
      expect(node.children[0].name).toBe('items');
      expect(node.children[0].type).toBe('array');
      expect(node.children[0].children).toHaveLength(3);
      expect(node.children[0].children[0].value).toBe('apple');
    });

    test('should serialize hierarchy back to YAML', () => {
      const yaml = `name: John
items:
  - one
  - two`;
      const node = handler.parse(yaml);
      const serialized = handler.serialize(node);
      
      expect(serialized).toContain('name: John');
      expect(serialized).toContain('items:');
      expect(serialized).toContain('- one');
      expect(serialized).toContain('- two');
    });

    test('should detect YAML format', () => {
      expect(handler.detect('key: value')).toBe(true);
      expect(handler.detect('---\nkey: value')).toBe(true);
      expect(handler.detect('- item1\n- item2')).toBe(true);
      expect(handler.detect('{"test": true}')).toBe(false);
    });
  });

  describe('MarkdownHandler', () => {
    let handler;

    beforeEach(() => {
      handler = new MarkdownHandler();
    });

    test('should parse Markdown headings', () => {
      const markdown = `# Title
## Subtitle
Content here`;
      const node = handler.parse(markdown);
      
      expect(node.type).toBe('document');
      expect(node.children).toHaveLength(2);
      expect(node.children[0].type).toBe('heading');
      expect(node.children[0].name).toBe('Title');
      expect(node.children[0].metadata.level).toBe(1);
      expect(node.children[1].type).toBe('heading');
      expect(node.children[1].name).toBe('Subtitle');
      expect(node.children[1].metadata.level).toBe(2);
    });

    test('should parse nested content under headings', () => {
      const markdown = `# Section 1
Content for section 1

## Section 1.1
Nested content`;
      const node = handler.parse(markdown);
      
      const section1 = node.children[0];
      expect(section1.children).toHaveLength(2);
      expect(section1.children[0].type).toBe('content');
      expect(section1.children[1].type).toBe('heading');
      expect(section1.children[1].name).toBe('Section 1.1');
    });

    test('should serialize hierarchy back to Markdown', () => {
      const markdown = `# Main Title

Content under main title

## Subsection

Subsection content`;
      const node = handler.parse(markdown);
      const serialized = handler.serialize(node);
      
      expect(serialized).toContain('# Main Title');
      expect(serialized).toContain('## Subsection');
      expect(serialized).toContain('Content under main title');
    });

    test('should detect Markdown format', () => {
      expect(handler.detect('# Title')).toBe(true);
      expect(handler.detect('## Heading\nContent')).toBe(true);
      expect(handler.detect('- List item\n- Another item')).toBe(true);
      expect(handler.detect('{"test": true}')).toBe(false);
    });
  });

  describe('HierarchyRenderer', () => {
    let renderer;
    let expansionState;
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      expansionState = new ExpansionStateManager();
      renderer = new HierarchyRenderer({
        expansionState,
        enableEditing: true
      });
    });

    test('should render simple object node', () => {
      const node = new HierarchyNode({
        type: 'object',
        name: 'root',
        children: [
          new HierarchyNode({ type: 'value', name: 'key1', value: 'value1' }),
          new HierarchyNode({ type: 'value', name: 'key2', value: 123 })
        ]
      });

      const element = renderer.render(node);
      container.appendChild(element);
      
      expect(container.querySelector('.hierarchy-node')).toBeTruthy();
      expect(container.querySelectorAll('.node-key')).toHaveLength(2);
      expect(container.querySelector('.node-key').textContent).toBe('key1: ');
      expect(container.querySelectorAll('.node-value')[0].textContent).toBe('"value1"');
      expect(container.querySelectorAll('.node-value')[1].textContent).toBe('123');
    });

    test('should render expansion controls for expandable nodes', () => {
      const node = new HierarchyNode({
        type: 'object',
        name: 'root',
        children: [
          new HierarchyNode({
            type: 'object',
            name: 'nested',
            children: [
              new HierarchyNode({ type: 'value', name: 'inner', value: 'test' })
            ]
          })
        ]
      });

      const element = renderer.render(node);
      container.appendChild(element);
      
      const expandControls = container.querySelectorAll('.expand-control');
      expect(expandControls).toHaveLength(1); // only nested has expansion control  
      expect(expandControls[0].textContent).toBe('▼'); // expanded by default
    });

    test('should handle expansion toggle', () => {
      const node = new HierarchyNode({
        type: 'object',
        name: 'container',
        children: [
          new HierarchyNode({ 
            type: 'object',
            name: 'expandable',
            children: [
              new HierarchyNode({ type: 'value', name: 'inner', value: 'test' })
            ]
          })
        ]
      });

      let expandCalled = false;
      let collapseCalled = false;
      
      renderer.onExpand = () => { expandCalled = true; };
      renderer.onCollapse = () => { collapseCalled = true; };

      const element = renderer.render(node);
      container.appendChild(element);
      
      const expandControl = container.querySelector('.expand-control');
      expect(expandControl).toBeTruthy();
      
      // Initially expanded, click to collapse
      expandControl.click();
      expect(collapseCalled).toBe(true);
      expect(expansionState.isExpanded('expandable')).toBe(false);
    });

    test('should show collapsed summary', () => {
      const node = new HierarchyNode({
        type: 'object',
        name: 'root',
        children: [
          new HierarchyNode({ type: 'value', name: 'a', value: 1 }),
          new HierarchyNode({ type: 'value', name: 'b', value: 2 }),
          new HierarchyNode({ type: 'value', name: 'c', value: 3 })
        ]
      });

      expansionState.collapse('root');
      const element = renderer.render(node);
      container.appendChild(element);
      
      const summary = container.querySelector('.collapsed-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toBe(' // 3 properties');
    });

    test('should render array nodes with indices', () => {
      const node = new HierarchyNode({
        type: 'array',
        name: 'items',
        children: [
          new HierarchyNode({ type: 'value', name: '0', value: 'first' }),
          new HierarchyNode({ type: 'value', name: '1', value: 'second' })
        ]
      });

      const element = renderer.render(node);
      container.appendChild(element);
      
      const keys = container.querySelectorAll('.node-key');
      expect(keys[0].textContent).toBe('[0]');
      expect(keys[1].textContent).toBe('[1]');
      expect(keys[0].classList.contains('array-index')).toBe(true);
    });

    test('should render XML elements with attributes', () => {
      const node = new HierarchyNode({
        type: 'element',
        name: 'person',
        attributes: {
          name: 'John',
          age: '30'
        },
        children: []
      });

      const element = renderer.render(node);
      container.appendChild(element);
      
      expect(container.querySelector('.xml-tag')).toBeTruthy();
      expect(container.querySelector('.xml-attributes')).toBeTruthy();
      expect(container.querySelectorAll('.attr-key')).toHaveLength(2);
      expect(container.querySelector('.attr-key').textContent).toBe('name');
      expect(container.querySelector('.attr-value').textContent).toBe('"John"');
    });

    test('should render Markdown headings', () => {
      const node = new HierarchyNode({
        type: 'heading',
        name: 'Main Title',
        metadata: { level: 1 },
        children: []
      });

      const element = renderer.render(node);
      container.appendChild(element);
      
      const heading = container.querySelector('h1.markdown-heading');
      expect(heading).toBeTruthy();
      expect(heading.textContent).toBe('Main Title');
    });

    test('should handle inline editing for values', () => {
      const node = new HierarchyNode({
        type: 'value',
        name: 'editable',
        value: 'original'
      });

      let editData = null;
      renderer.onEdit = (data) => { editData = data; };

      const element = renderer.render(node);
      container.appendChild(element);
      
      const valueElement = container.querySelector('.node-value');
      expect(valueElement.getAttribute('data-editable')).toBe('true');
      
      // Click to start editing
      valueElement.click();
      
      const input = container.querySelector('.edit-input');
      expect(input).toBeTruthy();
      expect(input.value).toBe('original');
      
      // Change value and press Enter
      input.value = 'modified';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(editData).toEqual({
        type: 'value',
        node,
        oldValue: 'original',
        newValue: 'modified',
        path: expect.any(String)
      });
    });
  });

  describe('ExpansionStateManager', () => {
    let manager;

    beforeEach(() => {
      manager = new ExpansionStateManager();
    });

    test('should track expansion state', () => {
      expect(manager.isExpanded('path.to.node')).toBe(true); // default expanded
      
      manager.collapse('path.to.node');
      expect(manager.isExpanded('path.to.node')).toBe(false);
      
      manager.expand('path.to.node');
      expect(manager.isExpanded('path.to.node')).toBe(true);
    });

    test('should toggle expansion state', () => {
      expect(manager.toggle('test.path')).toBe(false); // was expanded, now collapsed
      expect(manager.isExpanded('test.path')).toBe(false);
      
      expect(manager.toggle('test.path')).toBe(true); // was collapsed, now expanded
      expect(manager.isExpanded('test.path')).toBe(true);
    });

    test('should collapse descendants when parent collapsed', () => {
      manager.expand('parent');
      manager.expand('parent.child');
      manager.expand('parent.child.grandchild');
      
      manager.collapse('parent');
      
      expect(manager.isExpanded('parent')).toBe(false);
      expect(manager.isExpanded('parent.child')).toBe(false);
      expect(manager.isExpanded('parent.child.grandchild')).toBe(false);
    });

    test('should expand all nodes', () => {
      const rootNode = new HierarchyNode({
        type: 'object',
        name: 'root',
        children: [
          new HierarchyNode({
            type: 'object',
            name: 'level1',
            children: [
              new HierarchyNode({
                type: 'object',
                name: 'level2',
                children: []
              })
            ]
          })
        ]
      });

      manager.collapseAll();
      manager.expandAll(rootNode);
      
      expect(manager.isExpanded('root')).toBe(true);
      expect(manager.isExpanded('root.level1')).toBe(true);
      expect(manager.isExpanded('root.level1.level2')).toBe(true);
    });

    test('should expand to specific depth', () => {
      const rootNode = new HierarchyNode({
        type: 'object',
        name: 'root',
        children: [
          new HierarchyNode({
            type: 'object',
            name: 'level1',
            children: [
              new HierarchyNode({
                type: 'object',
                name: 'level2',
                children: [
                  new HierarchyNode({
                    type: 'object',
                    name: 'level3',
                    children: []
                  })
                ]
              })
            ]
          })
        ]
      });

      manager.expandToDepth(rootNode, 2);
      
      expect(manager.isExpanded('root')).toBe(true);
      expect(manager.isExpanded('root.level1')).toBe(true);
      expect(manager.isExpanded('root.level1.level2')).toBe(false);
    });

    test('should expand path and ancestors', () => {
      manager.collapseAll();
      manager.expandPath('root.branch.leaf');
      
      expect(manager.isExpanded('root')).toBe(true);
      expect(manager.isExpanded('root.branch')).toBe(true);
      expect(manager.isExpanded('root.branch.leaf')).toBe(true);
    });

    test('should emit events on state changes', () => {
      const expandEvents = [];
      const collapseEvents = [];
      const changeEvents = [];
      
      manager.on('expand', (path) => expandEvents.push(path));
      manager.on('collapse', (path) => collapseEvents.push(path));
      manager.on('change', (data) => changeEvents.push(data));
      
      manager.expand('test.path');
      manager.collapse('test.path');
      manager.expandAll();
      
      expect(expandEvents).toContain('test.path');
      expect(collapseEvents).toContain('test.path');
      expect(changeEvents).toHaveLength(3);
      expect(changeEvents[2].action).toBe('expandAll');
    });

    test('should save and restore state', () => {
      manager.expand('path1');
      manager.expand('path2');
      manager.collapse('path3');
      
      const state = manager.saveState();
      
      const newManager = new ExpansionStateManager();
      newManager.restoreState(state);
      
      expect(newManager.isExpanded('path1')).toBe(true);
      expect(newManager.isExpanded('path2')).toBe(true);
      expect(newManager.isExpanded('path3')).toBe(false);
    });

    test('should persist state to localStorage', () => {
      const mockStorage = {};
      global.localStorage = {
        getItem: (key) => mockStorage[key],
        setItem: (key, value) => { mockStorage[key] = value; },
        removeItem: (key) => { delete mockStorage[key]; }
      };

      const persistedManager = new ExpansionStateManager({
        persistKey: 'test-expansion'
      });

      persistedManager.expand('persisted.path');
      expect(mockStorage['test-expansion']).toBeTruthy();
      
      const loaded = JSON.parse(mockStorage['test-expansion']);
      expect(loaded.expandedNodes).toContain('persisted.path');
    });
  });

  describe('Integration Tests', () => {
    test('should render JSON with working expansion', () => {
      const container = document.createElement('div');
      const expansionState = new ExpansionStateManager();
      const renderer = new HierarchyRenderer({ expansionState });
      const handler = new JsonHandler();
      
      const json = `{
        "users": [
          {"name": "John", "age": 30},
          {"name": "Jane", "age": 25}
        ],
        "count": 2
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Check initial render
      expect(container.querySelectorAll('.hierarchy-node').length).toBeGreaterThan(0);
      expect(container.querySelector('.node-key').textContent).toBe('users');
      
      // Find and click the users array expansion control
      const expandControls = container.querySelectorAll('.expand-control');
      const usersExpand = expandControls[1]; // Second control is for 'users' array
      
      // Collapse the users array
      usersExpand.click();
      
      // Re-render with new expansion state
      container.innerHTML = '';
      const newElement = renderer.render(node, { formatHandler: handler });
      container.appendChild(newElement);
      
      // Check collapsed state
      const summary = container.querySelector('.collapsed-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toContain('2 items');
    });

    test('should convert between formats', () => {
      const jsonHandler = new JsonHandler();
      const xmlHandler = new XmlHandler();
      const yamlHandler = new YamlHandler();
      
      const originalJson = {
        person: {
          name: "John Doe",
          age: 30,
          active: true
        }
      };
      
      // Parse JSON
      const jsonString = JSON.stringify(originalJson);
      const node = jsonHandler.parse(jsonString);
      
      // Convert to XML
      const xmlString = xmlHandler.serialize(node);
      expect(xmlString).toContain('<person>');
      expect(xmlString).toContain('<name>John Doe</name>');
      
      // Convert to YAML
      const yamlString = yamlHandler.serialize(node);
      expect(yamlString).toContain('person:');
      expect(yamlString).toContain('name: John Doe');
      expect(yamlString).toContain('age: 30');
    });

    test('should maintain structure across format conversions', () => {
      const handlers = {
        json: new JsonHandler(),
        xml: new XmlHandler(),
        yaml: new YamlHandler()
      };
      
      const testStructure = {
        root: {
          items: ['a', 'b', 'c'],
          metadata: {
            version: 1,
            author: 'test'
          }
        }
      };
      
      // Start with JSON
      const jsonString = JSON.stringify(testStructure);
      let node = handlers.json.parse(jsonString);
      
      // Convert through each format
      const xmlString = handlers.xml.serialize(node);
      node = handlers.xml.parse(xmlString);
      
      const yamlString = handlers.yaml.serialize(node);
      node = handlers.yaml.parse(yamlString);
      
      const finalJson = handlers.json.serialize(node);
      const finalData = JSON.parse(finalJson);
      
      // Check structure is maintained
      expect(finalData.root).toBeTruthy();
      expect(finalData.root.items).toHaveLength(3);
      expect(finalData.root.metadata.version).toBe(1);
      expect(finalData.root.metadata.author).toBe('test');
    });
  });
});