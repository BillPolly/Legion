// Core data models and message types for PDF Signer

/**
 * PDFDocument - Represents a PDF document in the system
 */
export class PDFDocument {
  constructor(data = {}) {
    // Validate required fields
    if (!data.filename) throw new Error('filename is required');
    if (!data.data) throw new Error('data is required');
    if (!data.pageCount) throw new Error('pageCount is required');

    this.id = data.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.filename = data.filename;
    this.data = data.data; // Buffer containing PDF binary
    this.pageCount = data.pageCount;
    this.fields = data.fields || [];
    this.signatures = data.signatures || [];
    this.uploadTime = data.uploadTime || new Date();
    this.lastModified = data.lastModified || new Date();
  }

  addField(field) {
    this.fields.push(field);
    this.lastModified = new Date();
  }

  addSignature(signature) {
    this.signatures.push(signature);
    this.lastModified = new Date();
  }

  getField(fieldId) {
    return this.fields.find(f => f.id === fieldId);
  }

  getSignature(signatureId) {
    return this.signatures.find(s => s.id === signatureId);
  }

  getUnsignedFields() {
    return this.fields.filter(f => !f.isSigned());
  }

  isFullySigned() {
    const requiredFields = this.fields.filter(f => f.required);
    return requiredFields.every(f => f.isSigned());
  }
}

/**
 * SignatureField - Represents a signature field in a PDF
 */
export class SignatureField {
  constructor(data = {}) {
    // Validate required fields
    if (!data.documentId) throw new Error('documentId is required');
    if (!data.page) throw new Error('page is required');
    if (!data.rect) throw new Error('rect is required');
    
    // Validate rect structure
    if (!data.rect.hasOwnProperty('x') || 
        !data.rect.hasOwnProperty('y') || 
        !data.rect.hasOwnProperty('width') || 
        !data.rect.hasOwnProperty('height')) {
      throw new Error('rect must have x, y, width, and height');
    }

    this.id = data.id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.documentId = data.documentId;
    this.page = data.page;
    this.rect = data.rect; // { x, y, width, height }
    this.label = data.label || null;
    this.required = data.required || false;
    this.signatureId = data.signatureId || null;
  }

  isSigned() {
    return this.signatureId !== null;
  }

  clearSignature() {
    this.signatureId = null;
  }
}

/**
 * Signature - Represents a captured signature
 */
export class Signature {
  constructor(data = {}) {
    // Validate required fields
    if (!data.fieldId) throw new Error('fieldId is required');
    if (!data.imageData) throw new Error('imageData is required');
    if (!data.signerName) throw new Error('signerName is required');

    // Validate image data format
    if (!data.imageData.startsWith('data:image/') || !data.imageData.includes('base64,')) {
      throw new Error('imageData must be a base64 encoded image');
    }

    this.id = data.id || `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.fieldId = data.fieldId;
    this.imageData = data.imageData; // base64 encoded PNG
    this.signerName = data.signerName;
    this.timestamp = data.timestamp || new Date();
    this.metadata = data.metadata || {};
  }

  getImageBuffer() {
    const base64Data = this.imageData.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  }
}

/**
 * Message Types - Constants for actor communication
 */
export const MessageTypes = {
  // Client to Server
  UPLOAD_PDF: 'upload_pdf',
  GET_SIGNATURE_FIELDS: 'get_signature_fields',
  ADD_SIGNATURE: 'add_signature',
  CLEAR_SIGNATURE: 'clear_signature',
  DOWNLOAD_PDF: 'download_pdf',
  
  // Server to Client
  PDF_READY: 'pdf_ready',
  SIGNATURE_ADDED: 'signature_added',
  SIGNATURE_CLEARED: 'signature_cleared',
  PDF_DOWNLOAD_READY: 'pdf_download_ready',
  ERROR: 'error'
};

/**
 * Create a message for actor communication
 */
export function createMessage(type, data = {}) {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    data,
    timestamp: new Date()
  };
}

/**
 * Validate message structure and optionally specific type
 */
export function validateMessage(message, expectedType = null) {
  // Basic structure validation
  if (!message.type) throw new Error('Message must have type');
  if (!message.data) throw new Error('Message must have data');

  // Check if type is valid
  const validTypes = Object.values(MessageTypes);
  if (!validTypes.includes(message.type)) {
    throw new Error(`Invalid message type: ${message.type}`);
  }

  // If expected type specified, validate it matches
  if (expectedType && message.type !== expectedType) {
    throw new Error(`Expected message type ${expectedType}, got ${message.type}`);
  }

  // Validate specific message data based on type
  switch (message.type) {
    case MessageTypes.UPLOAD_PDF:
      if (!message.data.pdfBase64) throw new Error('UPLOAD_PDF message must have pdfBase64');
      if (!message.data.filename) throw new Error('UPLOAD_PDF message must have filename');
      break;
      
    case MessageTypes.GET_SIGNATURE_FIELDS:
      if (!message.data.documentId) throw new Error('GET_SIGNATURE_FIELDS message must have documentId');
      break;
      
    case MessageTypes.ADD_SIGNATURE:
      if (!message.data.documentId) throw new Error('ADD_SIGNATURE message must have documentId');
      if (!message.data.fieldId) throw new Error('ADD_SIGNATURE message must have fieldId');
      if (!message.data.signatureImage) throw new Error('ADD_SIGNATURE message must have signatureImage');
      if (!message.data.metadata) throw new Error('ADD_SIGNATURE message must have metadata');
      break;
      
    case MessageTypes.CLEAR_SIGNATURE:
      if (!message.data.documentId) throw new Error('CLEAR_SIGNATURE message must have documentId');
      if (!message.data.fieldId) throw new Error('CLEAR_SIGNATURE message must have fieldId');
      break;
      
    case MessageTypes.DOWNLOAD_PDF:
      if (!message.data.documentId) throw new Error('DOWNLOAD_PDF message must have documentId');
      break;
      
    case MessageTypes.PDF_READY:
      if (!message.data.documentId) throw new Error('PDF_READY message must have documentId');
      if (!message.data.signatureFields) throw new Error('PDF_READY message must have signatureFields');
      break;
      
    case MessageTypes.SIGNATURE_ADDED:
      if (!message.data.documentId) throw new Error('SIGNATURE_ADDED message must have documentId');
      if (!message.data.fieldId) throw new Error('SIGNATURE_ADDED message must have fieldId');
      break;
      
    case MessageTypes.PDF_DOWNLOAD_READY:
      if (!message.data.documentId) throw new Error('PDF_DOWNLOAD_READY message must have documentId');
      if (!message.data.pdfBase64) throw new Error('PDF_DOWNLOAD_READY message must have pdfBase64');
      break;
      
    case MessageTypes.ERROR:
      if (!message.data.message) throw new Error('ERROR message must have message');
      break;
  }

  return true;
}