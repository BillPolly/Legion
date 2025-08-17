/**
 * SignaturePad - Client-side signature capture component
 * Wraps signature_pad library for drawing signatures
 */
export class SignaturePad {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: options.width || 400,
      height: options.height || 200,
      penColor: options.penColor || '#000000',
      backgroundColor: options.backgroundColor || '#ffffff',
      penMinWidth: options.penMinWidth || 0.5,
      penMaxWidth: options.penMaxWidth || 2.5,
      velocityFilterWeight: options.velocityFilterWeight || 0.7,
      maintainAspectRatio: options.maintainAspectRatio || false,
      aspectRatio: options.aspectRatio || 2,
      onApply: options.onApply || null,
      onCancel: options.onCancel || null,
      ...options
    };
    
    this.modal = null;
    this.canvas = null;
    this.pad = null;
    this.isVisible = false;
    
    // Buttons
    this.clearButton = null;
    this.applyButton = null;
    this.cancelButton = null;
  }

  /**
   * Show the signature modal
   */
  async show() {
    if (this.isVisible) return;
    
    // Get signature_pad library
    const SignaturePadLib = await this.getSignaturePadLib();
    
    // Create modal
    this.createModal();
    
    // Initialize signature pad
    this.pad = new SignaturePadLib(this.canvas, {
      penColor: this.options.penColor,
      backgroundColor: this.options.backgroundColor,
      minWidth: this.options.penMinWidth,
      maxWidth: this.options.penMaxWidth,
      velocityFilterWeight: this.options.velocityFilterWeight
    });
    
    // Show modal
    this.container.appendChild(this.modal);
    this.isVisible = true;
  }

  /**
   * Hide the signature modal
   */
  hide() {
    if (!this.isVisible) return;
    
    if (this.modal) {
      this.modal.remove();
    }
    
    this.isVisible = false;
  }

  /**
   * Create modal elements
   */
  createModal() {
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'signature-modal';
    this.modal.style.position = 'fixed';
    this.modal.style.top = '50%';
    this.modal.style.left = '50%';
    this.modal.style.transform = 'translate(-50%, -50%)';
    this.modal.style.backgroundColor = 'white';
    this.modal.style.padding = '20px';
    this.modal.style.borderRadius = '8px';
    this.modal.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    this.modal.style.zIndex = '1000';
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'signature-backdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100%';
    backdrop.style.height = '100%';
    backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    backdrop.style.zIndex = '999';
    
    // Create title
    const title = document.createElement('h3');
    title.textContent = 'Draw Your Signature';
    title.style.marginTop = '0';
    title.style.marginBottom = '15px';
    title.style.textAlign = 'center';
    this.modal.appendChild(title);
    
    // Create canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'signature-canvas-container';
    canvasContainer.style.border = '2px solid #e0e0e0';
    canvasContainer.style.borderRadius = '4px';
    canvasContainer.style.marginBottom = '15px';
    canvasContainer.style.backgroundColor = this.options.backgroundColor;
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'signature-canvas';
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    canvasContainer.appendChild(this.canvas);
    this.modal.appendChild(canvasContainer);
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'signature-buttons';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.gap = '10px';
    
    // Create clear button
    this.clearButton = this.createButton('Clear', () => this.clear());
    this.clearButton.style.backgroundColor = '#f0f0f0';
    buttonContainer.appendChild(this.clearButton);
    
    // Create cancel button
    this.cancelButton = this.createButton('Cancel', () => this.cancel());
    this.cancelButton.style.backgroundColor = '#f0f0f0';
    buttonContainer.appendChild(this.cancelButton);
    
    // Create apply button
    this.applyButton = this.createButton('Apply', () => this.apply());
    this.applyButton.style.backgroundColor = '#4CAF50';
    this.applyButton.style.color = 'white';
    buttonContainer.appendChild(this.applyButton);
    
    this.modal.appendChild(buttonContainer);
    
    // Add backdrop to container first
    this.container.appendChild(backdrop);
    
    // Store backdrop reference for removal
    this.backdrop = backdrop;
  }

  /**
   * Create a button element
   */
  createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'signature-button';
    button.style.padding = '8px 16px';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.flex = '1';
    
    button.onclick = onClick;
    button.click = onClick; // For testing
    
    return button;
  }

  /**
   * Clear the signature
   */
  clear() {
    if (this.pad) {
      this.pad.clear();
    }
  }

  /**
   * Check if signature is empty
   */
  isEmpty() {
    return this.pad ? this.pad.isEmpty() : true;
  }

  /**
   * Get signature as base64 image
   */
  getSignature(format = 'image/png') {
    if (!this.pad || this.pad.isEmpty()) {
      return null;
    }
    
    return this.pad.toDataURL(format);
  }

  /**
   * Apply the signature
   */
  apply() {
    if (this.isEmpty()) {
      return null;
    }
    
    const signature = this.getSignature();
    
    if (this.options.onApply) {
      this.options.onApply(signature);
    }
    
    this.hide();
    return signature;
  }

  /**
   * Cancel signature capture
   */
  cancel() {
    if (this.options.onCancel) {
      this.options.onCancel();
    }
    
    this.hide();
  }

  /**
   * Undo last stroke
   */
  undo() {
    if (!this.pad) return;
    
    const data = this.pad.toData();
    if (data && data.length > 0) {
      data.pop(); // Remove last stroke
      this.pad.fromData(data);
    }
  }

  /**
   * Set pen color
   */
  setPenColor(color) {
    this.options.penColor = color;
    if (this.pad) {
      this.pad.penColor = color;
    }
  }

  /**
   * Set pen width
   */
  setPenWidth(min, max) {
    if (this.pad) {
      this.pad.minWidth = min;
      this.pad.maxWidth = max;
    }
  }

  /**
   * Set background color
   */
  setBackgroundColor(color) {
    this.options.backgroundColor = color;
    
    if (this.canvas) {
      const ctx = this.canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Resize canvas
   */
  resize(width, height) {
    if (this.options.maintainAspectRatio) {
      // Adjust height to maintain aspect ratio
      height = width / this.options.aspectRatio;
    }
    
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    
    this.options.width = width;
    this.options.height = height;
  }

  /**
   * Load signature from data URL
   */
  loadSignature(dataUrl) {
    if (this.pad) {
      this.pad.fromDataURL(dataUrl);
    }
  }

  /**
   * Get signature_pad library
   */
  async getSignaturePadLib() {
    // In browser, signature_pad should be loaded
    if (typeof window !== 'undefined' && window.SignaturePad) {
      return window.SignaturePad;
    }
    
    // Try dynamic import
    try {
      const module = await import('signature_pad');
      return module.default || module.SignaturePad;
    } catch (error) {
      throw new Error('SignaturePad library not available. Please include it in your HTML.');
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.modal) {
      this.modal.remove();
    }
    
    if (this.backdrop) {
      this.backdrop.remove();
    }
    
    this.pad = null;
    this.canvas = null;
    this.modal = null;
    this.backdrop = null;
    this.isVisible = false;
  }
}