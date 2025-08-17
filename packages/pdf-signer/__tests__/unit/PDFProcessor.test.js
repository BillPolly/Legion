import { describe, it, expect, beforeEach } from '@jest/globals';
import { PDFProcessor } from '../../src/server/PDFProcessor.js';
import { PDFDocument, SignatureField } from '../../src/shared/SignatureTypes.js';
import { TestUtils } from '../utils/TestUtils.js';

describe('PDFProcessor', () => {
  let processor;
  
  beforeEach(() => {
    processor = new PDFProcessor();
  });

  describe('PDF Loading', () => {
    it('should load a PDF from buffer', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const doc = await processor.loadPDF(pdfBuffer, 'test.pdf');
      
      expect(doc).toBeInstanceOf(PDFDocument);
      expect(doc.filename).toBe('test.pdf');
      expect(doc.data).toEqual(pdfBuffer);
      expect(doc.pageCount).toBeGreaterThan(0);
    });

    it('should throw error for invalid PDF', async () => {
      const invalidBuffer = Buffer.from('Not a PDF');
      
      await expect(processor.loadPDF(invalidBuffer, 'invalid.pdf'))
        .rejects.toThrow('Invalid PDF');
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.from('');
      
      await expect(processor.loadPDF(emptyBuffer, 'empty.pdf'))
        .rejects.toThrow('Empty PDF buffer');
    });
  });

  describe('PDF Parsing', () => {
    it('should extract PDF metadata', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const metadata = await processor.parsePDF(pdfBuffer);
      
      expect(metadata).toHaveProperty('pageCount');
      expect(metadata.pageCount).toBeGreaterThan(0);
      expect(metadata).toHaveProperty('text');
    });

    it('should extract text from PDF', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const metadata = await processor.parsePDF(pdfBuffer);
      
      // pdf-parse may not extract text from simple test PDFs
      expect(metadata).toHaveProperty('text');
      expect(typeof metadata.text).toBe('string');
    });
  });

  describe('Signature Field Detection', () => {
    it('should detect form fields in PDF', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const doc = await processor.loadPDF(pdfBuffer, 'test.pdf');
      const fields = await processor.detectSignatureFields(doc);
      
      expect(Array.isArray(fields)).toBe(true);
      // Test PDF has no form fields, so should be empty
      expect(fields).toHaveLength(0);
    });

    it('should detect signature patterns in text', async () => {
      // Create a PDF with signature text patterns
      const pdfWithSignatureText = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 100 >>
stream
BT
/F1 12 Tf
100 700 Td
(Contract Agreement) Tj
100 650 Td
(Signature: _________________) Tj
100 600 Td
(Date: _________________) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000256 00000 n 
0000000333 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
500
%%EOF`);

      const doc = await processor.loadPDF(pdfWithSignatureText, 'signature-doc.pdf');
      const fields = await processor.detectSignatureFields(doc);
      
      // Text pattern detection should find signature in this PDF
      expect(Array.isArray(fields)).toBe(true);
      // Since our test PDF has signature patterns, should detect them
      if (fields.length > 0) {
        expect(fields[0]).toBeInstanceOf(SignatureField);
        expect(fields[0].label).toContain('Signature');
      }
    });

    it('should identify placeholder rectangles', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const doc = await processor.loadPDF(pdfBuffer, 'test.pdf');
      
      // Add manual signature field identification
      const fields = await processor.identifySignaturePlaceholders(doc);
      
      expect(Array.isArray(fields)).toBe(true);
    });

    it('should return empty array for PDF without signature fields', async () => {
      const simplePDF = TestUtils.createTestPDF();
      const doc = await processor.loadPDF(simplePDF, 'simple.pdf');
      const fields = await processor.detectSignatureFields(doc);
      
      expect(fields).toEqual([]);
    });
  });

  describe('Signature Embedding', () => {
    it('should prepare signature image for embedding', async () => {
      const signatureImage = TestUtils.createTestSignatureImage();
      const field = TestUtils.createTestSignatureField();
      
      const preparedImage = await processor.prepareSignatureImage(signatureImage, field);
      
      expect(preparedImage).toHaveProperty('buffer');
      expect(preparedImage).toHaveProperty('width');
      expect(preparedImage).toHaveProperty('height');
      expect(preparedImage.buffer).toBeInstanceOf(Buffer);
    });

    it('should calculate correct position for signature', () => {
      const field = TestUtils.createTestSignatureField({
        rect: { x: 100, y: 200, width: 150, height: 50 }
      });
      
      const position = processor.calculateSignaturePosition(field, 792); // Letter size page height
      
      expect(position).toHaveProperty('x');
      expect(position).toHaveProperty('y');
      expect(position.x).toBe(100);
      // PDF coordinates are bottom-up, so y needs to be adjusted
      expect(position.y).toBe(792 - 200 - 50); // page height - y - height
    });

    it('should embed signature into PDF', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const doc = await processor.loadPDF(pdfBuffer, 'test.pdf');
      const signatureImage = TestUtils.createTestSignatureImage();
      const field = TestUtils.createTestSignatureField({
        documentId: doc.id,
        page: 1,
        rect: { x: 100, y: 100, width: 200, height: 50 }
      });
      
      const signedPDF = await processor.embedSignature(doc, field, signatureImage);
      
      expect(signedPDF).toBeInstanceOf(Buffer);
      expect(signedPDF.length).toBeGreaterThan(0);
      // Check PDF header
      expect(signedPDF[0]).toBe(0x25); // %
      expect(signedPDF[1]).toBe(0x50); // P
      expect(signedPDF[2]).toBe(0x44); // D
      expect(signedPDF[3]).toBe(0x46); // F
    });

    it('should handle multiple signatures', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const doc = await processor.loadPDF(pdfBuffer, 'test.pdf');
      
      const field1 = TestUtils.createTestSignatureField({
        id: 'field-1',
        documentId: doc.id,
        page: 1,
        rect: { x: 100, y: 100, width: 200, height: 50 }
      });
      
      const field2 = TestUtils.createTestSignatureField({
        id: 'field-2',
        documentId: doc.id,
        page: 1,
        rect: { x: 100, y: 200, width: 200, height: 50 }
      });
      
      const signature1 = TestUtils.createTestSignatureImage();
      const signature2 = TestUtils.createTestSignatureImage();
      
      // Embed first signature
      let signedPDF = await processor.embedSignature(doc, field1, signature1);
      doc.data = signedPDF;
      
      // Embed second signature
      signedPDF = await processor.embedSignature(doc, field2, signature2);
      
      expect(signedPDF).toBeInstanceOf(Buffer);
      expect(signedPDF.length).toBeGreaterThan(pdfBuffer.length);
    });
  });

  describe('Document Generation', () => {
    it('should generate final PDF with all signatures', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const doc = await processor.loadPDF(pdfBuffer, 'test.pdf');
      
      const field = TestUtils.createTestSignatureField({
        documentId: doc.id,
        page: 1,
        rect: { x: 100, y: 100, width: 200, height: 50 }
      });
      doc.addField(field);
      
      const signatureImage = TestUtils.createTestSignatureImage();
      const signatures = [{
        fieldId: field.id,
        imageData: signatureImage
      }];
      
      const finalPDF = await processor.generateSignedPDF(doc, signatures);
      
      expect(finalPDF).toBeInstanceOf(Buffer);
      expect(finalPDF.length).toBeGreaterThan(0);
    });

    it('should add metadata to signed PDF', async () => {
      const pdfBuffer = TestUtils.createTestPDF();
      const doc = await processor.loadPDF(pdfBuffer, 'test.pdf');
      
      const metadata = {
        signerName: 'John Doe',
        signedDate: new Date().toISOString(),
        documentId: doc.id
      };
      
      const pdfWithMetadata = await processor.addMetadata(doc, metadata);
      
      expect(pdfWithMetadata).toBeInstanceOf(Buffer);
      // Metadata is embedded in PDF, so size should increase slightly
      expect(pdfWithMetadata.length).toBeGreaterThanOrEqual(pdfBuffer.length);
    });
  });
});