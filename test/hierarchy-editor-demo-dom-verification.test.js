/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

// Create mock editors that actually update DOM
const createMockEditorWithDOM = (container, config) => {
  // Create a simple tree structure in DOM
  let treeData = {
    id: 'root',
    name: 'Root Node',
    children: [
      { id: 'child1', name: 'Child 1', children: [] },
      { id: 'child2', name: 'Child 2', children: [
        { id: 'grandchild1', name: 'Grandchild 1', children: [] }
      ]}
    ]
  };
  
  let mode = 'tree';
  let theme = config.theme || 'light';
  let expandedNodes = new Set();
  let selectedNode = null;
  
  const renderTree = () => {
    const html = `
      <div class="hierarchy-editor theme-${theme}">
        <div class="he-content">
          ${mode === 'tree' ? renderTreeView() : renderSourceView()}
        </div>
      </div>
    `;
    container.innerHTML = html;
  };
  
  const renderTreeView = () => {
    return `<div class="tree-view">${renderNode(treeData)}</div>`;
  };
  
  const renderNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode === node.id;
    const hasChildren = node.children && node.children.length > 0;
    
    return `
      <div class="tree-node ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}" 
           data-node-id="${node.id}" 
           data-depth="${depth}">
        <div class="node-header">
          ${hasChildren ? `<span class="expand-toggle">${isExpanded ? '▼' : '▶'}</span>` : '<span class="expand-spacer"></span>'}
          <span class="node-name">${node.name}</span>
        </div>
        ${hasChildren && isExpanded ? `
          <div class="node-children">
            ${node.children.map(child => renderNode(child, depth + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  };
  
  const renderSourceView = () => {
    return `
      <div class="source-view">
        <pre class="source-content">${JSON.stringify(treeData, null, 2)}</pre>
      </div>
    `;
  };
  
  const findNodeById = (node, id) => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  };
  
  const mockEditor = {
    render: () => {
      renderTree();
      // Simulate event handlers
      container.addEventListener('click', (e) => {
        const toggle = e.target.closest('.expand-toggle');
        if (toggle) {
          const nodeEl = toggle.closest('.tree-node');
          const nodeId = nodeEl.dataset.nodeId;
          if (expandedNodes.has(nodeId)) {
            expandedNodes.delete(nodeId);
          } else {
            expandedNodes.add(nodeId);
          }
          renderTree();
        }
        
        const nodeHeader = e.target.closest('.node-header');
        if (nodeHeader) {
          const nodeEl = nodeHeader.closest('.tree-node');
          selectedNode = nodeEl.dataset.nodeId;
          renderTree();
        }
      });
    },
    
    destroy: () => {
      container.innerHTML = '';
    },
    
    setMode: (newMode) => {
      mode = newMode;
      renderTree();
    },
    
    expandAll: () => {
      const addAllNodes = (node) => {
        if (node.children && node.children.length > 0) {
          expandedNodes.add(node.id);
          node.children.forEach(addAllNodes);
        }
      };
      addAllNodes(treeData);
      renderTree();
    },
    
    collapseAll: () => {
      expandedNodes.clear();
      renderTree();
    },
    
    loadContent: (content, format) => {
      try {
        if (format === 'json') {
          treeData = JSON.parse(content);
        } else {
          // Simple mock for other formats
          treeData = {
            id: 'root',
            name: `${format} content`,
            children: []
          };
        }
        expandedNodes.clear();
        selectedNode = null;
        renderTree();
      } catch (e) {
        console.error('Load content error:', e);
      }
    },
    
    setContent: (content) => {
      try {
        treeData = JSON.parse(content);
        renderTree();
      } catch (e) {
        console.error('Set content error:', e);
      }
    },
    
    getContent: () => JSON.stringify(treeData, null, 2),
    
    addNode: (path, value) => {
      const node = findNodeById(treeData, path);
      if (node) {
        if (!node.children) node.children = [];
        const newNode = {
          id: typeof value === 'object' && value.id ? value.id : `node_${Date.now()}`,
          name: typeof value === 'object' && value.created ? `New Node (${value.created})` : String(value),
          children: []
        };
        node.children.push(newNode);
        expandedNodes.add(path);
        renderTree();
      }
    },
    
    editNode: (path, value) => {
      const node = findNodeById(treeData, path);
      if (node) {
        node.name = String(value);
        renderTree();
      }
    },
    
    deleteNode: (path) => {
      // Not implemented for simplicity
    },
    
    bulkOperation: (fn) => fn(),
    
    getTreeData: () => treeData,
    
    setTheme: (newTheme) => {
      theme = newTheme;
      renderTree();
    },
    
    setEditable: (editable) => {
      // Mock implementation
    },
    
    validate: () => ({ valid: true })
  };
  
  // Call mount callback if provided
  if (config.onMount) {
    config.onMount(mockEditor);
  }
  
  return mockEditor;
};

// Mock the HierarchyEditor module
jest.mock('../src/components/hierarchy-editor/index.js', () => ({
  HierarchyEditor: {
    create: createMockEditorWithDOM
  }
}));

describe('HierarchyEditorDemo DOM Verification Tests', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  describe('Tree View DOM Interactions', () => {
    test('should render tree nodes in DOM and handle expand/collapse', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get the basic editor container
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      expect(basicContainer).toBeTruthy();
      
      // Check initial tree structure
      const treeView = basicContainer.querySelector('.tree-view');
      expect(treeView).toBeTruthy();
      
      // Check root node is rendered
      const rootNode = basicContainer.querySelector('[data-node-id="root"]');
      expect(rootNode).toBeTruthy();
      expect(rootNode.textContent).toContain('Root Node');
      
      // Initially collapsed - children should not be visible
      expect(rootNode.classList.contains('expanded')).toBe(false);
      expect(basicContainer.querySelector('[data-node-id="child1"]')).toBeFalsy();
      
      // Click expand toggle on root
      const expandToggle = rootNode.querySelector('.expand-toggle');
      expect(expandToggle).toBeTruthy();
      expect(expandToggle.textContent).toBe('▶'); // Collapsed icon
      
      expandToggle.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check root is now expanded
      const expandedRoot = basicContainer.querySelector('[data-node-id="root"]');
      expect(expandedRoot.classList.contains('expanded')).toBe(true);
      
      // Check children are now visible
      const child1 = basicContainer.querySelector('[data-node-id="child1"]');
      const child2 = basicContainer.querySelector('[data-node-id="child2"]');
      expect(child1).toBeTruthy();
      expect(child2).toBeTruthy();
      expect(child1.textContent).toContain('Child 1');
      expect(child2.textContent).toContain('Child 2');
      
      // Check expand icon changed
      const newExpandToggle = expandedRoot.querySelector('.expand-toggle');
      expect(newExpandToggle.textContent).toBe('▼'); // Expanded icon
      
      // Test collapse
      newExpandToggle.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Children should be hidden again
      expect(basicContainer.querySelector('[data-node-id="child1"]')).toBeFalsy();
      expect(basicContainer.querySelector('[data-node-id="child2"]')).toBeFalsy();
      
      demo.destroy();
    });
    
    test('should handle expand all and collapse all buttons', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      
      // Click expand all button
      const expandAllBtn = container.querySelector('[data-action="expand-all"][data-editor="basic"]');
      expandAllBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // All nodes should be visible
      expect(basicContainer.querySelector('[data-node-id="root"]').classList.contains('expanded')).toBe(true);
      expect(basicContainer.querySelector('[data-node-id="child1"]')).toBeTruthy();
      expect(basicContainer.querySelector('[data-node-id="child2"]')).toBeTruthy();
      expect(basicContainer.querySelector('[data-node-id="child2"]').classList.contains('expanded')).toBe(true);
      expect(basicContainer.querySelector('[data-node-id="grandchild1"]')).toBeTruthy();
      
      // Click collapse all button
      const collapseAllBtn = container.querySelector('[data-action="collapse-all"][data-editor="basic"]');
      collapseAllBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Only root should be visible
      expect(basicContainer.querySelector('[data-node-id="root"]').classList.contains('expanded')).toBe(false);
      expect(basicContainer.querySelector('[data-node-id="child1"]')).toBeFalsy();
      expect(basicContainer.querySelector('[data-node-id="grandchild1"]')).toBeFalsy();
      
      demo.destroy();
    });
    
    test('should handle node selection', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      
      // Expand to see children
      const expandAllBtn = container.querySelector('[data-action="expand-all"][data-editor="basic"]');
      expandAllBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Click on child1 node header
      const child1 = basicContainer.querySelector('[data-node-id="child1"]');
      const child1Header = child1.querySelector('.node-header');
      child1Header.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check child1 is selected
      expect(child1.classList.contains('selected')).toBe(true);
      
      // Click on child2
      const child2 = basicContainer.querySelector('[data-node-id="child2"]');
      const child2Header = child2.querySelector('.node-header');
      child2Header.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check child2 is selected and child1 is not
      expect(child2.classList.contains('selected')).toBe(true);
      expect(child1.classList.contains('selected')).toBe(false);
      
      demo.destroy();
    });
  });
  
  describe('Mode Switching DOM Verification', () => {
    test('should switch between tree and source views', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      
      // Initially in tree view
      expect(basicContainer.querySelector('.tree-view')).toBeTruthy();
      expect(basicContainer.querySelector('.source-view')).toBeFalsy();
      
      // Switch to source view
      const sourceModeBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
      sourceModeBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check source view is shown
      expect(basicContainer.querySelector('.tree-view')).toBeFalsy();
      expect(basicContainer.querySelector('.source-view')).toBeTruthy();
      
      // Check source content is displayed
      const sourceContent = basicContainer.querySelector('.source-content');
      expect(sourceContent).toBeTruthy();
      expect(sourceContent.textContent).toContain('Root Node');
      expect(sourceContent.textContent).toContain('Child 1');
      
      // Switch back to tree view
      const treeModeBtn = container.querySelector('[data-action="tree-mode"][data-editor="basic"]');
      treeModeBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check tree view is shown again
      expect(basicContainer.querySelector('.tree-view')).toBeTruthy();
      expect(basicContainer.querySelector('.source-view')).toBeFalsy();
      
      demo.destroy();
    });
  });
  
  describe('Format Loading DOM Verification', () => {
    test('should load different format content when format cards clicked', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const formatContainer = container.querySelector('[data-editor-container="format"]');
      
      // Click JSON format card
      const jsonCard = container.querySelector('[data-format="json"]');
      jsonCard.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check JSON card is highlighted
      expect(jsonCard.classList.contains('active')).toBe(true);
      
      // Check content loaded (our mock loads parsed JSON)
      let treeView = formatContainer.querySelector('.tree-view');
      expect(treeView).toBeTruthy();
      
      // Click XML format card
      const xmlCard = container.querySelector('[data-format="xml"]');
      xmlCard.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check XML card is highlighted and JSON card is not
      expect(xmlCard.classList.contains('active')).toBe(true);
      expect(jsonCard.classList.contains('active')).toBe(false);
      
      // Check content changed
      treeView = formatContainer.querySelector('.tree-view');
      expect(treeView.textContent).toContain('xml content');
      
      demo.destroy();
    });
  });
  
  describe('Edit Operations DOM Verification', () => {
    test('should add nodes and update DOM', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const editContainer = container.querySelector('[data-editor-container="edit"]');
      
      // Initial state - items should be empty
      const initialTree = editContainer.querySelector('.tree-view');
      expect(initialTree.textContent).toContain('items');
      
      // Click add node button
      const addBtn = container.querySelector('[data-action="add-node"]');
      addBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check new node was added
      const itemsNode = editContainer.querySelector('[data-node-id="items"]');
      expect(itemsNode).toBeTruthy();
      expect(itemsNode.classList.contains('expanded')).toBe(true);
      
      // Should have a child node now
      const newNode = itemsNode.querySelector('.node-children .tree-node');
      expect(newNode).toBeTruthy();
      expect(newNode.textContent).toContain('New Node');
      
      // Check node count updated
      const nodeCountEl = container.querySelector('[data-node-count="edit"] .count');
      expect(nodeCountEl.textContent).toBe('4'); // root + items + settings + new node
      
      demo.destroy();
    });
    
    test('should bulk add nodes', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const editContainer = container.querySelector('[data-editor-container="edit"]');
      
      // Click bulk add button
      const bulkBtn = container.querySelector('[data-action="bulk-add"]');
      bulkBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check items node is expanded and has children
      const itemsNode = editContainer.querySelector('[data-node-id="items"]');
      expect(itemsNode.classList.contains('expanded')).toBe(true);
      
      const childNodes = itemsNode.querySelectorAll('.node-children .tree-node');
      expect(childNodes.length).toBe(5);
      
      // Check content of added nodes
      expect(childNodes[0].textContent).toContain('Item 1');
      expect(childNodes[4].textContent).toContain('Item 5');
      
      demo.destroy();
    });
    
    test('should clear content when clear button clicked', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const editContainer = container.querySelector('[data-editor-container="edit"]');
      
      // Add some nodes first
      const bulkBtn = container.querySelector('[data-action="bulk-add"]');
      bulkBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify nodes were added
      let itemsNode = editContainer.querySelector('[data-node-id="items"]');
      let childNodes = itemsNode.querySelectorAll('.node-children .tree-node');
      expect(childNodes.length).toBe(5);
      
      // Click clear button
      const clearBtn = container.querySelector('[data-action="clear"]');
      clearBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check items node has no children
      itemsNode = editContainer.querySelector('[data-node-id="items"]');
      childNodes = itemsNode.querySelectorAll('.node-children .tree-node');
      expect(childNodes.length).toBe(0);
      
      demo.destroy();
    });
  });
  
  describe('Event Logging DOM Verification', () => {
    test('should display events in event log', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const eventLog = container.querySelector('[data-event-log]');
      
      // Should have mount event
      let events = eventLog.querySelectorAll('.event');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].textContent).toContain('mount');
      
      // Programmatic edit
      const editBtn = container.querySelector('[data-action="programmatic-edit"][data-editor="event"]');
      editBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check new event added
      events = eventLog.querySelectorAll('.event');
      const editEvent = Array.from(events).find(e => e.textContent.includes('nodeEdit'));
      expect(editEvent).toBeTruthy();
      expect(editEvent.textContent).toContain('Jane Doe');
      
      // Clear log
      const clearBtn = container.querySelector('[data-action="clear-log"]');
      clearBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Log should be empty
      events = eventLog.querySelectorAll('.event');
      expect(events.length).toBe(0);
      expect(eventLog.innerHTML).toBe('');
      
      demo.destroy();
    });
  });
  
  describe('Theme Switching DOM Verification', () => {
    test('should update theme classes on all editors', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check initial theme
      const demoEl = container.querySelector('.hierarchy-editor-demo');
      expect(demoEl.classList.contains('theme-light')).toBe(true);
      
      // Check editors have light theme
      const basicEditor = container.querySelector('[data-editor-container="basic"] .hierarchy-editor');
      expect(basicEditor.classList.contains('theme-light')).toBe(true);
      
      // Toggle theme
      const themeBtn = container.querySelector('[data-action="toggle-theme"]');
      themeBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check demo container updated
      expect(demoEl.classList.contains('theme-dark')).toBe(true);
      expect(demoEl.classList.contains('theme-light')).toBe(false);
      
      // Check all editors updated
      const allEditors = container.querySelectorAll('.hierarchy-editor');
      allEditors.forEach(editor => {
        expect(editor.classList.contains('theme-dark')).toBe(true);
        expect(editor.classList.contains('theme-light')).toBe(false);
      });
      
      // Check info text updated
      const infoEl = container.querySelector('[data-info="advanced"]');
      expect(infoEl.textContent).toContain('Theme: dark');
      
      demo.destroy();
    });
  });
  
  describe('Status Updates DOM Verification', () => {
    test('should update status text based on actions', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Edit demo status
      const editStatus = container.querySelector('[data-status="edit"]');
      expect(editStatus.textContent).toBe('Double-click any value to edit');
      
      // Add a node
      const addBtn = container.querySelector('[data-action="add-node"]');
      addBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Status should update
      expect(editStatus.textContent).toContain('Added node to items');
      
      // Format demo status
      const formatStatus = container.querySelector('[data-status="format"]');
      expect(formatStatus.textContent).toBe('Click a format above to load sample data');
      
      // Load JSON
      const jsonCard = container.querySelector('[data-format="json"]');
      jsonCard.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(formatStatus.textContent).toBe('Content loaded');
      
      demo.destroy();
    });
  });
});