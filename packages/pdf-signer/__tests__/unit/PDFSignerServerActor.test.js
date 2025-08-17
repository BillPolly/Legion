import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDFSignerServerActor, createPDFSignerServerActor } from '../../src/server/PDFSignerServerActor.js';
import { MessageTypes, createMessage } from '../../src/shared/SignatureTypes.js';
import { TestUtils } from '../utils/TestUtils.js';

describe('PDFSignerServerActor', () => {
  let actor;
  let mockServices;
  
  beforeEach(() => {
    mockServices = new Map();
    mockServices.set('resourceManager', {
      get: jest.fn((key) => {
        if (key === 'env.MONOREPO_ROOT') return '/test/root';
        return null;
      })
    });
    
    actor = new PDFSignerServerActor(mockServices);
  });

  describe('Initialization', () => {
    it('should create actor with services', () => {
      expect(actor).toBeInstanceOf(PDFSignerServerActor);
      expect(actor.services).toBe(mockServices);
      expect(actor.documents).toBeInstanceOf(Map);
      expect(actor.processor).toBeDefined();
      expect(actor.signatureManager).toBeDefined();
    });

    it('should set remote actor', () => {
      const mockRemoteActor = { receive: jest.fn() };
      actor.setRemoteActor(mockRemoteActor);
      expect(actor.remoteActor).toBe(mockRemoteActor);
    });
  });

  describe('Message Handling', () => {
    it('should handle upload_pdf message', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const message = createMessage(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBuffer),
        filename: 'test.pdf'
      });
      
      const response = await actor.receive(message.type, message.data);
      
      expect(response).toBeDefined();
      expect(response.type).toBe(MessageTypes.PDF_READY);
      expect(response.data.documentId).toBeDefined();
      expect(response.data.filename).toBe('test.pdf');
      expect(response.data.pageCount).toBeGreaterThan(0);
      expect(response.data.signatureFields).toBeDefined();
    });

    it('should handle get_signature_fields message', async () => {
      // First upload a PDF
      const pdfBuffer = TestUtils.createTestPDF();
      const uploadResponse = await actor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBuffer),
        filename: 'test.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      
      // Get signature fields
      const message = createMessage(MessageTypes.GET_SIGNATURE_FIELDS, {
        documentId
      });
      
      const response = await actor.receive(message.type, message.data);
      
      expect(response.type).toBe(MessageTypes.PDF_READY);
      expect(response.data.signatureFields).toBeDefined();
      expect(Array.isArray(response.data.signatureFields)).toBe(true);
    });

    it('should handle add_signature message', async () => {
      // Upload PDF
      const pdfBuffer = TestUtils.createTestPDF();
      const uploadResponse = await actor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBuffer),
        filename: 'test.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      
      // Add a field manually for testing
      const doc = actor.documents.get(documentId);
      const field = TestUtils.createTestSignatureField({
        id: 'field-1',
        documentId: doc.id
      });
      doc.addField(field);
      
      // Add signature
      const message = createMessage(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'field-1',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: {
          signerName: 'Test User',
          ...TestUtils.createTestSignatureMetadata()
        }
      });
      
      const response = await actor.receive(message.type, message.data);
      
      expect(response.type).toBe(MessageTypes.SIGNATURE_ADDED);
      expect(response.data.success).toBe(true);
      expect(response.data.fieldId).toBe('field-1');
    });

    it('should handle clear_signature message', async () => {
      // Setup document with signature
      const pdfBuffer = TestUtils.createTestPDF();
      const uploadResponse = await actor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBuffer),
        filename: 'test.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      const doc = actor.documents.get(documentId);
      const field = TestUtils.createTestSignatureField({
        id: 'field-1',
        documentId: doc.id
      });
      doc.addField(field);
      
      // Add signature first
      await actor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'field-1',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: {
          signerName: 'Test User',
          ...TestUtils.createTestSignatureMetadata()
        }
      });
      
      // Clear signature
      const message = createMessage(MessageTypes.CLEAR_SIGNATURE, {
        documentId,
        fieldId: 'field-1'
      });
      
      const response = await actor.receive(message.type, message.data);
      
      expect(response.type).toBe(MessageTypes.SIGNATURE_CLEARED);
      expect(response.data.success).toBe(true);
      expect(response.data.fieldId).toBe('field-1');
    });

    it('should handle download_pdf message', async () => {
      // Setup document
      const pdfBuffer = TestUtils.createTestPDF();
      const uploadResponse = await actor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBuffer),
        filename: 'test.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      
      // Download PDF
      const message = createMessage(MessageTypes.DOWNLOAD_PDF, {
        documentId
      });
      
      const response = await actor.receive(message.type, message.data);
      
      expect(response.type).toBe(MessageTypes.PDF_DOWNLOAD_READY);
      expect(response.data.documentId).toBe(documentId);
      expect(response.data.pdfBase64).toBeDefined();
      expect(response.data.filename).toContain('test');
    });

    it('should handle unknown message type', async () => {
      const response = await actor.receive('unknown_type', {});
      
      expect(response.type).toBe(MessageTypes.ERROR);
      expect(response.data.message).toContain('Unknown message type');
    });

    it('should handle errors gracefully', async () => {
      // Try to get fields for non-existent document
      const message = createMessage(MessageTypes.GET_SIGNATURE_FIELDS, {
        documentId: 'non-existent'
      });
      
      const response = await actor.receive(message.type, message.data);
      
      expect(response.type).toBe(MessageTypes.ERROR);
      expect(response.data.message).toContain('Document not found');
    });
  });

  describe('State Management', () => {
    it('should maintain document state', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const uploadResponse = await actor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBuffer),
        filename: 'test.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      
      // Document should be stored
      expect(actor.documents.has(documentId)).toBe(true);
      
      const doc = actor.documents.get(documentId);
      expect(doc.filename).toBe('test.pdf');
    });

    it('should track signatures per document', async () => {
      // Upload document
      const pdfBuffer = TestUtils.createTestPDF();
      const uploadResponse = await actor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBuffer),
        filename: 'test.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      const doc = actor.documents.get(documentId);
      
      // Add fields
      const field1 = TestUtils.createTestSignatureField({
        id: 'field-1',
        documentId: doc.id
      });
      const field2 = TestUtils.createTestSignatureField({
        id: 'field-2',
        documentId: doc.id
      });
      doc.addField(field1);
      doc.addField(field2);
      
      // Add signatures
      await actor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'field-1',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: { signerName: 'User 1' }
      });
      
      await actor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'field-2',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: { signerName: 'User 2' }
      });
      
      // Check signatures are tracked
      const signatures = actor.signatureManager.getDocumentSignatures(documentId);
      expect(signatures).toHaveLength(2);
    });

    it('should clean up on session end', () => {
      // Add some documents
      actor.documents.set('doc-1', {});
      actor.documents.set('doc-2', {});
      
      // Clean up
      actor.cleanup();
      
      expect(actor.documents.size).toBe(0);
      expect(actor.signatureManager.getStatistics().totalSignatures).toBe(0);
    });
  });

  describe('Factory Function', () => {
    it('should create actor using factory', () => {
      const services = new Map();
      const actor = createPDFSignerServerActor(services);
      
      expect(actor).toBeInstanceOf(PDFSignerServerActor);
      expect(actor.services).toBe(services);
    });
  });
});