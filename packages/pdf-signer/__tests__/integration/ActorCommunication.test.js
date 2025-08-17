import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createPDFSignerServerActor,
  createPDFSignerClientActor,
  MessageTypes
} from '../../src/index.js';
import { JSDOM } from 'jsdom';
import { TestUtils } from '../utils/TestUtils.js';

describe('Actor Communication Integration Tests', () => {
  let dom;
  let serverActor;
  let clientActor;
  let container;
  let services;

  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="pdf-container" style="width: 800px; height: 600px;"></div>
        </body>
      </html>
    `);
    
    global.window = dom.window;
    global.document = dom.window.document;
    global.FileReader = dom.window.FileReader;
    global.navigator = { userAgent: 'test-browser' };
    
    // Mock PDF.js
    global.window.pdfjsLib = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: () => Promise.resolve({
            getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale, scale }),
            render: () => ({ promise: Promise.resolve() })
          }),
          destroy: () => {}
        })
      })
    };
    
    // Mock SignaturePad library
    global.window.SignaturePad = class {
      constructor() {
        this._isEmpty = true;
      }
      isEmpty() { return this._isEmpty; }
      clear() { this._isEmpty = true; }
      toDataURL() { return this._isEmpty ? null : 'data:image/png;base64,testsignature'; }
    };
    
    // Create services for server actor
    services = new Map();
    services.set('resourceManager', {
      get: (key) => {
        if (key === 'env.MONOREPO_ROOT') return '/test/root';
        return null;
      }
    });
    
    // Create actors
    serverActor = createPDFSignerServerActor(services);
    container = document.getElementById('pdf-container');
    clientActor = createPDFSignerClientActor(container);
    
    // Set up bidirectional communication
    serverActor.setRemoteActor(clientActor);
    clientActor.setRemoteActor(serverActor);
  });
  
  afterEach(() => {
    if (serverActor) {
      serverActor.cleanup();
    }
    if (clientActor) {
      clientActor.cleanup();
    }
    dom.window.close();
  });

  describe('Complete PDF Signing Workflow', () => {
    it('should handle complete workflow from upload to download', async () => {
      // Step 1: Client uploads PDF
      const pdfBytes = TestUtils.createTestPDF();
      const pdfBase64 = TestUtils.bufferToBase64(pdfBytes);
      
      // Server processes upload
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64,
        filename: 'test-contract.pdf'
      });
      
      expect(uploadResponse.type).toBe(MessageTypes.PDF_READY);
      expect(uploadResponse.data.documentId).toBeDefined();
      
      const documentId = uploadResponse.data.documentId;
      
      // Client receives PDF ready message
      await clientActor.receive(uploadResponse.type, uploadResponse.data);
      
      expect(clientActor.currentDocument).toBeDefined();
      expect(clientActor.currentDocument.id).toBe(documentId);
      expect(clientActor.viewer).toBeDefined();
      
      // Step 2: Add signature field manually (since detection may not find any)
      const doc = serverActor.documents.get(documentId);
      const testField = TestUtils.createTestSignatureField({
        id: 'signature-field-1',
        documentId: doc.id,
        page: 1,
        rect: { x: 100, y: 500, width: 200, height: 50 },
        label: 'Primary Signature',
        required: true
      });
      doc.addField(testField);
      
      // Make sure the field has proper rect data
      testField.rect = { x: 100, y: 500, width: 200, height: 50 };
      
      // Update client with field info
      clientActor.currentDocument.fields = [testField];
      
      // Step 3: Client signs field  
      // Use TestUtils to create a proper test signature image
      const signatureImage = TestUtils.createTestSignatureImage();
      const signatureResponse = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'signature-field-1',
        signatureImage,
        metadata: {
          signerName: 'Test User',
          timestamp: Date.now()
        }
      });
      
      expect(signatureResponse.type).toBe(MessageTypes.SIGNATURE_ADDED);
      expect(signatureResponse.data.success).toBe(true);
      
      // Client receives signature confirmation
      await clientActor.receive(signatureResponse.type, signatureResponse.data);
      
      expect(clientActor.currentDocument.fields[0].signed).toBe(true);
      
      // Step 4: Download signed PDF
      const downloadResponse = await serverActor.receive(MessageTypes.DOWNLOAD_PDF, {
        documentId
      });
      
      if (downloadResponse.type === MessageTypes.ERROR) {
        console.log('Download error:', downloadResponse.data);
      }
      
      expect(downloadResponse.type).toBe(MessageTypes.PDF_DOWNLOAD_READY);
      expect(downloadResponse.data.pdfBase64).toBeDefined();
      expect(downloadResponse.data.filename).toContain('signed');
      
      // Client receives download
      await clientActor.receive(downloadResponse.type, downloadResponse.data);
      
      // Verify the complete workflow
      expect(serverActor.documents.has(documentId)).toBe(true);
      expect(serverActor.signatureManager.getDocumentSignatures(documentId)).toHaveLength(1);
    });

    it('should handle error propagation between actors', async () => {
      // Try to get fields for non-existent document
      const errorResponse = await serverActor.receive(MessageTypes.GET_SIGNATURE_FIELDS, {
        documentId: 'non-existent-doc'
      });
      
      expect(errorResponse.type).toBe(MessageTypes.ERROR);
      expect(errorResponse.data.message).toContain('Document not found');
      
      // Client receives error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await clientActor.receive(errorResponse.type, errorResponse.data);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error received:',
        expect.objectContaining({
          message: expect.stringContaining('Document not found')
        })
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Message Protocol Validation', () => {
    it('should handle all supported message types', async () => {
      const supportedMessages = [
        MessageTypes.UPLOAD_PDF,
        MessageTypes.GET_SIGNATURE_FIELDS,
        MessageTypes.ADD_SIGNATURE,
        MessageTypes.CLEAR_SIGNATURE,
        MessageTypes.DOWNLOAD_PDF
      ];
      
      for (const messageType of supportedMessages) {
        // Server should handle all these message types
        const response = await serverActor.receive(messageType, {});
        expect(response).toBeDefined();
        expect(response.type).toBeDefined();
      }
    });

    it('should handle unknown message types gracefully', async () => {
      const response = await serverActor.receive('UNKNOWN_MESSAGE', {});
      expect(response.type).toBe(MessageTypes.ERROR);
      expect(response.data.message).toContain('Unknown message type');
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await clientActor.receive('UNKNOWN_CLIENT_MESSAGE', {});
      expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown message type:', 'UNKNOWN_CLIENT_MESSAGE');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Session Isolation', () => {
    it('should maintain separate sessions for different actor pairs', async () => {
      // Create second client actor
      const container2 = document.createElement('div');
      const clientActor2 = createPDFSignerClientActor(container2);
      
      // Create second server actor
      const serverActor2 = createPDFSignerServerActor(services);
      
      // Upload documents to each server
      const pdfBytes = TestUtils.createTestPDF();
      const pdfBase64 = TestUtils.bufferToBase64(pdfBytes);
      
      const upload1 = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64,
        filename: 'doc1.pdf'
      });
      
      const upload2 = await serverActor2.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64,
        filename: 'doc2.pdf'
      });
      
      const docId1 = upload1.data.documentId;
      const docId2 = upload2.data.documentId;
      
      // Verify documents are isolated
      expect(serverActor.documents.has(docId1)).toBe(true);
      expect(serverActor.documents.has(docId2)).toBe(false);
      
      expect(serverActor2.documents.has(docId1)).toBe(false);
      expect(serverActor2.documents.has(docId2)).toBe(true);
      
      // Cleanup
      serverActor2.cleanup();
      clientActor2.cleanup();
    });
  });

  describe('State Synchronization', () => {
    it('should keep client and server state synchronized', async () => {
      // Upload PDF
      const pdfBytes = TestUtils.createTestPDF();
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'sync-test.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      
      // Client receives PDF ready
      await clientActor.receive(uploadResponse.type, uploadResponse.data);
      
      // Verify state sync
      expect(clientActor.currentDocument.id).toBe(documentId);
      expect(serverActor.documents.get(documentId).id).toBe(documentId);
      
      // Add field to server
      const doc = serverActor.documents.get(documentId);
      const field = TestUtils.createTestSignatureField({
        id: 'sync-field',
        documentId: doc.id
      });
      doc.addField(field);
      
      // Add signature
      const signatureResponse = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'sync-field',
        signatureImage: 'data:image/png;base64,signature',
        metadata: { signerName: 'Sync Test' }
      });
      
      // Update client state
      clientActor.currentDocument.fields = [field];
      await clientActor.receive(signatureResponse.type, signatureResponse.data);
      
      // Verify both sides have consistent state
      const serverSignatures = serverActor.signatureManager.getDocumentSignatures(documentId);
      expect(serverSignatures).toHaveLength(1);
      expect(clientActor.currentDocument.fields[0].signed).toBe(true);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should clean up resources properly', async () => {
      // Upload and process document
      const pdfBytes = TestUtils.createTestPDF();
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'cleanup-test.pdf'
      });
      
      await clientActor.receive(uploadResponse.type, uploadResponse.data);
      
      // Verify resources exist
      expect(serverActor.documents.size).toBe(1);
      expect(clientActor.currentDocument).toBeDefined();
      
      // Cleanup server
      serverActor.cleanup();
      expect(serverActor.documents.size).toBe(0);
      expect(serverActor.remoteActor).toBeNull();
      
      // Cleanup client
      clientActor.cleanup();
      expect(clientActor.currentDocument).toBeNull();
      expect(clientActor.remoteActor).toBeNull();
    });
  });
});