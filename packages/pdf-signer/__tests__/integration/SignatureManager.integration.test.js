import { describe, it, expect, beforeEach } from '@jest/globals';
import { SignatureManager } from '../../src/server/SignatureManager.js';
import { PDFProcessor } from '../../src/server/PDFProcessor.js';
import { PDFDocument, Signature, SignatureField } from '../../src/shared/SignatureTypes.js';
import { TestUtils } from '../utils/TestUtils.js';

describe('SignatureManager Integration Tests', () => {
  let manager;
  let processor;
  let testDoc;
  
  beforeEach(async () => {
    manager = new SignatureManager();
    processor = new PDFProcessor();
    
    // Create a test document
    const pdfBuffer = TestUtils.createTestPDF();
    testDoc = await processor.loadPDF(pdfBuffer, 'test.pdf');
    
    // Add some fields to the document
    const field1 = new SignatureField({
      id: 'field-1',
      documentId: testDoc.id,
      page: 1,
      rect: { x: 100, y: 100, width: 200, height: 50 },
      label: 'Primary Signature',
      required: true
    });
    
    const field2 = new SignatureField({
      id: 'field-2',
      documentId: testDoc.id,
      page: 1,
      rect: { x: 100, y: 200, width: 200, height: 50 },
      label: 'Secondary Signature',
      required: false
    });
    
    testDoc.addField(field1);
    testDoc.addField(field2);
  });

  describe('Signature Lifecycle', () => {
    it('should manage complete signature lifecycle', async () => {
      // Create and store signature
      const signature = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe',
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        }
      });
      
      manager.storeSignature(testDoc.id, signature);
      testDoc.addSignature(signature);
      
      // Mark field as signed
      const field = testDoc.getField('field-1');
      field.signatureId = signature.id;
      
      // Verify signature is stored
      expect(manager.isFieldSigned(testDoc.id, 'field-1')).toBe(true);
      expect(field.isSigned()).toBe(true);
      
      // Generate signed PDF
      const signedPDF = await processor.generateSignedPDF(testDoc, [{
        fieldId: signature.fieldId,
        imageData: signature.imageData
      }]);
      
      expect(signedPDF).toBeInstanceOf(Buffer);
      expect(signedPDF.length).toBeGreaterThan(0);
    });

    it('should handle multiple signers on same document', async () => {
      // First signer
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe',
        metadata: { signerEmail: 'john@example.com' }
      });
      
      manager.storeSignature(testDoc.id, sig1);
      testDoc.addSignature(sig1);
      testDoc.getField('field-1').signatureId = sig1.id;
      
      // Second signer
      const sig2 = new Signature({
        fieldId: 'field-2',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'Jane Smith',
        metadata: { signerEmail: 'jane@example.com' }
      });
      
      manager.storeSignature(testDoc.id, sig2);
      testDoc.addSignature(sig2);
      testDoc.getField('field-2').signatureId = sig2.id;
      
      // Check both fields are signed
      expect(manager.isFieldSigned(testDoc.id, 'field-1')).toBe(true);
      expect(manager.isFieldSigned(testDoc.id, 'field-2')).toBe(true);
      
      // Get signature history
      const history = manager.getSignatureHistory(testDoc.id);
      expect(history).toHaveLength(2);
      expect(history[0].signerName).toBe('John Doe');
      expect(history[1].signerName).toBe('Jane Smith');
      
      // Generate PDF with both signatures
      const signedPDF = await processor.generateSignedPDF(testDoc, [
        { fieldId: sig1.fieldId, imageData: sig1.imageData },
        { fieldId: sig2.fieldId, imageData: sig2.imageData }
      ]);
      
      expect(signedPDF).toBeInstanceOf(Buffer);
    });

    it('should handle signature replacement', async () => {
      // Initial signature
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe',
        timestamp: new Date('2024-01-01')
      });
      
      manager.storeSignature(testDoc.id, sig1);
      
      // Replace with new signature
      const sig2 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe',
        timestamp: new Date('2024-01-02'),
        metadata: { reason: 'Signature correction' }
      });
      
      manager.storeSignature(testDoc.id, sig2);
      
      // Latest signature should be sig2
      const latest = manager.getLatestSignatureForField(testDoc.id, 'field-1');
      expect(latest.id).toBe(sig2.id);
      expect(latest.metadata.reason).toBe('Signature correction');
      
      // History should show both
      const fieldSigs = manager.getSignaturesByField(testDoc.id, 'field-1');
      expect(fieldSigs).toHaveLength(2);
    });
  });

  describe('Data Persistence', () => {
    it('should export and import signatures', () => {
      // Create signatures
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe'
      });
      
      const sig2 = new Signature({
        fieldId: 'field-2',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'Jane Smith'
      });
      
      manager.storeSignature(testDoc.id, sig1);
      manager.storeSignature(testDoc.id, sig2);
      
      // Export signatures
      const exported = manager.exportDocumentSignatures(testDoc.id);
      expect(exported).toHaveLength(2);
      
      // Clear and verify empty
      manager.clearDocumentSignatures(testDoc.id);
      expect(manager.getDocumentSignatures(testDoc.id)).toHaveLength(0);
      
      // Import back
      manager.importDocumentSignatures(testDoc.id, exported);
      
      // Verify imported
      const imported = manager.getDocumentSignatures(testDoc.id);
      expect(imported).toHaveLength(2);
      expect(imported[0].signerName).toBe('John Doe');
      expect(imported[1].signerName).toBe('Jane Smith');
    });

    it('should maintain data integrity across operations', () => {
      // Add multiple signatures
      for (let i = 0; i < 5; i++) {
        const sig = new Signature({
          fieldId: `field-${i % 2 + 1}`, // Alternate between field-1 and field-2
          imageData: TestUtils.createTestSignatureImage(),
          signerName: `User ${i}`,
          timestamp: new Date(Date.now() + i * 1000) // Stagger timestamps
        });
        manager.storeSignature(testDoc.id, sig);
      }
      
      // Check statistics
      const stats = manager.getStatistics();
      expect(stats.totalSignatures).toBe(5);
      expect(stats.documentsWithSignatures).toBe(1);
      
      // Remove one signature
      const signatures = manager.getDocumentSignatures(testDoc.id);
      manager.removeSignature(testDoc.id, signatures[0].id);
      
      // Verify removal
      const updatedStats = manager.getStatistics();
      expect(updatedStats.totalSignatures).toBe(4);
      
      // Check field signatures
      const field1Sigs = manager.getSignaturesByField(testDoc.id, 'field-1');
      const field2Sigs = manager.getSignaturesByField(testDoc.id, 'field-2');
      expect(field1Sigs.length + field2Sigs.length).toBe(4);
    });
  });

  describe('Session Management', () => {
    it('should handle session cleanup properly', () => {
      // Create signatures for multiple documents
      const docs = ['doc-1', 'doc-2', 'doc-3'];
      
      docs.forEach(docId => {
        const sig = new Signature({
          fieldId: 'field-1',
          imageData: TestUtils.createTestSignatureImage(),
          signerName: `Signer for ${docId}`
        });
        manager.storeSignature(docId, sig);
      });
      
      // Verify all stored
      expect(manager.getStatistics().totalDocuments).toBe(3);
      expect(manager.getStatistics().totalSignatures).toBe(3);
      
      // Clear session
      manager.clearSession();
      
      // Verify all cleared
      expect(manager.getStatistics().totalDocuments).toBe(0);
      expect(manager.getStatistics().totalSignatures).toBe(0);
      
      docs.forEach(docId => {
        expect(manager.getDocumentSignatures(docId)).toHaveLength(0);
      });
    });

    it('should isolate document signatures', () => {
      // Add signatures to different documents
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User A'
      });
      
      const sig2 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User B'
      });
      
      manager.storeSignature('doc-1', sig1);
      manager.storeSignature('doc-2', sig2);
      
      // Clear only doc-1
      manager.clearDocumentSignatures('doc-1');
      
      // doc-1 should be empty, doc-2 should still have signature
      expect(manager.getDocumentSignatures('doc-1')).toHaveLength(0);
      expect(manager.getDocumentSignatures('doc-2')).toHaveLength(1);
      expect(manager.getSignature('doc-2', sig2.id)).toBe(sig2);
    });
  });
});