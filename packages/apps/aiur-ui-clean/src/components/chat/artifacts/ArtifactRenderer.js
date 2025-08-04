/**
 * ArtifactRenderer - Base class and registry for rendering different types of artifacts
 * 
 * This system provides a plugin-based approach for rendering various artifact types
 * in the chat interface, with support for previews, full views, and interactions.
 */

/**
 * Base ArtifactRenderer class
 */
export class ArtifactRenderer {
  constructor(type, subtype = null) {
    this.type = type;
    this.subtype = subtype;
    this.name = `${type}${subtype ? '/' + subtype : ''}`;
  }

  /**
   * Check if this renderer can handle the given artifact
   * @param {Object} artifact - Artifact metadata object
   * @returns {boolean} True if this renderer can handle the artifact
   */
  canRender(artifact) {
    if (this.subtype) {
      return artifact.type === this.type && artifact.subtype === this.subtype;
    }
    return artifact.type === this.type;
  }

  /**
   * Get the priority of this renderer (higher = more specific, preferred)
   * @returns {number} Priority score
   */
  getPriority() {
    return this.subtype ? 100 : 10; // Subtype renderers have higher priority
  }

  /**
   * Render artifact preview card
   * @param {Object} artifact - Artifact metadata
   * @returns {HTMLElement} DOM element containing the preview
   */
  renderPreview(artifact) {
    const card = document.createElement('div');
    card.className = 'artifact-card';
    card.dataset.artifactId = artifact.id;
    
    card.style.cssText = `
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 400px;
    `;

    // Add hover effect
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = '#666';
      card.style.background = '#333';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '#444';
      card.style.background = '#2a2a2a';
    });

    // Icon
    const icon = this.createIcon(artifact);
    card.appendChild(icon);

    // Content
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 500;
      color: #e0e0e0;
      font-size: 14px;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    title.textContent = artifact.title;

    const details = document.createElement('div');
    details.style.cssText = `
      font-size: 12px;
      color: #999;
      display: flex;
      gap: 8px;
    `;
    
    details.innerHTML = this.getDetailsHTML(artifact);

    content.appendChild(title);
    content.appendChild(details);
    card.appendChild(content);

    // Actions
    const actions = this.createActions(artifact);
    if (actions) {
      card.appendChild(actions);
    }

    return card;
  }

  /**
   * Render full artifact view
   * @param {Object} artifact - Artifact metadata
   * @param {string} content - Artifact content (if available)
   * @returns {HTMLElement} DOM element containing the full view
   */
  renderFull(artifact, content) {
    const container = document.createElement('div');
    container.className = 'artifact-full-view';
    container.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #1a1a1a;
      color: #e0e0e0;
    `;

    // Header
    const header = this.createHeader(artifact);
    container.appendChild(header);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 16px;
    `;

    if (content) {
      const contentElement = this.renderContent(artifact, content);
      contentArea.appendChild(contentElement);
    } else {
      contentArea.innerHTML = '<div style="color: #666; text-align: center; padding: 40px;">Content not available</div>';
    }

    container.appendChild(contentArea);

    return container;
  }

  /**
   * Create icon for the artifact type
   * @param {Object} artifact - Artifact metadata
   * @returns {HTMLElement} Icon element
   */
  createIcon(artifact) {
    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    `;

    const { emoji, bgColor } = this.getIconInfo(artifact);
    icon.style.background = bgColor;
    icon.textContent = emoji;

    return icon;
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
   * Get details HTML for the artifact
   * @param {Object} artifact - Artifact metadata
   * @returns {string} HTML string for details
   */
  getDetailsHTML(artifact) {
    const parts = [];
    
    parts.push(`<span>${artifact.type}${artifact.subtype ? '/' + artifact.subtype : ''}</span>`);
    
    if (artifact.size) {
      parts.push(`<span>${this.formatSize(artifact.size)}</span>`);
    }

    if (artifact.exists === false) {
      parts.push(`<span style="color: #ff6b6b;">Not found</span>`);
    }

    return parts.join('<span style="color: #555;">•</span>');
  }

  /**
   * Create action buttons for the artifact
   * @param {Object} artifact - Artifact metadata
   * @returns {HTMLElement|null} Actions element or null
   */
  createActions(artifact) {
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    `;

    // View button
    const viewBtn = this.createActionButton('👁️', 'View', () => {
      this.handleView(artifact);
    });
    actions.appendChild(viewBtn);

    // Download button (if applicable)
    if (artifact.path || artifact.content) {
      const downloadBtn = this.createActionButton('⬇️', 'Download', () => {
        this.handleDownload(artifact);
      });
      actions.appendChild(downloadBtn);
    }

    return actions;
  }

  /**
   * Create action button
   * @param {string} emoji - Button emoji
   * @param {string} title - Button title
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} Button element
   */
  createActionButton(emoji, title, onClick) {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.title = title;
    btn.style.cssText = `
      background: none;
      border: 1px solid #555;
      border-radius: 4px;
      color: #e0e0e0;
      cursor: pointer;
      font-size: 12px;
      padding: 4px 6px;
      transition: all 0.2s ease;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#777';
      btn.style.background = '#333';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#555';
      btn.style.background = 'none';
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });

    return btn;
  }

  /**
   * Create header for full view
   * @param {Object} artifact - Artifact metadata
   * @returns {HTMLElement} Header element
   */
  createHeader(artifact) {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #333;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    const icon = this.createIcon(artifact);
    header.appendChild(icon);

    const info = document.createElement('div');
    info.style.cssText = 'flex: 1;';

    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0 0 4px 0;
      font-size: 16px;
      color: #e0e0e0;
    `;
    title.textContent = artifact.title;

    const meta = document.createElement('div');
    meta.style.cssText = `
      font-size: 12px;
      color: #999;
    `;
    meta.innerHTML = this.getDetailsHTML(artifact);

    info.appendChild(title);
    info.appendChild(meta);
    header.appendChild(info);

    return header;
  }

  /**
   * Render content in full view (override in subclasses)
   * @param {Object} artifact - Artifact metadata
   * @param {string} content - Artifact content
   * @returns {HTMLElement} Content element
   */
  renderContent(artifact, content) {
    const pre = document.createElement('pre');
    pre.style.cssText = `
      margin: 0;
      white-space: pre-wrap;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.4;
      color: #e0e0e0;
    `;
    pre.textContent = content;
    return pre;
  }

  /**
   * Handle view action
   * @param {Object} artifact - Artifact metadata
   */
  handleView(artifact) {
    // Emit event for parent to handle
    const event = new CustomEvent('artifact-view', {
      detail: { artifact, renderer: this }
    });
    document.dispatchEvent(event);
  }

  /**
   * Handle download action
   * @param {Object} artifact - Artifact metadata
   */
  handleDownload(artifact) {
    // Emit event for parent to handle
    const event = new CustomEvent('artifact-download', {
      detail: { artifact, renderer: this }
    });
    document.dispatchEvent(event);
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
}

/**
 * ArtifactRendererRegistry - Manages available renderers
 */
export class ArtifactRendererRegistry {
  constructor() {
    this.renderers = new Map();
    this.defaultRenderer = new ArtifactRenderer('*'); // Fallback renderer
  }

  /**
   * Register a renderer
   * @param {ArtifactRenderer} renderer - Renderer instance
   */
  register(renderer) {
    const key = `${renderer.type}${renderer.subtype ? '/' + renderer.subtype : ''}`;
    
    if (!this.renderers.has(key)) {
      this.renderers.set(key, []);
    }
    
    this.renderers.get(key).push(renderer);
    
    // Sort by priority (highest first)
    this.renderers.get(key).sort((a, b) => b.getPriority() - a.getPriority());
    
    console.log(`ArtifactRendererRegistry: Registered renderer for ${key}`);
  }

  /**
   * Get the best renderer for an artifact
   * @param {Object} artifact - Artifact metadata
   * @returns {ArtifactRenderer} Best matching renderer
   */
  getRenderer(artifact) {
    // Try specific subtype first
    if (artifact.subtype) {
      const subtypeKey = `${artifact.type}/${artifact.subtype}`;
      const subtypeRenderers = this.renderers.get(subtypeKey);
      if (subtypeRenderers && subtypeRenderers.length > 0) {
        return subtypeRenderers[0];
      }
    }

    // Try general type
    const typeRenderers = this.renderers.get(artifact.type);
    if (typeRenderers && typeRenderers.length > 0) {
      return typeRenderers[0];
    }

    // Fallback to default
    return this.defaultRenderer;
  }

  /**
   * Get all registered renderer types
   * @returns {Array} Array of registered types
   */
  getRegisteredTypes() {
    return Array.from(this.renderers.keys());
  }
}

// Global registry instance
export const artifactRegistry = new ArtifactRendererRegistry();