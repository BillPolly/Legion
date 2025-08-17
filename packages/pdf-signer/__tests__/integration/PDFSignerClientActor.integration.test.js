import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PDFSignerClientActor } from '../../src/client/PDFSignerClientActor.js';
import { PDFViewer } from '../../src/client/PDFViewer.js';
import { SignaturePad } from '../../src/client/SignaturePad.js';
import { MessageTypes, createMessage } from '../../src/shared/SignatureTypes.js';
import { JSDOM } from 'jsdom';
import { TestUtils } from '../utils/TestUtils.js';

describe('PDFSignerClientActor Integration Tests', () => {
  let dom;
  let container;
  let actor;
  let mockRemoteActor;
  
  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="pdf-container" style="width: 800px; height: 600px;"></div>
        </body>
      </html>
    `, { 
      url: 'http://localhost',
      resources: 'usable',
      runScripts: 'dangerously'
    });
    
    global.window = dom.window;
    global.document = dom.window.document;
    global.CustomEvent = dom.window.CustomEvent;
    global.FileReader = dom.window.FileReader;
    global.navigator = { userAgent: 'test-browser' };
    
    // Mock PDF.js
    global.window.pdfjsLib = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: (pageNum) => Promise.resolve({
            getViewport: ({ scale }) => ({
              width: 612 * scale,
              height: 792 * scale,
              scale
            }),
            render: () => ({
              promise: Promise.resolve()
            })
          }),
          destroy: () => {}
        })
      })
    };
    
    // Mock SignaturePad library
    global.window.SignaturePad = class {
      constructor(canvas, options) {
        this.canvas = canvas;
        this.options = options;
        this.penColor = options?.penColor || '#000000';
        this._isEmpty = true;
        this._data = [];
      }
      
      isEmpty() { return this._isEmpty; }
      clear() { 
        this._isEmpty = true; 
        this._data = [];
      }
      toDataURL() { 
        return this._isEmpty ? null : 'data:image/png;base64,testsignature';
      }
      fromDataURL() { this._isEmpty = false; }
      toData() { return this._data; }
      fromData(data) { 
        this._data = data;
        this._isEmpty = data.length === 0;
      }
      simulateDraw() {
        this._isEmpty = false;
        this._data.push({ x: 10, y: 10 });
      }
    };
    
    // Get container
    container = document.getElementById('pdf-container');
    
    // Create mock remote actor
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    // Create actor
    actor = new PDFSignerClientActor(container);
    actor.setRemoteActor(mockRemoteActor);
  });
  
  afterEach(() => {
    if (actor) {
      actor.cleanup();
    }
    dom.window.close();
  });

  describe('Complete Signing Workflow', () => {
    it('should handle complete PDF signing workflow', async () => {
      // Step 1: Receive PDF ready message
      const pdfReadyMessage = createMessage(MessageTypes.PDF_READY, {
        documentId: 'doc-123',
        filename: 'contract.pdf',
        pageCount: 2,
        signatureFields: [
          {
            id: 'sig-1',
            page: 1,
            x: 100,
            y: 500,
            width: 200,
            height: 50,
            label: 'Signer 1',
            required: true,
            signed: false
          },
          {
            id: 'sig-2',
            page: 2,
            x: 100,
            y: 600,
            width: 200,
            height: 50,
            label: 'Signer 2',
            required: false,
            signed: false
          }
        ],
        pdfBase64: TestUtils.bufferToBase64(TestUtils.createTestPDF())
      });
      
      await actor.receive(pdfReadyMessage.type, pdfReadyMessage.data);
      
      // Verify document loaded
      expect(actor.currentDocument).toBeDefined();
      expect(actor.currentDocument.id).toBe('doc-123');
      expect(actor.currentDocument.fields).toHaveLength(2);
      
      // Verify PDF viewer initialized
      expect(actor.viewer).toBeDefined();
      expect(actor.viewer).toBeInstanceOf(PDFViewer);
      
      // Step 2: Click on signature field to open signature pad
      const field = actor.currentDocument.fields[0];
      await actor.handleFieldClick(field);
      
      // Verify signature pad initialized
      expect(actor.signaturePad).toBeDefined();
      expect(actor.signaturePad).toBeInstanceOf(SignaturePad);
      expect(actor.currentField).toBe(field);
      
      // Step 3: Apply signature
      const signatureData = 'data:image/png;base64,mysignature';
      actor.handleSignatureApply(signatureData);
      
      // Verify signature sent to server
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.ADD_SIGNATURE,
        expect.objectContaining({
          documentId: 'doc-123',
          fieldId: 'sig-1',
          signatureImage: signatureData
        })
      );
      
      // Step 4: Receive signature added confirmation
      const signatureAddedMessage = createMessage(MessageTypes.SIGNATURE_ADDED, {
        documentId: 'doc-123',
        fieldId: 'sig-1',
        success: true,
        remainingFields: 0
      });
      
      await actor.receive(signatureAddedMessage.type, signatureAddedMessage.data);
      
      // Verify field marked as signed
      expect(actor.currentDocument.fields[0].signed).toBe(true);
      
      // Step 5: Request download
      actor.handleDownloadRequest();
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.DOWNLOAD_PDF,
        { documentId: 'doc-123' }
      );
      
      // Step 6: Receive download ready
      const downloadReadyMessage = createMessage(MessageTypes.PDF_DOWNLOAD_READY, {
        documentId: 'doc-123',
        filename: 'contract_signed.pdf',
        pdfBase64: TestUtils.bufferToBase64(TestUtils.createTestPDF())
      });
      
      await actor.receive(downloadReadyMessage.type, downloadReadyMessage.data);
      
      // Download would trigger in real browser
    });

    it('should handle signature clearing', async () => {
      // Setup document with signed field
      const pdfReadyMessage = createMessage(MessageTypes.PDF_READY, {
        documentId: 'doc-456',
        filename: 'document.pdf',
        pageCount: 1,
        signatureFields: [
          {
            id: 'sig-clear',
            page: 1,
            x: 100,
            y: 500,
            width: 200,
            height: 50,
            signed: true
          }
        ],
        pdfBase64: TestUtils.bufferToBase64(TestUtils.createTestPDF())
      });
      
      await actor.receive(pdfReadyMessage.type, pdfReadyMessage.data);
      
      // Clear signature
      actor.handleClearSignature('sig-clear');
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.CLEAR_SIGNATURE,
        {
          documentId: 'doc-456',
          fieldId: 'sig-clear'
        }
      );
      
      // Receive clear confirmation
      const clearMessage = createMessage(MessageTypes.SIGNATURE_CLEARED, {
        documentId: 'doc-456',
        fieldId: 'sig-clear',
        success: true
      });
      
      await actor.receive(clearMessage.type, clearMessage.data);
      
      // Verify field marked as unsigned
      expect(actor.currentDocument.fields[0].signed).toBe(false);
    });
  });

  describe('File Upload', () => {
    it('should handle PDF file upload', async () => {
      // Create mock file
      const pdfContent = TestUtils.createTestPDF();
      const file = new File([pdfContent], 'upload.pdf', { type: 'application/pdf' });
      
      // Mock FileReader
      global.FileReader = class {
        readAsDataURL(file) {
          setTimeout(() => {
            this.result = TestUtils.bufferToBase64(pdfContent);
            if (this.onload) {
              this.onload({ target: { result: this.result } });
            }
          }, 0);
        }
      };
      
      await actor.handleFileUpload(file);
      
      // Wait for FileReader to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.UPLOAD_PDF,
        expect.objectContaining({
          filename: 'upload.pdf',
          pdfBase64: expect.stringContaining('data:application/pdf;base64')
        })
      );
    });

    it('should reject non-PDF files', async () => {
      const file = new File(['text content'], 'document.txt', { type: 'text/plain' });
      
      await actor.handleFileUpload(file);
      
      expect(mockRemoteActor.receive).not.toHaveBeenCalled();
    });
  });

  describe('UI Component Integration', () => {
    it('should initialize UI components on demand', async () => {
      expect(actor.viewer).toBeNull();
      expect(actor.signaturePad).toBeNull();
      
      await actor.initializeUI();
      
      expect(actor.viewer).toBeInstanceOf(PDFViewer);
      expect(actor.signaturePad).toBeInstanceOf(SignaturePad);
    });

    it('should set up field click handler', async () => {
      await actor.initializeUI();
      
      const field = { id: 'test-field', signed: false };
      
      // Simulate field click through viewer
      const clickHandler = actor.viewer.onFieldClick;
      expect(clickHandler).toBeDefined();
      
      await clickHandler(field);
      
      expect(actor.currentField).toBe(field);
    });

    it('should handle signature pad callbacks', async () => {
      await actor.initializeUI();
      
      // Test apply callback
      actor.currentDocument = { id: 'doc-789' };
      actor.currentField = { id: 'field-789' };
      
      const signatureData = 'data:image/png;base64,signature';
      actor.signaturePad.options.onApply(signatureData);
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.ADD_SIGNATURE,
        expect.objectContaining({
          documentId: 'doc-789',
          fieldId: 'field-789',
          signatureImage: signatureData
        })
      );
      
      // Test cancel callback
      actor.currentField = { id: 'field-cancel' };
      actor.signaturePad.options.onCancel();
      
      expect(actor.currentField).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors from server', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const errorMessage = createMessage(MessageTypes.ERROR, {
        code: 'PDF_PROCESSING_ERROR',
        message: 'Failed to process PDF'
      });
      
      await actor.receive(errorMessage.type, errorMessage.data);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error received:',
        expect.objectContaining({
          code: 'PDF_PROCESSING_ERROR',
          message: 'Failed to process PDF'
        })
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle viewer initialization errors', async () => {
      // Remove PDF.js to cause error
      delete global.window.pdfjsLib;
      
      const pdfReadyMessage = createMessage(MessageTypes.PDF_READY, {
        documentId: 'doc-error',
        filename: 'error.pdf',
        pageCount: 1,
        signatureFields: [],
        pdfBase64: 'data:application/pdf;base64,test'
      });
      
      // Should handle error gracefully
      await actor.receive(pdfReadyMessage.type, pdfReadyMessage.data);
      
      // Actor should still have document info even if viewer fails
      expect(actor.currentDocument).toBeDefined();
      expect(actor.currentDocument.id).toBe('doc-error');
    });
  });

  describe('State Management', () => {
    it('should maintain document state across operations', async () => {
      // Load document
      const pdfReadyMessage = createMessage(MessageTypes.PDF_READY, {
        documentId: 'doc-state',
        filename: 'state.pdf',
        pageCount: 1,
        signatureFields: [
          { id: 'field-1', signed: false },
          { id: 'field-2', signed: false }
        ],
        pdfBase64: TestUtils.bufferToBase64(TestUtils.createTestPDF())
      });
      
      await actor.receive(pdfReadyMessage.type, pdfReadyMessage.data);
      
      expect(actor.currentDocument.fields).toHaveLength(2);
      
      // Add signature to first field
      await actor.receive(MessageTypes.SIGNATURE_ADDED, {
        documentId: 'doc-state',
        fieldId: 'field-1',
        success: true,
        remainingFields: 1
      });
      
      expect(actor.currentDocument.fields[0].signed).toBe(true);
      expect(actor.currentDocument.fields[1].signed).toBe(false);
      
      // Add signature to second field
      await actor.receive(MessageTypes.SIGNATURE_ADDED, {
        documentId: 'doc-state',
        fieldId: 'field-2',
        success: true,
        remainingFields: 0
      });
      
      expect(actor.currentDocument.fields[0].signed).toBe(true);
      expect(actor.currentDocument.fields[1].signed).toBe(true);
    });
  });

  describe('Loading States', () => {
    it('should show and hide loading indicator', () => {
      actor.showLoading('Processing...');
      
      const loadingElement = document.querySelector('.pdf-signer-loading');
      expect(loadingElement).toBeTruthy();
      expect(loadingElement.textContent).toBe('Processing...');
      
      actor.hideLoading();
      
      expect(document.querySelector('.pdf-signer-loading')).toBeFalsy();
    });

    it('should show loading during operations', async () => {
      actor.currentDocument = { id: 'doc-loading' };
      
      // Download request should show loading
      actor.handleDownloadRequest();
      
      let loadingElement = document.querySelector('.pdf-signer-loading');
      expect(loadingElement).toBeTruthy();
      expect(loadingElement.textContent).toContain('download');
      
      actor.hideLoading();
      
      // Clear signature should show loading
      actor.handleClearSignature('field-loading');
      
      loadingElement = document.querySelector('.pdf-signer-loading');
      expect(loadingElement).toBeTruthy();
      expect(loadingElement.textContent).toContain('Clear');
    });
  });

  describe('Cleanup', () => {
    it('should clean up all resources', async () => {
      // Initialize everything
      await actor.initializeUI();
      actor.currentDocument = { id: 'doc-cleanup' };
      actor.currentField = { id: 'field-cleanup' };
      actor.showLoading('Cleaning up...');
      
      // Clean up
      actor.cleanup();
      
      // Verify cleanup
      expect(actor.currentDocument).toBeNull();
      expect(actor.currentField).toBeNull();
      expect(actor.remoteActor).toBeNull();
      expect(document.querySelector('.pdf-signer-loading')).toBeFalsy();
    });
  });
});