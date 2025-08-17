import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDFViewer } from '../../src/client/PDFViewer.js';

// Mock DOM environment
global.document = {
  createElement: jest.fn((tag) => {
    const element = {
      tagName: tag,
      className: '',
      innerHTML: '',
      style: {},
      dataset: {},
      children: [],
      appendChild: jest.fn(function(child) {
        this.children.push(child);
        return child;
      }),
      querySelector: jest.fn(),
      addEventListener: jest.fn(),
      remove: jest.fn(),
      dispatchEvent: jest.fn(),
      getContext: jest.fn(() => ({
        drawImage: jest.fn(),
        clearRect: jest.fn()
      })),
      clientWidth: 800,
      clientHeight: 600
    };
    
    if (tag === 'canvas') {
      element.width = 0;
      element.height = 0;
      element.getContext = jest.fn(() => ({
        drawImage: jest.fn(),
        clearRect: jest.fn()
      }));
    }
    
    return element;
  })
};

global.window = {
  pdfjsLib: null,
  CustomEvent: jest.fn((type, options) => ({
    type,
    detail: options?.detail
  }))
};

global.atob = jest.fn((str) => {
  // Simple base64 decode mock
  return Buffer.from(str, 'base64').toString('binary');
});

describe('PDFViewer', () => {
  let container;
  let viewer;
  let mockPDFJS;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create container
    container = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      dispatchEvent: jest.fn(),
      clientWidth: 800,
      clientHeight: 600,
      children: []
    };
    
    // Create PDF.js mock
    mockPDFJS = {
      getDocument: jest.fn(() => ({
        promise: Promise.resolve({
          numPages: 3,
          getPage: jest.fn((pageNum) => Promise.resolve({
            getViewport: jest.fn(({ scale }) => ({
              width: 612 * scale,
              height: 792 * scale,
              scale
            })),
            render: jest.fn(() => ({
              promise: Promise.resolve()
            }))
          })),
          destroy: jest.fn()
        })
      }))
    };
    
    // Set up viewer
    viewer = new PDFViewer(container);
    
    // Mock getPDFJS to return our mock
    viewer.getPDFJS = jest.fn(() => Promise.resolve(mockPDFJS));
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const viewer = new PDFViewer(container);
      
      expect(viewer.container).toBe(container);
      expect(viewer.options.scale).toBe(1.0);
      expect(viewer.options.enableTextLayer).toBe(true);
      expect(viewer.options.enableAnnotationLayer).toBe(true);
      expect(viewer.currentPage).toBe(1);
      expect(viewer.totalPages).toBe(0);
      expect(viewer.fieldOverlays).toEqual([]);
    });

    it('should accept custom options', () => {
      const options = {
        scale: 1.5,
        enableTextLayer: false,
        customOption: 'test'
      };
      
      const viewer = new PDFViewer(container, options);
      
      expect(viewer.options.scale).toBe(1.5);
      expect(viewer.options.enableTextLayer).toBe(false);
      expect(viewer.options.customOption).toBe('test');
    });
  });

  describe('PDF Loading', () => {
    it('should load PDF successfully', async () => {
      const pdfData = 'data:application/pdf;base64,dGVzdA==';
      const signatureFields = [
        { id: 'field1', page: 1, x: 100, y: 200, width: 150, height: 50 }
      ];
      
      const result = await viewer.loadPDF(pdfData, signatureFields);
      
      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(3);
      expect(viewer.totalPages).toBe(3);
      expect(viewer.currentPage).toBe(1);
      expect(mockPDFJS.getDocument).toHaveBeenCalled();
    });

    it('should handle PDF loading errors', async () => {
      viewer.getPDFJS = jest.fn(() => Promise.reject(new Error('PDF.js not available')));
      
      const result = await viewer.loadPDF('data:application/pdf;base64,test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF.js not available');
    });

    it('should render first page after loading', async () => {
      const renderSpy = jest.spyOn(viewer, 'renderPage');
      
      await viewer.loadPDF('data:application/pdf;base64,test');
      
      expect(renderSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Page Rendering', () => {
    beforeEach(async () => {
      await viewer.loadPDF('data:application/pdf;base64,test');
    });

    it('should render specific page', async () => {
      const canvas = document.createElement('canvas');
      container.querySelector = jest.fn(() => canvas);
      
      await viewer.renderPage(2);
      
      expect(viewer.currentPage).toBe(2);
      expect(viewer.pdfDocument.getPage).toHaveBeenCalledWith(2);
    });

    it('should throw error for invalid page number', async () => {
      await expect(viewer.renderPage(0)).rejects.toThrow('Invalid page number: 0');
      await expect(viewer.renderPage(5)).rejects.toThrow('Invalid page number: 5');
    });

    it('should throw error if no PDF loaded', async () => {
      const newViewer = new PDFViewer(container);
      await expect(newViewer.renderPage(1)).rejects.toThrow('No PDF document loaded');
    });

    it('should update page info after rendering', async () => {
      const updateSpy = jest.spyOn(viewer, 'updatePageInfo');
      
      await viewer.renderPage(2);
      
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('Field Overlays', () => {
    const signatureFields = [
      {
        id: 'field1',
        page: 1,
        x: 100,
        y: 200,
        width: 150,
        height: 50,
        label: 'Signature 1',
        required: true,
        signed: false
      },
      {
        id: 'field2',
        page: 1,
        x: 300,
        y: 200,
        width: 150,
        height: 50,
        label: 'Signature 2',
        required: false,
        signed: true
      },
      {
        id: 'field3',
        page: 2,
        x: 100,
        y: 100,
        width: 200,
        height: 60,
        required: true,
        signed: false
      }
    ];

    beforeEach(async () => {
      await viewer.loadPDF('data:application/pdf;base64,test');
    });

    it('should create field overlays for current page', () => {
      viewer.renderFieldOverlays(signatureFields);
      
      // Should only create overlays for page 1
      expect(viewer.fieldOverlays).toHaveLength(2);
      // Canvas was also appended during loadPDF
      expect(container.appendChild.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should clear existing overlays before rendering new ones', () => {
      const oldOverlay = { remove: jest.fn() };
      viewer.fieldOverlays = [oldOverlay];
      
      viewer.renderFieldOverlays(signatureFields);
      
      expect(oldOverlay.remove).toHaveBeenCalled();
    });

    it('should style unsigned required fields differently', () => {
      const overlay = viewer.createFieldOverlay(signatureFields[0]);
      
      expect(overlay.style.border).toContain('dashed');
      expect(overlay.style.border).toContain('#2196F3');
      expect(overlay.style.cursor).toBe('pointer');
    });

    it('should style signed fields differently', () => {
      const overlay = viewer.createFieldOverlay(signatureFields[1]);
      
      expect(overlay.style.border).toContain('solid');
      expect(overlay.style.border).toContain('#4CAF50');
      expect(overlay.style.cursor).toBe('default');
    });

    it('should add click handler for unsigned fields', () => {
      const clickHandler = jest.fn();
      viewer.setFieldClickHandler(clickHandler);
      
      const overlay = viewer.createFieldOverlay(signatureFields[0]);
      
      expect(overlay.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should not add click handler for signed fields', () => {
      const clickHandler = jest.fn();
      viewer.setFieldClickHandler(clickHandler);
      
      const overlay = viewer.createFieldOverlay(signatureFields[1]);
      
      expect(overlay.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      await viewer.loadPDF('data:application/pdf;base64,test');
    });

    it('should navigate to next page', async () => {
      await viewer.nextPage();
      expect(viewer.currentPage).toBe(2);
      
      await viewer.nextPage();
      expect(viewer.currentPage).toBe(3);
    });

    it('should not navigate past last page', async () => {
      viewer.currentPage = 3;
      await viewer.nextPage();
      expect(viewer.currentPage).toBe(3);
    });

    it('should navigate to previous page', async () => {
      viewer.currentPage = 2;
      await viewer.previousPage();
      expect(viewer.currentPage).toBe(1);
    });

    it('should not navigate before first page', async () => {
      await viewer.previousPage();
      expect(viewer.currentPage).toBe(1);
    });

    it('should go to specific page', async () => {
      await viewer.goToPage(3);
      expect(viewer.currentPage).toBe(3);
    });
  });

  describe('Zoom Controls', () => {
    beforeEach(async () => {
      await viewer.loadPDF('data:application/pdf;base64,test');
    });

    it('should zoom in', async () => {
      const initialScale = viewer.options.scale;
      await viewer.zoomIn();
      expect(viewer.options.scale).toBe(initialScale * 1.25);
    });

    it('should limit zoom in to maximum', async () => {
      viewer.options.scale = 2.5;
      await viewer.zoomIn();
      expect(viewer.options.scale).toBeLessThanOrEqual(3.0);
    });

    it('should zoom out', async () => {
      viewer.options.scale = 1.0;
      await viewer.zoomOut();
      expect(viewer.options.scale).toBe(0.8);
    });

    it('should limit zoom out to minimum', async () => {
      viewer.options.scale = 0.6;
      await viewer.zoomOut();
      expect(viewer.options.scale).toBeGreaterThanOrEqual(0.5);
    });

    it('should fit to width', async () => {
      await viewer.fitToWidth();
      
      // Scale should be calculated based on container width
      const expectedScale = container.clientWidth / 612;
      expect(viewer.options.scale).toBeCloseTo(expectedScale, 2);
    });
  });

  describe('Field Status Updates', () => {
    beforeEach(async () => {
      await viewer.loadPDF('data:application/pdf;base64,test');
    });

    it('should update field status to signed', () => {
      const overlay = {
        dataset: { fieldId: 'field1' },
        style: {},
        querySelector: jest.fn(() => ({
          className: 'field-required',
          innerHTML: '*',
          style: {}
        }))
      };
      viewer.fieldOverlays = [overlay];
      
      viewer.updateFieldStatus('field1', true);
      
      expect(overlay.style.border).toContain('solid');
      expect(overlay.style.cursor).toBe('default');
    });

    it('should update field status to unsigned', () => {
      const overlay = {
        dataset: { fieldId: 'field1' },
        style: {},
        querySelector: jest.fn(() => null)
      };
      viewer.fieldOverlays = [overlay];
      
      viewer.updateFieldStatus('field1', false);
      
      expect(overlay.style.border).toContain('dashed');
      expect(overlay.style.cursor).toBe('pointer');
    });

    it('should handle non-existent field gracefully', () => {
      viewer.fieldOverlays = [];
      
      // Should not throw
      expect(() => viewer.updateFieldStatus('non-existent', true)).not.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('should convert base64 to ArrayBuffer', () => {
      const base64 = 'data:application/pdf;base64,dGVzdA==';
      const buffer = viewer.base64ToArrayBuffer(base64);
      
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle base64 without data URI prefix', () => {
      const base64 = 'dGVzdA==';
      const buffer = viewer.base64ToArrayBuffer(base64);
      
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    });

    it('should dispatch page change events', () => {
      viewer.currentPage = 2;
      viewer.totalPages = 5;
      
      viewer.updatePageInfo();
      
      expect(container.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pagechange',
          detail: {
            currentPage: 2,
            totalPages: 5
          }
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      await viewer.loadPDF('data:application/pdf;base64,test');
      
      const overlay = { remove: jest.fn() };
      viewer.fieldOverlays = [overlay];
      
      const canvas = { remove: jest.fn() };
      container.querySelector = jest.fn(() => canvas);
      
      const destroySpy = jest.fn();
      viewer.pdfDocument.destroy = destroySpy;
      
      viewer.destroy();
      
      expect(overlay.remove).toHaveBeenCalled();
      expect(destroySpy).toHaveBeenCalled();
      expect(canvas.remove).toHaveBeenCalled();
      expect(viewer.pdfDocument).toBeNull();
      expect(viewer.fieldOverlays).toEqual([]);
    });

    it('should handle destroy without loaded PDF', () => {
      const newViewer = new PDFViewer(container);
      
      // Should not throw
      expect(() => newViewer.destroy()).not.toThrow();
    });
  });

  describe('PDF.js Integration', () => {
    it('should use window.pdfjsLib if available', async () => {
      window.pdfjsLib = mockPDFJS;
      const newViewer = new PDFViewer(container);
      
      const pdfjsLib = await newViewer.getPDFJS();
      
      expect(pdfjsLib).toBe(mockPDFJS);
    });

    it('should try dynamic import if window.pdfjsLib not available', async () => {
      window.pdfjsLib = null;
      const newViewer = new PDFViewer(container);
      
      // Mock dynamic import failure
      newViewer.getPDFJS = jest.fn(() => 
        Promise.reject(new Error('PDF.js library not available'))
      );
      
      await expect(newViewer.getPDFJS()).rejects.toThrow('PDF.js library not available');
    });
  });
});