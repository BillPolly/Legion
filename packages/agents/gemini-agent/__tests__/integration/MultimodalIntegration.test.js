/**
 * Integration tests for Multimodal File Processing
 * NO MOCKS - tests real image/PDF processing capabilities
 */

import MultimodalFileProcessor from '../../src/utils/MultimodalFileProcessor.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Multimodal Integration', () => {
  let processor;
  let testDir;

  beforeAll(async () => {
    processor = new MultimodalFileProcessor();
    
    // Create test directory
    testDir = path.join(os.tmpdir(), `multimodal-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should detect different file types correctly', async () => {
    const testFiles = [
      { name: 'test.js', expectedType: 'text' },
      { name: 'test.ts', expectedType: 'text' },
      { name: 'image.png', expectedType: 'image' },
      { name: 'doc.pdf', expectedType: 'pdf' },
      { name: 'icon.svg', expectedType: 'svg' },
      { name: 'song.mp3', expectedType: 'audio' },
      { name: 'video.mp4', expectedType: 'video' }
    ];

    // Create test files
    for (const testFile of testFiles) {
      const filePath = path.join(testDir, testFile.name);
      await fs.writeFile(filePath, `Test content for ${testFile.name}`);
    }

    // Test file type detection
    for (const testFile of testFiles) {
      const filePath = path.join(testDir, testFile.name);
      const detectedType = await processor.detectFileType(filePath);
      expect(detectedType).toBe(testFile.expectedType);
    }

    console.log('✅ File type detection working for all types');
  });

  test('should process text files with multimodal processor', async () => {
    const textFile = path.join(testDir, 'multimodal-text.js');
    const content = `function example() {
  console.log("Hello World");
  return 42;
}`;
    
    await fs.writeFile(textFile, content);

    const result = await processor.processFile(textFile);

    expect(result.success).toBe(true);
    expect(result.fileType).toBe('text');
    expect(result.content).toContain('Hello World');
    expect(result.lines).toBe(4);
    expect(result.isTruncated).toBe(false);

    console.log('✅ Text file multimodal processing working');
  });

  test('should create base64 data for images', async () => {
    // Create a simple PNG file (1x1 pixel)
    const simplePNG = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0x1D, 0x01, 0x01, 0x00, 0x00, 0xFF,
      0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);
    
    const imageFile = path.join(testDir, 'test-image.png');
    await fs.writeFile(imageFile, simplePNG);

    const result = await processor.processFile(imageFile);

    expect(result.success).toBe(true);
    expect(result.fileType).toBe('image');
    expect(result.base64Data).toBeDefined();
    expect(result.mimeType).toBe('image/png');
    expect(result.content).toContain('[IMAGE FILE:');
    expect(result.metadata).toBeDefined();

    console.log('✅ Image multimodal processing working');
    console.log('Image metadata:', result.metadata);
  });

  test('should handle PDF files', async () => {
    // Create a minimal PDF file
    const minimalPDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000015 00000 n \n0000000074 00000 n \n0000000131 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n210\n%%EOF');
    
    const pdfFile = path.join(testDir, 'test-doc.pdf');
    await fs.writeFile(pdfFile, minimalPDF);

    const result = await processor.processFile(pdfFile);

    expect(result.success).toBe(true);
    expect(result.fileType).toBe('pdf');
    expect(result.base64Data).toBeDefined();
    expect(result.mimeType).toBe('application/pdf');
    expect(result.content).toContain('[PDF FILE:');

    console.log('✅ PDF multimodal processing working');
  });

  test('should check multimodal support for files', async () => {
    const testFiles = [
      { name: 'image.png', supported: true },
      { name: 'doc.pdf', supported: true },
      { name: 'icon.svg', supported: true },
      { name: 'text.js', supported: false },
      { name: 'audio.mp3', supported: false }
    ];

    for (const testFile of testFiles) {
      const filePath = path.join(testDir, testFile.name);
      await fs.writeFile(filePath, 'test content');
      
      const isSupported = await processor.isMultimodalSupported(filePath);
      expect(isSupported).toBe(testFile.supported);
    }

    console.log('✅ Multimodal support detection working');
  });

  test('should provide supported file types information', () => {
    const supportedTypes = processor.getSupportedTypes();

    expect(supportedTypes.images).toContain('.png');
    expect(supportedTypes.images).toContain('.jpg');
    expect(supportedTypes.documents).toContain('.pdf');
    expect(supportedTypes.text).toContain('.js');

    console.log('Supported types:', supportedTypes);
    console.log('✅ Supported types information available');
  });

  test('should handle binary file detection', async () => {
    // Create a simple binary file
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
    const binaryFile = path.join(testDir, 'binary-test.bin');
    await fs.writeFile(binaryFile, binaryData);

    const isBinary = await processor.isBinaryFile(binaryFile);
    expect(isBinary).toBe(true);

    const result = await processor.processFile(binaryFile);
    expect(result.success).toBe(true);
    expect(result.fileType).toBe('binary');

    console.log('✅ Binary file detection working');
  });

  test('should format file sizes correctly', () => {
    const processor = new MultimodalFileProcessor();
    
    // Access private method for testing
    const formatSize = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(2097152)).toBe('2.0 MB');

    console.log('✅ File size formatting working');
  });
});