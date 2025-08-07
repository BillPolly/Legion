import { Window } from '/Legion/components/window/index.js';

/**
 * ArtifactViewer - Window component for viewing artifacts in full detail
 * 
 * This component creates a draggable window for viewing artifacts with their
 * full content, metadata, and interaction capabilities.
 */
export class ArtifactViewer {
  constructor(container) {
    this.container = container;
    this.window = null;
    this.currentArtifact = null;
    this.currentRenderer = null;
    this.contentArea = null;
    
    // Track open position for next window
    this.nextPosition = { x: 400, y: 100 };
    this.positionOffset = 30; // Offset for cascading windows
    
    // Event handlers
    this.onClose = null;
    this.onDownload = null;
  }

  /**
   * Show the artifact viewer window
   * @param {Object} artifact - Artifact metadata
   * @param {ArtifactRenderer} renderer - Renderer instance
   */
  async show(artifact, renderer) {
    console.log('ArtifactViewer: Showing artifact in window:', artifact.title, artifact.type);
    
    this.currentArtifact = artifact;
    this.currentRenderer = renderer;
    
    // If window already exists, destroy it first
    if (this.window) {
      this.window.destroy();
    }
    
    // Create new window for this artifact
    this.createWindow(artifact);
    
    // Load and display content
    await this.loadContent(artifact, renderer);
    
    // Update position for next window (cascade effect)
    this.nextPosition.x += this.positionOffset;
    this.nextPosition.y += this.positionOffset;
    
    // Reset position if too far
    if (this.nextPosition.x > 800 || this.nextPosition.y > 500) {
      this.nextPosition = { x: 400, y: 100 };
    }
  }

  /**
   * Create the artifact window
   * @param {Object} artifact - Artifact metadata
   */
  createWindow(artifact) {
    const windowTitle = `${artifact.title} - ${artifact.type}${artifact.subtype ? '/' + artifact.subtype : ''}`;
    
    this.window = Window.create({
      dom: this.container,
      title: windowTitle,
      width: 800,
      height: 600,
      position: { ...this.nextPosition },
      theme: 'dark',
      resizable: true,
      draggable: true,
      onClose: () => {
        console.log('Artifact window closed');
        this.handleClose();
      },
      onResize: (width, height) => {
        console.log(`Artifact window resized to ${width}x${height}`);
      }
    });
    
    // Get the content area from the window
    this.contentArea = this.window.contentElement;
    
    // Style the content area
    this.contentArea.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #0d1117;
      color: #e0e0e0;
      overflow: hidden;
    `;
    
    // Skip header for images - they fill the entire window
    if (artifact.type !== 'image') {
      // Add header with artifact info and actions
      this.createHeader(artifact);
    }
  }

  /**
   * Create header with artifact info and actions
   * @param {Object} artifact - Artifact metadata
   */
  createHeader(artifact) {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #30363d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #161b22;
      flex-shrink: 0;
    `;
    
    // Info section
    const info = document.createElement('div');
    info.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    `;
    
    // Icon
    const icon = document.createElement('div');
    const { emoji, bgColor } = this.getIconInfo(artifact);
    icon.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    `;
    icon.textContent = emoji;
    
    // Metadata
    const metadata = document.createElement('div');
    metadata.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;
    
    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      color: #f0f6fc;
    `;
    title.textContent = artifact.title;
    
    const details = document.createElement('div');
    details.style.cssText = `
      font-size: 12px;
      color: #8b949e;
    `;
    const detailParts = [];
    detailParts.push(`${artifact.type}${artifact.subtype ? '/' + artifact.subtype : ''}`);
    if (artifact.size) {
      detailParts.push(this.formatSize(artifact.size));
    }
    if (artifact.createdBy) {
      detailParts.push(`via ${artifact.createdBy}`);
    }
    details.textContent = detailParts.join(' • ');
    
    metadata.appendChild(title);
    metadata.appendChild(details);
    
    info.appendChild(icon);
    info.appendChild(metadata);
    
    // Actions section
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
    `;
    
    // Download button
    if (artifact.path || artifact.content) {
      const downloadBtn = this.createActionButton('⬇️ Download', () => {
        this.handleDownload();
      });
      actions.appendChild(downloadBtn);
    }
    
    // Copy button (for text content)
    if (artifact.type === 'code' || artifact.type === 'document' || artifact.type === 'config') {
      const copyBtn = this.createActionButton('📋 Copy', async () => {
        await this.handleCopy();
      });
      actions.appendChild(copyBtn);
    }
    
    header.appendChild(info);
    header.appendChild(actions);
    this.contentArea.appendChild(header);
  }

  /**
   * Create action button
   * @param {string} text - Button text
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} Button element
   */
  createActionButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #c9d1d9;
      cursor: pointer;
      font-size: 12px;
      padding: 6px 12px;
      transition: all 0.2s ease;
    `;
    
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#30363d';
      btn.style.borderColor = '#8b949e';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#21262d';
      btn.style.borderColor = '#30363d';
    });
    
    btn.addEventListener('click', onClick);
    
    return btn;
  }

  /**
   * Load and display artifact content
   * @param {Object} artifact - Artifact metadata
   * @param {ArtifactRenderer} renderer - Renderer instance
   */
  async loadContent(artifact, renderer) {
    // Create scrollable content container
    const scrollContainer = document.createElement('div');
    scrollContainer.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 0;
    `;
    
    try {
      let content = null;
      
      // Try to get content from artifact directly
      if (artifact.content) {
        content = artifact.content;
      } else if (artifact.path) {
        // For file-based artifacts, try to fetch from server
        // For now, show a message that content needs to be loaded
        content = null; // Don't use preview as fallback - it's misleading
      }
      
      // Render content using the appropriate renderer
      if (content !== null) {
        const contentElement = renderer.renderContent(artifact, content);
        scrollContainer.appendChild(contentElement);
      } else {
        // Show detailed message about why content is not available
        const reason = artifact.path ? 
          `File path: ${artifact.path}<br/>Content was not captured during execution` :
          'No content was provided for this artifact';
          
        scrollContainer.innerHTML = `
          <div style="padding: 40px; text-align: center; color: #8b949e;">
            <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
            <div style="font-size: 16px; margin-bottom: 12px;">Content Not Available</div>
            <div style="font-size: 13px; line-height: 1.5; color: #6e7681; max-width: 400px; margin: 0 auto;">
              ${reason}
            </div>
            ${artifact.preview ? `
              <div style="margin-top: 20px; padding: 12px; background: #161b22; border-radius: 6px; text-align: left;">
                <div style="font-size: 11px; color: #8b949e; margin-bottom: 8px;">Preview (truncated):</div>
                <pre style="font-size: 12px; color: #c9d1d9; white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: 'SF Mono', Monaco, monospace;">${artifact.preview}</pre>
              </div>
            ` : ''}
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading artifact content:', error);
      scrollContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #f85149;">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <div>Failed to load content</div>
          <div style="font-size: 12px; margin-top: 8px; color: #8b949e;">
            ${error.message}
          </div>
        </div>
      `;
    }
    
    this.contentArea.appendChild(scrollContainer);
  }

  /**
   * Fetch artifact content (placeholder implementation)
   * @param {Object} artifact - Artifact metadata
   * @returns {Promise<string>} Artifact content
   */
  async fetchArtifactContent(artifact) {
    // This is a placeholder implementation
    // In a real application, you would make an API call to get file content
    
    if (artifact.preview) {
      return artifact.preview;
    }
    
    // Return a helpful message for files that need server loading
    return `# ${artifact.title}\n\nFile location: ${artifact.path}\n\n*Note: Full file content loading from server is not yet implemented.*`;
  }

  /**
   * Handle download action
   */
  async handleDownload() {
    if (!this.currentArtifact) return;
    
    if (this.onDownload) {
      this.onDownload(this.currentArtifact);
    } else {
      await this.downloadArtifact(this.currentArtifact);
    }
  }

  /**
   * Handle copy action
   */
  async handleCopy() {
    if (!this.currentArtifact) return;
    
    try {
      let content = this.currentArtifact.content || this.currentArtifact.preview || '';
      
      if (!content && this.currentArtifact.path) {
        content = await this.fetchArtifactContent(this.currentArtifact);
      }
      
      await navigator.clipboard.writeText(content);
      console.log('Content copied to clipboard');
      
      // TODO: Show success feedback to user
    } catch (error) {
      console.error('Failed to copy content:', error);
    }
  }

  /**
   * Download artifact content
   * @param {Object} artifact - Artifact metadata
   */
  async downloadArtifact(artifact) {
    try {
      let content = artifact.content;
      let filename = artifact.title;
      
      if (!content && artifact.preview) {
        content = artifact.preview;
      }
      
      if (!content && artifact.path) {
        content = await this.fetchArtifactContent(artifact);
      }
      
      if (!content) {
        throw new Error('No content available for download');
      }
      
      // Create blob and download
      const blob = new Blob([content], { 
        type: this.getMimeType(artifact) 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Downloaded artifact: ${filename}`);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error.message}`);
    }
  }

  /**
   * Handle window close
   */
  handleClose() {
    this.currentArtifact = null;
    this.currentRenderer = null;
    this.contentArea = null;
    
    if (this.onClose) {
      this.onClose();
    }
  }

  /**
   * Hide the artifact viewer
   */
  hide() {
    if (this.window) {
      this.window.hide();
    }
  }

  /**
   * Get MIME type for artifact
   * @param {Object} artifact - Artifact metadata
   * @returns {string} MIME type
   */
  getMimeType(artifact) {
    const mimeMap = {
      js: 'text/javascript',
      jsx: 'text/javascript',
      ts: 'text/typescript',
      tsx: 'text/typescript',
      html: 'text/html',
      css: 'text/css',
      json: 'application/json',
      md: 'text/markdown',
      txt: 'text/plain',
      py: 'text/x-python',
      java: 'text/x-java-source',
      xml: 'application/xml',
      csv: 'text/csv'
    };
    
    return mimeMap[artifact.subtype] || 'text/plain';
  }

  /**
   * Get icon information for artifact type
   * @param {Object} artifact - Artifact metadata
   * @returns {Object} Icon info with emoji and background color
   */
  getIconInfo(artifact) {
    const iconMap = {
      code: { emoji: '📝', bgColor: '#1a472a' },
      markup: { emoji: '🌐', bgColor: '#472a1a' },
      stylesheet: { emoji: '🎨', bgColor: '#2a1a47' },
      config: { emoji: '⚙️', bgColor: '#47471a' },
      document: { emoji: '📄', bgColor: '#1a4747' },
      image: { emoji: '🖼️', bgColor: '#471a47' },
      data: { emoji: '📊', bgColor: '#1a2a47' },
      url: { emoji: '🔗', bgColor: '#47321a' },
      archive: { emoji: '📦', bgColor: '#2a471a' }
    };
    
    return iconMap[artifact.type] || { emoji: '📎', bgColor: '#444' };
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Destroy the viewer
   */
  destroy() {
    if (this.window) {
      this.window.destroy();
      this.window = null;
    }
    
    this.currentArtifact = null;
    this.currentRenderer = null;
    this.contentArea = null;
  }
}