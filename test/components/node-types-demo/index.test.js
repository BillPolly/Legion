/**
 * NodeTypesDemo Component Tests
 * 
 * Comprehensive testing of drag & drop functionality and real user interactions
 */

import { NodeTypesDemo } from '../../../public/examples/node-types-demo/index.js';

// Mock DragEvent for jsdom
class MockDragEvent extends Event {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.dataTransfer = eventInit.dataTransfer || {
      effectAllowed: 'copy',
      dropEffect: 'copy',
      getData: () => '',
      setData: () => {},
      setDragImage: () => {},
      types: [],
      files: []
    };
    this.clientX = eventInit.clientX || 0;
    this.clientY = eventInit.clientY || 0;
  }
}

global.DragEvent = MockDragEvent;

describe('NodeTypesDemo Component', () => {
  let container;
  let demo;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '1400px';
    container.style.height = '800px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (demo && demo.destroy) {
      demo.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  describe('Umbilical Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      NodeTypesDemo.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });
      
      expect(requirements).toBeDefined();
      expect(requirements.dom).toBeDefined();
      expect(requirements.dom.type).toBe('HTMLElement');
      expect(requirements.dom.description).toBe('Parent DOM element');
    });
    
    test('should support validation mode', () => {
      const validation = NodeTypesDemo.create({
        validate: (checks) => {
          expect(checks).toBeDefined();
          expect(checks.hasDomElement).toBeDefined();
          return checks;
        }
      });
      
      expect(validation).toBeDefined();
      expect(validation.hasDomElement).toBeDefined();
    });
    
    test('should validate DOM element correctly', () => {
      const validValidation = NodeTypesDemo.create({
        validate: (checks) => checks,
        dom: container
      });
      
      const invalidValidation = NodeTypesDemo.create({
        validate: (checks) => checks,
        dom: null
      });
      
      expect(validValidation.hasDomElement).toBe(true);
      expect(invalidValidation.hasDomElement).toBe(false);
    });
  });
  
  describe('Component Creation and UI', () => {
    test('should create demo instance with complete UI', () => {
      let mountCalled = false;
      
      demo = NodeTypesDemo.create({
        dom: container,
        onMount: (instance) => {
          mountCalled = true;
          expect(instance.getEditor()).toBeDefined();
          expect(instance.getNodeTypes()).toBeDefined();
        }
      });
      
      expect(demo).toBeDefined();
      expect(mountCalled).toBe(true);
      
      // Check main structure
      const demoContainer = container.querySelector('.node-types-demo');
      expect(demoContainer).toBeTruthy();
      
      // Check header
      const header = demoContainer.querySelector('.header');
      expect(header).toBeTruthy();
      expect(header.querySelector('h1').textContent).toBe('Node Types Customization Demo');
      
      // Check sidebar with palette
      const sidebar = demoContainer.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();
      
      // Check all 6 node types exist in palette
      const nodeTypes = ['process', 'decision', 'data', 'terminal', 'document', 'database'];
      nodeTypes.forEach(nodeType => {
        const nodeTypeEl = sidebar.querySelector(`[data-node-type="${nodeType}"]`);
        expect(nodeTypeEl).toBeTruthy();
        expect(nodeTypeEl.getAttribute('draggable')).toBe('true');
      });
      
      // Check editor container
      const editorContainer = demoContainer.querySelector('#editorContainer');
      expect(editorContainer).toBeTruthy();
      
      // Check properties panel
      const propertiesPanel = demoContainer.querySelector('.properties-panel');
      expect(propertiesPanel).toBeTruthy();
      
      // Check toolbar buttons
      const buttons = [
        'selectBtn', 'connectBtn', 'deleteBtn', 'undoBtn', 'redoBtn',
        'autoLayoutBtn', 'exportBtn'
      ];
      buttons.forEach(buttonId => {
        const button = demoContainer.querySelector(`#${buttonId}`);
        expect(button).toBeTruthy();
        expect(button.tagName).toBe('BUTTON');
      });
    });
    
    test('should initialize with empty graph ready for drag & drop', async () => {
      demo = NodeTypesDemo.create({
        dom: container
      });
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const editor = demo.getEditor();
      expect(editor).toBeDefined();
      
      // Check graph starts empty (only root node)
      const model = editor.getModel();
      const nodes = model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root');
      const edges = model.getEdges();
      
      expect(nodes.length).toBe(0); // Empty graph
      expect(edges.length).toBe(0); // No edges
      
      // Verify editor is ready for drag & drop
      expect(demo.getNodeTypes()).toBeDefined();
      expect(Object.keys(demo.getNodeTypes()).length).toBe(6); // 6 node types available
    });
  });
  
  describe('Drag & Drop Functionality', () => {
    beforeEach(async () => {
      demo = NodeTypesDemo.create({
        dom: container
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Mock DataTransfer for drag & drop testing
    function createMockDataTransfer() {
      const data = {};
      return {
        effectAllowed: 'copy',
        dropEffect: 'copy',
        getData: (type) => data[type] || '',
        setData: (type, value) => { data[type] = value; },
        setDragImage: () => {},
        types: [],
        files: []
      };
    }
    
    test('should drag process node from palette and drop on canvas', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const processNode = demoContainer.querySelector('[data-node-type="process"]');
      const editorContainer = demoContainer.querySelector('#editorContainer');
      const svg = editorContainer.querySelector('svg');
      
      // Verify initial state
      expect(processNode).toBeTruthy();
      expect(editorContainer).toBeTruthy();
      expect(svg).toBeTruthy();
      
      const initialNodes = svg.querySelectorAll('g.node').length;
      console.log('Initial nodes in SVG:', initialNodes);
      
      // Create mock data transfer
      const dataTransfer = createMockDataTransfer();
      
      // Simulate drag start
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });
      
      // Manually set the data since jsdom doesn't handle dataTransfer properly
      dataTransfer.setData('nodeType', 'process');
      
      processNode.dispatchEvent(dragStartEvent);
      
      // Verify drag started (element should have dragging class)
      expect(processNode.classList.contains('dragging')).toBe(true);
      
      // Simulate drag over editor
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
        clientX: 300,
        clientY: 200
      });
      
      editorContainer.dispatchEvent(dragOverEvent);
      
      // Simulate drop on canvas
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
        clientX: 300,
        clientY: 200
      });
      
      editorContainer.dispatchEvent(dropEvent);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify new node was created
      const editor = demo.getEditor();
      const model = editor.getModel();
      const newNodeCount = model.getSceneGraph().getAllNodes().length - 1; // Exclude root
      
      expect(newNodeCount).toBe(1); // 0 initial + 1 new
      
      // Check the new node exists in the model
      const allNodes = model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root');
      const newNode = allNodes.find(n => n.getId().startsWith('node'));
      expect(newNode).toBeDefined();
      expect(newNode.getData().type).toBe('process');
      
      // Simulate drag end
      const dragEndEvent = new DragEvent('dragend', {
        bubbles: true
      });
      processNode.dispatchEvent(dragEndEvent);
      
      // Verify drag ended (dragging class removed)
      expect(processNode.classList.contains('dragging')).toBe(false);
    });
    
    test('should drag all 6 node types and create correct nodes', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const editorContainer = demoContainer.querySelector('#editorContainer');
      const editor = demo.getEditor();
      const model = editor.getModel();
      
      const nodeTypes = ['process', 'decision', 'data', 'terminal', 'document', 'database'];
      const initialNodeCount = model.getSceneGraph().getAllNodes().length - 1;
      
      for (let i = 0; i < nodeTypes.length; i++) {
        const nodeType = nodeTypes[i];
        const nodeTypeEl = demoContainer.querySelector(`[data-node-type="${nodeType}"]`);
        expect(nodeTypeEl).toBeTruthy();
        
        // Create drag & drop sequence
        const dataTransfer = createMockDataTransfer();
        dataTransfer.setData('nodeType', nodeType);
        
        // Drag start
        const dragStartEvent = new DragEvent('dragstart', {
          bubbles: true,
          dataTransfer: dataTransfer
        });
        nodeTypeEl.dispatchEvent(dragStartEvent);
        
        // Drop at different positions
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dataTransfer,
          clientX: 100 + (i * 50),
          clientY: 100 + (i * 30)
        });
        editorContainer.dispatchEvent(dropEvent);
        
        // Drag end
        const dragEndEvent = new DragEvent('dragend', { bubbles: true });
        nodeTypeEl.dispatchEvent(dragEndEvent);
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Verify all nodes were created
      const finalNodeCount = model.getSceneGraph().getAllNodes().length - 1;
      expect(finalNodeCount).toBe(initialNodeCount + nodeTypes.length);
      
      // Verify each node type was created correctly
      const allNodes = model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root' && n.getId().startsWith('node'));
      expect(allNodes.length).toBe(nodeTypes.length);
      
      // Check that we have one of each type
      const createdTypes = allNodes.map(node => node.getData().type).sort();
      expect(createdTypes).toEqual(nodeTypes.sort());
    });
    
    test('should handle invalid drag data gracefully', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const editorContainer = demoContainer.querySelector('#editorContainer');
      const editor = demo.getEditor();
      const model = editor.getModel();
      
      const initialNodeCount = model.getSceneGraph().getAllNodes().length - 1;
      
      // Create empty data transfer (no nodeType data)
      const dataTransfer = createMockDataTransfer();
      // Don't set any data
      
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
        clientX: 300,
        clientY: 200
      });
      
      editorContainer.dispatchEvent(dropEvent);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify no node was created
      const finalNodeCount = model.getSceneGraph().getAllNodes().length - 1;
      expect(finalNodeCount).toBe(initialNodeCount);
    });
  });
  
  describe('Properties Panel Live Editing', () => {
    beforeEach(async () => {
      demo = NodeTypesDemo.create({
        dom: container
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    test('should update properties panel when node is selected', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const editor = demo.getEditor();
      const model = editor.getModel();
      const viewModel = editor.getViewModel();
      
      // Get a sample node
      const startNode = model.getSceneGraph().getNodeById('start');
      expect(startNode).toBeDefined();
      
      // Simulate node selection
      viewModel.setSelection({ nodes: [startNode] });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check properties panel updated
      const propertiesContent = demoContainer.querySelector('#propertiesContent');
      expect(propertiesContent.innerHTML).not.toContain('Select a node to edit properties');
      
      // Check property inputs exist
      expect(propertiesContent.querySelector('#nodeLabel')).toBeTruthy();
      expect(propertiesContent.querySelector('#nodeType')).toBeTruthy();
      expect(propertiesContent.querySelector('#nodeX')).toBeTruthy();
      expect(propertiesContent.querySelector('#nodeY')).toBeTruthy();
      
      // Check values are correct
      const labelInput = propertiesContent.querySelector('#nodeLabel');
      const typeSelect = propertiesContent.querySelector('#nodeType');
      
      expect(labelInput.value).toBe('Start');
      expect(typeSelect.value).toBe('terminal');
    });
    
    test('should update node label in real-time when editing', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const editor = demo.getEditor();
      const model = editor.getModel();
      const viewModel = editor.getViewModel();
      
      // Select a node
      const startNode = model.getSceneGraph().getNodeById('start');
      viewModel.setSelection({ nodes: [startNode] });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get label input
      const labelInput = demoContainer.querySelector('#nodeLabel');
      expect(labelInput).toBeTruthy();
      
      // Change the label
      labelInput.value = 'New Start Label';
      const inputEvent = new Event('input', { bubbles: true });
      labelInput.dispatchEvent(inputEvent);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify node label was updated
      expect(startNode.getLabel()).toBe('New Start Label');
    });
    
    test('should update node type and trigger re-rendering', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const editor = demo.getEditor();
      const model = editor.getModel();
      const viewModel = editor.getViewModel();
      
      // Select a node
      const startNode = model.getSceneGraph().getNodeById('start');
      viewModel.setSelection({ nodes: [startNode] });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get type select
      const typeSelect = demoContainer.querySelector('#nodeType');
      expect(typeSelect).toBeTruthy();
      expect(typeSelect.value).toBe('terminal');
      
      // Change the type
      typeSelect.value = 'process';
      const changeEvent = new Event('change', { bubbles: true });
      typeSelect.dispatchEvent(changeEvent);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify node type was updated
      expect(startNode.getData().type).toBe('process');
      
      // Verify size was updated based on type
      const nodeTypes = demo.getNodeTypes();
      const processConfig = nodeTypes.process;
      expect(startNode.getSize().width).toBe(processConfig.defaultSize.width);
      expect(startNode.getSize().height).toBe(processConfig.defaultSize.height);
    });
    
    test('should update node position when editing coordinates', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const editor = demo.getEditor();
      const model = editor.getModel();
      const viewModel = editor.getViewModel();
      
      // Select a node
      const startNode = model.getSceneGraph().getNodeById('start');
      const originalPos = startNode.getPosition();
      viewModel.setSelection({ nodes: [startNode] });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get position inputs
      const xInput = demoContainer.querySelector('#nodeX');
      const yInput = demoContainer.querySelector('#nodeY');
      expect(xInput).toBeTruthy();
      expect(yInput).toBeTruthy();
      
      // Change the position
      xInput.value = '500';
      yInput.value = '300';
      
      const inputEventX = new Event('input', { bubbles: true });
      const inputEventY = new Event('input', { bubbles: true });
      
      xInput.dispatchEvent(inputEventX);
      yInput.dispatchEvent(inputEventY);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify node position was updated
      const newPos = startNode.getPosition();
      expect(newPos.x).toBe(500);
      expect(newPos.y).toBe(300);
      expect(newPos.x).not.toBe(originalPos.x);
      expect(newPos.y).not.toBe(originalPos.y);
    });
  });
  
  describe('Tool Integration', () => {
    beforeEach(async () => {
      demo = NodeTypesDemo.create({
        dom: container
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    test('should switch between select and connect tools', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const selectBtn = demoContainer.querySelector('#selectBtn');
      const connectBtn = demoContainer.querySelector('#connectBtn');
      const editor = demo.getEditor();
      const coordinator = editor.getViewModel().getEventCoordinator();
      
      // Initially select tool should be active
      expect(coordinator.getActiveTool().name).toBe('select');
      expect(selectBtn.classList.contains('primary')).toBe(true);
      expect(connectBtn.classList.contains('primary')).toBe(false);
      
      // Click connect tool
      connectBtn.click();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(coordinator.getActiveTool().name).toBe('connect');
      expect(selectBtn.classList.contains('primary')).toBe(false);
      expect(connectBtn.classList.contains('primary')).toBe(true);
      
      // Switch back to select
      selectBtn.click();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(coordinator.getActiveTool().name).toBe('select');
      expect(selectBtn.classList.contains('primary')).toBe(true);
      expect(connectBtn.classList.contains('primary')).toBe(false);
    });
    
    test('should enable/disable delete button based on selection', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const deleteBtn = demoContainer.querySelector('#deleteBtn');
      const editor = demo.getEditor();
      const model = editor.getModel();
      const viewModel = editor.getViewModel();
      
      // Initially no selection, delete should be disabled
      expect(deleteBtn.disabled).toBe(true);
      
      // Select a node
      const startNode = model.getSceneGraph().getNodeById('start');
      viewModel.setSelection({ nodes: [startNode] });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Delete should now be enabled
      expect(deleteBtn.disabled).toBe(false);
      
      // Clear selection
      viewModel.setSelection({ nodes: [] });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Delete should be disabled again
      expect(deleteBtn.disabled).toBe(true);
    });
  });
  
  describe('Status Updates', () => {
    beforeEach(async () => {
      demo = NodeTypesDemo.create({
        dom: container
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    test('should create SVG node when dragging from palette', async () => {
      const demoContainer = container.querySelector('.node-types-demo');
      const editorContainer = demoContainer.querySelector('#editorContainer');
      const editor = demo.getEditor();
      const model = editor.getModel();
      
      // Wait for initial graph creation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get initial counts
      const initialModelNodes = model.getSceneGraph().getAllNodes().length;
      const svg = editorContainer.querySelector('svg');
      const initialSvgNodes = svg.querySelectorAll('g.node').length;
      
      console.log('BEFORE DROP:');
      console.log('- Model nodes:', initialModelNodes);
      console.log('- SVG nodes:', initialSvgNodes);
      console.log('- SVG innerHTML length:', svg.innerHTML.length);
      
      // Mock DataTransfer for drag & drop
      function createMockDataTransfer() {
        const data = {};
        return {
          effectAllowed: 'copy',
          dropEffect: 'copy',
          getData: (type) => data[type] || '',
          setData: (type, value) => { data[type] = value; },
          setDragImage: () => {},
          types: [],
          files: []
        };
      }
      
      // Simulate drag & drop of process node
      const dataTransfer = createMockDataTransfer();
      dataTransfer.setData('nodeType', 'process');
      
      // Mock getBoundingClientRect for positioning
      editorContainer.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 800, height: 600
      });
      
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
        clientX: 300,
        clientY: 200
      });
      
      console.log('DISPATCHING DROP EVENT...');
      editorContainer.dispatchEvent(dropEvent);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force render to ensure SVG is updated
      editor.getViewModel().render();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check results
      const finalModelNodes = model.getSceneGraph().getAllNodes().length;
      const finalSvgNodes = svg.querySelectorAll('g.node').length;
      
      console.log('AFTER DROP:');
      console.log('- Model nodes:', finalModelNodes);
      console.log('- SVG nodes:', finalSvgNodes);
      console.log('- SVG innerHTML length:', svg.innerHTML.length);
      
      // Check that node was added to model
      expect(finalModelNodes).toBe(initialModelNodes + 1);
      
      // Check that SVG node was created
      expect(finalSvgNodes).toBeGreaterThan(initialSvgNodes);
      
      // Find the new node in the model
      const allNodes = model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root');
      const newNode = allNodes.find(n => n.getId().startsWith('node'));
      expect(newNode).toBeDefined();
      expect(newNode.getData().type).toBe('process');
      expect(newNode.getPosition().x).toBe(300);
      expect(newNode.getPosition().y).toBe(200);
      
      // Check that corresponding SVG element exists
      const svgNode = svg.querySelector(`g[data-node-id="${newNode.getId()}"]`);
      expect(svgNode).toBeTruthy();
      expect(svgNode.querySelector('rect')).toBeTruthy();
      expect(svgNode.querySelector('text')).toBeTruthy();
      
      // Verify positioning in SVG
      const transform = svgNode.getAttribute('transform');
      expect(transform).toMatch(/translate\(300.*,\s*200.*\)/);
      
      console.log('✅ Drag & drop created node successfully');
    });
  });
  
  describe('Component Lifecycle', () => {
    test('should call onMount callback with editor instance', () => {
      let mountCalled = false;
      let mountedInstance = null;
      
      demo = NodeTypesDemo.create({
        dom: container,
        onMount: (instance) => {
          mountCalled = true;
          mountedInstance = instance;
        }
      });
      
      expect(mountCalled).toBe(true);
      expect(mountedInstance).toBe(demo);
      expect(mountedInstance.getEditor()).toBeDefined();
      expect(mountedInstance.getNodeTypes()).toBeDefined();
    });
    
    test('should call onDestroy callback', () => {
      let destroyCalled = false;
      let destroyedInstance = null;
      
      demo = NodeTypesDemo.create({
        dom: container,
        onDestroy: (instance) => {
          destroyCalled = true;
          destroyedInstance = instance;
        }
      });
      
      demo.destroy();
      
      expect(destroyCalled).toBe(true);
      expect(destroyedInstance).toBe(demo);
    });
    
    test('should clean up properly on destroy', () => {
      demo = NodeTypesDemo.create({
        dom: container
      });
      
      // Check component is mounted
      const demoContainer = container.querySelector('.node-types-demo');
      expect(demoContainer).toBeTruthy();
      
      // Destroy the component
      demo.destroy();
      
      // Check cleanup
      const cleanedContainer = container.querySelector('.node-types-demo');
      expect(cleanedContainer).toBeFalsy();
    });
  });
  
  describe('Error Handling', () => {
    test('should handle missing DOM gracefully', () => {
      expect(() => {
        NodeTypesDemo.create({
          dom: null
        });
      }).toThrow();
    });
    
    test('should handle editor initialization errors gracefully', () => {
      const invalidContainer = document.createElement('span');
      
      let demo;
      expect(() => {
        demo = NodeTypesDemo.create({
          dom: invalidContainer
        });
      }).not.toThrow();
      
      if (demo) {
        demo.destroy();
      }
    });
  });
});