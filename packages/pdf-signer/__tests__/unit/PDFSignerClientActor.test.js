import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDFSignerClientActor } from '../../src/client/PDFSignerClientActor.js';
import { MessageTypes, createMessage } from '../../src/shared/SignatureTypes.js';

// Mock DOM and browser APIs
global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn((tag) => {
    const element = {
      tagName: tag,
      style: {},
      appendChild: jest.fn(),
      remove: jest.fn(),
      className: '',
      textContent: '',
      href: '',
      download: '',
      click: jest.fn()
    };
    return element;
  }),
  body: {
    appendChild: jest.fn()
  }
};

global.window = {
  URL: {
    createObjectURL: jest.fn(() => 'blob:mock-url'),
    revokeObjectURL: jest.fn()
  },
  alert: jest.fn()
};

global.navigator = {
  userAgent: 'test-user-agent'
};

// Mock FileReader
global.FileReader = class {
  constructor() {
    this.onload = null;
    this.result = null;
  }
  readAsDataURL(file) {
    setTimeout(() => {
      this.result = 'data:application/pdf;base64,mockpdfdata';
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
};

describe('PDFSignerClientActor', () => {
  let actor;
  let mockContainer;
  let mockViewer;
  let mockSignaturePad;
  let mockRemoteActor;
  
  beforeEach(() => {
    // Reset document createElement mock for each test
    jest.clearAllMocks();
    
    // Create mock container
    mockContainer = {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(),
      style: {}
    };
    
    // Create mock PDFViewer
    mockViewer = {
      loadPDF: jest.fn(() => Promise.resolve({ success: true, pageCount: 2 })),
      renderFieldOverlays: jest.fn(),
      setFieldClickHandler: jest.fn(),
      updateFieldStatus: jest.fn(),
      destroy: jest.fn()
    };
    
    // Create mock SignaturePad
    mockSignaturePad = {
      show: jest.fn(() => Promise.resolve()),
      hide: jest.fn(),
      getSignature: jest.fn(() => 'data:image/png;base64,signature'),
      destroy: jest.fn()
    };
    
    // Create mock remote actor
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    // Create actor with mocks
    actor = new PDFSignerClientActor(mockContainer);
    actor.viewer = mockViewer;
    actor.signaturePad = mockSignaturePad;
  });

  describe('Initialization', () => {
    it('should create actor with container', () => {
      const newActor = new PDFSignerClientActor(mockContainer);
      expect(newActor.container).toBe(mockContainer);
      expect(newActor.remoteActor).toBeNull();
      expect(newActor.currentDocument).toBeNull();
    });

    it('should set remote actor', () => {
      actor.setRemoteActor(mockRemoteActor);
      expect(actor.remoteActor).toBe(mockRemoteActor);
    });

    it('should initialize UI components on first use', async () => {
      const newActor = new PDFSignerClientActor(mockContainer);
      await newActor.initializeUI();
      
      expect(newActor.viewer).toBeDefined();
      expect(newActor.signaturePad).toBeDefined();
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      actor.setRemoteActor(mockRemoteActor);
    });

    it('should handle PDF_READY message', async () => {
      const message = createMessage(MessageTypes.PDF_READY, {
        documentId: 'doc-123',
        filename: 'test.pdf',
        pageCount: 2,
        signatureFields: [
          { id: 'field-1', page: 1, x: 100, y: 200, width: 150, height: 50 }
        ],
        pdfBase64: 'data:application/pdf;base64,pdfdata'
      });
      
      await actor.receive(message.type, message.data);
      
      expect(actor.currentDocument).toEqual({
        id: 'doc-123',
        filename: 'test.pdf',
        pageCount: 2,
        fields: message.data.signatureFields
      });
      
      expect(mockViewer.loadPDF).toHaveBeenCalledWith(
        'data:application/pdf;base64,pdfdata',
        message.data.signatureFields
      );
    });

    it('should handle SIGNATURE_ADDED message', async () => {
      // Setup current document
      actor.currentDocument = {
        id: 'doc-123',
        fields: [
          { id: 'field-1', signed: false }
        ]
      };
      
      const message = createMessage(MessageTypes.SIGNATURE_ADDED, {
        documentId: 'doc-123',
        fieldId: 'field-1',
        success: true,
        remainingFields: 0
      });
      
      await actor.receive(message.type, message.data);
      
      expect(mockViewer.updateFieldStatus).toHaveBeenCalledWith('field-1', true);
      expect(actor.currentDocument.fields[0].signed).toBe(true);
    });

    it('should handle SIGNATURE_CLEARED message', async () => {
      actor.currentDocument = {
        id: 'doc-123',
        fields: [
          { id: 'field-1', signed: true }
        ]
      };
      
      const message = createMessage(MessageTypes.SIGNATURE_CLEARED, {
        documentId: 'doc-123',
        fieldId: 'field-1',
        success: true
      });
      
      await actor.receive(message.type, message.data);
      
      expect(mockViewer.updateFieldStatus).toHaveBeenCalledWith('field-1', false);
      expect(actor.currentDocument.fields[0].signed).toBe(false);
    });

    it('should handle PDF_DOWNLOAD_READY message', async () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
        remove: jest.fn()
      };
      createElementSpy.mockReturnValue(mockLink);
      
      const message = createMessage(MessageTypes.PDF_DOWNLOAD_READY, {
        documentId: 'doc-123',
        filename: 'signed.pdf',
        pdfBase64: 'data:application/pdf;base64,signedpdf'
      });
      
      await actor.receive(message.type, message.data);
      
      expect(mockLink.href).toBe('data:application/pdf;base64,signedpdf');
      expect(mockLink.download).toBe('signed.pdf');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should handle ERROR message', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const message = createMessage(MessageTypes.ERROR, {
        code: 'TEST_ERROR',
        message: 'Test error message'
      });
      
      await actor.receive(message.type, message.data);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error received:', {
        code: 'TEST_ERROR',
        message: 'Test error message'
      });
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle unknown message type', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await actor.receive('unknown_type', {});
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown message type:', 'unknown_type');
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('User Actions', () => {
    beforeEach(() => {
      actor.setRemoteActor(mockRemoteActor);
    });

    it('should handle file upload', async () => {
      const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
      
      await actor.handleFileUpload(file);
      
      // Wait for FileReader to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.UPLOAD_PDF,
        expect.objectContaining({
          filename: 'test.pdf',
          pdfBase64: 'data:application/pdf;base64,mockpdfdata'
        })
      );
    });

    it('should handle signature field click', async () => {
      actor.currentDocument = { id: 'doc-123' };
      const field = { id: 'field-1', signed: false };
      
      // Mock signature pad to return a signature
      mockSignaturePad.getSignature.mockReturnValue('data:image/png;base64,sig');
      mockSignaturePad.show.mockImplementation(() => {
        // Simulate applying signature
        if (mockSignaturePad.options?.onApply) {
          mockSignaturePad.options.onApply('data:image/png;base64,sig');
        }
        return Promise.resolve();
      });
      
      await actor.handleFieldClick(field);
      
      expect(mockSignaturePad.show).toHaveBeenCalled();
    });

    it('should not open signature pad for signed fields', async () => {
      const field = { id: 'field-1', signed: true };
      
      await actor.handleFieldClick(field);
      
      expect(mockSignaturePad.show).not.toHaveBeenCalled();
    });

    it('should handle signature apply', () => {
      actor.currentDocument = { id: 'doc-123' };
      actor.currentField = { id: 'field-1' };
      
      const signatureData = 'data:image/png;base64,signature';
      actor.handleSignatureApply(signatureData);
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.ADD_SIGNATURE,
        expect.objectContaining({
          documentId: 'doc-123',
          fieldId: 'field-1',
          signatureImage: signatureData
        })
      );
      
      expect(actor.currentField).toBeNull();
    });

    it('should handle clear signature', () => {
      actor.currentDocument = { id: 'doc-123' };
      
      actor.handleClearSignature('field-1');
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.CLEAR_SIGNATURE,
        {
          documentId: 'doc-123',
          fieldId: 'field-1'
        }
      );
    });

    it('should handle download request', () => {
      actor.currentDocument = { id: 'doc-123' };
      
      actor.handleDownloadRequest();
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        MessageTypes.DOWNLOAD_PDF,
        {
          documentId: 'doc-123'
        }
      );
    });
  });

  describe('UI Updates', () => {
    it('should show loading state', () => {
      actor.showLoading('Processing PDF...');
      
      expect(actor.loadingElement).toBeDefined();
      expect(actor.loadingElement.textContent).toBe('Processing PDF...');
      expect(document.body.appendChild).toHaveBeenCalledWith(actor.loadingElement);
    });

    it('should hide loading state', () => {
      actor.showLoading('Loading...');
      const loadingElement = actor.loadingElement;
      const removeSpy = jest.fn();
      loadingElement.remove = removeSpy;
      
      actor.hideLoading();
      
      expect(removeSpy).toHaveBeenCalled();
      expect(actor.loadingElement).toBeNull();
    });

    it('should show error message', () => {
      actor.showError('Test error');
      
      expect(window.alert).toHaveBeenCalledWith('Error: Test error');
    });

    it('should show success message', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      actor.showSuccess('Operation completed');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Success:', 'Operation completed');
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('State Management', () => {
    it('should track current document', () => {
      expect(actor.currentDocument).toBeNull();
      
      actor.currentDocument = {
        id: 'doc-123',
        filename: 'test.pdf'
      };
      
      expect(actor.currentDocument.id).toBe('doc-123');
    });

    it('should track current field being signed', () => {
      expect(actor.currentField).toBeNull();
      
      actor.currentField = { id: 'field-1' };
      
      expect(actor.currentField.id).toBe('field-1');
    });

    it('should update field status in document', () => {
      actor.currentDocument = {
        fields: [
          { id: 'field-1', signed: false },
          { id: 'field-2', signed: false }
        ]
      };
      
      actor.updateFieldStatus('field-1', true);
      
      expect(actor.currentDocument.fields[0].signed).toBe(true);
      expect(actor.currentDocument.fields[1].signed).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources', () => {
      actor.viewer = mockViewer;
      actor.signaturePad = mockSignaturePad;
      actor.currentDocument = { id: 'doc-123' };
      const removeSpy = jest.fn();
      actor.loadingElement = { remove: removeSpy };
      
      actor.cleanup();
      
      expect(mockViewer.destroy).toHaveBeenCalled();
      expect(mockSignaturePad.destroy).toHaveBeenCalled();
      expect(actor.currentDocument).toBeNull();
      expect(actor.remoteActor).toBeNull();
      expect(removeSpy).toHaveBeenCalled();
    });

    it('should handle cleanup without initialized components', () => {
      const newActor = new PDFSignerClientActor(mockContainer);
      
      // Should not throw
      expect(() => newActor.cleanup()).not.toThrow();
    });
  });
});