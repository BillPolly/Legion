/**
 * ImageRenderer
 * 
 * Specialized renderer for displaying image assets in ShowMe windows
 * Supports various image formats, zoom controls, and responsive display
 */

export class ImageRenderer {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      maxWidth: 800,
      maxHeight: 600,
      showControls: false,
      showMetadata: false,
      zoomStep: 0.25,
      minZoom: 0.1,
      maxZoom: 5.0,
      ...config
    };

    // Track object URLs for cleanup
    this.objectUrls = new Set();
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Check if this renderer can handle the given asset
   * @param {*} asset - Asset to check
   * @returns {boolean} True if renderer can handle this asset
   */
  canRender(asset) {
    // Check Buffer with image headers
    if (Buffer.isBuffer(asset)) {
      return this.hasImageHeader(asset);
    }

    // Check string assets (file paths, URLs, data URLs)
    if (typeof asset === 'string') {
      // Data URL
      if (asset.startsWith('data:image/')) {
        return true;
      }

      // File path or URL with image extension
      const imageExtensions = /\.(png|jpe?g|gif|bmp|svg|webp|ico|tiff?)(\?|#|$)/i;
      return imageExtensions.test(asset);
    }

    return false;
  }

  /**
   * Check if Buffer has image header
   * @private
   * @param {Buffer} buffer - Buffer to check
   * @returns {boolean} True if buffer has image header
   */
  hasImageHeader(buffer) {
    if (!buffer || buffer.length < 4) return false;

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && 
        buffer[2] === 0x4E && buffer[3] === 0x47) {
      return true;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return true;
    }

    // GIF: 47 49 46 38 (GIF8)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && 
        buffer[2] === 0x46 && buffer[3] === 0x38) {
      return true;
    }

    // BMP: 42 4D (BM)
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return true;
    }

    return false;
  }

  /**
   * Render image asset to DOM element
   * @param {*} asset - Image asset to render
   * @returns {Object} Render result with element and metadata
   */
  render(asset) {
    if (asset === null || asset === undefined) {
      throw new Error('Invalid image data provided');
    }

    // Create container element
    const container = document.createElement('div');
    container.className = 'image-renderer';
    container.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #f9f9f9;
    `;

    // Create image element
    const img = document.createElement('img');
    this.setupImageElement(img, asset);

    // Create image container for zoom functionality
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';
    imageContainer.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
      padding: 8px;
      background: #ffffff;
    `;
    
    imageContainer.appendChild(img);
    container.appendChild(imageContainer);

    // Create result object
    const result = {
      element: container,
      imageElement: img,
      zoomLevel: 1.0,
      asset: asset
    };

    // Add controls if enabled
    if (this.config.showControls) {
      const controls = this.createControls(result);
      container.insertBefore(controls, imageContainer);
    }

    // Add metadata if enabled
    if (this.config.showMetadata) {
      const metadata = this.createMetadata(asset);
      container.appendChild(metadata);
    }

    return result;
  }

  /**
   * Setup image element with appropriate source
   * @private
   * @param {HTMLImageElement} img - Image element
   * @param {*} asset - Image asset
   */
  setupImageElement(img, asset) {
    // Basic image styling
    img.style.cssText = `
      max-width: 100%;
      height: auto;
      display: block;
      transition: transform 0.2s ease;
      cursor: grab;
    `;

    img.setAttribute('role', 'img');

    // Handle different asset types
    if (Buffer.isBuffer(asset)) {
      this.setupBufferImage(img, asset);
    } else if (typeof asset === 'string') {
      this.setupStringImage(img, asset);
    }

    // Add error handling
    img.addEventListener('error', () => {
      this.handleImageError(img);
    });

    // Add load handling for proper sizing
    img.addEventListener('load', () => {
      this.handleImageLoad(img);
    });
  }

  /**
   * Setup image from Buffer data
   * @private
   * @param {HTMLImageElement} img - Image element
   * @param {Buffer} buffer - Image buffer
   */
  setupBufferImage(img, buffer) {
    try {
      // Create blob from buffer
      const blob = new Blob([buffer], { type: this.detectMimeType(buffer) });
      const objectUrl = URL.createObjectURL(blob);
      
      // Track for cleanup
      this.objectUrls.add(objectUrl);
      
      // Set src immediately (synchronous)
      img.src = objectUrl;
      img.alt = 'Binary Image Data';
      
      // Cleanup object URL when image is removed (but not immediately on load)
      const cleanup = () => {
        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
          this.objectUrls.delete(objectUrl);
        }, 100); // Small delay to allow tests to verify
      };
      
      img.addEventListener('load', cleanup, { once: true });
      img.addEventListener('error', cleanup, { once: true });
      
    } catch (error) {
      this.handleImageError(img);
    }
  }

  /**
   * Setup image from string (path, URL, data URL)
   * @private
   * @param {HTMLImageElement} img - Image element
   * @param {string} asset - Image source string
   */
  setupStringImage(img, asset) {
    img.src = asset;

    // Extract filename for alt text
    if (asset.startsWith('data:')) {
      img.alt = 'Data URL Image';
    } else {
      const filename = asset.split('/').pop().split('?')[0].split('#')[0];
      img.alt = filename || 'Image';
    }
  }

  /**
   * Detect MIME type from Buffer
   * @private
   * @param {Buffer} buffer - Image buffer
   * @returns {string} MIME type
   */
  detectMimeType(buffer) {
    if (!buffer || buffer.length < 4) return 'application/octet-stream';

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && 
        buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'image/png';
    }

    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }

    // GIF
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && 
        buffer[2] === 0x46 && buffer[3] === 0x38) {
      return 'image/gif';
    }

    // BMP
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return 'image/bmp';
    }

    return 'application/octet-stream';
  }

  /**
   * Handle image load event
   * @private
   * @param {HTMLImageElement} img - Image element
   */
  handleImageLoad(img) {
    // Apply initial sizing based on configuration
    if (this.config.maxWidth && img.naturalWidth > this.config.maxWidth) {
      img.style.maxWidth = `${this.config.maxWidth}px`;
    }
    
    if (this.config.maxHeight && img.naturalHeight > this.config.maxHeight) {
      img.style.maxHeight = `${this.config.maxHeight}px`;
    }
  }

  /**
   * Handle image error
   * @private
   * @param {HTMLImageElement} img - Image element
   */
  handleImageError(img) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 200px;
      height: 150px;
      background: #f5f5f5;
      border: 2px dashed #ccc;
      border-radius: 4px;
      color: #666;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      text-align: center;
      padding: 16px;
    `;
    
    errorDiv.textContent = 'Failed to load image';
    
    // Replace img with error div
    if (img.parentNode) {
      img.parentNode.replaceChild(errorDiv, img);
    }
  }

  /**
   * Create zoom and control buttons
   * @private
   * @param {Object} result - Render result object
   * @returns {HTMLElement} Controls element
   */
  createControls(result) {
    const controls = document.createElement('div');
    controls.className = 'image-controls';
    controls.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 8px;
      background: #f0f0f0;
      border-bottom: 1px solid #ddd;
    `;

    const buttons = [
      { class: 'zoom-in', label: 'Zoom In', text: '+', action: () => this.zoomIn(result) },
      { class: 'zoom-out', label: 'Zoom Out', text: '−', action: () => this.zoomOut(result) },
      { class: 'zoom-fit', label: 'Fit to Window', text: '⌂', action: () => this.zoomFit(result) },
      { class: 'zoom-actual', label: 'Actual Size', text: '1:1', action: () => this.zoomActual(result) }
    ];

    buttons.forEach(({ class: className, label, text, action }) => {
      const button = document.createElement('button');
      button.className = className;
      button.textContent = text;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.tabIndex = 0;
      
      button.style.cssText = `
        width: 28px;
        height: 28px;
        border: 1px solid #ccc;
        background: white;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
      `;

      button.addEventListener('click', action);
      controls.appendChild(button);
    });

    return controls;
  }

  /**
   * Create metadata display
   * @private
   * @param {*} asset - Original asset
   * @returns {HTMLElement} Metadata element
   */
  createMetadata(asset) {
    const metadata = document.createElement('div');
    metadata.className = 'image-metadata';
    metadata.style.cssText = `
      padding: 8px;
      background: #f9f9f9;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
      font-family: system-ui, sans-serif;
    `;

    let metadataText = '';
    
    if (Buffer.isBuffer(asset)) {
      metadataText = `Binary image data (${asset.length} bytes)`;
    } else if (typeof asset === 'string') {
      if (asset.startsWith('data:')) {
        metadataText = 'Data URL image';
      } else if (asset.startsWith('http')) {
        const url = new URL(asset);
        metadataText = `${url.pathname.split('/').pop()} from ${url.protocol}//${url.hostname}`;
      } else {
        metadataText = asset.split('/').pop() || asset;
      }
    }

    metadata.textContent = metadataText;
    return metadata;
  }

  /**
   * Zoom in
   * @private
   * @param {Object} result - Render result
   */
  zoomIn(result) {
    const newZoom = Math.min(result.zoomLevel + this.config.zoomStep, this.config.maxZoom);
    this.setZoom(result, newZoom);
  }

  /**
   * Zoom out
   * @private
   * @param {Object} result - Render result
   */
  zoomOut(result) {
    const newZoom = Math.max(result.zoomLevel - this.config.zoomStep, this.config.minZoom);
    this.setZoom(result, newZoom);
  }

  /**
   * Fit image to container
   * @private
   * @param {Object} result - Render result
   */
  zoomFit(result) {
    result.imageElement.style.maxWidth = '100%';
    result.imageElement.style.maxHeight = '100%';
    result.imageElement.style.transform = 'scale(1)';
    result.zoomLevel = 1.0;
  }

  /**
   * Show image at actual size
   * @private
   * @param {Object} result - Render result
   */
  zoomActual(result) {
    this.setZoom(result, 1.0);
  }

  /**
   * Set specific zoom level
   * @private
   * @param {Object} result - Render result
   * @param {number} zoom - Zoom level
   */
  setZoom(result, zoom) {
    result.zoomLevel = zoom;
    result.imageElement.style.transform = `scale(${zoom})`;
    result.imageElement.style.maxWidth = 'none';
    result.imageElement.style.maxHeight = 'none';
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Revoke all object URLs
    this.objectUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.objectUrls.clear();
  }
}