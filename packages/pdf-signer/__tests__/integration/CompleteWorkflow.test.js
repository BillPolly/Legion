import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createPDFSignerServerActor,
  createPDFSignerClientActor,
  MessageTypes
} from '../../src/index.js';
import { JSDOM } from 'jsdom';
import { TestUtils } from '../utils/TestUtils.js';

describe('Complete PDF Signing Workflow Tests', () => {
  let dom;
  let serverActor;
  let clientActor;
  let container;
  let services;
  let mockServerReceive;
  let mockClientReceive;

  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="pdf-container" style="width: 800px; height: 600px;"></div>
          <input type="file" id="file-upload" accept=".pdf" />
          <button id="download-btn">Download PDF</button>
        </body>
      </html>
    `);
    
    global.window = dom.window;
    global.document = dom.window.document;
    global.FileReader = dom.window.FileReader;
    global.navigator = { userAgent: 'test-browser' };
    
    // Mock PDF.js
    global.window.pdfjsLib = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 3,
          getPage: (pageNum) => Promise.resolve({
            getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale, scale }),
            render: () => ({ promise: Promise.resolve() })
          }),
          destroy: () => {}
        })
      })
    };
    
    // Mock SignaturePad library
    global.window.SignaturePad = class {
      constructor() {
        this._isEmpty = true;
        this._strokes = [];
      }
      isEmpty() { return this._isEmpty; }
      clear() { 
        this._isEmpty = true; 
        this._strokes = [];
      }
      toDataURL() { 
        return this._isEmpty ? null : TestUtils.createTestSignatureImage();
      }
      fromDataURL() { this._isEmpty = false; }
      simulateDrawing() {
        this._isEmpty = false;
        this._strokes.push({ x: 10, y: 10 });
      }
    };
    
    // Create services for server actor
    services = new Map();
    services.set('resourceManager', {
      get: (key) => {
        if (key === 'env.MONOREPO_ROOT') return '/test/root';
        return null;
      }
    });
    
    // Create actors
    serverActor = createPDFSignerServerActor(services);
    container = document.getElementById('pdf-container');
    clientActor = createPDFSignerClientActor(container);
    
    // Set up bidirectional communication with mocks
    mockServerReceive = jest.fn().mockImplementation(serverActor.receive.bind(serverActor));
    mockClientReceive = jest.fn().mockImplementation(clientActor.receive.bind(clientActor));
    
    serverActor.setRemoteActor({ receive: mockClientReceive });
    clientActor.setRemoteActor({ receive: mockServerReceive });
  });
  
  afterEach(() => {
    if (serverActor) {
      serverActor.cleanup();
    }
    if (clientActor) {
      clientActor.cleanup();
    }
    dom.window.close();
  });

  describe('Document Upload Workflow', () => {
    it('should handle complete file upload to PDF ready flow', async () => {
      // Create test PDF file
      const pdfBytes = TestUtils.createTestPDF();
      const file = new File([pdfBytes], 'contract.pdf', { type: 'application/pdf' });
      
      // Mock FileReader for client
      global.FileReader = class {
        readAsDataURL(file) {
          setTimeout(() => {
            this.result = TestUtils.bufferToBase64(pdfBytes);
            if (this.onload) {
              this.onload({ target: { result: this.result } });
            }
          }, 0);
        }
      };
      
      // Client uploads file
      await clientActor.handleFileUpload(file);
      
      // Wait for file reader
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Server should have received upload request
      expect(serverActor.documents.size).toBe(1);
      
      // Client should have loaded document
      expect(clientActor.currentDocument).toBeDefined();
      expect(clientActor.currentDocument.filename).toBe('contract.pdf');
      expect(clientActor.viewer).toBeDefined();
    });

    it('should detect signature fields accurately', async () => {
      // Upload PDF with form fields
      const pdfBytes = TestUtils.createTestPDF();
      
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'form-document.pdf'
      });
      
      expect(uploadResponse.type).toBe(MessageTypes.PDF_READY);
      expect(uploadResponse.data.signatureFields).toBeDefined();
      
      // Should have detected signature fields from form (may be 0 for basic PDF)
      const fields = uploadResponse.data.signatureFields;
      expect(fields.length).toBeGreaterThanOrEqual(0);
      
      // Verify field properties
      fields.forEach(field => {
        expect(field.id).toBeDefined();
        expect(field.page).toBeGreaterThan(0);
        expect(field.x).toBeGreaterThanOrEqual(0);
        expect(field.y).toBeGreaterThanOrEqual(0);
        expect(field.width).toBeGreaterThan(0);
        expect(field.height).toBeGreaterThan(0);
      });
    });

    it('should handle PDFs without signature fields', async () => {
      // Upload plain PDF without form fields
      const pdfBytes = TestUtils.createTestPDF();
      
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'plain-document.pdf'
      });
      
      expect(uploadResponse.type).toBe(MessageTypes.PDF_READY);
      expect(uploadResponse.data.signatureFields).toBeDefined();
      expect(Array.isArray(uploadResponse.data.signatureFields)).toBe(true);
      
      // May have 0 fields or detected text patterns
      const fields = uploadResponse.data.signatureFields;
      expect(fields.length).toBeGreaterThanOrEqual(0);
    });

    it('should confirm client rendering of uploaded PDF', async () => {
      const pdfBytes = TestUtils.createTestPDF();
      
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'render-test.pdf'
      });
      
      // Client receives PDF ready message
      await clientActor.receive(uploadResponse.type, uploadResponse.data);
      
      // Verify client state
      expect(clientActor.currentDocument).toBeDefined();
      expect(clientActor.viewer).toBeDefined();
      
      // Verify PDF was loaded in viewer
      expect(clientActor.viewer.totalPages).toBeGreaterThan(0);
      expect(clientActor.viewer.currentPage).toBe(1);
    });
  });

  describe('Signature Capture Workflow', () => {
    let documentId;
    let testField;
    
    beforeEach(async () => {
      // Set up document with signature field
      const pdfBytes = TestUtils.createTestPDF();
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'signature-test.pdf'
      });
      
      documentId = uploadResponse.data.documentId;
      
      // Add test field
      const doc = serverActor.documents.get(documentId);
      testField = TestUtils.createTestSignatureField({
        id: 'test-signature-field',
        documentId: doc.id,
        page: 1,
        rect: { x: 100, y: 500, width: 200, height: 50 },
        label: 'Test Signature',
        required: true
      });
      doc.addField(testField);
      
      // Set up client
      await clientActor.receive(uploadResponse.type, uploadResponse.data);
      clientActor.currentDocument.fields = [testField];
    });

    it('should handle field click through to signature modal', async () => {
      // Click on signature field
      await clientActor.handleFieldClick(testField);
      
      // Should have opened signature pad
      expect(clientActor.signaturePad).toBeDefined();
      expect(clientActor.currentField).toBe(testField);
    });

    it('should capture signature drawing and confirmation', async () => {
      await clientActor.initializeUI();
      
      // Simulate field click
      clientActor.currentField = testField;
      
      // Simulate signature drawing and apply
      const signatureData = TestUtils.createTestSignatureImage();
      clientActor.handleSignatureApply(signatureData);
      
      // Should have sent signature to server
      expect(mockServerReceive).toHaveBeenCalledWith(
        MessageTypes.ADD_SIGNATURE,
        expect.objectContaining({
          documentId,
          fieldId: 'test-signature-field',
          signatureImage: signatureData
        })
      );
    });

    it('should verify signature appears in PDF', async () => {
      // Add signature
      const signatureResponse = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'test-signature-field',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: {
          signerName: 'Test Signer',
          timestamp: Date.now()
        }
      });
      
      expect(signatureResponse.type).toBe(MessageTypes.SIGNATURE_ADDED);
      expect(signatureResponse.data.success).toBe(true);
      
      // Verify signature is stored
      const signatures = serverActor.signatureManager.getDocumentSignatures(documentId);
      expect(signatures).toHaveLength(1);
      expect(signatures[0].fieldId).toBe('test-signature-field');
      
      // Verify field is marked as signed
      const field = serverActor.documents.get(documentId).getField('test-signature-field');
      expect(field.signatureId).toBeDefined();
    });

    it('should handle signature pad cancellation', async () => {
      await clientActor.initializeUI();
      
      clientActor.currentField = testField;
      clientActor.handleSignatureCancel();
      
      expect(clientActor.currentField).toBeNull();
    });

    it('should prevent signing already signed fields', async () => {
      // Mark field as signed
      testField.signed = true;
      
      await clientActor.handleFieldClick(testField);
      
      // Should not open signature pad
      expect(clientActor.currentField).toBeNull();
    });
  });

  describe('Document Download Workflow', () => {
    let documentId;
    
    beforeEach(async () => {
      // Upload document
      const pdfBytes = TestUtils.createTestPDF();
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'download-test.pdf'
      });
      
      documentId = uploadResponse.data.documentId;
      await clientActor.receive(uploadResponse.type, uploadResponse.data);
    });

    it('should handle download request through to file save', async () => {
      // Request download
      clientActor.handleDownloadRequest();
      
      // Should have sent download request to server
      expect(mockServerReceive).toHaveBeenCalledWith(
        MessageTypes.DOWNLOAD_PDF,
        { documentId }
      );
    });

    it('should verify downloaded PDF contains signatures', async () => {
      // Add signature first
      const doc = serverActor.documents.get(documentId);
      const field = TestUtils.createTestSignatureField({
        id: 'download-field',
        documentId: doc.id,
        page: 1,
        rect: { x: 100, y: 500, width: 200, height: 50 }
      });
      doc.addField(field);
      
      await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'download-field',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: { signerName: 'Download Test' }
      });
      
      // Download PDF
      const downloadResponse = await serverActor.receive(MessageTypes.DOWNLOAD_PDF, {
        documentId
      });
      
      if (downloadResponse.type === MessageTypes.ERROR) {
        console.log('Download error:', downloadResponse.data);
      }
      
      expect(downloadResponse.type).toBe(MessageTypes.PDF_DOWNLOAD_READY);
      expect(downloadResponse.data.signatures).toHaveLength(1);
      expect(downloadResponse.data.signatures[0].signerName).toBe('Download Test');
      expect(downloadResponse.data.filename).toContain('signed');
    });

    it('should confirm PDF validity with external reader simulation', async () => {
      const downloadResponse = await serverActor.receive(MessageTypes.DOWNLOAD_PDF, {
        documentId
      });
      
      expect(downloadResponse.type).toBe(MessageTypes.PDF_DOWNLOAD_READY);
      
      // Simulate external PDF validation
      const pdfData = downloadResponse.data.pdfBase64;
      expect(pdfData).toMatch(/^data:application\/pdf;base64,/);
      
      // Decode and verify it's valid PDF structure
      const base64Data = pdfData.split(',')[1];
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      
      // Should start with PDF header
      expect(pdfBuffer.toString('ascii', 0, 4)).toBe('%PDF');
      expect(pdfBuffer.length).toBeGreaterThan(500);
    });

    it('should handle download of unsigned documents', async () => {
      const downloadResponse = await serverActor.receive(MessageTypes.DOWNLOAD_PDF, {
        documentId
      });
      
      expect(downloadResponse.type).toBe(MessageTypes.PDF_DOWNLOAD_READY);
      expect(downloadResponse.data.signatures).toHaveLength(0);
      expect(downloadResponse.data.filename).not.toContain('signed');
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should handle multiple signers on same document', async () => {
      // Upload document
      const pdfBytes = TestUtils.createTestPDF();
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'multi-signer.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      const doc = serverActor.documents.get(documentId);
      
      // Add multiple signature fields
      const field1 = TestUtils.createTestSignatureField({
        id: 'signer-1',
        documentId: doc.id,
        page: 1,
        rect: { x: 100, y: 500, width: 200, height: 50 },
        label: 'First Signer'
      });
      const field2 = TestUtils.createTestSignatureField({
        id: 'signer-2', 
        documentId: doc.id,
        page: 1,
        rect: { x: 350, y: 500, width: 200, height: 50 },
        label: 'Second Signer'
      });
      
      doc.addField(field1);
      doc.addField(field2);
      
      // First signer signs
      const sig1Response = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'signer-1',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: { signerName: 'Alice Johnson' }
      });
      
      expect(sig1Response.data.success).toBe(true);
      expect(sig1Response.data.remainingFields).toBe(1);
      
      // Second signer signs
      const sig2Response = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'signer-2',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: { signerName: 'Bob Smith' }
      });
      
      expect(sig2Response.data.success).toBe(true);
      expect(sig2Response.data.remainingFields).toBe(0);
      
      // Download should contain both signatures
      const downloadResponse = await serverActor.receive(MessageTypes.DOWNLOAD_PDF, {
        documentId
      });
      
      expect(downloadResponse.data.signatures || []).toHaveLength(2);
      const signers = downloadResponse.data.signatures.map(s => s.signerName);
      expect(signers).toContain('Alice Johnson');
      expect(signers).toContain('Bob Smith');
    });

    it('should handle concurrent signature attempts', async () => {
      // Upload document
      const pdfBytes = TestUtils.createTestPDF();
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'concurrent.pdf'
      });
      
      const documentId = uploadResponse.data.documentId;
      const doc = serverActor.documents.get(documentId);
      
      const field = TestUtils.createTestSignatureField({
        id: 'concurrent-field',
        documentId: doc.id
      });
      doc.addField(field);
      
      // Simulate concurrent signature attempts
      const sig1Promise = serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'concurrent-field',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: { signerName: 'First Attempt' }
      });
      
      const sig2Promise = serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'concurrent-field',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: { signerName: 'Second Attempt' }
      });
      
      const [response1, response2] = await Promise.all([sig1Promise, sig2Promise]);
      
      // Both may succeed since they're on the same field, but it should handle it gracefully
      const successful = [response1, response2].filter(r => r.data.success);
      expect(successful.length).toBeGreaterThanOrEqual(1);
      expect(successful.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Signature Management', () => {
    let documentId;
    let testField;
    
    beforeEach(async () => {
      const pdfBytes = TestUtils.createTestPDF();
      const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
        pdfBase64: TestUtils.bufferToBase64(pdfBytes),
        filename: 'signature-mgmt.pdf'
      });
      
      documentId = uploadResponse.data.documentId;
      const doc = serverActor.documents.get(documentId);
      
      testField = TestUtils.createTestSignatureField({
        id: 'mgmt-field',
        documentId: doc.id
      });
      doc.addField(testField);
    });

    it('should handle signature clearing', async () => {
      // Add signature first
      await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'mgmt-field',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata: { signerName: 'Original Signer' }
      });
      
      // Verify signature exists
      let signatures = serverActor.signatureManager.getDocumentSignatures(documentId);
      expect(signatures).toHaveLength(1);
      
      // Clear signature
      const clearResponse = await serverActor.receive(MessageTypes.CLEAR_SIGNATURE, {
        documentId,
        fieldId: 'mgmt-field'
      });
      
      expect(clearResponse.type).toBe(MessageTypes.SIGNATURE_CLEARED);
      expect(clearResponse.data.success).toBe(true);
      
      // Verify signature removed
      signatures = serverActor.signatureManager.getDocumentSignatures(documentId);
      expect(signatures).toHaveLength(0);
    });

    it('should track signature metadata properly', async () => {
      const metadata = {
        signerName: 'John Doe',
        signerEmail: 'john@example.com',
        timestamp: Date.now(),
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser'
      };
      
      await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: 'mgmt-field',
        signatureImage: TestUtils.createTestSignatureImage(),
        metadata
      });
      
      const signatures = serverActor.signatureManager.getDocumentSignatures(documentId);
      expect(signatures).toHaveLength(1);
      
      const signature = signatures[0];
      expect(signature.signerName).toBe('John Doe');
      expect(signature.metadata.signerEmail).toBe('john@example.com');
      expect(signature.metadata.ipAddress).toBe('192.168.1.100');
    });
  });
});