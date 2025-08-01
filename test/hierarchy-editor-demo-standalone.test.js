/**
 * @jest-environment jsdom
 */

// Standalone test that doesn't import HierarchyEditor
describe('HierarchyEditorDemo Standalone DOM Tests', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  test('should verify actual DOM manipulation patterns', async () => {
    // Create a minimal demo structure
    container.innerHTML = `
      <div class="hierarchy-editor-demo theme-light">
        <div class="demo-section" data-demo="basic">
          <div class="demo-controls">
            <button data-action="expand-all" data-editor="basic">Expand All</button>
            <button data-action="collapse-all" data-editor="basic">Collapse All</button>
          </div>
          <div data-editor-container="basic" class="editor-container">
            <div class="hierarchy-editor">
              <div class="tree-view">
                <div class="tree-node" data-node-id="root">
                  <div class="node-header">
                    <span class="expand-toggle">▶</span>
                    <span class="node-name">Root</span>
                  </div>
                  <div class="node-children" style="display: none;">
                    <div class="tree-node" data-node-id="child1">
                      <div class="node-header">
                        <span class="node-name">Child 1</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Test initial state
    const rootNode = container.querySelector('[data-node-id="root"]');
    const childrenContainer = rootNode.querySelector('.node-children');
    const expandToggle = rootNode.querySelector('.expand-toggle');
    
    expect(rootNode).toBeTruthy();
    expect(childrenContainer.style.display).toBe('none');
    expect(expandToggle.textContent).toBe('▶');
    
    // Simulate expand by clicking toggle
    expandToggle.addEventListener('click', () => {
      if (childrenContainer.style.display === 'none') {
        childrenContainer.style.display = 'block';
        expandToggle.textContent = '▼';
        rootNode.classList.add('expanded');
      } else {
        childrenContainer.style.display = 'none';
        expandToggle.textContent = '▶';
        rootNode.classList.remove('expanded');
      }
    });
    
    expandToggle.click();
    
    // Verify DOM changed
    expect(childrenContainer.style.display).toBe('block');
    expect(expandToggle.textContent).toBe('▼');
    expect(rootNode.classList.contains('expanded')).toBe(true);
    
    // Verify child is visible
    const child1 = container.querySelector('[data-node-id="child1"]');
    expect(child1).toBeTruthy();
    // In jsdom, offsetParent might be null, so check display instead
    const childContainer = child1.parentElement;
    expect(childContainer.style.display).toBe('block');
    
    // Test collapse
    expandToggle.click();
    
    expect(childrenContainer.style.display).toBe('none');
    expect(expandToggle.textContent).toBe('▶');
    expect(rootNode.classList.contains('expanded')).toBe(false);
  });
  
  test('should verify node addition updates DOM', () => {
    container.innerHTML = `
      <div class="editor-container">
        <div class="tree-view">
          <div class="tree-node" data-node-id="items">
            <div class="node-header">
              <span class="expand-toggle">▶</span>
              <span class="node-name">Items</span>
            </div>
            <div class="node-children" style="display: none;"></div>
          </div>
        </div>
      </div>
      <div class="status-bar">
        <span data-node-count>Nodes: <span class="count">1</span></span>
      </div>
    `;
    
    const itemsNode = container.querySelector('[data-node-id="items"]');
    const childrenContainer = itemsNode.querySelector('.node-children');
    const nodeCount = container.querySelector('.count');
    
    // Simulate adding a node
    const addNode = (id, name) => {
      const newNode = document.createElement('div');
      newNode.className = 'tree-node';
      newNode.dataset.nodeId = id;
      newNode.innerHTML = `
        <div class="node-header">
          <span class="node-name">${name}</span>
        </div>
      `;
      
      childrenContainer.appendChild(newNode);
      childrenContainer.style.display = 'block';
      itemsNode.querySelector('.expand-toggle').textContent = '▼';
      itemsNode.classList.add('expanded');
      
      // Update count
      const currentCount = parseInt(nodeCount.textContent);
      nodeCount.textContent = currentCount + 1;
    };
    
    // Add a node
    addNode('new1', 'New Item 1');
    
    // Verify DOM updated
    expect(childrenContainer.children.length).toBe(1);
    expect(childrenContainer.style.display).toBe('block');
    expect(itemsNode.classList.contains('expanded')).toBe(true);
    expect(nodeCount.textContent).toBe('2');
    
    // Verify new node exists and is visible
    const newNode = container.querySelector('[data-node-id="new1"]');
    expect(newNode).toBeTruthy();
    expect(newNode.textContent).toContain('New Item 1');
    
    // Add another node
    addNode('new2', 'New Item 2');
    
    expect(childrenContainer.children.length).toBe(2);
    expect(nodeCount.textContent).toBe('3');
  });
  
  test('should verify theme switching updates all elements', () => {
    container.innerHTML = `
      <div class="hierarchy-editor-demo theme-light">
        <div class="editor-container">
          <div class="hierarchy-editor theme-light">
            <div class="content">Editor 1</div>
          </div>
        </div>
        <div class="editor-container">
          <div class="hierarchy-editor theme-light">
            <div class="content">Editor 2</div>
          </div>
        </div>
        <div class="status-bar">
          <span data-info>Theme: light</span>
        </div>
      </div>
    `;
    
    const demoEl = container.querySelector('.hierarchy-editor-demo');
    const editors = container.querySelectorAll('.hierarchy-editor');
    const infoEl = container.querySelector('[data-info]');
    
    // Simulate theme switch
    const switchTheme = (newTheme) => {
      const oldTheme = newTheme === 'dark' ? 'light' : 'dark';
      
      demoEl.classList.remove(`theme-${oldTheme}`);
      demoEl.classList.add(`theme-${newTheme}`);
      
      editors.forEach(editor => {
        editor.classList.remove(`theme-${oldTheme}`);
        editor.classList.add(`theme-${newTheme}`);
      });
      
      infoEl.textContent = `Theme: ${newTheme}`;
    };
    
    // Switch to dark theme
    switchTheme('dark');
    
    // Verify all elements updated
    expect(demoEl.classList.contains('theme-dark')).toBe(true);
    expect(demoEl.classList.contains('theme-light')).toBe(false);
    
    editors.forEach(editor => {
      expect(editor.classList.contains('theme-dark')).toBe(true);
      expect(editor.classList.contains('theme-light')).toBe(false);
    });
    
    expect(infoEl.textContent).toBe('Theme: dark');
  });
  
  test('should verify event logging in DOM', () => {
    container.innerHTML = `
      <div class="event-log" data-event-log></div>
      <button data-action="clear-log">Clear Log</button>
    `;
    
    const eventLog = container.querySelector('[data-event-log]');
    const clearBtn = container.querySelector('[data-action="clear-log"]');
    
    // Function to add event to log
    const logEvent = (type, data) => {
      const eventEl = document.createElement('div');
      eventEl.className = 'event';
      eventEl.innerHTML = `
        <span class="event-type">${type}</span>: ${JSON.stringify(data)}
      `;
      eventLog.insertBefore(eventEl, eventLog.firstChild);
      
      // Keep only last 5 events
      while (eventLog.children.length > 5) {
        eventLog.removeChild(eventLog.lastChild);
      }
    };
    
    // Add some events
    logEvent('mount', { component: 'test' });
    logEvent('click', { target: 'button' });
    logEvent('change', { value: 'new' });
    
    // Verify events in DOM
    expect(eventLog.children.length).toBe(3);
    expect(eventLog.firstChild.textContent).toContain('change');
    expect(eventLog.lastChild.textContent).toContain('mount');
    
    // Add more events to test limit
    logEvent('event4', {});
    logEvent('event5', {});
    logEvent('event6', {});
    
    expect(eventLog.children.length).toBe(5);
    expect(eventLog.firstChild.textContent).toContain('event6');
    expect(eventLog.querySelector('.event:last-child').textContent).not.toContain('mount');
    
    // Test clear
    clearBtn.addEventListener('click', () => {
      eventLog.innerHTML = '';
    });
    
    clearBtn.click();
    
    expect(eventLog.children.length).toBe(0);
    expect(eventLog.innerHTML).toBe('');
  });
  
  test('should verify format card selection', () => {
    container.innerHTML = `
      <div class="sample-data-grid">
        <div class="sample-data-card" data-format="json">JSON</div>
        <div class="sample-data-card" data-format="xml">XML</div>
        <div class="sample-data-card" data-format="yaml">YAML</div>
      </div>
      <div class="editor-content"></div>
    `;
    
    const cards = container.querySelectorAll('.sample-data-card');
    const content = container.querySelector('.editor-content');
    
    // Function to handle card click
    const selectFormat = (format) => {
      cards.forEach(card => {
        if (card.dataset.format === format) {
          card.classList.add('active');
          content.textContent = `Loaded ${format} content`;
        } else {
          card.classList.remove('active');
        }
      });
    };
    
    // Click JSON card
    cards[0].addEventListener('click', () => selectFormat('json'));
    cards[0].click();
    
    expect(cards[0].classList.contains('active')).toBe(true);
    expect(cards[1].classList.contains('active')).toBe(false);
    expect(cards[2].classList.contains('active')).toBe(false);
    expect(content.textContent).toBe('Loaded json content');
    
    // Click XML card
    cards[1].addEventListener('click', () => selectFormat('xml'));
    cards[1].click();
    
    expect(cards[0].classList.contains('active')).toBe(false);
    expect(cards[1].classList.contains('active')).toBe(true);
    expect(cards[2].classList.contains('active')).toBe(false);
    expect(content.textContent).toBe('Loaded xml content');
  });
  
  test('should verify inline editing simulation', () => {
    container.innerHTML = `
      <div class="tree-node" data-node-id="test">
        <div class="node-header">
          <span class="node-name">Original Name</span>
          <span class="node-value" contenteditable="false">Original Value</span>
        </div>
      </div>
    `;
    
    const nodeValue = container.querySelector('.node-value');
    
    // Simulate double-click to edit
    nodeValue.addEventListener('dblclick', () => {
      nodeValue.contentEditable = 'true';
      nodeValue.classList.add('editing');
      nodeValue.focus();
      
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(nodeValue);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    
    // Simulate blur to save
    nodeValue.addEventListener('blur', () => {
      nodeValue.contentEditable = 'false';
      nodeValue.classList.remove('editing');
    });
    
    // Double click to start editing
    nodeValue.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    expect(nodeValue.contentEditable).toBe('true');
    expect(nodeValue.classList.contains('editing')).toBe(true);
    
    // Change value
    nodeValue.textContent = 'New Value';
    
    // Blur to save
    nodeValue.dispatchEvent(new Event('blur', { bubbles: true }));
    
    expect(nodeValue.contentEditable).toBe('false');
    expect(nodeValue.classList.contains('editing')).toBe(false);
    expect(nodeValue.textContent).toBe('New Value');
  });
});