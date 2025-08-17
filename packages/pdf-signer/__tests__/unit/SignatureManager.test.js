import { describe, it, expect, beforeEach } from '@jest/globals';
import { SignatureManager } from '../../src/server/SignatureManager.js';
import { Signature, SignatureField } from '../../src/shared/SignatureTypes.js';
import { TestUtils } from '../utils/TestUtils.js';

describe('SignatureManager', () => {
  let manager;
  
  beforeEach(() => {
    manager = new SignatureManager();
  });

  describe('Signature Storage', () => {
    it('should store a signature', () => {
      const signature = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe'
      });
      
      manager.storeSignature('doc-123', signature);
      const stored = manager.getSignature('doc-123', signature.id);
      
      expect(stored).toBe(signature);
    });

    it('should store multiple signatures for a document', () => {
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
      
      manager.storeSignature('doc-123', sig1);
      manager.storeSignature('doc-123', sig2);
      
      const signatures = manager.getDocumentSignatures('doc-123');
      expect(signatures).toHaveLength(2);
      expect(signatures).toContain(sig1);
      expect(signatures).toContain(sig2);
    });

    it('should handle multiple documents', () => {
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User 1'
      });
      
      const sig2 = new Signature({
        fieldId: 'field-2',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User 2'
      });
      
      manager.storeSignature('doc-1', sig1);
      manager.storeSignature('doc-2', sig2);
      
      expect(manager.getDocumentSignatures('doc-1')).toHaveLength(1);
      expect(manager.getDocumentSignatures('doc-2')).toHaveLength(1);
    });

    it('should clear signatures for a document', () => {
      const signature = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe'
      });
      
      manager.storeSignature('doc-123', signature);
      expect(manager.getDocumentSignatures('doc-123')).toHaveLength(1);
      
      manager.clearDocumentSignatures('doc-123');
      expect(manager.getDocumentSignatures('doc-123')).toHaveLength(0);
    });
  });

  describe('Metadata Management', () => {
    it('should store signature metadata', () => {
      const metadata = TestUtils.createTestSignatureMetadata({
        signerEmail: 'john@example.com',
        ipAddress: '192.168.1.100'
      });
      
      const signature = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe',
        metadata
      });
      
      manager.storeSignature('doc-123', signature);
      const stored = manager.getSignature('doc-123', signature.id);
      
      expect(stored.metadata).toEqual(metadata);
    });

    it('should update signature metadata', () => {
      const signature = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe'
      });
      
      manager.storeSignature('doc-123', signature);
      
      const updatedMetadata = {
        verified: true,
        verifiedAt: new Date()
      };
      
      manager.updateSignatureMetadata('doc-123', signature.id, updatedMetadata);
      const stored = manager.getSignature('doc-123', signature.id);
      
      expect(stored.metadata.verified).toBe(true);
      expect(stored.metadata.verifiedAt).toBeInstanceOf(Date);
    });

    it('should get signatures by field ID', () => {
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe'
      });
      
      const sig2 = new Signature({
        fieldId: 'field-1', // Same field, different signature
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'Jane Smith'
      });
      
      const sig3 = new Signature({
        fieldId: 'field-2',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'Bob Jones'
      });
      
      manager.storeSignature('doc-123', sig1);
      manager.storeSignature('doc-123', sig2);
      manager.storeSignature('doc-123', sig3);
      
      const field1Sigs = manager.getSignaturesByField('doc-123', 'field-1');
      expect(field1Sigs).toHaveLength(2);
      expect(field1Sigs).toContain(sig1);
      expect(field1Sigs).toContain(sig2);
      
      const field2Sigs = manager.getSignaturesByField('doc-123', 'field-2');
      expect(field2Sigs).toHaveLength(1);
      expect(field2Sigs).toContain(sig3);
    });
  });

  describe('Signature Retrieval', () => {
    it('should retrieve signature by ID', () => {
      const signature = new Signature({
        id: 'sig-123',
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe'
      });
      
      manager.storeSignature('doc-123', signature);
      const retrieved = manager.getSignature('doc-123', 'sig-123');
      
      expect(retrieved).toBe(signature);
    });

    it('should return null for non-existent signature', () => {
      const retrieved = manager.getSignature('doc-123', 'non-existent');
      expect(retrieved).toBeNull();
    });

    it('should return empty array for document without signatures', () => {
      const signatures = manager.getDocumentSignatures('non-existent-doc');
      expect(signatures).toEqual([]);
    });

    it('should get latest signature for a field', () => {
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'John Doe',
        timestamp: new Date('2024-01-01')
      });
      
      const sig2 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'Jane Smith',
        timestamp: new Date('2024-01-02')
      });
      
      manager.storeSignature('doc-123', sig1);
      manager.storeSignature('doc-123', sig2);
      
      const latest = manager.getLatestSignatureForField('doc-123', 'field-1');
      expect(latest).toBe(sig2);
    });
  });

  describe('Session Management', () => {
    it('should clear all signatures for a session', () => {
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User 1'
      });
      
      const sig2 = new Signature({
        fieldId: 'field-2',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User 2'
      });
      
      manager.storeSignature('doc-1', sig1);
      manager.storeSignature('doc-2', sig2);
      
      expect(manager.getDocumentSignatures('doc-1')).toHaveLength(1);
      expect(manager.getDocumentSignatures('doc-2')).toHaveLength(1);
      
      manager.clearSession();
      
      expect(manager.getDocumentSignatures('doc-1')).toHaveLength(0);
      expect(manager.getDocumentSignatures('doc-2')).toHaveLength(0);
    });

    it('should remove a specific signature', () => {
      const sig1 = new Signature({
        id: 'sig-1',
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User 1'
      });
      
      const sig2 = new Signature({
        id: 'sig-2',
        fieldId: 'field-2',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User 2'
      });
      
      manager.storeSignature('doc-123', sig1);
      manager.storeSignature('doc-123', sig2);
      
      manager.removeSignature('doc-123', 'sig-1');
      
      const signatures = manager.getDocumentSignatures('doc-123');
      expect(signatures).toHaveLength(1);
      expect(signatures[0]).toBe(sig2);
    });

    it('should get signature statistics', () => {
      const sig1 = new Signature({
        fieldId: 'field-1',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User 1'
      });
      
      const sig2 = new Signature({
        fieldId: 'field-2',
        imageData: TestUtils.createTestSignatureImage(),
        signerName: 'User 2'
      });
      
      manager.storeSignature('doc-1', sig1);
      manager.storeSignature('doc-1', sig2);
      manager.storeSignature('doc-2', sig1);
      
      const stats = manager.getStatistics();
      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalSignatures).toBe(3);
      expect(stats.documentsWithSignatures).toBe(2);
    });
  });
});