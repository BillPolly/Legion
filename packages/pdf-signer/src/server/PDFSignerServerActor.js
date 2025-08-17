import { PDFProcessor } from './PDFProcessor.js';
import { SignatureManager } from './SignatureManager.js';
import { 
  PDFDocument, 
  Signature, 
  MessageTypes, 
  createMessage 
} from '../shared/SignatureTypes.js';

/**
 * PDFSignerServerActor - Server-side actor for PDF signing operations
 */
export class PDFSignerServerActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    
    // Initialize components
    this.processor = new PDFProcessor();
    this.signatureManager = new SignatureManager();
    
    // Document storage (per session)
    this.documents = new Map();
  }

  /**
   * Set remote actor reference (called by framework)
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  /**
   * Primary message handler (ActorSpace protocol)
   */
  async receive(messageType, data) {
    try {
      let response;
      
      switch (messageType) {
        case MessageTypes.UPLOAD_PDF:
          response = await this.handleUploadPDF(data);
          break;
          
        case MessageTypes.GET_SIGNATURE_FIELDS:
          response = await this.handleGetSignatureFields(data);
          break;
          
        case MessageTypes.ADD_SIGNATURE:
          response = await this.handleAddSignature(data);
          break;
          
        case MessageTypes.CLEAR_SIGNATURE:
          response = await this.handleClearSignature(data);
          break;
          
        case MessageTypes.DOWNLOAD_PDF:
          response = await this.handleDownloadPDF(data);
          break;
          
        default:
          response = createMessage(MessageTypes.ERROR, {
            code: 'UNKNOWN_MESSAGE',
            message: `Unknown message type: ${messageType}`
          });
      }
      
      // Send response to client if we have a remote actor
      if (this.remoteActor && response) {
        this.remoteActor.receive(response.type, response.data);
      }
      
      return response;
    } catch (error) {
      const errorResponse = createMessage(MessageTypes.ERROR, {
        code: 'PROCESSING_ERROR',
        message: error.message,
        context: { messageType, data }
      });
      
      if (this.remoteActor) {
        this.remoteActor.receive(errorResponse.type, errorResponse.data);
      }
      
      return errorResponse;
    }
  }

  /**
   * Alternative handle method for compatibility
   */
  async handle(message) {
    return this.receive(message.type, message.data);
  }

  /**
   * Handle PDF upload
   */
  async handleUploadPDF(data) {
    const { pdfBase64, filename, metadata } = data;
    
    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64.split(',')[1] || pdfBase64, 'base64');
    
    // Load and process PDF
    const doc = await this.processor.loadPDF(pdfBuffer, filename);
    
    // Detect signature fields
    const fields = await this.processor.detectSignatureFields(doc);
    doc.fields = fields;
    
    // Store document
    this.documents.set(doc.id, doc);
    
    // Return response
    return createMessage(MessageTypes.PDF_READY, {
      documentId: doc.id,
      filename: doc.filename,
      pageCount: doc.pageCount,
      documentSize: doc.data.length,
      signatureFields: fields.map(field => ({
        id: field.id,
        page: field.page,
        x: field.rect.x,
        y: field.rect.y,
        width: field.rect.width,
        height: field.rect.height,
        label: field.label,
        required: field.required,
        signed: field.isSigned()
      })),
      pdfBase64: pdfBase64 // Send back for rendering
    });
  }

  /**
   * Handle get signature fields request
   */
  async handleGetSignatureFields(data) {
    const { documentId, pageNumber } = data;
    
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    let fields = doc.fields || [];
    
    // Filter by page if specified
    if (pageNumber) {
      fields = fields.filter(f => f.page === pageNumber);
    }
    
    return createMessage(MessageTypes.PDF_READY, {
      documentId: doc.id,
      signatureFields: fields.map(field => ({
        id: field.id,
        page: field.page,
        x: field.rect.x,
        y: field.rect.y,
        width: field.rect.width,
        height: field.rect.height,
        label: field.label,
        required: field.required,
        signed: this.signatureManager.isFieldSigned(documentId, field.id)
      }))
    });
  }

  /**
   * Handle add signature
   */
  async handleAddSignature(data) {
    const { documentId, fieldId, signatureImage, metadata } = data;
    
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    const field = doc.getField(fieldId);
    if (!field) {
      throw new Error(`Field not found: ${fieldId}`);
    }
    
    // Create signature
    const signature = new Signature({
      fieldId,
      imageData: signatureImage,
      signerName: metadata.signerName || 'Unknown',
      metadata
    });
    
    // Store signature
    this.signatureManager.storeSignature(documentId, signature);
    doc.addSignature(signature);
    
    // Mark field as signed
    field.signatureId = signature.id;
    
    // Count remaining unsigned fields
    const remainingFields = doc.fields.filter(f => {
      return f.required && !this.signatureManager.isFieldSigned(documentId, f.id);
    }).length;
    
    return createMessage(MessageTypes.SIGNATURE_ADDED, {
      documentId,
      fieldId,
      success: true,
      timestamp: signature.timestamp,
      remainingFields
    });
  }

  /**
   * Handle clear signature
   */
  async handleClearSignature(data) {
    const { documentId, fieldId } = data;
    
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    const field = doc.getField(fieldId);
    if (!field) {
      throw new Error(`Field not found: ${fieldId}`);
    }
    
    // Get existing signature
    const existingSignature = this.signatureManager.getLatestSignatureForField(documentId, fieldId);
    if (existingSignature) {
      // Remove signature
      this.signatureManager.removeSignature(documentId, existingSignature.id);
      
      // Remove from document
      const index = doc.signatures.findIndex(s => s.id === existingSignature.id);
      if (index !== -1) {
        doc.signatures.splice(index, 1);
      }
    }
    
    // Clear field
    field.signatureId = null;
    
    return createMessage(MessageTypes.SIGNATURE_CLEARED, {
      documentId,
      fieldId,
      success: true
    });
  }

  /**
   * Handle download PDF
   */
  async handleDownloadPDF(data) {
    const { documentId, format } = data;
    
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    // Get all signatures for document
    const signatures = this.signatureManager.getDocumentSignatures(documentId);
    
    // Generate signed PDF if there are signatures
    let finalPDF = doc.data;
    if (signatures.length > 0) {
      const signatureData = signatures.map(sig => ({
        fieldId: sig.fieldId,
        imageData: sig.imageData
      }));
      
      finalPDF = await this.processor.generateSignedPDF(doc, signatureData);
      
      // Add metadata
      const metadata = {
        signerName: signatures.map(s => s.signerName).join(', '),
        signedDate: new Date().toISOString(),
        documentId: doc.id
      };
      
      finalPDF = await this.processor.addMetadata(
        { ...doc, data: finalPDF },
        metadata
      );
    }
    
    // Convert to base64
    const pdfBase64 = `data:application/pdf;base64,${finalPDF.toString('base64')}`;
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const signedSuffix = signatures.length > 0 ? '_signed' : '';
    const filename = doc.filename.replace('.pdf', `${signedSuffix}_${timestamp}.pdf`);
    
    return createMessage(MessageTypes.PDF_DOWNLOAD_READY, {
      documentId,
      filename,
      pdfBase64,
      signatures: signatures.map(sig => ({
        fieldId: sig.fieldId,
        signerName: sig.signerName,
        timestamp: sig.timestamp
      }))
    });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.documents.clear();
    this.signatureManager.clearSession();
    this.remoteActor = null;
  }
}

/**
 * Factory function to create server actor
 */
export function createPDFSignerServerActor(services) {
  return new PDFSignerServerActor(services);
}