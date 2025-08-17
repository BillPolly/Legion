import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PDFViewer } from '../../src/client/PDFViewer.js';
import { JSDOM } from 'jsdom';
import { TestUtils } from '../utils/TestUtils.js';

describe('PDFViewer Integration Tests', () => {
  let dom;
  let container;
  let viewer;
  
  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="pdf-container" style="width: 800px; height: 600px;"></div>
        </body>
      </html>
    `, { 
      url: 'http://localhost',
      resources: 'usable',
      runScripts: 'dangerously'
    });
    
    global.window = dom.window;
    global.document = dom.window.document;
    global.CustomEvent = dom.window.CustomEvent;
    global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
    global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
    
    // Get container
    container = document.getElementById('pdf-container');
    
    // Mock PDF.js since we can't load it in Node
    global.window.pdfjsLib = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: (pageNum) => Promise.resolve({
            getViewport: ({ scale }) => ({
              width: 612 * scale,
              height: 792 * scale,
              scale
            }),
            render: () => ({
              promise: Promise.resolve()
            })
          }),
          destroy: () => {}
        })
      })
    };
    
    // Create viewer
    viewer = new PDFViewer(container);
  });
  
  afterEach(() => {
    if (viewer) {
      viewer.destroy();
    }
    dom.window.close();
  });

  describe('Complete PDF Viewing Workflow', () => {
    it('should handle complete PDF viewing workflow', async () => {
      // Create test PDF data
      const pdfBytes = TestUtils.createTestPDF();
      const pdfBase64 = TestUtils.bufferToBase64(pdfBytes);
      
      // Define signature fields
      const signatureFields = [
        {
          id: 'sig-1',
          page: 1,
          x: 100,
          y: 500,
          width: 200,
          height: 50,
          label: 'Primary Signature',
          required: true,
          signed: false
        },
        {
          id: 'sig-2',
          page: 2,
          x: 100,
          y: 600,
          width: 200,
          height: 50,
          label: 'Secondary Signature',
          required: false,
          signed: false
        }
      ];
      
      // Load PDF
      const loadResult = await viewer.loadPDF(pdfBase64, signatureFields);
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.pageCount).toBe(2);
      expect(viewer.currentPage).toBe(1);
      
      // Check canvas was created
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.className).toBe('pdf-canvas');
      
      // Check field overlays for page 1
      const overlays = container.querySelectorAll('.signature-field-overlay');
      expect(overlays.length).toBe(1);
      
      const overlay = overlays[0];
      expect(overlay.dataset.fieldId).toBe('sig-1');
      expect(overlay.style.position).toBe('absolute');
      expect(overlay.style.border).toContain('dashed');
      
      // Navigate to page 2
      await viewer.nextPage();
      expect(viewer.currentPage).toBe(2);
      
      // Field overlays should update
      viewer.renderFieldOverlays(signatureFields);
      const page2Overlays = container.querySelectorAll('.signature-field-overlay');
      expect(page2Overlays.length).toBe(1);
      expect(page2Overlays[0].dataset.fieldId).toBe('sig-2');
    });

    it('should handle field click interactions', async () => {
      const pdfBase64 = TestUtils.bufferToBase64(TestUtils.createTestPDF());
      const signatureFields = [
        {
          id: 'clickable-field',
          page: 1,
          x: 100,
          y: 500,
          width: 200,
          height: 50,
          required: true,
          signed: false
        }
      ];
      
      // Set up click handler
      let clickedField = null;
      viewer.setFieldClickHandler((field) => {
        clickedField = field;
      });
      
      // Load PDF
      await viewer.loadPDF(pdfBase64, signatureFields);
      
      // Find overlay
      const overlay = container.querySelector('[data-field-id="clickable-field"]');
      expect(overlay).toBeTruthy();
      
      // Simulate click
      const clickEvent = new dom.window.MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });
      overlay.dispatchEvent(clickEvent);
      
      // Handler should have been called
      expect(clickedField).toEqual(signatureFields[0]);
    });

    it('should update field status dynamically', async () => {
      const pdfBase64 = TestUtils.bufferToBase64(TestUtils.createTestPDF());
      const signatureFields = [
        {
          id: 'dynamic-field',
          page: 1,
          x: 100,
          y: 500,
          width: 200,
          height: 50,
          required: true,
          signed: false
        }
      ];
      
      await viewer.loadPDF(pdfBase64, signatureFields);
      
      // Get initial overlay
      const overlay = container.querySelector('[data-field-id="dynamic-field"]');
      expect(overlay.style.border).toContain('dashed');
      expect(overlay.style.cursor).toBe('pointer');
      
      // Update field status to signed
      viewer.updateFieldStatus('dynamic-field', true);
      
      // Check updated styles
      expect(overlay.style.border).toContain('solid');
      expect(overlay.style.cursor).toBe('default');
    });
  });

  describe('Zoom and Navigation', () => {
    it('should handle zoom operations', async () => {
      const pdfBase64 = TestUtils.bufferToBase64(TestUtils.createTestPDF());
      await viewer.loadPDF(pdfBase64);
      
      const initialScale = viewer.options.scale;
      
      // Zoom in
      await viewer.zoomIn();
      expect(viewer.options.scale).toBeGreaterThan(initialScale);
      
      // Zoom out
      await viewer.zoomOut();
      await viewer.zoomOut();
      expect(viewer.options.scale).toBeLessThan(initialScale);
      
      // Fit to width
      await viewer.fitToWidth();
      const expectedScale = container.clientWidth / 612;
      expect(viewer.options.scale).toBeCloseTo(expectedScale, 2);
    });

    it('should handle page navigation', async () => {
      const pdfBase64 = TestUtils.bufferToBase64(TestUtils.createTestPDF());
      await viewer.loadPDF(pdfBase64);
      
      // Initial page
      expect(viewer.currentPage).toBe(1);
      
      // Go to specific page
      await viewer.goToPage(2);
      expect(viewer.currentPage).toBe(2);
      
      // Previous page
      await viewer.previousPage();
      expect(viewer.currentPage).toBe(1);
      
      // Next page
      await viewer.nextPage();
      expect(viewer.currentPage).toBe(2);
      
      // Try to go past last page
      await viewer.nextPage();
      expect(viewer.currentPage).toBe(2);
    });
  });

  describe('Event Handling', () => {
    it('should dispatch page change events', async () => {
      const pdfBase64 = TestUtils.bufferToBase64(TestUtils.createTestPDF());
      await viewer.loadPDF(pdfBase64);
      
      let eventData = null;
      container.addEventListener('pagechange', (event) => {
        eventData = event.detail;
      });
      
      await viewer.goToPage(2);
      
      expect(eventData).toEqual({
        currentPage: 2,
        totalPages: 2
      });
    });
  });

  describe('Multiple Field Pages', () => {
    it('should handle fields across multiple pages', async () => {
      const pdfBase64 = TestUtils.bufferToBase64(TestUtils.createTestPDF());
      const signatureFields = [
        { id: 'field-p1-1', page: 1, x: 100, y: 200, width: 150, height: 50, required: true },
        { id: 'field-p1-2', page: 1, x: 300, y: 200, width: 150, height: 50, required: false },
        { id: 'field-p2-1', page: 2, x: 100, y: 300, width: 150, height: 50, required: true },
        { id: 'field-p2-2', page: 2, x: 300, y: 300, width: 150, height: 50, required: true }
      ];
      
      await viewer.loadPDF(pdfBase64, signatureFields);
      
      // Page 1 should have 2 overlays
      viewer.renderFieldOverlays(signatureFields);
      let overlays = container.querySelectorAll('.signature-field-overlay');
      expect(overlays.length).toBe(2);
      
      const page1FieldIds = Array.from(overlays).map(o => o.dataset.fieldId);
      expect(page1FieldIds).toContain('field-p1-1');
      expect(page1FieldIds).toContain('field-p1-2');
      
      // Navigate to page 2
      await viewer.goToPage(2);
      viewer.renderFieldOverlays(signatureFields);
      
      overlays = container.querySelectorAll('.signature-field-overlay');
      expect(overlays.length).toBe(2);
      
      const page2FieldIds = Array.from(overlays).map(o => o.dataset.fieldId);
      expect(page2FieldIds).toContain('field-p2-1');
      expect(page2FieldIds).toContain('field-p2-2');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing PDF.js library', async () => {
      // Remove PDF.js mock
      delete global.window.pdfjsLib;
      
      const newViewer = new PDFViewer(container);
      newViewer.getPDFJS = () => Promise.reject(new Error('PDF.js library not available'));
      
      const result = await newViewer.loadPDF('data:application/pdf;base64,test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF.js library not available');
    });

    it('should handle invalid PDF data', async () => {
      // Mock getDocument to throw error for invalid data
      global.window.pdfjsLib.getDocument = () => ({
        promise: Promise.reject(new Error('Invalid PDF structure'))
      });
      
      const result = await viewer.loadPDF('invalid-pdf-data');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid PDF');
    });
  });

  describe('Cleanup', () => {
    it('should properly clean up resources', async () => {
      const pdfBase64 = TestUtils.bufferToBase64(TestUtils.createTestPDF());
      const signatureFields = [
        { id: 'cleanup-field', page: 1, x: 100, y: 200, width: 150, height: 50 }
      ];
      
      await viewer.loadPDF(pdfBase64, signatureFields);
      
      // Verify elements exist
      expect(container.querySelector('canvas')).toBeTruthy();
      expect(container.querySelector('.signature-field-overlay')).toBeTruthy();
      
      // Destroy viewer
      viewer.destroy();
      
      // Verify cleanup
      expect(container.querySelector('canvas')).toBeFalsy();
      expect(container.querySelector('.signature-field-overlay')).toBeFalsy();
      expect(viewer.pdfDocument).toBeNull();
      expect(viewer.fieldOverlays).toEqual([]);
    });
  });
});