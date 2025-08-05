import { ArtifactRenderer } from '../ArtifactRenderer.js';

/**
 * ImageRenderer - Renders image artifacts with preview and full view
 */
export class ImageRenderer extends ArtifactRenderer {
  constructor() {
    super('image');
  }

  renderPreview(artifact) {
    const card = document.createElement('div');
    card.className = 'artifact-card image-card';
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
      position: relative;
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

    // Image thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.style.cssText = `
      width: 48px;
      height: 48px;
      border-radius: 4px;
      background: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
    `;

    // Check for content (base64) OR path
    if (artifact.content || (artifact.path && artifact.exists)) {
      const img = document.createElement('img');
      img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: cover;
      `;
      
      // Use createImageDataUrl which handles both content and path
      img.src = this.createImageDataUrl(artifact);
      img.alt = artifact.title;
      
      img.onerror = () => {
        console.log('[ImageRenderer] Thumbnail failed to load for:', artifact.title);
        thumbnail.innerHTML = '🖼️';
        thumbnail.style.fontSize = '20px';
        thumbnail.style.color = '#666';
      };
      
      thumbnail.appendChild(img);
    } else {
      thumbnail.innerHTML = '🖼️';
      thumbnail.style.fontSize = '20px';
      thumbnail.style.color = '#666';
    }

    card.appendChild(thumbnail);

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
    
    details.innerHTML = this.getImageDetailsHTML(artifact);

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

  renderContent(artifact, content) {
    console.log('[ImageRenderer] Rendering artifact:', {
      id: artifact.id,
      title: artifact.title,
      hasPath: !!artifact.path,
      hasContent: !!artifact.content,
      contentPreview: artifact.content ? artifact.content.substring(0, 50) : 'none',
      exists: artifact.exists
    });
    
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      height: 100%;
      background: #0d1117;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;

    // Check for content (base64 data) OR path
    if (artifact.content || (artifact.path && artifact.exists)) {
      const img = document.createElement('img');
      img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
      `;
      
      img.src = this.createImageDataUrl(artifact);
      img.alt = artifact.title;
      
      img.onerror = () => {
        container.innerHTML = `
          <div style="text-align: center; color: #8b949e;">
            <div style="font-size: 48px; margin-bottom: 16px;">🖼️</div>
            <div>Unable to load image</div>
            <div style="font-size: 12px; margin-top: 8px; color: #6e7681;">${artifact.path}</div>
          </div>
        `;
      };

      // Add zoom functionality
      let isZoomed = false;
      img.addEventListener('click', () => {
        if (isZoomed) {
          img.style.transform = 'scale(1)';
          img.style.cursor = 'zoom-in';
        } else {
          img.style.transform = 'scale(2)';
          img.style.cursor = 'zoom-out';
        }
        isZoomed = !isZoomed;
      });
      
      img.style.cursor = 'zoom-in';
      img.style.transition = 'transform 0.3s ease';

      container.appendChild(img);
      
      // Add floating download button
      const downloadBtn = document.createElement('button');
      downloadBtn.innerHTML = '⬇';
      downloadBtn.title = 'Download Image';
      downloadBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.5);
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        opacity: 0.3;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      `;
      
      // Hover effects
      downloadBtn.addEventListener('mouseenter', () => {
        downloadBtn.style.opacity = '1';
        downloadBtn.style.background = 'rgba(0, 0, 0, 0.6)';
        downloadBtn.style.color = 'rgba(255, 255, 255, 0.9)';
        downloadBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        downloadBtn.style.transform = 'scale(1.1)';
      });
      
      downloadBtn.addEventListener('mouseleave', () => {
        downloadBtn.style.opacity = '0.3';
        downloadBtn.style.background = 'rgba(0, 0, 0, 0.3)';
        downloadBtn.style.color = 'rgba(255, 255, 255, 0.5)';
        downloadBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        downloadBtn.style.transform = 'scale(1)';
      });
      
      // Download functionality
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent zoom toggle
        this.handleDownload(artifact);
      });
      
      container.appendChild(downloadBtn);
    } else {
      container.innerHTML = `
        <div style="text-align: center; color: #8b949e;">
          <div style="font-size: 48px; margin-bottom: 16px;">🖼️</div>
          <div>Image not found</div>
          <div style="font-size: 12px; margin-top: 8px; color: #6e7681;">${artifact.path || 'No path available'}</div>
        </div>
      `;
    }

    return container;
  }

  /**
   * Get image-specific details HTML
   * @param {Object} artifact - Artifact metadata
   * @returns {string} HTML string for details
   */
  getImageDetailsHTML(artifact) {
    const parts = [];
    
    parts.push(`<span>${artifact.subtype?.toUpperCase() || 'IMAGE'}</span>`);
    
    if (artifact.size) {
      parts.push(`<span>${this.formatSize(artifact.size)}</span>`);
    }

    // Try to get image dimensions from metadata
    if (artifact.metadata && artifact.metadata.width && artifact.metadata.height) {
      parts.push(`<span>${artifact.metadata.width}×${artifact.metadata.height}</span>`);
    }

    if (artifact.exists === false) {
      parts.push(`<span style="color: #ff6b6b;">Not found</span>`);
    }

    return parts.join('<span style="color: #555;">•</span>');
  }

  /**
   * Create a data URL for the image (placeholder implementation)
   * In a real implementation, this would read the file and convert to data URL
   * @param {Object} artifact - Artifact metadata
   * @returns {string} Data URL or placeholder
   */
  createImageDataUrl(artifact) {
    console.log('[ImageRenderer] createImageDataUrl called:', {
      title: artifact.title,
      hasContent: !!artifact.content,
      contentPreview: artifact.content ? artifact.content.substring(0, 50) + '...' : 'none'
    });
    
    if (artifact.content) {
      // If content is a URL (http:// or https://)
      if (artifact.content.startsWith('http://') || artifact.content.startsWith('https://')) {
        console.log('[ImageRenderer] Using artifact.content as URL');
        return artifact.content;
      }
      // If content is already a data URL
      if (artifact.content.startsWith('data:')) {
        console.log('[ImageRenderer] Using artifact.content as data URL');
        return artifact.content;
      }
      // If it's raw base64, add the data URL prefix
      console.log('[ImageRenderer] Adding data: prefix to raw base64');
      return `data:image/png;base64,${artifact.content}`;
    }

    // Placeholder SVG for demonstration
    const svg = `
      <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="150" fill="#2d3748"/>
        <text x="100" y="75" font-family="Arial" font-size="14" fill="#a0aec0" text-anchor="middle">
          ${artifact.title}
        </text>
        <text x="100" y="95" font-family="Arial" font-size="12" fill="#718096" text-anchor="middle">
          ${artifact.subtype?.toUpperCase() || 'IMAGE'}
        </text>
      </svg>
    `;
    
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  /**
   * Create additional action buttons for images
   * @param {Object} artifact - Artifact metadata
   * @returns {HTMLElement} Actions element
   */
  createActions(artifact) {
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    `;

    // View button
    const viewBtn = this.createActionButton('👁️', 'View Full Size', () => {
      this.handleView(artifact);
    });
    actions.appendChild(viewBtn);

    // Download button
    if (artifact.path || artifact.content) {
      const downloadBtn = this.createActionButton('⬇️', 'Download Image', () => {
        this.handleDownload(artifact);
      });
      actions.appendChild(downloadBtn);
    }

    // Info button
    const infoBtn = this.createActionButton('ℹ️', 'Image Info', () => {
      this.handleImageInfo(artifact);
    });
    actions.appendChild(infoBtn);

    return actions;
  }

  /**
   * Handle image info action
   * @param {Object} artifact - Artifact metadata
   */
  handleImageInfo(artifact) {
    const event = new CustomEvent('artifact-info', {
      detail: { artifact, renderer: this }
    });
    document.dispatchEvent(event);
  }

  /**
   * Override download handling for images
   * @param {Object} artifact - Artifact metadata
   */
  handleDownload(artifact) {
    // For images, we want to trigger a download with the proper filename
    const event = new CustomEvent('artifact-download', {
      detail: { 
        artifact, 
        renderer: this,
        downloadType: 'image',
        filename: artifact.title
      }
    });
    document.dispatchEvent(event);
  }
}