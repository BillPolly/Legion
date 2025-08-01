/**
 * Mock HierarchyEditor for testing the demo component
 */

export const HierarchyEditor = {
  create(config) {
    console.log('Mock HierarchyEditor.create called');
    
    const mockInstance = {
      config: config,
      _rendered: false,
      _content: config.content || '{"default": "data"}',
      _mode: config.defaultMode || 'tree',
      _theme: config.theme || 'light',
      
      render() {
        console.log('Mock HierarchyEditor.render called');
        this._rendered = true;
        if (config.dom) {
          config.dom.innerHTML = `
            <div class="mock-hierarchy-editor" style="padding: 10px; background: #f0f0f0; border: 1px solid #ddd;">
              <div>Mock HierarchyEditor (${config.format || 'json'})</div>
              <div>Mode: ${this._mode}</div>
              <div>Content: ${this._content.substring(0, 50)}...</div>
            </div>
          `;
        }
        if (config.onReady) {
          config.onReady({ instance: this });
        }
      },
      
      destroy() {
        console.log('Mock HierarchyEditor.destroy called');
        if (config.onDestroy) {
          config.onDestroy(this);
        }
      },
      
      setMode(mode) {
        console.log(`Mock setMode: ${mode}`);
        this._mode = mode;
        if (config.onModeChange) {
          config.onModeChange({ fromMode: this._mode, toMode: mode });
        }
      },
      
      expandAll() {
        console.log('Mock expandAll');
      },
      
      collapseAll() {
        console.log('Mock collapseAll');
      },
      
      loadContent(content, format) {
        console.log(`Mock loadContent: ${format}`);
        this._content = content;
        if (config.onContentChange) {
          config.onContentChange({ content, format });
        }
      },
      
      setContent(content) {
        console.log('Mock setContent');
        this._content = content;
        if (config.onChange) {
          config.onChange({ content });
        }
      },
      
      getContent() {
        return this._content;
      },
      
      addNode(path, value) {
        console.log(`Mock addNode: ${path}`);
        if (config.onNodeAdd) {
          config.onNodeAdd({ parentPath: path, value });
        }
      },
      
      editNode(path, value) {
        console.log(`Mock editNode: ${path} = ${value}`);
        if (config.onNodeEdit) {
          config.onNodeEdit({ path, newValue: value, oldValue: 'old' });
        }
      },
      
      deleteNode(path) {
        console.log(`Mock deleteNode: ${path}`);
        if (config.onNodeRemove) {
          config.onNodeRemove({ path });
        }
      },
      
      bulkOperation(fn) {
        console.log('Mock bulkOperation');
        fn();
      },
      
      getTreeData() {
        return { id: 'root', name: 'Root', children: [] };
      },
      
      setTheme(theme) {
        console.log(`Mock setTheme: ${theme}`);
        this._theme = theme;
      },
      
      setEditable(editable) {
        console.log(`Mock setEditable: ${editable}`);
      },
      
      validate(content) {
        return { valid: true };
      }
    };
    
    // Call mount callback
    if (config.onMount) {
      config.onMount(mockInstance);
    }
    
    return mockInstance;
  }
};