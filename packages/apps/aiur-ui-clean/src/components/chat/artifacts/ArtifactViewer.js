/**
 * ArtifactViewer - Modal component for viewing artifacts in full detail
 * 
 * This component creates a modal overlay for viewing artifacts with their
 * full content, metadata, and interaction capabilities.
 */
export class ArtifactViewer {
  constructor() {
    this.isVisible = false;
    this.currentArtifact = null;
    this.currentRenderer = null;
    this.modal = null;
    this.overlay = null;
    
    // Event handlers
    this.onClose = null;
    this.onDownload = null;
    
    this.createModal();
    this.bindEvents();
  }

  /**
   * Create modal DOM structure
   */
  createModal() {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'artifact-viewer-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: none;
      backdrop-filter: blur(4px);
    `;

    // Modal
    this.modal = document.createElement('div');
    this.modal.className = 'artifact-viewer-modal';
    this.modal.style.cssText = `
      position: fixed;
      top: 5%;
      left: 5%;
      right: 5%;
      bottom: 5%;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      z-index: 10001;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.className = 'artifact-viewer-header';
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #333;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #222;
      flex-shrink: 0;
    `;

    // Title area
    const titleArea = document.createElement('div');
    titleArea.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    `;

    this.titleIcon = document.createElement('div');
    this.titleIcon.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    `;

    this.titleText = document.createElement('h2');
    this.titleText.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #e0e0e0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    this.subtitleText = document.createElement('div');
    this.subtitleText.style.cssText = `
      font-size: 12px;
      color: #999;
      margin-top: 2px;
    `;

    const titleContent = document.createElement('div');
    titleContent.style.cssText = 'flex: 1; min-width: 0;';
    titleContent.appendChild(this.titleText);
    titleContent.appendChild(this.subtitleText);

    titleArea.appendChild(this.titleIcon);
    titleArea.appendChild(titleContent);

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    this.downloadBtn = this.createActionButton('⬇️', 'Download', () => {
      this.handleDownload();
    });

    this.closeBtn = this.createActionButton('✕', 'Close', () => {
      this.hide();
    });

    actions.appendChild(this.downloadBtn);
    actions.appendChild(this.closeBtn);

    header.appendChild(titleArea);
    header.appendChild(actions);

    // Content area
    this.contentArea = document.createElement('div');
    this.contentArea.className = 'artifact-viewer-content';
    this.contentArea.style.cssText = `
      flex: 1;
      overflow: auto;
      background: #0d1117;
    `;

    // Loading indicator
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #999;
      font-size: 14px;
      display: none;
    `;
    this.loadingIndicator.textContent = 'Loading artifact content...';

    // Error display
    this.errorDisplay = document.createElement('div');
    this.errorDisplay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #ff6b6b;
      font-size: 14px;
      text-align: center;
      display: none;
    `;

    this.modal.appendChild(header);
    this.modal.appendChild(this.contentArea);
    this.modal.appendChild(this.loadingIndicator);
    this.modal.appendChild(this.errorDisplay);

    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
  }

  /**
   * Create action button
   * @param {string} icon - Button icon/text
   * @param {string} title - Button title
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} Button element
   */
  createActionButton(icon, title, onClick) {
    const btn = document.createElement('button');
    btn.textContent = icon;
    btn.title = title;
    btn.style.cssText = `
      background: #333;
      border: 1px solid #555;
      border-radius: 6px;
      color: #e0e0e0;
      cursor: pointer;
      font-size: 14px;
      padding: 8px 12px;
      transition: all 0.2s ease;
      min-width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#444';
      btn.style.borderColor = '#666';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#333';
      btn.style.borderColor = '#555';
    });

    btn.addEventListener('click', onClick);

    return btn;
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // Prevent modal clicks from closing
    this.modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Show the artifact viewer
   * @param {Object} artifact - Artifact metadata
   * @param {ArtifactRenderer} renderer - Renderer instance
   */
  async show(artifact, renderer) {
    this.currentArtifact = artifact;
    this.currentRenderer = renderer;

    // Update header
    this.updateHeader(artifact);

    // Show modal
    this.overlay.style.display = 'block';
    this.isVisible = true;

    // Load and display content
    await this.loadContent(artifact, renderer);

    // Animate in
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '0';
      this.overlay.style.transition = 'opacity 0.3s ease';
      requestAnimationFrame(() => {
        this.overlay.style.opacity = '1';
      });
    });
  }

  /**
   * Hide the artifact viewer
   */
  hide() {
    if (!this.isVisible) return;

    this.overlay.style.transition = 'opacity 0.3s ease';
    this.overlay.style.opacity = '0';

    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.isVisible = false;
      this.currentArtifact = null;
      this.currentRenderer = null;

      if (this.onClose) {
        this.onClose();
      }
    }, 300);
  }

  /**
   * Update header with artifact information
   * @param {Object} artifact - Artifact metadata
   */
  updateHeader(artifact) {
    // Update icon
    const { emoji, bgColor } = this.getIconInfo(artifact);
    this.titleIcon.style.background = bgColor;
    this.titleIcon.textContent = emoji;

    // Update title and subtitle
    this.titleText.textContent = artifact.title;
    
    const details = [];
    details.push(`${artifact.type}${artifact.subtype ? '/' + artifact.subtype : ''}`);
    
    if (artifact.size) {
      details.push(this.formatSize(artifact.size));
    }

    if (artifact.createdBy) {
      details.push(`Created by ${artifact.createdBy}`);
    }

    this.subtitleText.textContent = details.join(' • ');

    // Update download button visibility
    this.downloadBtn.style.display = 
      (artifact.path || artifact.content) ? 'flex' : 'none';
  }

  /**
   * Load and display artifact content
   * @param {Object} artifact - Artifact metadata
   * @param {ArtifactRenderer} renderer - Renderer instance
   */
  async loadContent(artifact, renderer) {
    // Show loading
    this.showLoading();

    try {
      let content = null;

      // Try to get content from artifact directly
      if (artifact.content) {
        content = artifact.content;
      } else if (artifact.path) {
        // For file-based artifacts, we would need to fetch the content
        // This is a placeholder - in a real implementation, you would
        // make an API call to get the file content
        content = await this.fetchArtifactContent(artifact);
      }

      // Hide loading
      this.hideLoading();

      // Render content
      if (content !== null) {
        const contentElement = renderer.renderFull(artifact, content);
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(contentElement);
      } else {
        this.showError('Content not available');
      }
    } catch (error) {
      console.error('Error loading artifact content:', error);
      this.hideLoading();
      this.showError(`Failed to load content: ${error.message}`);
    }
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
      return artifact.preview; // Just return the preview without the placeholder text
    }
    
    // For now, return a helpful message instead of throwing an error
    return `# ${artifact.title}\n\nThis is a preview of the artifact.\n\n**Type:** ${artifact.type}${artifact.subtype ? '/' + artifact.subtype : ''}\n**Size:** ${this.formatSize(artifact.size || 0)}\n\n*Full content loading from file system is not yet implemented in this demo.*`;
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    this.loadingIndicator.style.display = 'block';
    this.errorDisplay.style.display = 'none';
    this.contentArea.innerHTML = '';
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.loadingIndicator.style.display = 'none';
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.errorDisplay.textContent = message;
    this.errorDisplay.style.display = 'block';
    this.loadingIndicator.style.display = 'none';
  }

  /**
   * Handle download action
   */
  handleDownload() {
    if (this.onDownload) {
      this.onDownload(this.currentArtifact);
    } else {
      // Default download behavior
      this.downloadArtifact(this.currentArtifact);
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
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error.message}`);
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
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    
    this.modal = null;
    this.overlay = null;
    this.currentArtifact = null;
    this.currentRenderer = null;
  }
}