/**
 * CollapsibleSectionComponent - Reusable MVVM component for collapsible sections
 * Handles the fold-away triangle and content visibility
 */

export class CollapsibleSectionComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      title: options.title || 'Section',
      defaultExpanded: options.defaultExpanded !== false,
      icon: options.icon || '📋',
      ...options
    };
    
    // Model
    this.model = {
      isExpanded: this.options.defaultExpanded,
      content: null
    };
    
    // View elements
    this.elements = {};
    
    this.render();
  }
  
  setContent(content) {
    this.model.content = content;
    this.renderContent();
  }
  
  toggle() {
    this.model.isExpanded = !this.model.isExpanded;
    this.render();
  }
  
  expand() {
    this.model.isExpanded = true;
    this.render();
  }
  
  collapse() {
    this.model.isExpanded = false;
    this.render();
  }
  
  render() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create main container
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'collapsible-section';
    
    // Header with triangle and title
    const header = document.createElement('div');
    header.className = 'collapsible-header';
    header.style.cursor = 'pointer';
    
    const triangle = document.createElement('span');
    triangle.className = 'collapsible-triangle';
    triangle.textContent = this.model.isExpanded ? '▼' : '▶️';
    
    const title = document.createElement('h4');
    title.textContent = `${this.options.icon} ${this.options.title}`;
    title.style.display = 'inline';
    title.style.marginLeft = '8px';
    
    header.appendChild(triangle);
    header.appendChild(title);
    
    // Add click handler
    header.addEventListener('click', () => this.toggle());
    
    sectionDiv.appendChild(header);
    
    // Content container (only show if expanded)
    if (this.model.isExpanded) {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'collapsible-content';
      this.elements.contentContainer = contentDiv;
      
      // Add existing content if any
      this.renderContent();
      
      sectionDiv.appendChild(contentDiv);
    }
    
    this.container.appendChild(sectionDiv);
    
    // Store references
    this.elements.container = sectionDiv;
    this.elements.header = header;
    this.elements.triangle = triangle;
  }
  
  renderContent() {
    if (!this.elements.contentContainer || !this.model.content) {
      return;
    }
    
    // Clear existing content
    this.elements.contentContainer.innerHTML = '';
    
    // Add new content
    if (typeof this.model.content === 'string') {
      this.elements.contentContainer.innerHTML = this.model.content;
    } else if (this.model.content instanceof HTMLElement) {
      this.elements.contentContainer.appendChild(this.model.content);
    }
  }
}