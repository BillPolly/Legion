import { Window } from '/Legion/components/window/index.js';

/**
 * ArtifactDebugView - Debug panel for monitoring artifacts
 * 
 * Displays a live view of all artifacts in the system with their
 * labels, descriptions, and metadata. Allows clicking to view full content.
 */
export class ArtifactDebugView {
  constructor(container, artifactViewer) {
    this.container = container;
    this.artifactViewer = artifactViewer; // Reference to existing ArtifactViewer
    this.window = null;
    this.contentArea = null;
    this.artifactListElement = null;
    this.artifacts = new Map(); // artifactId -> artifact
    
    // UI state
    this.sortBy = 'created'; // created, label, type
    this.filterText = '';
    
    // Position for debug window
    this.position = { x: 850, y: 50 };
  }
  
  /**
   * Show the artifact debug window
   */
  show() {
    if (this.window) {
      this.window.show();
      return;
    }
    
    this.createWindow();
    this.createUI();
    this.updateArtifactList();
  }
  
  /**
   * Create the debug window
   */
  createWindow() {
    this.window = Window.create({
      dom: this.container,
      title: '🔍 Artifact Debug',
      width: 400,
      height: 600,
      position: this.position,
      theme: 'dark',
      resizable: true,
      draggable: true,
      onClose: () => {
        console.log('Artifact debug window closed');
        this.window = null;
        this.contentArea = null;
        this.artifactListElement = null;
      },
      onResize: (width, height) => {
        console.log(`Artifact debug window resized to ${width}x${height}`);
      }
    });
    
    this.contentArea = this.window.contentElement;
    
    // Style the content area
    this.contentArea.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #0d1117;
      color: #e0e0e0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
      font-size: 13px;
    `;
  }
  
  /**
   * Create the UI components
   */
  createUI() {
    // Header with controls
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px;
      border-bottom: 1px solid #30363d;
      background: #161b22;
      flex-shrink: 0;
    `;
    
    // Search/filter input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Filter artifacts...';
    searchInput.style.cssText = `
      width: 100%;
      padding: 6px 10px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #c9d1d9;
      font-size: 13px;
      outline: none;
    `;
    searchInput.addEventListener('input', (e) => {
      this.filterText = e.target.value.toLowerCase();
      this.updateArtifactList();
    });
    
    // Sort controls
    const sortContainer = document.createElement('div');
    sortContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
    `;
    
    const sortLabel = document.createElement('span');
    sortLabel.textContent = 'Sort by:';
    sortLabel.style.color = '#8b949e';
    
    const sortOptions = ['created', 'label', 'type'];
    const sortButtons = sortOptions.map(option => {
      const btn = document.createElement('button');
      btn.textContent = option.charAt(0).toUpperCase() + option.slice(1);
      btn.style.cssText = `
        padding: 4px 8px;
        background: ${this.sortBy === option ? '#1f6feb' : '#21262d'};
        border: 1px solid ${this.sortBy === option ? '#388bfd' : '#30363d'};
        border-radius: 4px;
        color: ${this.sortBy === option ? '#ffffff' : '#c9d1d9'};
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s ease;
      `;
      
      btn.addEventListener('click', () => {
        this.sortBy = option;
        this.updateSortButtons(sortButtons, sortOptions);
        this.updateArtifactList();
      });
      
      return btn;
    });
    
    sortContainer.appendChild(sortLabel);
    sortButtons.forEach(btn => sortContainer.appendChild(btn));
    
    header.appendChild(searchInput);
    header.appendChild(sortContainer);
    
    // Artifact list container
    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;
    
    this.artifactListElement = document.createElement('div');
    this.artifactListElement.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    
    listContainer.appendChild(this.artifactListElement);
    
    // Stats footer
    this.statsElement = document.createElement('div');
    this.statsElement.style.cssText = `
      padding: 8px 12px;
      border-top: 1px solid #30363d;
      background: #161b22;
      font-size: 12px;
      color: #8b949e;
      text-align: center;
      flex-shrink: 0;
    `;
    this.updateStats();
    
    // Add all components
    this.contentArea.appendChild(header);
    this.contentArea.appendChild(listContainer);
    this.contentArea.appendChild(this.statsElement);
  }
  
  /**
   * Update sort button styles
   */
  updateSortButtons(buttons, options) {
    buttons.forEach((btn, idx) => {
      const isActive = this.sortBy === options[idx];
      btn.style.background = isActive ? '#1f6feb' : '#21262d';
      btn.style.borderColor = isActive ? '#388bfd' : '#30363d';
      btn.style.color = isActive ? '#ffffff' : '#c9d1d9';
    });
  }
  
  /**
   * Update the artifact list display
   */
  updateArtifactList() {
    if (!this.artifactListElement) return;
    
    // Clear current list
    this.artifactListElement.innerHTML = '';
    
    // Get and filter artifacts
    let artifacts = Array.from(this.artifacts.values());
    
    if (this.filterText) {
      artifacts = artifacts.filter(artifact => {
        const searchText = this.filterText;
        return (
          (artifact.label && artifact.label.toLowerCase().includes(searchText)) ||
          (artifact.title && artifact.title.toLowerCase().includes(searchText)) ||
          (artifact.description && artifact.description.toLowerCase().includes(searchText)) ||
          artifact.type.toLowerCase().includes(searchText)
        );
      });
    }
    
    // Sort artifacts
    artifacts.sort((a, b) => {
      switch (this.sortBy) {
        case 'label':
          const labelA = a.label || a.title || '';
          const labelB = b.label || b.title || '';
          return labelA.localeCompare(labelB);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'created':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
    
    // Create artifact items
    artifacts.forEach(artifact => {
      const item = this.createArtifactItem(artifact);
      this.artifactListElement.appendChild(item);
    });
    
    // Update stats
    this.updateStats();
  }
  
  /**
   * Create an artifact list item
   */
  createArtifactItem(artifact) {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 10px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    
    // Header with label and type
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    `;
    
    const label = document.createElement('div');
    label.style.cssText = `
      font-weight: 600;
      color: #58a6ff;
      font-size: 14px;
    `;
    label.textContent = artifact.label || artifact.id;
    
    const type = document.createElement('div');
    type.style.cssText = `
      font-size: 11px;
      color: #8b949e;
      background: #21262d;
      padding: 2px 6px;
      border-radius: 3px;
    `;
    type.textContent = artifact.type + (artifact.subtype ? `/${artifact.subtype}` : '');
    
    header.appendChild(label);
    header.appendChild(type);
    
    // Title
    if (artifact.title) {
      const title = document.createElement('div');
      title.style.cssText = `
        color: #f0f6fc;
        font-size: 13px;
        margin-bottom: 4px;
      `;
      title.textContent = artifact.title;
      item.appendChild(title);
    }
    
    // Description
    if (artifact.description) {
      const desc = document.createElement('div');
      desc.style.cssText = `
        color: #8b949e;
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 4px;
      `;
      desc.textContent = artifact.description;
      item.appendChild(desc);
    }
    
    // Metadata
    const meta = document.createElement('div');
    meta.style.cssText = `
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #6e7681;
      margin-top: 6px;
    `;
    
    // Created time
    const time = document.createElement('span');
    time.textContent = this.formatTime(artifact.createdAt);
    
    // Size if available
    if (artifact.size) {
      const size = document.createElement('span');
      size.textContent = this.formatSize(artifact.size);
      meta.appendChild(size);
    }
    
    // Tool that created it
    if (artifact.createdBy) {
      const tool = document.createElement('span');
      tool.textContent = `via ${artifact.createdBy}`;
      meta.appendChild(tool);
    }
    
    meta.appendChild(time);
    
    // Hover effect
    item.addEventListener('mouseenter', () => {
      item.style.background = '#1c2128';
      item.style.borderColor = '#388bfd';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.background = '#161b22';
      item.style.borderColor = '#30363d';
    });
    
    // Click to view
    item.addEventListener('click', () => {
      this.viewArtifact(artifact);
    });
    
    // Assemble item
    item.appendChild(header);
    item.appendChild(meta);
    
    return item;
  }
  
  /**
   * View artifact in the artifact viewer
   */
  async viewArtifact(artifact) {
    if (this.artifactViewer) {
      // Get the appropriate renderer
      const rendererType = this.getRendererType(artifact);
      
      // For now, create a simple renderer proxy
      const renderer = {
        renderContent: (artifact, content) => {
          const container = document.createElement('div');
          container.style.padding = '20px';
          
          if (artifact.type === 'image' && content) {
            const img = document.createElement('img');
            img.src = content.startsWith('data:') ? content : `data:image/png;base64,${content}`;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            container.appendChild(img);
          } else {
            const pre = document.createElement('pre');
            pre.style.cssText = `
              margin: 0;
              white-space: pre-wrap;
              word-wrap: break-word;
              font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
              font-size: 13px;
              line-height: 1.5;
              color: #c9d1d9;
            `;
            pre.textContent = content || artifact.content || 'No content available';
            container.appendChild(pre);
          }
          
          return container;
        }
      };
      
      await this.artifactViewer.show(artifact, renderer);
    }
  }
  
  /**
   * Get renderer type for artifact
   */
  getRendererType(artifact) {
    const typeMap = {
      'image': 'ImageRenderer',
      'code': 'CodeRenderer',
      'document': 'DocumentRenderer',
      'text': 'DocumentRenderer',
      'data': 'CodeRenderer'
    };
    
    return typeMap[artifact.type] || 'DocumentRenderer';
  }
  
  /**
   * Update stats display
   */
  updateStats() {
    if (!this.statsElement) return;
    
    const total = this.artifacts.size;
    const filtered = this.artifactListElement ? this.artifactListElement.children.length : 0;
    
    if (this.filterText) {
      this.statsElement.textContent = `Showing ${filtered} of ${total} artifacts`;
    } else {
      this.statsElement.textContent = `${total} artifact${total !== 1 ? 's' : ''}`;
    }
  }
  
  /**
   * Add or update an artifact
   */
  addArtifact(artifact) {
    this.artifacts.set(artifact.id, artifact);
    this.updateArtifactList();
  }
  
  /**
   * Add multiple artifacts
   */
  addArtifacts(artifacts) {
    artifacts.forEach(artifact => {
      this.artifacts.set(artifact.id, artifact);
    });
    this.updateArtifactList();
  }
  
  /**
   * Update an existing artifact
   */
  updateArtifact(artifact) {
    if (this.artifacts.has(artifact.id)) {
      this.artifacts.set(artifact.id, artifact);
      this.updateArtifactList();
    }
  }
  
  /**
   * Clear all artifacts
   */
  clearArtifacts() {
    this.artifacts.clear();
    this.updateArtifactList();
  }
  
  /**
   * Format timestamp
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
      return 'just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
  
  /**
   * Format file size
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  /**
   * Hide the debug window
   */
  hide() {
    if (this.window) {
      this.window.hide();
    }
  }
  
  /**
   * Destroy the debug view
   */
  destroy() {
    if (this.window) {
      this.window.destroy();
      this.window = null;
    }
    
    this.artifacts.clear();
    this.contentArea = null;
    this.artifactListElement = null;
    this.statsElement = null;
  }
}