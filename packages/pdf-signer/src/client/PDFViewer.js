/**
 * PDFViewer - Client-side PDF viewing component
 * Wraps PDF.js for rendering PDFs in the browser
 */
export class PDFViewer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      scale: options.scale || 1.0,
      enableTextLayer: options.enableTextLayer !== false,
      enableAnnotationLayer: options.enableAnnotationLayer !== false,
      ...options
    };
    
    this.currentPDF = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.pdfDocument = null;
    this.fieldOverlays = [];
    this.onFieldClick = null;
  }

  /**
   * Load and display a PDF
   */
  async loadPDF(pdfData, signatureFields = []) {
    try {
      // Import PDF.js dynamically (browser only)
      const pdfjsLib = await this.getPDFJS();
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: this.base64ToArrayBuffer(pdfData)
      });
      
      this.pdfDocument = await loadingTask.promise;
      this.totalPages = this.pdfDocument.numPages;
      this.currentPage = 1;
      
      // Render first page
      await this.renderPage(this.currentPage);
      
      // Add signature field overlays
      this.renderFieldOverlays(signatureFields);
      
      return {
        success: true,
        pageCount: this.totalPages
      };
    } catch (error) {
      console.error('Failed to load PDF:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Render a specific page
   */
  async renderPage(pageNumber) {
    if (!this.pdfDocument) {
      throw new Error('No PDF document loaded');
    }
    
    if (pageNumber < 1 || pageNumber > this.totalPages) {
      throw new Error(`Invalid page number: ${pageNumber}`);
    }
    
    // Get page
    const page = await this.pdfDocument.getPage(pageNumber);
    
    // Set up canvas
    const canvas = this.getOrCreateCanvas();
    const context = canvas.getContext('2d');
    
    // Calculate viewport
    const viewport = page.getViewport({ scale: this.options.scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render page
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Update current page
    this.currentPage = pageNumber;
    
    // Update page info display
    this.updatePageInfo();
  }

  /**
   * Render signature field overlays
   */
  renderFieldOverlays(signatureFields) {
    // Clear existing overlays
    this.clearFieldOverlays();
    
    // Filter fields for current page
    const currentPageFields = signatureFields.filter(
      field => field.page === this.currentPage
    );
    
    // Create overlay for each field
    currentPageFields.forEach(field => {
      const overlay = this.createFieldOverlay(field);
      this.fieldOverlays.push(overlay);
      this.container.appendChild(overlay);
    });
  }

  /**
   * Create a field overlay element
   */
  createFieldOverlay(field) {
    const overlay = document.createElement('div');
    overlay.className = 'signature-field-overlay';
    overlay.dataset.fieldId = field.id;
    
    // Position and size
    overlay.style.position = 'absolute';
    overlay.style.left = `${field.x * this.options.scale}px`;
    overlay.style.top = `${field.y * this.options.scale}px`;
    overlay.style.width = `${field.width * this.options.scale}px`;
    overlay.style.height = `${field.height * this.options.scale}px`;
    
    // Styling
    overlay.style.border = field.signed ? '2px solid #4CAF50' : '2px dashed #2196F3';
    overlay.style.backgroundColor = field.signed ? 'rgba(76, 175, 80, 0.1)' : 'rgba(33, 150, 243, 0.1)';
    overlay.style.cursor = field.signed ? 'default' : 'pointer';
    overlay.style.zIndex = '10';
    
    // Add label
    if (field.label) {
      const label = document.createElement('span');
      label.className = 'field-label';
      label.textContent = field.label;
      label.style.position = 'absolute';
      label.style.top = '-20px';
      label.style.left = '0';
      label.style.fontSize = '12px';
      label.style.color = field.signed ? '#4CAF50' : '#2196F3';
      overlay.appendChild(label);
    }
    
    // Add status icon
    if (field.signed) {
      const checkmark = document.createElement('span');
      checkmark.className = 'field-status';
      checkmark.innerHTML = '✓';
      checkmark.style.position = 'absolute';
      checkmark.style.top = '5px';
      checkmark.style.right = '5px';
      checkmark.style.color = '#4CAF50';
      checkmark.style.fontSize = '20px';
      overlay.appendChild(checkmark);
    } else if (field.required) {
      const required = document.createElement('span');
      required.className = 'field-required';
      required.innerHTML = '*';
      required.style.position = 'absolute';
      required.style.top = '5px';
      required.style.right = '5px';
      required.style.color = '#F44336';
      required.style.fontSize = '20px';
      overlay.appendChild(required);
    }
    
    // Add click handler
    if (!field.signed && this.onFieldClick) {
      overlay.addEventListener('click', () => {
        this.onFieldClick(field);
      });
    }
    
    return overlay;
  }

  /**
   * Clear field overlays
   */
  clearFieldOverlays() {
    this.fieldOverlays.forEach(overlay => {
      overlay.remove();
    });
    this.fieldOverlays = [];
  }

  /**
   * Navigate to next page
   */
  async nextPage() {
    if (this.currentPage < this.totalPages) {
      await this.renderPage(this.currentPage + 1);
    }
  }

  /**
   * Navigate to previous page
   */
  async previousPage() {
    if (this.currentPage > 1) {
      await this.renderPage(this.currentPage - 1);
    }
  }

  /**
   * Go to specific page
   */
  async goToPage(pageNumber) {
    await this.renderPage(pageNumber);
  }

  /**
   * Zoom in
   */
  async zoomIn() {
    this.options.scale = Math.min(this.options.scale * 1.25, 3.0);
    await this.renderPage(this.currentPage);
  }

  /**
   * Zoom out
   */
  async zoomOut() {
    this.options.scale = Math.max(this.options.scale * 0.8, 0.5);
    await this.renderPage(this.currentPage);
  }

  /**
   * Fit to width
   */
  async fitToWidth() {
    if (!this.container || !this.pdfDocument) return;
    
    const page = await this.pdfDocument.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: 1.0 });
    
    const containerWidth = this.container.clientWidth;
    this.options.scale = containerWidth / viewport.width;
    
    await this.renderPage(this.currentPage);
  }

  /**
   * Set field click handler
   */
  setFieldClickHandler(handler) {
    this.onFieldClick = handler;
  }

  /**
   * Update field status
   */
  updateFieldStatus(fieldId, signed) {
    const overlay = this.fieldOverlays.find(
      o => o.dataset.fieldId === fieldId
    );
    
    if (overlay) {
      // Update styling
      overlay.style.border = signed ? '2px solid #4CAF50' : '2px dashed #2196F3';
      overlay.style.backgroundColor = signed ? 'rgba(76, 175, 80, 0.1)' : 'rgba(33, 150, 243, 0.1)';
      overlay.style.cursor = signed ? 'default' : 'pointer';
      
      // Update status icon
      const statusElement = overlay.querySelector('.field-status, .field-required');
      if (statusElement) {
        if (signed) {
          statusElement.className = 'field-status';
          statusElement.innerHTML = '✓';
          statusElement.style.color = '#4CAF50';
        }
      }
    }
  }

  /**
   * Get or create canvas element
   */
  getOrCreateCanvas() {
    let canvas = this.container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'pdf-canvas';
      this.container.appendChild(canvas);
    }
    return canvas;
  }

  /**
   * Update page info display
   */
  updatePageInfo() {
    const event = new CustomEvent('pagechange', {
      detail: {
        currentPage: this.currentPage,
        totalPages: this.totalPages
      }
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const base64Data = base64.split(',')[1] || base64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get PDF.js library (browser environment)
   */
  async getPDFJS() {
    // In browser, PDF.js should be loaded via script tag or import
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      return window.pdfjsLib;
    }
    
    // Try dynamic import
    try {
      const pdfjsModule = await import('pdfjs-dist');
      return pdfjsModule;
    } catch (error) {
      throw new Error('PDF.js library not available. Please include it in your HTML.');
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.clearFieldOverlays();
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
    const canvas = this.container.querySelector('canvas');
    if (canvas) {
      canvas.remove();
    }
  }
}