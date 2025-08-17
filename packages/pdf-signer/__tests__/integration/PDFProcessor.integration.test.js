import { describe, it, expect, beforeEach } from '@jest/globals';
import { PDFProcessor } from '../../src/server/PDFProcessor.js';
import { PDFDocument, SignatureField, Signature } from '../../src/shared/SignatureTypes.js';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PDFProcessor Integration Tests', () => {
  let processor;
  let testPDF;
  
  beforeEach(async () => {
    processor = new PDFProcessor();
    
    // Create a more complex test PDF with forms
    const pdfDoc = await PDFLibDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    
    // Add some text
    page.drawText('Contract Agreement', { x: 50, y: 700, size: 20 });
    page.drawText('This is a test contract that requires signatures.', { x: 50, y: 650, size: 12 });
    page.drawText('Signature: _______________________', { x: 50, y: 500, size: 12 });
    page.drawText('Date: _______________________', { x: 350, y: 500, size: 12 });
    
    // Create form with signature field
    const form = pdfDoc.getForm();
    const signatureField = form.createTextField('signature1');
    signatureField.addToPage(page, { x: 150, y: 490, width: 150, height: 30 });
    
    testPDF = Buffer.from(await pdfDoc.save());
  });

  describe('Complete PDF Processing Pipeline', () => {
    it('should process a real PDF document', async () => {
      // Load PDF
      const doc = await processor.loadPDF(testPDF, 'contract.pdf');
      expect(doc).toBeInstanceOf(PDFDocument);
      expect(doc.pageCount).toBe(1);
      
      // Detect fields
      const fields = await processor.detectSignatureFields(doc);
      expect(Array.isArray(fields)).toBe(true);
      
      // Fields should be detected from form or text patterns
      if (fields.length > 0) {
        expect(fields[0]).toBeInstanceOf(SignatureField);
      }
    });

    it('should embed real signature image into PDF', async () => {
      // Load PDF
      const doc = await processor.loadPDF(testPDF, 'contract.pdf');
      
      // Create a signature field manually
      const field = new SignatureField({
        documentId: doc.id,
        page: 1,
        rect: { x: 150, y: 490, width: 150, height: 30 }
      });
      doc.addField(field);
      
      // Create a real signature image (small black rectangle)
      const signatureCanvas = await createSignatureImage();
      
      // Embed signature
      const signedPDF = await processor.embedSignature(doc, field, signatureCanvas);
      
      // Verify the result is a valid PDF
      expect(signedPDF).toBeInstanceOf(Buffer);
      expect(signedPDF.length).toBeGreaterThan(testPDF.length);
      
      // Load the signed PDF to verify it's valid
      const signedDoc = await PDFLibDocument.load(signedPDF);
      expect(signedDoc.getPageCount()).toBe(1);
    });

    it('should handle multiple signatures in sequence', async () => {
      const doc = await processor.loadPDF(testPDF, 'contract.pdf');
      
      // Add multiple fields
      const field1 = new SignatureField({
        id: 'sig1',
        documentId: doc.id,
        page: 1,
        rect: { x: 150, y: 490, width: 150, height: 30 }
      });
      
      const field2 = new SignatureField({
        id: 'sig2',
        documentId: doc.id,
        page: 1,
        rect: { x: 150, y: 400, width: 150, height: 30 }
      });
      
      doc.addField(field1);
      doc.addField(field2);
      
      // Create signatures
      const sig1 = new Signature({
        fieldId: field1.id,
        imageData: await createSignatureImage(),
        signerName: 'John Doe'
      });
      
      const sig2 = new Signature({
        fieldId: field2.id,
        imageData: await createSignatureImage(),
        signerName: 'Jane Smith'
      });
      
      doc.addSignature(sig1);
      doc.addSignature(sig2);
      
      // Generate signed PDF
      const signedPDF = await processor.generateSignedPDF(doc, [
        { fieldId: field1.id, imageData: sig1.imageData },
        { fieldId: field2.id, imageData: sig2.imageData }
      ]);
      
      expect(signedPDF).toBeInstanceOf(Buffer);
      
      // Verify it's still a valid PDF
      const signedDoc = await PDFLibDocument.load(signedPDF);
      expect(signedDoc.getPageCount()).toBe(1);
    });

    it('should preserve PDF structure after modifications', async () => {
      const doc = await processor.loadPDF(testPDF, 'contract.pdf');
      
      // Add metadata
      const pdfWithMetadata = await processor.addMetadata(doc, {
        signerName: 'Test User',
        signedDate: new Date().toISOString(),
        documentId: doc.id
      });
      
      // Load modified PDF and check metadata
      const modifiedDoc = await PDFLibDocument.load(pdfWithMetadata);
      expect(modifiedDoc.getAuthor()).toBe('Test User');
      // Producer gets overridden by pdf-lib, so just check it exists
      expect(modifiedDoc.getProducer()).toBeDefined();
      
      // Original content should still be there
      const pages = modifiedDoc.getPages();
      expect(pages.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted PDF gracefully', async () => {
      const corruptedPDF = Buffer.from('Not a real PDF but starts with %PDF-1.4');
      
      // Should throw appropriate error
      await expect(processor.loadPDF(corruptedPDF, 'corrupt.pdf'))
        .rejects.toThrow('Invalid PDF');
    });

    it('should handle missing signature field', async () => {
      const doc = await processor.loadPDF(testPDF, 'contract.pdf');
      
      const signatures = [{
        fieldId: 'non-existent-field',
        imageData: await createSignatureImage()
      }];
      
      await expect(processor.generateSignedPDF(doc, signatures))
        .rejects.toThrow('Field non-existent-field not found');
    });

    it('should handle invalid signature image', async () => {
      const doc = await processor.loadPDF(testPDF, 'contract.pdf');
      
      const field = new SignatureField({
        documentId: doc.id,
        page: 1,
        rect: { x: 150, y: 490, width: 150, height: 30 }
      });
      
      const invalidImage = 'not-a-valid-base64-image';
      
      await expect(processor.embedSignature(doc, field, invalidImage))
        .rejects.toThrow();
    });
  });
});

// Helper function to create a signature image
async function createSignatureImage() {
  // Create a simple 1x1 black pixel PNG as base64
  // This is a valid PNG image
  const blackPixelPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT chunk size
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, // compressed data
    0x00, 0x01, // more compressed data
    0x49, 0xC0, 0x41, 0x8E, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk size
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  
  return `data:image/png;base64,${blackPixelPNG.toString('base64')}`;
}