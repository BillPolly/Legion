import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  PDFDocument,
  SignatureField,
  Signature,
  MessageTypes,
  createMessage,
  validateMessage
} from '../../src/shared/SignatureTypes.js';

describe('PDFDocument Model', () => {
  it('should create a PDFDocument with required fields', () => {
    const doc = new PDFDocument({
      id: 'doc-123',
      filename: 'test.pdf',
      data: Buffer.from('PDF content'),
      pageCount: 3
    });

    expect(doc.id).toBe('doc-123');
    expect(doc.filename).toBe('test.pdf');
    expect(doc.data).toBeInstanceOf(Buffer);
    expect(doc.pageCount).toBe(3);
    expect(doc.fields).toEqual([]);
    expect(doc.signatures).toEqual([]);
    expect(doc.uploadTime).toBeInstanceOf(Date);
    expect(doc.lastModified).toBeInstanceOf(Date);
  });

  it('should generate id if not provided', () => {
    const doc = new PDFDocument({
      filename: 'test.pdf',
      data: Buffer.from('PDF'),
      pageCount: 1
    });

    expect(doc.id).toMatch(/^doc-/);
  });

  it('should throw error if required fields missing', () => {
    expect(() => new PDFDocument({})).toThrow('filename is required');
    expect(() => new PDFDocument({ filename: 'test.pdf' })).toThrow('data is required');
    expect(() => new PDFDocument({ 
      filename: 'test.pdf', 
      data: Buffer.from('PDF') 
    })).toThrow('pageCount is required');
  });

  it('should add signature field', () => {
    const doc = new PDFDocument({
      filename: 'test.pdf',
      data: Buffer.from('PDF'),
      pageCount: 1
    });

    const field = new SignatureField({
      documentId: doc.id,
      page: 1,
      rect: { x: 100, y: 100, width: 200, height: 50 }
    });

    doc.addField(field);
    expect(doc.fields).toHaveLength(1);
    expect(doc.fields[0]).toBe(field);
  });

  it('should add signature', () => {
    const doc = new PDFDocument({
      filename: 'test.pdf',
      data: Buffer.from('PDF'),
      pageCount: 1
    });

    const signature = new Signature({
      fieldId: 'field-1',
      imageData: 'data:image/png;base64,abc',
      signerName: 'John Doe'
    });

    doc.addSignature(signature);
    expect(doc.signatures).toHaveLength(1);
    expect(doc.signatures[0]).toBe(signature);
    expect(doc.lastModified).not.toBe(doc.uploadTime);
  });
});

describe('SignatureField Model', () => {
  it('should create a SignatureField with required fields', () => {
    const field = new SignatureField({
      documentId: 'doc-123',
      page: 1,
      rect: { x: 100, y: 200, width: 150, height: 50 }
    });

    expect(field.id).toMatch(/^field-/);
    expect(field.documentId).toBe('doc-123');
    expect(field.page).toBe(1);
    expect(field.rect).toEqual({ x: 100, y: 200, width: 150, height: 50 });
    expect(field.required).toBe(false);
    expect(field.signatureId).toBeNull();
  });

  it('should accept optional fields', () => {
    const field = new SignatureField({
      id: 'custom-id',
      documentId: 'doc-123',
      page: 2,
      rect: { x: 0, y: 0, width: 100, height: 100 },
      label: 'CEO Signature',
      required: true
    });

    expect(field.id).toBe('custom-id');
    expect(field.label).toBe('CEO Signature');
    expect(field.required).toBe(true);
  });

  it('should throw error if required fields missing', () => {
    expect(() => new SignatureField({})).toThrow('documentId is required');
    expect(() => new SignatureField({ documentId: 'doc-123' })).toThrow('page is required');
    expect(() => new SignatureField({ 
      documentId: 'doc-123',
      page: 1 
    })).toThrow('rect is required');
  });

  it('should validate rect structure', () => {
    expect(() => new SignatureField({
      documentId: 'doc-123',
      page: 1,
      rect: { x: 0, y: 0 } // missing width and height
    })).toThrow('rect must have x, y, width, and height');
  });

  it('should mark as signed', () => {
    const field = new SignatureField({
      documentId: 'doc-123',
      page: 1,
      rect: { x: 0, y: 0, width: 100, height: 50 }
    });

    expect(field.isSigned()).toBe(false);
    field.signatureId = 'sig-123';
    expect(field.isSigned()).toBe(true);
  });
});

describe('Signature Model', () => {
  it('should create a Signature with required fields', () => {
    const signature = new Signature({
      fieldId: 'field-123',
      imageData: 'data:image/png;base64,xyz',
      signerName: 'Jane Smith'
    });

    expect(signature.id).toMatch(/^sig-/);
    expect(signature.fieldId).toBe('field-123');
    expect(signature.imageData).toBe('data:image/png;base64,xyz');
    expect(signature.signerName).toBe('Jane Smith');
    expect(signature.timestamp).toBeInstanceOf(Date);
    expect(signature.metadata).toEqual({});
  });

  it('should accept metadata', () => {
    const metadata = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      dimensions: { width: 200, height: 50 }
    };

    const signature = new Signature({
      fieldId: 'field-123',
      imageData: 'data:image/png;base64,xyz',
      signerName: 'Jane Smith',
      metadata
    });

    expect(signature.metadata).toEqual(metadata);
  });

  it('should throw error if required fields missing', () => {
    expect(() => new Signature({})).toThrow('fieldId is required');
    expect(() => new Signature({ fieldId: 'field-123' })).toThrow('imageData is required');
    expect(() => new Signature({ 
      fieldId: 'field-123',
      imageData: 'data:image/png;base64,xyz' 
    })).toThrow('signerName is required');
  });

  it('should validate image data format', () => {
    expect(() => new Signature({
      fieldId: 'field-123',
      imageData: 'not-a-valid-image',
      signerName: 'Jane'
    })).toThrow('imageData must be a base64 encoded image');
  });
});

describe('Message Types', () => {
  it('should have all required message types', () => {
    expect(MessageTypes.UPLOAD_PDF).toBe('upload_pdf');
    expect(MessageTypes.GET_SIGNATURE_FIELDS).toBe('get_signature_fields');
    expect(MessageTypes.ADD_SIGNATURE).toBe('add_signature');
    expect(MessageTypes.CLEAR_SIGNATURE).toBe('clear_signature');
    expect(MessageTypes.DOWNLOAD_PDF).toBe('download_pdf');
    expect(MessageTypes.PDF_READY).toBe('pdf_ready');
    expect(MessageTypes.SIGNATURE_ADDED).toBe('signature_added');
    expect(MessageTypes.SIGNATURE_CLEARED).toBe('signature_cleared');
    expect(MessageTypes.PDF_DOWNLOAD_READY).toBe('pdf_download_ready');
    expect(MessageTypes.ERROR).toBe('error');
  });
});

describe('Message Creation and Validation', () => {
  it('should create a valid message', () => {
    const message = createMessage(MessageTypes.UPLOAD_PDF, {
      pdfBase64: 'base64data',
      filename: 'document.pdf'
    });

    expect(message.type).toBe('upload_pdf');
    expect(message.data).toEqual({
      pdfBase64: 'base64data',
      filename: 'document.pdf'
    });
    expect(message.timestamp).toBeInstanceOf(Date);
    expect(message.id).toMatch(/^msg-/);
  });

  it('should validate message structure', () => {
    const validMessage = {
      type: MessageTypes.PDF_READY,
      data: { 
        documentId: 'doc-123',
        signatureFields: [] 
      },
      timestamp: new Date(),
      id: 'msg-123'
    };

    expect(() => validateMessage(validMessage)).not.toThrow();
  });

  it('should reject invalid message type', () => {
    const invalidMessage = {
      type: 'invalid_type',
      data: {},
      timestamp: new Date(),
      id: 'msg-123'
    };

    expect(() => validateMessage(invalidMessage)).toThrow('Invalid message type');
  });

  it('should reject message without required fields', () => {
    expect(() => validateMessage({})).toThrow('Message must have type');
    expect(() => validateMessage({ type: MessageTypes.ERROR })).toThrow('Message must have data');
  });

  it('should validate specific message data', () => {
    const uploadMessage = createMessage(MessageTypes.UPLOAD_PDF, {
      pdfBase64: 'base64',
      filename: 'test.pdf'
    });
    expect(() => validateMessage(uploadMessage, MessageTypes.UPLOAD_PDF)).not.toThrow();

    const invalidUpload = createMessage(MessageTypes.UPLOAD_PDF, {
      // missing filename
      pdfBase64: 'base64'
    });
    expect(() => validateMessage(invalidUpload, MessageTypes.UPLOAD_PDF))
      .toThrow('UPLOAD_PDF message must have filename');
  });
});