// Test utilities for pdf-signer tests
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TestUtils {
  // Create a simple test PDF
  static createTestPDF() {
    // Minimal valid PDF structure
    const pdfContent = `%PDF-1.4
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
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
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
425
%%EOF`;
    return Buffer.from(pdfContent);
  }

  // Create a test signature image (base64)
  static createTestSignatureImage() {
    // 1x1 black pixel PNG as minimal signature
    const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    return pngBase64;
  }

  // Create a test signature field
  static createTestSignatureField(overrides = {}) {
    return {
      id: 'field-1',
      page: 1,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      label: 'Signature',
      required: true,
      signed: false,
      ...overrides
    };
  }

  // Create a test document metadata
  static createTestDocumentMetadata(overrides = {}) {
    return {
      documentId: 'doc-123',
      filename: 'test.pdf',
      pageCount: 1,
      documentSize: 1024,
      signatureFields: [TestUtils.createTestSignatureField()],
      ...overrides
    };
  }

  // Create test signature metadata
  static createTestSignatureMetadata(overrides = {}) {
    return {
      timestamp: Date.now(),
      signerName: 'Test User',
      signerEmail: 'test@example.com',
      ipAddress: '127.0.0.1',
      dimensions: {
        width: 200,
        height: 50
      },
      ...overrides
    };
  }

  // Wait for async operations
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Create mock WebSocket
  static createMockWebSocket() {
    return {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1, // OPEN
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    };
  }

  // Create mock actor
  static createMockActor() {
    return {
      receive: jest.fn(),
      setRemoteActor: jest.fn(),
      handle: jest.fn()
    };
  }

  // Convert base64 to buffer
  static base64ToBuffer(base64) {
    const base64Data = base64.split(',')[1] || base64;
    return Buffer.from(base64Data, 'base64');
  }

  // Convert buffer to base64
  static bufferToBase64(buffer, mimeType = 'application/pdf') {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
}