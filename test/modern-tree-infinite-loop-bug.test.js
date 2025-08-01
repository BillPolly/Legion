/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('ModernTree Infinite Loop Bug Reproduction', () => {
  let container;
  let tree;
  let sampleData;
  let renderCallCount;
  let originalRender;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '600px';
    container.style.height = '400px';
    document.body.appendChild(container);
    
    sampleData = [
      {
        id: 'documents',
        name: '📁 Documents',
        children: [
          { id: 'file1', name: '📄 Important File.txt' }
        ]
      },
      {
        id: 'settings',
        name: '⚙️ System Settings'
      }
    ];
    
    renderCallCount = 0;
  });

  afterEach(() => {
    if (tree) {
      tree.destroy();
      tree = null;
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  test('should reproduce infinite render loop when editing starts', async () => {
    console.log('=== INFINITE LOOP BUG REPRODUCTION TEST ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Intercept render calls to count them
    originalRender = tree.view.render;
    tree.view.render = function() {
      renderCallCount++;
      console.log(`🔄 Render call #${renderCallCount}`);
      
      // Prevent infinite loop in test by limiting calls
      if (renderCallCount > 10) {
        console.log('❌ INFINITE LOOP DETECTED - stopping test');
        return;
      }
      
      return originalRender.call(this);
    };

    console.log('Initial render calls:', renderCallCount);
    expect(renderCallCount).toBe(0);

    // Find the documents node and its content span
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    expect(documentsNode).toBeTruthy();
    
    const contentSpan = documentsNode.querySelector('.node-content');
    expect(contentSpan).toBeTruthy();
    
    console.log('About to click on content span to start editing...');
    
    // Click on the content span to start editing
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    contentSpan.dispatchEvent(clickEvent);
    
    // Wait for any async operations
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('Total render calls after click:', renderCallCount);
    
    // Check if we have an infinite loop (more than 5 render calls is suspicious)
    if (renderCallCount > 5) {
      console.log('❌ INFINITE LOOP BUG CONFIRMED');
      console.log('Render was called', renderCallCount, 'times');
      
      // Check if input exists
      const editingInput = container.querySelector('.tree-node-label-input');
      console.log('Editing input exists:', !!editingInput);
      
      // This test should fail to demonstrate the bug
      fail(`Infinite loop detected: render() called ${renderCallCount} times when starting edit. Expected <= 2 calls.`);
    } else {
      console.log('✅ No infinite loop detected');
      
      // Verify editing input exists
      const editingInput = container.querySelector('.tree-node-label-input');
      expect(editingInput).toBeTruthy();
      console.log('✅ Editing input created successfully');
    }
  });

  test('should identify what triggers the infinite renders', async () => {
    console.log('=== RENDER TRIGGER ANALYSIS ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Track what's calling render
    const renderSources = [];
    originalRender = tree.view.render;
    tree.view.render = function() {
      const stack = new Error().stack;
      const caller = stack.split('\n')[2]; // Get the calling line
      renderSources.push(caller);
      console.log(`🔄 Render called from: ${caller}`);
      
      if (renderSources.length > 10) {
        console.log('❌ Too many renders, stopping to prevent infinite loop');
        return;
      }
      
      return originalRender.call(this);
    };

    // Start editing
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    const contentSpan = documentsNode.querySelector('.node-content');
    
    contentSpan.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Render call sources:');
    renderSources.forEach((source, i) => {
      console.log(`${i + 1}. ${source}`);
    });
    
    // Analyze the sources
    const uniqueSources = [...new Set(renderSources)];
    console.log('Unique render sources:', uniqueSources.length);
    
    if (renderSources.length > 5) {
      console.log('❌ ANALYSIS: Multiple renders detected');
      console.log('This suggests something is triggering renders in a loop');
    }
  });

  test('should track editing state during the loop', async () => {
    console.log('=== EDITING STATE TRACKING ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Track editing state during renders
    const stateSnapshots = [];
    originalRender = tree.view.render;
    tree.view.render = function() {
      const snapshot = {
        renderCall: stateSnapshots.length + 1,
        editingNodeId: tree.viewModel.editingNodeId,
        editingInput: !!tree.viewModel.editingInput,
        inputInDOM: !!document.querySelector('.tree-node-label-input'),
        timestamp: Date.now()
      };
      stateSnapshots.push(snapshot);
      console.log(`🔄 Render #${snapshot.renderCall}:`, snapshot);
      
      if (stateSnapshots.length > 10) {
        console.log('❌ Stopping to prevent infinite loop');
        return;
      }
      
      return originalRender.call(this);
    };

    // Start editing
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    const contentSpan = documentsNode.querySelector('.node-content');
    
    console.log('Starting edit...');
    contentSpan.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('State progression:');
    stateSnapshots.forEach(snapshot => {
      console.log(`Render ${snapshot.renderCall}: editing=${snapshot.editingNodeId}, inputExists=${snapshot.inputInDOM}`);
    });
    
    // Analyze the pattern
    if (stateSnapshots.length > 1) {
      const firstState = stateSnapshots[0];
      const lastState = stateSnapshots[stateSnapshots.length - 1];
      
      console.log('First render state:', firstState);
      console.log('Last render state:', lastState);
      
      if (firstState.editingNodeId !== lastState.editingNodeId) {
        console.log('❌ ISSUE: Editing state changed between renders');
      }
      
      if (firstState.inputInDOM && !lastState.inputInDOM) {
        console.log('❌ ISSUE: Input disappeared from DOM during renders');
      }
    }
  });
});