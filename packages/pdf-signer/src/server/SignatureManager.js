/**
 * SignatureManager - Manages signature storage and metadata
 */
export class SignatureManager {
  constructor() {
    // In-memory storage for MVP
    // Structure: { documentId: { signatureId: Signature } }
    this.signatures = new Map();
  }

  /**
   * Store a signature for a document
   */
  storeSignature(documentId, signature) {
    if (!this.signatures.has(documentId)) {
      this.signatures.set(documentId, new Map());
    }
    
    const docSignatures = this.signatures.get(documentId);
    docSignatures.set(signature.id, signature);
  }

  /**
   * Get a specific signature
   */
  getSignature(documentId, signatureId) {
    const docSignatures = this.signatures.get(documentId);
    if (!docSignatures) {
      return null;
    }
    return docSignatures.get(signatureId) || null;
  }

  /**
   * Get all signatures for a document
   */
  getDocumentSignatures(documentId) {
    const docSignatures = this.signatures.get(documentId);
    if (!docSignatures) {
      return [];
    }
    return Array.from(docSignatures.values());
  }

  /**
   * Get signatures by field ID
   */
  getSignaturesByField(documentId, fieldId) {
    const docSignatures = this.getDocumentSignatures(documentId);
    return docSignatures.filter(sig => sig.fieldId === fieldId);
  }

  /**
   * Get the latest signature for a field
   */
  getLatestSignatureForField(documentId, fieldId) {
    const fieldSignatures = this.getSignaturesByField(documentId, fieldId);
    if (fieldSignatures.length === 0) {
      return null;
    }
    
    // Sort by timestamp descending
    fieldSignatures.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      return timeB - timeA;
    });
    
    return fieldSignatures[0];
  }

  /**
   * Update signature metadata
   */
  updateSignatureMetadata(documentId, signatureId, metadata) {
    const signature = this.getSignature(documentId, signatureId);
    if (!signature) {
      throw new Error(`Signature ${signatureId} not found`);
    }
    
    // Merge new metadata with existing
    signature.metadata = {
      ...signature.metadata,
      ...metadata
    };
  }

  /**
   * Remove a specific signature
   */
  removeSignature(documentId, signatureId) {
    const docSignatures = this.signatures.get(documentId);
    if (docSignatures) {
      docSignatures.delete(signatureId);
    }
  }

  /**
   * Clear all signatures for a document
   */
  clearDocumentSignatures(documentId) {
    const docSignatures = this.signatures.get(documentId);
    if (docSignatures) {
      docSignatures.clear();
    }
  }

  /**
   * Clear all signatures (session cleanup)
   */
  clearSession() {
    this.signatures.clear();
  }

  /**
   * Get statistics about stored signatures
   */
  getStatistics() {
    let totalSignatures = 0;
    let documentsWithSignatures = 0;
    
    for (const [docId, docSignatures] of this.signatures) {
      if (docSignatures.size > 0) {
        documentsWithSignatures++;
        totalSignatures += docSignatures.size;
      }
    }
    
    return {
      totalDocuments: this.signatures.size,
      totalSignatures,
      documentsWithSignatures
    };
  }

  /**
   * Check if a field has been signed
   */
  isFieldSigned(documentId, fieldId) {
    const fieldSignatures = this.getSignaturesByField(documentId, fieldId);
    return fieldSignatures.length > 0;
  }

  /**
   * Get signature history for a document
   */
  getSignatureHistory(documentId) {
    const signatures = this.getDocumentSignatures(documentId);
    
    // Sort by timestamp
    signatures.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      return timeA - timeB;
    });
    
    return signatures.map(sig => ({
      id: sig.id,
      fieldId: sig.fieldId,
      signerName: sig.signerName,
      timestamp: sig.timestamp,
      metadata: sig.metadata
    }));
  }

  /**
   * Export signatures for a document (for saving/sending)
   */
  exportDocumentSignatures(documentId) {
    const signatures = this.getDocumentSignatures(documentId);
    return signatures.map(sig => ({
      id: sig.id,
      fieldId: sig.fieldId,
      imageData: sig.imageData,
      signerName: sig.signerName,
      timestamp: sig.timestamp,
      metadata: sig.metadata
    }));
  }

  /**
   * Import signatures for a document (for loading)
   */
  importDocumentSignatures(documentId, signatureData) {
    signatureData.forEach(sigData => {
      this.storeSignature(documentId, sigData);
    });
  }
}