/**
 * @jest-environment jsdom
 */

import { ImageViewer } from '../src/components/image-viewer/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

describe('ImageViewer Component', () => {
  // Mock DOM helper
  const createMockContainer = () => {
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    return container;
  };

  // Mock Image constructor
  let mockImageLoad = null;
  let mockImageError = null;
  
  beforeAll(() => {
    global.Image = class {
      constructor() {
        setTimeout(() => {
          if (mockImageLoad && this.src && this.src !== 'invalid-url.jpg') {
            this.width = 800;
            this.height = 600;
            mockImageLoad();
          } else if (mockImageError) {
            mockImageError();
          }
        }, 0);
      }
      set onload(fn) {
        mockImageLoad = fn;
      }
      set onerror(fn) {
        mockImageError = fn;
      }
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    mockImageLoad = null;
    mockImageError = null;
  });

  describe('Introspection', () => {
    test('should describe requirements when given describe umbilical', () => {
      let capturedRequirements = null;

      ImageViewer.create({
        describe: (reqs) => {
          capturedRequirements = reqs.getAll();
        }
      });

      expect(capturedRequirements).toBeDefined();
      expect(capturedRequirements.dom).toBeDefined();
      expect(capturedRequirements.dom.type).toBe('HTMLElement');
      expect(capturedRequirements.imageData).toBeDefined();
      expect(capturedRequirements.showControls).toBeDefined();
      expect(capturedRequirements.showInfo).toBeDefined();
      expect(capturedRequirements.initialZoom).toBeDefined();
      expect(capturedRequirements.onImageLoaded).toBeDefined();
    });

    test('should validate umbilical when given validate capability', () => {
      const container = createMockContainer();
      
      const validation = ImageViewer.create({
        validate: (testResult) => ({
          ...testResult,
          hasDomElement: true,
          hasValidImageData: true,
          hasValidZoomRange: true
        })
      });

      expect(validation.hasDomElement).toBe(true);
      expect(validation.hasValidImageData).toBe(true);
      expect(validation.hasValidZoomRange).toBe(true);
    });
  });

  describe('Instance Creation', () => {
    test('should create viewer with minimal umbilical', () => {
      const container = createMockContainer();
      
      const viewer = ImageViewer.create({
        dom: container
      });

      expect(viewer).toBeDefined();
      expect(viewer.element).toBeDefined();
      expect(viewer.imageElement).toBeDefined();
      expect(viewer.zoomLevel).toBe(1.0);
    });

    test('should create viewer with custom options', () => {
      const container = createMockContainer();
      
      const viewer = ImageViewer.create({
        dom: container,
        initialZoom: 2.0,
        minZoom: 0.5,
        maxZoom: 3.0,
        showControls: true,
        showInfo: false
      });

      expect(viewer.zoomLevel).toBe(2.0);
      // Controls should be visible
      const controls = viewer.element.querySelector('.umbilical-image-controls');
      expect(controls.style.display).toBe('flex');
    });

    test('should throw error when dom is missing', () => {
      expect(() => {
        ImageViewer.create({});
      }).toThrow('ImageViewer missing required capabilities: dom');
    });
  });

  describe('Image Loading', () => {
    test('should load image from URL', (done) => {
      const container = createMockContainer();
      const onImageLoaded = jest.fn();
      
      const viewer = ImageViewer.create({
        dom: container,
        onImageLoaded
      });

      viewer.loadImage('https://example.com/image.jpg');

      setTimeout(() => {
        expect(viewer.isLoaded).toBe(true);
        expect(viewer.imageInfo).toBeDefined();
        expect(viewer.imageInfo.width).toBe(800);
        expect(viewer.imageInfo.height).toBe(600);
        expect(viewer.imageInfo.type).toBe('JPEG');
        expect(onImageLoaded).toHaveBeenCalledWith(viewer.imageInfo, viewer);
        done();
      }, 10);
    });

    test('should load image from base64 data', (done) => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({ dom: container });

      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      viewer.loadImage(base64);

      setTimeout(() => {
        expect(viewer.isLoaded).toBe(true);
        expect(viewer.imageInfo.type).toBe('PNG');
        done();
      }, 10);
    });

    test('should handle image load error', (done) => {
      const container = createMockContainer();
      const onError = jest.fn();
      
      const viewer = ImageViewer.create({
        dom: container,
        onError
      });

      viewer.loadImage('invalid-url.jpg');

      setTimeout(() => {
        expect(viewer.isLoaded).toBe(false);
        expect(onError).toHaveBeenCalledWith('Failed to load image', viewer);
        done();
      }, 10);
    });

    test('should load initial image from umbilical', (done) => {
      const container = createMockContainer();
      
      const viewer = ImageViewer.create({
        dom: container,
        imageData: 'https://example.com/initial.jpg'
      });

      setTimeout(() => {
        expect(viewer.isLoaded).toBe(true);
        done();
      }, 10);
    });
  });

  describe('Zoom Operations', () => {
    let viewer;
    let container;
    let onZoomChanged;

    beforeEach(() => {
      container = createMockContainer();
      onZoomChanged = jest.fn();
      viewer = ImageViewer.create({
        dom: container,
        initialZoom: 1.0,
        minZoom: 0.1,
        maxZoom: 5.0,
        zoomStep: 0.1,
        onZoomChanged
      });
    });

    test('should zoom in', () => {
      viewer.zoom(0.1);
      expect(viewer.zoomLevel).toBe(1.1);
      expect(onZoomChanged).toHaveBeenCalledWith(1.1, viewer);
    });

    test('should zoom out', () => {
      viewer.zoom(-0.1);
      expect(viewer.zoomLevel).toBe(0.9);
      expect(onZoomChanged).toHaveBeenCalledWith(0.9, viewer);
    });

    test('should respect max zoom', () => {
      viewer.setZoom(10);
      expect(viewer.zoomLevel).toBe(5.0);
    });

    test('should respect min zoom', () => {
      viewer.setZoom(0.01);
      expect(viewer.zoomLevel).toBe(0.1);
    });

    test('should reset view', () => {
      viewer.setZoom(2.5);
      viewer.resetView();
      expect(viewer.zoomLevel).toBe(1.0);
      expect(onZoomChanged).toHaveBeenLastCalledWith(1.0, viewer);
    });

    test('should handle mouse wheel zoom', () => {
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100, // Negative for zoom in
        bubbles: true
      });
      
      viewer.element.dispatchEvent(wheelEvent);
      expect(viewer.zoomLevel).toBeGreaterThan(1.0);
    });
  });

  describe('Controls Management', () => {
    test('should toggle controls visibility', () => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({
        dom: container,
        showControls: false
      });

      const controls = viewer.element.querySelector('.umbilical-image-controls');
      expect(controls.style.display).toBe('none');

      viewer.showControls();
      expect(controls.style.display).toBe('flex');

      viewer.hideControls();
      expect(controls.style.display).toBe('none');

      viewer.toggleControls();
      expect(controls.style.display).toBe('flex');
    });

    test('should handle controls toggle button click', () => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({
        dom: container,
        showControls: false
      });

      const toggleBtn = viewer.element.querySelector('.umbilical-controls-toggle');
      const controls = viewer.element.querySelector('.umbilical-image-controls');
      
      expect(controls.style.display).toBe('none');
      
      toggleBtn.click();
      expect(controls.style.display).toBe('flex');
    });
  });

  describe('Info Display', () => {
    test('should show image info when enabled', (done) => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({
        dom: container,
        showInfo: true,
        infoFadeDelay: 100 // Short delay for testing
      });

      viewer.loadImage('https://example.com/test.png');

      setTimeout(() => {
        const info = viewer.element.querySelector('.umbilical-image-info');
        expect(info).toBeDefined();
        expect(info.style.display).toBe('block');
        expect(info.innerHTML).toContain('800 × 600');
        expect(info.innerHTML).toContain('PNG');
        done();
      }, 10);
    });

    test('should not show info when disabled', (done) => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({
        dom: container,
        showInfo: false
      });

      viewer.loadImage('https://example.com/test.png');

      setTimeout(() => {
        const info = viewer.element.querySelector('.umbilical-image-info');
        expect(info).toBeNull();
        done();
      }, 10);
    });
  });

  describe('Pan Operations', () => {
    test('should handle mouse drag for panning', () => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({ dom: container });

      // Simulate mouse down
      const mouseDown = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true
      });
      viewer.element.dispatchEvent(mouseDown);

      // Simulate mouse move
      const mouseMove = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 120,
        bubbles: true
      });
      viewer.element.dispatchEvent(mouseMove);

      // Check transform updated (pan offset changed)
      const transform = viewer.imageElement.style.transform;
      expect(transform).toContain('translate(50px, 20px)');

      // Simulate mouse up
      const mouseUp = new MouseEvent('mouseup', { bubbles: true });
      viewer.element.dispatchEvent(mouseUp);
    });

    test('should reset view on double click', () => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({ dom: container });

      viewer.setZoom(2.0);
      
      const dblClick = new MouseEvent('dblclick', { bubbles: true });
      viewer.element.dispatchEvent(dblClick);

      expect(viewer.zoomLevel).toBe(1.0);
    });
  });

  describe('Save Functionality', () => {
    test('should save image when loaded', (done) => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({ dom: container });

      // Mock link click
      const mockClick = jest.fn();
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'a') {
          return { click: mockClick, style: {} };
        }
        return document.createElement.bind(document)(tagName);
      });

      viewer.loadImage('https://example.com/test.jpg');

      setTimeout(() => {
        viewer.saveImage();
        expect(mockClick).toHaveBeenCalled();
        done();
      }, 10);
    });

    test('should not save when no image loaded', () => {
      const container = createMockContainer();
      const viewer = ImageViewer.create({ dom: container });

      const mockClick = jest.fn();
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'a') {
          return { click: mockClick, style: {} };
        }
        return document.createElement.bind(document)(tagName);
      });

      viewer.saveImage();
      expect(mockClick).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle Management', () => {
    test('should call onMount when created', () => {
      const container = createMockContainer();
      const onMount = jest.fn();
      
      const viewer = ImageViewer.create({
        dom: container,
        onMount
      });

      expect(onMount).toHaveBeenCalledWith(viewer);
    });

    test('should cleanup on destroy', () => {
      const container = createMockContainer();
      const onDestroy = jest.fn();
      
      const viewer = ImageViewer.create({
        dom: container,
        onDestroy,
        showInfo: true,
        infoFadeDelay: 1000
      });

      expect(container.contains(viewer.element)).toBe(true);
      
      viewer.destroy();
      
      expect(container.contains(viewer.element)).toBe(false);
      expect(onDestroy).toHaveBeenCalledWith(viewer);
    });
  });

  describe('Agent Testing Patterns', () => {
    test('should work with completely mocked umbilical', (done) => {
      const container = createMockContainer();
      const mockUmbilical = UmbilicalUtils.createMockUmbilical({
        dom: container,
        showControls: true,
        onImageLoaded: jest.fn(),
        onZoomChanged: jest.fn()
      });

      const viewer = ImageViewer.create(mockUmbilical);
      
      viewer.loadImage('https://example.com/test.jpg');
      
      setTimeout(() => {
        expect(mockUmbilical.onImageLoaded).toHaveBeenCalled();
        
        viewer.zoom(0.1);
        expect(mockUmbilical.onZoomChanged).toHaveBeenCalled();
        done();
      }, 10);
    });

    test('should allow agent to test different configurations', () => {
      const container = createMockContainer();
      const configs = [
        { showControls: true, showInfo: true },
        { showControls: false, showInfo: false },
        { initialZoom: 2.0, minZoom: 0.5, maxZoom: 3.0 }
      ];

      configs.forEach(config => {
        const viewer = ImageViewer.create({
          dom: container,
          ...config
        });

        expect(viewer).toBeDefined();
        
        if (config.initialZoom) {
          expect(viewer.zoomLevel).toBe(config.initialZoom);
        }
      });
    });
  });
});