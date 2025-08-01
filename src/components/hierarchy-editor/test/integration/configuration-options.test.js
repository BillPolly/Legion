/**
 * Configuration Options Integration Tests
 */
import { createTestContainer, cleanupTestContainer } from '../test-helpers.js';

describe('Configuration Options', () => {
  let container;
  let HierarchyEditor;

  beforeEach(async () => {
    container = createTestContainer();
    
    // Import HierarchyEditor
    const editorModule = await import('../../index.js');
    HierarchyEditor = editorModule.HierarchyEditor;
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Theme Configuration', () => {
    test('should support light theme', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        theme: 'light'
      });
      
      editor.render();
      
      const editorEl = container.querySelector('.hierarchy-editor');
      expect(editorEl.classList.contains('theme-light')).toBe(true);
      
      editor.destroy();
    });
    
    test('should support dark theme', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        theme: 'dark'
      });
      
      editor.render();
      
      const editorEl = container.querySelector('.hierarchy-editor');
      expect(editorEl.classList.contains('theme-dark')).toBe(true);
      
      editor.destroy();
    });
    
    test('should support theme switching at runtime', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        theme: 'light'
      });
      
      editor.render();
      
      // Switch theme
      editor.setTheme('dark');
      
      const editorEl = container.querySelector('.hierarchy-editor');
      expect(editorEl.classList.contains('theme-dark')).toBe(true);
      expect(editorEl.classList.contains('theme-light')).toBe(false);
      
      editor.destroy();
    });
  });
  
  describe('Icon Configuration', () => {
    test('should support custom icons', () => {
      const customIcons = {
        expanded: '▼',
        collapsed: '▶',
        object: '{}',
        array: '[]',
        string: '""',
        number: '#',
        boolean: '✓',
        null: '∅'
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"str": "text", "num": 42, "bool": true}',
        format: 'json',
        icons: customIcons
      });
      
      editor.render();
      
      // Check custom icons are used
      const stringIcon = container.querySelector('[data-path="str"] .node-icon');
      const numberIcon = container.querySelector('[data-path="num"] .node-icon');
      const boolIcon = container.querySelector('[data-path="bool"] .node-icon');
      
      expect(stringIcon.textContent).toBe('""');
      expect(numberIcon.textContent).toBe('#');
      expect(boolIcon.textContent).toBe('✓');
      
      editor.destroy();
    });
    
    test('should fall back to defaults for missing icons', () => {
      const partialIcons = {
        string: 'STR'
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"str": "text", "num": 42}',
        format: 'json',
        icons: partialIcons
      });
      
      editor.render();
      
      const stringIcon = container.querySelector('[data-path="str"] .node-icon');
      expect(stringIcon.textContent).toBe('STR');
      
      // Number should use default
      const numberIcon = container.querySelector('[data-path="num"] .node-icon');
      expect(numberIcon.textContent).toBeTruthy(); // Has some default
      
      editor.destroy();
    });
  });
  
  describe('Indentation Configuration', () => {
    test('should support custom indentation size', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"parent": {"child": {"grandchild": true}}}',
        format: 'json',
        indentSize: 40
      });
      
      editor.render();
      editor.expandAll();
      
      // Check indentation
      const childNode = container.querySelector('[data-path="parent.child"]');
      const grandchildNode = container.querySelector('[data-path="parent.child.grandchild"]');
      
      const childIndent = parseInt(childNode.style.paddingLeft || '0');
      const grandchildIndent = parseInt(grandchildNode.style.paddingLeft || '0');
      
      expect(childIndent).toBe(40);
      expect(grandchildIndent).toBe(80);
      
      editor.destroy();
    });
    
    test('should support indentation character in source mode', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": {"nested": true}}',
        format: 'json',
        indentChar: '\t'
      });
      
      editor.render();
      await editor.setMode('source');
      
      const content = editor.getContent();
      expect(content).toContain('\t"nested"');
      
      editor.destroy();
    });
  });
  
  describe('Keyboard Shortcuts Configuration', () => {
    test('should support custom keyboard shortcuts', () => {
      const shortcuts = {
        'cmd+s': 'save',
        'cmd+z': 'undo',
        'cmd+shift+z': 'redo',
        'delete': 'deleteNode',
        'enter': 'editNode'
      };
      
      const saveHandler = jest.fn();
      const undoHandler = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        shortcuts,
        onSave: saveHandler,
        onUndo: undoHandler
      });
      
      editor.render();
      editor.selectNode('test');
      
      // Trigger keyboard shortcut
      const event = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true
      });
      container.dispatchEvent(event);
      
      expect(saveHandler).toHaveBeenCalled();
      
      editor.destroy();
    });
    
    test('should disable shortcuts when configured', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        enableKeyboardShortcuts: false
      });
      
      editor.render();
      
      const deleteHandler = jest.fn();
      editor.on('nodeDelete', deleteHandler);
      
      // Try delete shortcut
      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true
      });
      container.dispatchEvent(event);
      
      expect(deleteHandler).not.toHaveBeenCalled();
      
      editor.destroy();
    });
  });
  
  describe('Localization Configuration', () => {
    test('should support custom labels', () => {
      const labels = {
        addNode: 'Adicionar',
        deleteNode: 'Excluir',
        editNode: 'Editar',
        moveNode: 'Mover',
        expandAll: 'Expandir Tudo',
        collapseAll: 'Recolher Tudo',
        treeView: 'Vista Árvore',
        sourceView: 'Vista Código'
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        labels,
        showToolbar: true
      });
      
      editor.render();
      
      // Check toolbar buttons
      const buttons = container.querySelectorAll('.he-toolbar button');
      const buttonTexts = Array.from(buttons).map(b => b.textContent);
      
      expect(buttonTexts).toContain('Vista Árvore');
      expect(buttonTexts).toContain('Vista Código');
      
      editor.destroy();
    });
    
    test('should support RTL languages', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        direction: 'rtl'
      });
      
      editor.render();
      
      const editorEl = container.querySelector('.hierarchy-editor');
      expect(editorEl.getAttribute('dir')).toBe('rtl');
      
      editor.destroy();
    });
  });
  
  describe('Performance Configuration', () => {
    test('should support virtual scrolling for large datasets', () => {
      const largeData = {};
      for (let i = 0; i < 10000; i++) {
        largeData[`item_${i}`] = {
          id: i,
          value: `Value ${i}`
        };
      }
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: JSON.stringify(largeData),
        format: 'json',
        virtualScroll: true,
        virtualScrollHeight: 500
      });
      
      const startTime = Date.now();
      editor.render();
      const renderTime = Date.now() - startTime;
      
      // Should render quickly even with large data
      expect(renderTime).toBeLessThan(1000);
      
      // Should have virtual scroll container
      expect(container.querySelector('.virtual-scroll-container')).toBeTruthy();
      
      editor.destroy();
    });
    
    test('should support debounced validation', async () => {
      let validationCount = 0;
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        validationDelay: 500,
        onValidation: () => validationCount++
      });
      
      editor.render();
      await editor.setMode('source');
      
      // Rapid edits
      for (let i = 0; i < 5; i++) {
        editor.setContent(`{"test": ${i}}`);
      }
      
      // Validation should not have run yet
      expect(validationCount).toBe(0);
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should have validated once
      expect(validationCount).toBe(1);
      
      editor.destroy();
    });
  });
  
  describe('Accessibility Configuration', () => {
    test('should support ARIA labels', () => {
      const ariaLabels = {
        tree: 'Hierarchy tree view',
        node: 'Tree node',
        expandButton: 'Expand node',
        collapseButton: 'Collapse node'
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"parent": {"child": true}}',
        format: 'json',
        ariaLabels
      });
      
      editor.render();
      
      const treeView = container.querySelector('.tree-view');
      expect(treeView.getAttribute('aria-label')).toBe('Hierarchy tree view');
      
      const nodeEl = container.querySelector('.node');
      expect(nodeEl.getAttribute('aria-label')).toContain('Tree node');
      
      editor.destroy();
    });
    
    test('should support high contrast mode', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        highContrast: true
      });
      
      editor.render();
      
      const editorEl = container.querySelector('.hierarchy-editor');
      expect(editorEl.classList.contains('high-contrast')).toBe(true);
      
      editor.destroy();
    });
  });
  
  describe('Export/Import Configuration', () => {
    test('should support custom export formats', () => {
      const exportFormats = {
        csv: (data) => {
          // Simple CSV export
          const rows = [];
          const flatten = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
              const path = prefix ? `${prefix}.${key}` : key;
              if (typeof value === 'object' && value !== null) {
                flatten(value, path);
              } else {
                rows.push(`"${path}","${value}"`);
              }
            }
          };
          flatten(data);
          return rows.join('\n');
        }
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"user": {"name": "John", "age": 30}}',
        format: 'json',
        exportFormats
      });
      
      editor.render();
      
      const csvContent = editor.exportAs('csv');
      expect(csvContent).toContain('"user.name","John"');
      expect(csvContent).toContain('"user.age","30"');
      
      editor.destroy();
    });
    
    test('should support custom import parsers', () => {
      const importParsers = {
        csv: (content) => {
          // Simple CSV parser
          const result = {};
          const lines = content.split('\n');
          for (const line of lines) {
            const [path, value] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const keys = path.split('.');
            let current = result;
            for (let i = 0; i < keys.length - 1; i++) {
              if (!current[keys[i]]) current[keys[i]] = {};
              current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = isNaN(value) ? value : Number(value);
          }
          return result;
        }
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        importParsers
      });
      
      editor.render();
      
      editor.importFrom('"user.name","Jane"\n"user.age","25"', 'csv');
      
      const content = JSON.parse(editor.getContent());
      expect(content.user.name).toBe('Jane');
      expect(content.user.age).toBe(25);
      
      editor.destroy();
    });
  });
  
  describe('Plugin Configuration', () => {
    test('should support plugin system', () => {
      const pluginInit = jest.fn();
      const pluginDestroy = jest.fn();
      
      const customPlugin = {
        name: 'test-plugin',
        init: (editor) => {
          pluginInit(editor);
          
          // Add custom method
          editor.customMethod = () => 'plugin result';
          
          // Listen to events
          editor.on('change', () => {
            console.log('Plugin detected change');
          });
        },
        destroy: () => {
          pluginDestroy();
        }
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        plugins: [customPlugin]
      });
      
      editor.render();
      
      // Plugin should be initialized
      expect(pluginInit).toHaveBeenCalledWith(editor);
      
      // Custom method should exist
      expect(editor.customMethod()).toBe('plugin result');
      
      editor.destroy();
      
      // Plugin should be destroyed
      expect(pluginDestroy).toHaveBeenCalled();
    });
    
    test('should handle plugin errors gracefully', () => {
      const errorPlugin = {
        name: 'error-plugin',
        init: () => {
          throw new Error('Plugin initialization failed');
        }
      };
      
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        plugins: [errorPlugin],
        onError
      });
      
      // Should not throw
      expect(() => editor.render()).not.toThrow();
      
      // Should emit error
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin-error',
          plugin: 'error-plugin'
        })
      );
      
      editor.destroy();
    });
  });
});