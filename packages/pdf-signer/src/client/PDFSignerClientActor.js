import { PDFViewer } from '@legion/pdf-signer/client/PDFViewer.js';
import { SignaturePad } from '@legion/pdf-signer/client/SignaturePad.js';
import { MessageTypes, createMessage } from '@legion/pdf-signer/shared/SignatureTypes.js';

/**
 * PDFSignerClientActor - Client-side actor for PDF signing operations
 */
export class PDFSignerClientActor {
  constructor(container) {
    this.container = container;
    this.remoteActor = null;
    
    // UI Components (initialized on demand)
    this.viewer = null;
    this.signaturePad = null;
    
    // State
    this.currentDocument = null;
    this.currentField = null;
    this.loadingElement = null;
  }

  /**
   * Set remote actor reference (called by framework)
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  /**
   * Initialize UI components
   */
  async initializeUI() {
    if (!this.viewer) {
      this.viewer = new PDFViewer(this.container);
      this.viewer.setFieldClickHandler((field) => this.handleFieldClick(field));
    }
    
    if (!this.signaturePad) {
      this.signaturePad = new SignaturePad(this.container, {
        onApply: (signature) => this.handleSignatureApply(signature),
        onCancel: () => this.handleSignatureCancel()
      });
    }
  }

  /**
   * Primary message handler (ActorSpace protocol)
   */
  async receive(messageType, data) {
    try {
      switch (messageType) {
        case MessageTypes.PDF_READY:
          await this.handlePDFReady(data);
          break;
          
        case MessageTypes.SIGNATURE_ADDED:
          await this.handleSignatureAdded(data);
          break;
          
        case MessageTypes.SIGNATURE_CLEARED:
          await this.handleSignatureCleared(data);
          break;
          
        case MessageTypes.PDF_DOWNLOAD_READY:
          await this.handleDownloadReady(data);
          break;
          
        case MessageTypes.ERROR:
          await this.handleError(data);
          break;
          
        default:
          console.warn('Unknown message type:', messageType);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.showError(error.message);
    }
  }

  /**
   * Handle PDF ready message
   */
  async handlePDFReady(data) {
    const { documentId, filename, pageCount, signatureFields, pdfBase64 } = data;
    
    // Initialize UI if needed
    await this.initializeUI();
    
    // Store document info
    this.currentDocument = {
      id: documentId,
      filename,
      pageCount,
      fields: signatureFields
    };
    
    // Load PDF in viewer
    await this.viewer.loadPDF(pdfBase64, signatureFields);
    
    // Hide loading
    this.hideLoading();
    
    // Show success
    this.showSuccess(`PDF loaded: ${filename}`);
  }

  /**
   * Handle signature added message
   */
  async handleSignatureAdded(data) {
    const { fieldId, success, remainingFields } = data;
    
    if (success) {
      // Update field status
      this.updateFieldStatus(fieldId, true);
      this.viewer.updateFieldStatus(fieldId, true);
      
      // Show success
      const message = remainingFields > 0 
        ? `Signature added. ${remainingFields} fields remaining.`
        : 'All required signatures completed!';
      this.showSuccess(message);
    }
  }

  /**
   * Handle signature cleared message
   */
  async handleSignatureCleared(data) {
    const { fieldId, success } = data;
    
    if (success) {
      // Update field status
      this.updateFieldStatus(fieldId, false);
      this.viewer.updateFieldStatus(fieldId, false);
      
      this.showSuccess('Signature cleared');
    }
  }

  /**
   * Handle download ready message
   */
  async handleDownloadReady(data) {
    const { filename, pdfBase64 } = data;
    
    // Create download link
    const link = document.createElement('a');
    link.href = pdfBase64;
    link.download = filename;
    link.click();
    link.remove();
    
    this.showSuccess('PDF downloaded successfully');
  }

  /**
   * Handle error message
   */
  async handleError(data) {
    console.error('Error received:', data);
    this.showError(data.message || 'An error occurred');
    this.hideLoading();
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(file) {
    if (!file || file.type !== 'application/pdf') {
      this.showError('Please select a valid PDF file');
      return;
    }
    
    this.showLoading('Reading PDF file...');
    
    // Read file as base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const pdfBase64 = event.target.result;
      
      // Send to server
      if (this.remoteActor) {
        this.remoteActor.receive(MessageTypes.UPLOAD_PDF, {
          pdfBase64,
          filename: file.name,
          metadata: {
            size: file.size,
            lastModified: file.lastModified
          }
        });
      }
      
      this.showLoading('Processing PDF...');
    };
    
    reader.readAsDataURL(file);
  }

  /**
   * Handle signature field click
   */
  async handleFieldClick(field) {
    if (field.signed) {
      // Optionally show field info or offer to clear
      return;
    }
    
    // Store current field
    this.currentField = field;
    
    // Initialize signature pad if needed
    if (!this.signaturePad) {
      await this.initializeUI();
    }
    
    // Configure signature pad
    if (this.signaturePad.options) {
      this.signaturePad.options.onApply = (signature) => this.handleSignatureApply(signature);
    }
    
    // Show signature pad
    await this.signaturePad.show();
  }

  /**
   * Handle signature apply
   */
  handleSignatureApply(signatureData) {
    if (!this.currentField || !this.currentDocument) {
      return;
    }
    
    // Send signature to server
    if (this.remoteActor) {
      this.remoteActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId: this.currentDocument.id,
        fieldId: this.currentField.id,
        signatureImage: signatureData,
        metadata: {
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        }
      });
    }
    
    // Clear current field
    this.currentField = null;
    
    this.showLoading('Adding signature...');
  }

  /**
   * Handle signature cancel
   */
  handleSignatureCancel() {
    this.currentField = null;
  }

  /**
   * Handle clear signature request
   */
  handleClearSignature(fieldId) {
    if (!this.currentDocument) {
      return;
    }
    
    if (this.remoteActor) {
      this.remoteActor.receive(MessageTypes.CLEAR_SIGNATURE, {
        documentId: this.currentDocument.id,
        fieldId
      });
    }
    
    this.showLoading('Clearing signature...');
  }

  /**
   * Handle download request
   */
  handleDownloadRequest() {
    if (!this.currentDocument) {
      this.showError('No document loaded');
      return;
    }
    
    if (this.remoteActor) {
      this.remoteActor.receive(MessageTypes.DOWNLOAD_PDF, {
        documentId: this.currentDocument.id
      });
    }
    
    this.showLoading('Preparing download...');
  }

  /**
   * Update field status in document
   */
  updateFieldStatus(fieldId, signed) {
    if (!this.currentDocument) return;
    
    const field = this.currentDocument.fields.find(f => f.id === fieldId);
    if (field) {
      field.signed = signed;
    }
  }

  /**
   * Show loading indicator
   */
  showLoading(message = 'Loading...') {
    this.hideLoading();
    
    this.loadingElement = document.createElement('div');
    this.loadingElement.className = 'pdf-signer-loading';
    this.loadingElement.textContent = message;
    
    // Set styles if style object exists (browser environment)
    if (this.loadingElement.style) {
      this.loadingElement.style.position = 'fixed';
      this.loadingElement.style.top = '50%';
      this.loadingElement.style.left = '50%';
      this.loadingElement.style.transform = 'translate(-50%, -50%)';
      this.loadingElement.style.padding = '20px';
      this.loadingElement.style.backgroundColor = 'white';
      this.loadingElement.style.border = '1px solid #ccc';
      this.loadingElement.style.borderRadius = '4px';
      this.loadingElement.style.zIndex = '10000';
    }
    
    if (document.body && document.body.appendChild) {
      document.body.appendChild(this.loadingElement);
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    if (this.loadingElement) {
      this.loadingElement.remove();
      this.loadingElement = null;
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error('Error:', message);
    // In production, use a better notification system
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`Error: ${message}`);
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    console.log('Success:', message);
    // In production, use a better notification system
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.viewer) {
      this.viewer.destroy();
    }
    
    if (this.signaturePad) {
      this.signaturePad.destroy();
    }
    
    this.hideLoading();
    
    this.currentDocument = null;
    this.currentField = null;
    this.remoteActor = null;
  }
}

/**
 * Factory function to create client actor
 */
export function createPDFSignerClientActor(container) {
  return new PDFSignerClientActor(container);
}

// Default export for Legion Server Framework compatibility
export default PDFSignerClientActor;