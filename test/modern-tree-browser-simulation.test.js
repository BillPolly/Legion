/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

// Mock browser behaviors that might differ from jsdom
beforeAll(() => {
  // Mock focus/blur events that might trigger in real browsers
  const originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function() {
    console.log('🔍 FOCUS called on:', this.tagName, this.className);
    
    // Trigger focus event
    this.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    
    // Set as active element
    Object.defineProperty(document, 'activeElement', {
      get: () => this,
      configurable: true
    });
    
    return originalFocus.call(this);
  };

  // Mock CSS transitions that might trigger reflows
  Object.defineProperty(window, 'getComputedStyle', {
    value: (element) => ({
      cursor: element.style.cursor || 'default',
      display: element.style.display || 'block',
      position: element.style.position || 'static'
    })
  });

  // Mock ResizeObserver that might be watching elements
  global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe(element) {
      console.log('🔍 ResizeObserver observing:', element.tagName);
      // Simulate resize event after DOM changes
      setTimeout(() => {
        this.callback([{ target: element }]);
      }, 10);
    }
    unobserve() {}
    disconnect() {}
  };

  // Mock MutationObserver that might be watching DOM changes
  const originalMutationObserver = global.MutationObserver;
  global.MutationObserver = class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.observing = false;
    }
    observe(target, options) {
      console.log('🔍 MutationObserver observing:', target.tagName);
      this.observing = true;
      this.target = target;
      
      // Mock mutations when content changes
      const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      Object.defineProperty(target, 'innerHTML', {
        set: (value) => {
          console.log('🔍 innerHTML changed, triggering mutation');
          originalInnerHTML.set.call(target, value);
          if (this.observing) {
            setTimeout(() => {
              this.callback([{
                type: 'childList',
                target: target,
                addedNodes: target.childNodes,
                removedNodes: []
              }]);
            }, 5);
          }
        },
        get: () => originalInnerHTML.get.call(target)
      });
    }
    disconnect() {
      this.observing = false;
    }
  };
});

describe('ModernTree Browser Behavior Simulation', () => {
  let container;
  let tree;
  let sampleData;
  let renderCalls;

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
      }
    ];
    
    renderCalls = [];
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

  test('should simulate browser focus/blur cycles that might cause infinite renders', async () => {
    console.log('=== BROWSER FOCUS/BLUR SIMULATION ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Track render calls with full context
    const originalRender = tree.view.render;
    tree.view.render = function() {
      renderCalls.push({
        call: renderCalls.length + 1,
        timestamp: Date.now(),
        editingState: tree.viewModel.editingNodeId,
        inputExists: !!document.querySelector('.tree-node-label-input'),
        activeElement: document.activeElement?.tagName || 'none',
        stack: new Error().stack.split('\n').slice(1, 5) // Get calling functions
      });
      
      console.log(`🔄 Render call #${renderCalls.length}:`, renderCalls[renderCalls.length - 1]);
      
      if (renderCalls.length > 15) {
        console.log('❌ INFINITE LOOP DETECTED - stopping');
        throw new Error(`Infinite render loop detected: ${renderCalls.length} calls`);
      }
      
      return originalRender.call(this);
    };

    // Start editing
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    const contentSpan = documentsNode.querySelector('.node-content');
    
    console.log('Starting edit with focus simulation...');
    contentSpan.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Wait for initial edit setup
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Simulate browser focus/blur cycles that might happen
    const input = document.querySelector('.tree-node-label-input');
    if (input) {
      console.log('Simulating browser focus/blur cycles...');
      
      // Simulate rapid focus/blur that browsers sometimes do
      for (let i = 0; i < 3; i++) {
        input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 10));
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Final focus
      input.focus();
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log(`Total render calls: ${renderCalls.length}`);
    
    if (renderCalls.length > 5) {
      console.log('❌ EXCESSIVE RENDERS DETECTED');
      renderCalls.forEach((call, i) => {
        console.log(`Render ${i + 1}:`, {
          editing: call.editingState,
          inputExists: call.inputExists,
          activeElement: call.activeElement
        });
      });
    }
    
    // This should fail if we reproduce the infinite loop
    expect(renderCalls.length).toBeLessThanOrEqual(5);
  });

  test('should simulate DOM mutations that might trigger re-renders', async () => {
    console.log('=== DOM MUTATION SIMULATION ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Set up mutation tracking
    let mutationCount = 0;
    const observer = new MutationObserver((mutations) => {
      mutationCount++;
      console.log(`🔍 Mutation #${mutationCount}:`, mutations.length, 'changes');
      
      // This might trigger renders in real browsers
      if (tree && !tree.destroyed) {
        console.log('🔄 Mutation might trigger render...');
        // Don't actually trigger render here, just log
      }
    });
    
    observer.observe(container, { 
      childList: true, 
      subtree: true, 
      attributes: true 
    });

    // Track renders
    const originalRender = tree.view.render;
    tree.view.render = function() {
      renderCalls.push({
        call: renderCalls.length + 1,
        mutationCount: mutationCount
      });
      
      console.log(`🔄 Render call #${renderCalls.length} (after ${mutationCount} mutations)`);
      
      if (renderCalls.length > 10) {
        throw new Error('Infinite render loop from mutations');
      }
      
      return originalRender.call(this);
    };

    // Start editing (this will cause DOM mutations)
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    const contentSpan = documentsNode.querySelector('.node-content');
    
    contentSpan.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Wait for mutations to settle
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log(`Final: ${renderCalls.length} renders, ${mutationCount} mutations`);
    
    observer.disconnect();
    
    // Check if mutations caused excessive renders
    expect(renderCalls.length).toBeLessThanOrEqual(3);
  });

  test('should check if BaseView or BaseViewModel has event listeners causing loops', async () => {
    console.log('=== BASE CLASS EVENT LISTENER ANALYSIS ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Intercept all event listener additions
    const eventListeners = [];
    const originalAddEventListener = Element.prototype.addEventListener;
    Element.prototype.addEventListener = function(type, listener, options) {
      eventListeners.push({
        element: this.tagName + (this.className ? '.' + this.className : ''),
        event: type,
        listenerName: listener.name || 'anonymous'
      });
      
      console.log(`📡 Event listener added: ${type} on ${this.tagName}`);
      return originalAddEventListener.call(this, type, listener, options);
    };

    // Track renders
    const originalRender = tree.view.render;
    tree.view.render = function() {
      renderCalls.push({ call: renderCalls.length + 1 });
      console.log(`🔄 Render call #${renderCalls.length}`);
      
      if (renderCalls.length > 8) {
        console.log('Event listeners that might be causing loop:');
        eventListeners.forEach(el => {
          console.log(`- ${el.event} on ${el.element} (${el.listenerName})`);
        });
        throw new Error('Infinite render loop - check event listeners');
      }
      
      return originalRender.call(this);
    };

    // Start editing
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    const contentSpan = documentsNode.querySelector('.node-content');
    
    contentSpan.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('Event listeners registered:');
    eventListeners.forEach(el => {
      console.log(`- ${el.event} on ${el.element}`);
    });
    
    // Restore original
    Element.prototype.addEventListener = originalAddEventListener;
    
    expect(renderCalls.length).toBeLessThanOrEqual(3);
  });
});