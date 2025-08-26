/**
 * ThinkingComponent - MVVM Component for displaying progressive thinking/processing steps
 * Can be reused for planning, tool discovery, or any multi-step process
 */

export class ThinkingComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      title: options.title || '🧠 Processing',
      showProgress: options.showProgress !== false,
      ...options
    };
    
    // Model
    this.model = {
      steps: [],
      isActive: false,
      currentStep: null,
      error: null,
      isCollapsed: false
    };
    
    // View elements
    this.elements = {};
    
    this.render();
  }
  
  start(title) {
    this.model.isActive = true;
    this.model.steps = [];
    this.model.currentStep = null;
    this.model.error = null;
    if (title) this.options.title = title;
    this.render();
  }
  
  addStep(message, type = 'info') {
    const step = {
      id: Date.now() + Math.random(),
      message,
      type, // 'info', 'success', 'error', 'warning'
      timestamp: new Date().toLocaleTimeString(),
      completed: type === 'success'
    };
    
    this.model.steps.push(step);
    this.model.currentStep = step;
    this.render();
  }
  
  complete(finalMessage) {
    if (finalMessage) {
      this.addStep(finalMessage, 'success');
    }
    this.model.isActive = false;
    this.model.currentStep = null;
    this.render();
  }
  
  error(errorMessage) {
    this.addStep(errorMessage, 'error');
    this.model.isActive = false;
    this.model.error = errorMessage;
    this.render();
  }
  
  clear() {
    this.model.steps = [];
    this.model.isActive = false;
    this.model.currentStep = null;
    this.model.error = null;
    this.render();
  }
  
  toggleCollapse() {
    this.model.isCollapsed = !this.model.isCollapsed;
    this.render();
  }
  
  render() {
    // Clear container
    this.container.innerHTML = '';
    
    if (this.model.steps.length === 0 && !this.model.isActive) {
      return; // Don't show anything if no steps
    }
    
    // Create main container
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = `thinking-component ${this.model.isActive ? 'active' : 'completed'}`;
    
    // Header
    const header = document.createElement('div');
    header.className = 'thinking-header';
    header.style.cursor = 'pointer';
    
    const collapseIcon = document.createElement('span');
    collapseIcon.className = 'thinking-collapse-icon';
    collapseIcon.textContent = this.model.isCollapsed ? '▶️' : '▼';
    header.appendChild(collapseIcon);
    
    const title = document.createElement('h4');
    title.textContent = this.options.title;
    title.style.display = 'inline';
    title.style.marginLeft = '8px';
    header.appendChild(title);
    
    if (this.model.isActive && this.options.showProgress) {
      const spinner = document.createElement('div');
      spinner.className = 'thinking-spinner';
      header.appendChild(spinner);
    }
    
    // Add click event for collapse/expand
    header.addEventListener('click', () => this.toggleCollapse());
    
    thinkingDiv.appendChild(header);
    
    // Steps container (only show if not collapsed)
    let stepsContainer = null;
    if (!this.model.isCollapsed) {
      stepsContainer = document.createElement('div');
      stepsContainer.className = 'thinking-steps';
      
      this.model.steps.forEach(step => {
        const stepElement = this.createStepElement(step);
        stepsContainer.appendChild(stepElement);
      });
      
      thinkingDiv.appendChild(stepsContainer);
    }
    this.container.appendChild(thinkingDiv);
    
    // Store references
    this.elements.container = thinkingDiv;
    this.elements.header = header;
    this.elements.stepsContainer = stepsContainer;
  }
  
  createStepElement(step) {
    const stepDiv = document.createElement('div');
    stepDiv.className = `thinking-step thinking-step-${step.type}`;
    
    const icon = document.createElement('span');
    icon.className = 'thinking-step-icon';
    icon.textContent = this.getStepIcon(step.type);
    
    const message = document.createElement('span');
    message.className = 'thinking-step-message';
    message.textContent = step.message;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'thinking-step-timestamp';
    timestamp.textContent = step.timestamp;
    
    stepDiv.appendChild(icon);
    stepDiv.appendChild(message);
    stepDiv.appendChild(timestamp);
    
    return stepDiv;
  }
  
  getStepIcon(type) {
    const icons = {
      info: '🔍',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      progress: '⏳'
    };
    return icons[type] || '📝';
  }
}