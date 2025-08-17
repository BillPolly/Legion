import { PDFDocument as PDFLibDocument, rgb, StandardFonts } from 'pdf-lib';
import { PDFDocument, SignatureField } from '../shared/SignatureTypes.js';

// Dynamic import for pdf-parse to avoid initialization issues
let pdfParse;
async function getPdfParse() {
  if (!pdfParse) {
    try {
      pdfParse = (await import('pdf-parse')).default;
    } catch (error) {
      // Fallback if pdf-parse fails to load
      pdfParse = async (buffer) => ({
        numpages: 1,
        text: '',
        info: {},
        metadata: {}
      });
    }
  }
  return pdfParse;
}

/**
 * PDFProcessor - Handles all PDF manipulation operations
 */
export class PDFProcessor {
  constructor() {
    // No initialization needed for stateless processor
  }

  /**
   * Load a PDF from buffer and create PDFDocument instance
   */
  async loadPDF(buffer, filename) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty PDF buffer');
    }

    // Check PDF header
    if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || 
        buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      throw new Error('Invalid PDF: Missing PDF header');
    }

    try {
      // Parse PDF to get metadata
      const metadata = await this.parsePDF(buffer);
      
      // Create PDFDocument instance
      const doc = new PDFDocument({
        filename,
        data: buffer,
        pageCount: metadata.pageCount || 1
      });

      return doc;
    } catch (error) {
      throw new Error(`Failed to load PDF: ${error.message}`);
    }
  }

  /**
   * Parse PDF buffer to extract metadata and text
   */
  async parsePDF(buffer) {
    try {
      const parse = await getPdfParse();
      const data = await parse(buffer);
      return {
        pageCount: data.numpages || 1,
        text: data.text || '',
        info: data.info || {},
        metadata: data.metadata || {}
      };
    } catch (error) {
      // pdf-parse may fail on some PDFs, provide fallback
      return {
        pageCount: 1,
        text: '',
        info: {},
        metadata: {}
      };
    }
  }

  /**
   * Detect signature fields in the PDF
   */
  async detectSignatureFields(doc) {
    const fields = [];
    
    // Try multiple detection strategies
    const formFields = await this.detectFormFields(doc);
    const textPatternFields = await this.detectTextPatterns(doc);
    const placeholderFields = await this.identifySignaturePlaceholders(doc);
    
    // Combine and deduplicate fields
    fields.push(...formFields, ...textPatternFields, ...placeholderFields);
    
    // Remove duplicates based on position
    const uniqueFields = this.deduplicateFields(fields);
    
    return uniqueFields;
  }

  /**
   * Detect form fields in PDF
   */
  async detectFormFields(doc) {
    const fields = [];
    
    try {
      // Load PDF with pdf-lib to access form fields
      const pdfDoc = await PDFLibDocument.load(doc.data);
      const form = pdfDoc.getForm();
      
      if (!form) return fields;
      
      const formFields = form.getFields();
      
      formFields.forEach((field, index) => {
        // Check if it's a signature field
        const fieldName = field.getName() || '';
        const isSignatureField = 
          fieldName.toLowerCase().includes('sign') ||
          fieldName.toLowerCase().includes('signature') ||
          field.constructor.name === 'PDFSignature';
        
        if (isSignatureField) {
          // Get field position and size
          const widgets = field.acroField.getWidgets();
          if (widgets.length > 0) {
            const widget = widgets[0];
            const rect = widget.getRectangle();
            
            fields.push(new SignatureField({
              documentId: doc.id,
              page: 1, // Default to first page, would need more logic for multi-page
              rect: {
                x: rect.x || 0,
                y: rect.y || 0,
                width: rect.width || 200,
                height: rect.height || 50
              },
              label: fieldName || `Signature Field ${index + 1}`,
              required: field.isRequired ? field.isRequired() : false
            }));
          }
        }
      });
    } catch (error) {
      // Form field detection may fail on some PDFs
      console.log('Form field detection failed:', error.message);
    }
    
    return fields;
  }

  /**
   * Detect signature patterns in PDF text
   */
  async detectTextPatterns(doc) {
    const fields = [];
    
    try {
      const metadata = await this.parsePDF(doc.data);
      const text = metadata.text || '';
      
      // Look for signature patterns
      const patterns = [
        /Signature:\s*_{5,}/gi,
        /Sign(?:ed|ature)?(?:\s+here)?:\s*_{5,}/gi,
        /Authorized\s+(?:by|signature):\s*_{5,}/gi,
        /X:\s*_{10,}/gi, // Common signature line marker
        /_{20,}\s*(?:\n|\r)?\s*(?:Signature|Name|Date)/gi
      ];
      
      let foundPatterns = false;
      patterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          foundPatterns = true;
        }
      });
      
      // If we found signature patterns, create fields
      // In a real implementation, we'd extract coordinates from PDF structure
      if (foundPatterns) {
        // For now, create a default field when patterns are found
        fields.push(new SignatureField({
          documentId: doc.id,
          page: 1,
          rect: {
            x: 100,
            y: 650, // Near where signature text typically appears
            width: 200,
            height: 50
          },
          label: 'Signature',
          required: true
        }));
      }
    } catch (error) {
      console.log('Text pattern detection failed:', error.message);
    }
    
    return fields;
  }

  /**
   * Identify signature placeholder areas
   */
  async identifySignaturePlaceholders(doc) {
    const fields = [];
    
    // This would analyze the PDF structure for:
    // - Empty rectangles/boxes
    // - Horizontal lines with labels
    // - Areas marked for signatures
    
    // For MVP, we'll return empty array
    // In production, this would use pdf-lib to analyze page content
    
    return fields;
  }

  /**
   * Remove duplicate fields based on position
   */
  deduplicateFields(fields) {
    const unique = [];
    const seen = new Set();
    
    fields.forEach(field => {
      const key = `${field.page}-${field.rect.x}-${field.rect.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(field);
      }
    });
    
    return unique;
  }

  /**
   * Prepare signature image for embedding
   */
  async prepareSignatureImage(imageData, field) {
    // Extract base64 data
    const base64Data = imageData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Calculate dimensions to fit field
    const rect = field.rect || { width: 200, height: 50 };
    const aspectRatio = rect.width / rect.height;
    const width = rect.width;
    const height = rect.height;
    
    return {
      buffer,
      width,
      height,
      aspectRatio
    };
  }

  /**
   * Calculate signature position on PDF page
   */
  calculateSignaturePosition(field, pageHeight) {
    // PDF coordinates are bottom-up, so adjust y coordinate
    return {
      x: field.rect.x,
      y: pageHeight - field.rect.y - field.rect.height
    };
  }

  /**
   * Embed signature image into PDF
   */
  async embedSignature(doc, field, signatureImage) {
    try {
      // Load PDF document
      const pdfDoc = await PDFLibDocument.load(doc.data);
      
      // Get the page
      const pages = pdfDoc.getPages();
      const page = pages[field.page - 1]; // Convert to 0-based index
      
      if (!page) {
        throw new Error(`Page ${field.page} not found in PDF`);
      }
      
      // Prepare signature image
      const preparedImage = await this.prepareSignatureImage(signatureImage, field);
      
      // Embed PNG image
      const pngImage = await pdfDoc.embedPng(preparedImage.buffer);
      
      // Calculate position
      const { height } = page.getSize();
      const position = this.calculateSignaturePosition(field, height);
      
      // Draw the image
      page.drawImage(pngImage, {
        x: position.x,
        y: position.y,
        width: field.rect.width,
        height: field.rect.height
      });
      
      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      throw new Error(`Failed to embed signature: ${error.message}`);
    }
  }

  /**
   * Generate final signed PDF with all signatures
   */
  async generateSignedPDF(doc, signatures) {
    let pdfBuffer = doc.data;
    
    // Embed each signature
    for (const sig of signatures) {
      const field = doc.getField(sig.fieldId);
      if (!field) {
        throw new Error(`Field ${sig.fieldId} not found`);
      }
      
      pdfBuffer = await this.embedSignature(
        { ...doc, data: pdfBuffer },
        field,
        sig.imageData
      );
    }
    
    return pdfBuffer;
  }

  /**
   * Add metadata to PDF
   */
  async addMetadata(doc, metadata) {
    try {
      const pdfDoc = await PDFLibDocument.load(doc.data);
      
      // Set document metadata
      if (metadata.signerName) {
        pdfDoc.setAuthor(metadata.signerName);
      }
      
      if (metadata.signedDate) {
        pdfDoc.setModificationDate(new Date(metadata.signedDate));
      }
      
      if (metadata.documentId) {
        pdfDoc.setKeywords([`DocumentID:${metadata.documentId}`]);
      }
      
      // Add custom metadata
      pdfDoc.setProducer('Legion PDF Signer');
      
      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      throw new Error(`Failed to add metadata: ${error.message}`);
    }
  }
}