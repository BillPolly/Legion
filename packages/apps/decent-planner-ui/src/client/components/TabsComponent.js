/**
 * TabsComponent - MVVM Implementation for tab navigation
 * Properly maintains element references and state
 */

export class TabsComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      tabs: options.tabs || [],
      activeTab: options.activeTab || (options.tabs?.[0]?.id || null),
      onTabChange: options.onTabChange || (() => {})
    };
    
    // View elements
    this.elements = {};
    
    this.render();
    this.attachEventListeners();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="tabs-container">
        <div class="tabs-nav">
          ${this.model.tabs.map(tab => `
            <button 
              class="tab-btn ${this.model.activeTab === tab.id ? 'active' : ''}"
              data-tab-id="${tab.id}"
              ${tab.disabled ? 'disabled' : ''}
            >
              ${tab.icon || ''} ${tab.label}
            </button>
          `).join('')}
        </div>
        <div class="tabs-content">
          ${this.model.tabs.map(tab => `
            <div 
              class="tab-panel ${this.model.activeTab === tab.id ? 'active' : 'hidden'}"
              data-panel-id="${tab.id}"
            >
              <div id="${tab.id}-content"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Store element references
    this.elements.buttons = this.container.querySelectorAll('.tab-btn');
    this.elements.panels = this.container.querySelectorAll('.tab-panel');
  }
  
  attachEventListeners() {
    this.elements.buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tabId;
        if (tabId && !e.target.disabled) {
          this.switchTab(tabId);
        }
      });
    });
  }
  
  switchTab(tabId) {
    if (this.model.activeTab === tabId) return;
    
    this.model.activeTab = tabId;
    
    // Update UI
    this.elements.buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tabId === tabId);
    });
    
    this.elements.panels.forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panelId === tabId);
      panel.classList.toggle('hidden', panel.dataset.panelId !== tabId);
    });
    
    // Callback
    this.model.onTabChange(tabId);
  }
  
  getContentContainer(tabId) {
    return this.container.querySelector(`#${tabId}-content`);
  }
  
  enableTab(tabId, enabled = true) {
    const button = Array.from(this.elements.buttons).find(
      btn => btn.dataset.tabId === tabId
    );
    if (button) {
      button.disabled = !enabled;
    }
  }
  
  updateTabLabel(tabId, label) {
    const button = Array.from(this.elements.buttons).find(
      btn => btn.dataset.tabId === tabId
    );
    if (button) {
      const tab = this.model.tabs.find(t => t.id === tabId);
      if (tab) {
        button.innerHTML = `${tab.icon || ''} ${label}`;
      }
    }
  }
}