import { Window } from '/Legion/components/window/index.js';
import { ArtifactViewer } from '../chat/artifacts/ArtifactViewer.js';

/**
 * ArtifactDebugView - Debug panel for monitoring artifacts
 * 
 * Displays a live view of all artifacts in the system with their
 * labels, descriptions, and metadata. Allows clicking to view full content.
 */
export class ArtifactDebugView {
  constructor(container, artifactViewer = null) {
    this.container = container;
    this.artifactViewer = artifactViewer || new ArtifactViewer(container); // Create or use provided ArtifactViewer
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
    
    // Controls container (sort and copy)
    const controlsContainer = document.createElement('div');
    controlsContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
    `;
    
    // Sort controls
    const sortContainer = document.createElement('div');
    sortContainer.style.cssText = `
      display: flex;
      gap: 8px;
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
    
    // Copy button
    const copyButton = document.createElement('button');
    copyButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
        <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
      </svg>
      Copy JSON
    `;
    copyButton.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #c9d1d9;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
    `;
    
    copyButton.addEventListener('mouseenter', () => {
      copyButton.style.background = '#30363d';
      copyButton.style.borderColor = '#8b949e';
    });
    
    copyButton.addEventListener('mouseleave', () => {
      copyButton.style.background = '#21262d';
      copyButton.style.borderColor = '#30363d';
    });
    
    copyButton.addEventListener('click', () => this.copyArtifactsAsJSON(copyButton));
    
    controlsContainer.appendChild(sortContainer);
    controlsContainer.appendChild(copyButton);
    
    header.appendChild(searchInput);
    header.appendChild(controlsContainer);
    
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
      // Import the artifact registry to get the proper renderer
      const { artifactRegistry } = await import('../chat/artifacts/index.js');
      
      // Get the appropriate renderer from the registry
      const renderer = artifactRegistry.getRenderer(artifact);
      
      if (renderer) {
        console.log('ArtifactDebugView: Using renderer:', renderer.name, 'for artifact:', artifact.title);
        await this.artifactViewer.show(artifact, renderer);
      } else {
        console.warn('ArtifactDebugView: No renderer found for artifact type:', artifact.type);
        // Fallback to simple text display
        const fallbackRenderer = {
          renderContent: (artifact, content) => {
            const container = document.createElement('div');
            container.style.cssText = `
              padding: 20px;
              text-align: center;
              color: #8b949e;
            `;
            container.innerHTML = `
              <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
              <div>No renderer available for type: ${artifact.type}</div>
              <div style="font-size: 12px; margin-top: 8px; color: #6e7681;">
                ${artifact.title}
              </div>
            `;
            return container;
          }
        };
        await this.artifactViewer.show(artifact, fallbackRenderer);
      }
    } else {
      console.warn('ArtifactDebugView: No artifact viewer available');
    }
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
   * Copy all artifacts as JSON to clipboard
   */
  async copyArtifactsAsJSON(button) {
    try {
      // Get all artifacts as an array with full details including content
      const artifactsArray = Array.from(this.artifacts.values()).map(artifact => {
        // Create a complete copy including all fields
        const fullArtifact = {
          id: artifact.id,
          type: artifact.type,
          subtype: artifact.subtype,
          label: artifact.label,
          title: artifact.title,
          description: artifact.description,
          content: artifact.content || null, // Include the actual content
          path: artifact.path || null,
          url: artifact.url || null,
          size: artifact.size || 0,
          createdAt: artifact.createdAt,
          createdBy: artifact.createdBy || null,
          metadata: artifact.metadata || {},
          // Include any additional fields that might exist
          ...Object.keys(artifact).reduce((acc, key) => {
            // Skip fields we've already explicitly included
            const handledFields = ['id', 'type', 'subtype', 'label', 'title', 
                                  'description', 'content', 'path', 'url', 
                                  'size', 'createdAt', 'createdBy', 'metadata'];
            if (!handledFields.includes(key)) {
              acc[key] = artifact[key];
            }
            return acc;
          }, {})
        };
        
        return fullArtifact;
      });
      
      // Convert to formatted JSON string
      const jsonString = JSON.stringify(artifactsArray, null, 2);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(jsonString);
      
      // Update button to show success
      const originalHTML = button.innerHTML;
      const originalBackground = button.style.background;
      const originalBorderColor = button.style.borderColor;
      
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="#3fb950">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
        </svg>
        Copied!
      `;
      button.style.background = '#1c2f2c';
      button.style.borderColor = '#3fb950';
      button.style.color = '#3fb950';
      
      // Reset after 2 seconds
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.background = originalBackground;
        button.style.borderColor = originalBorderColor;
        button.style.color = '#c9d1d9';
      }, 2000);
      
      console.log(`Copied ${artifactsArray.length} artifacts to clipboard (${jsonString.length} characters)`);
      
    } catch (error) {
      console.error('Failed to copy artifacts:', error);
      
      // Show error state
      const originalHTML = button.innerHTML;
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="#f85149">
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
        </svg>
        Failed
      `;
      button.style.background = '#2d1f1f';
      button.style.borderColor = '#f85149';
      button.style.color = '#f85149';
      
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.background = '#21262d';
        button.style.borderColor = '#30363d';
        button.style.color = '#c9d1d9';
      }, 2000);
    }
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