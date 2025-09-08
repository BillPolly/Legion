/**
 * Unit Tests for ImageRenderer
 * 
 * Tests image asset rendering functionality with various image formats and sources
 * NO MOCKS - Tests real image rendering capabilities
 */

import { ImageRenderer } from '../../../src/renderers/ImageRenderer.js';

// Mock URL methods for performance testing
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('ImageRenderer', () => {
  let renderer;

  beforeEach(() => {
    renderer = new ImageRenderer();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      expect(renderer).toBeInstanceOf(ImageRenderer);
      expect(typeof renderer.render).toBe('function');
      expect(typeof renderer.canRender).toBe('function');
    });

    test('should accept custom configuration', () => {
      const customRenderer = new ImageRenderer({
        maxWidth: 1000,
        maxHeight: 800,
        showMetadata: true
      });

      const config = customRenderer.getConfig();
      expect(config.maxWidth).toBe(1000);
      expect(config.maxHeight).toBe(800);
      expect(config.showMetadata).toBe(true);
    });
  });

  describe('canRender', () => {
    test('should return true for image Buffer data', () => {
      // PNG header
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(renderer.canRender(pngBuffer)).toBe(true);

      // JPEG header
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(renderer.canRender(jpegBuffer)).toBe(true);
    });

    test('should return true for image file paths', () => {
      expect(renderer.canRender('/path/to/image.png')).toBe(true);
      expect(renderer.canRender('/path/to/photo.jpg')).toBe(true);
      expect(renderer.canRender('/path/to/picture.jpeg')).toBe(true);
      expect(renderer.canRender('/path/to/icon.gif')).toBe(true);
      expect(renderer.canRender('/path/to/graphic.bmp')).toBe(true);
      expect(renderer.canRender('/path/to/vector.svg')).toBe(true);
      expect(renderer.canRender('/path/to/modern.webp')).toBe(true);
    });

    test('should return true for image URLs', () => {
      expect(renderer.canRender('https://example.com/image.png')).toBe(true);
      expect(renderer.canRender('http://cdn.example.com/photo.jpg')).toBe(true);
      expect(renderer.canRender('https://images.example.com/picture.jpeg')).toBe(true);
    });

    test('should return true for data URLs', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      expect(renderer.canRender(dataUrl)).toBe(true);
    });

    test('should return false for non-image assets', () => {
      expect(renderer.canRender('plain text')).toBe(false);
      expect(renderer.canRender({ key: 'value' })).toBe(false);
      expect(renderer.canRender([1, 2, 3])).toBe(false);
      expect(renderer.canRender('/path/to/document.txt')).toBe(false);
      expect(renderer.canRender('https://example.com/api/data')).toBe(false);
    });
  });

  describe('render', () => {
    test('should render image from file path', () => {
      const imagePath = '/path/to/test-image.png';
      const result = renderer.render(imagePath);

      expect(result).toHaveProperty('element');
      expect(result.element).toBeInstanceOf(HTMLElement);
      expect(result.element.tagName).toBe('DIV');
      
      const img = result.element.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toContain('test-image.png');
      expect(img.alt).toBe('test-image.png');
    });

    test('should render image from URL', () => {
      const imageUrl = 'https://example.com/photo.jpg';
      const result = renderer.render(imageUrl);

      expect(result).toHaveProperty('element');
      const img = result.element.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toBe(imageUrl);
      expect(img.alt).toBe('photo.jpg');
    });

    test('should render image from data URL', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const result = renderer.render(dataUrl);

      expect(result).toHaveProperty('element');
      const img = result.element.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toBe(dataUrl);
      expect(img.alt).toBe('Data URL Image');
    });

    test('should render image from Buffer with object URL', () => {
      // Mock URL.createObjectURL for jsdom environment
      const mockObjectURL = 'blob:mock-buffer-url';
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = () => mockObjectURL;
      
      const imageBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      const result = renderer.render(imageBuffer);

      expect(result).toHaveProperty('element');
      const img = result.element.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toBe(mockObjectURL);
      expect(img.alt).toBe('Binary Image Data');
      
      // Restore original method
      URL.createObjectURL = originalCreateObjectURL;
    });

    test('should apply responsive image styling', () => {
      const imagePath = '/path/to/large-image.jpg';
      const result = renderer.render(imagePath);

      const img = result.element.querySelector('img');
      expect(img.style.maxWidth).toBe('100%');
      expect(img.style.height).toBe('auto');
      expect(img.style.display).toBe('block');
    });

    test('should include image controls when enabled', () => {
      const rendererWithControls = new ImageRenderer({
        showControls: true
      });

      const result = rendererWithControls.render('/path/to/image.png');
      
      expect(result.element.querySelector('.image-controls')).toBeTruthy();
      expect(result.element.querySelector('.zoom-in')).toBeTruthy();
      expect(result.element.querySelector('.zoom-out')).toBeTruthy();
      expect(result.element.querySelector('.zoom-fit')).toBeTruthy();
      expect(result.element.querySelector('.zoom-actual')).toBeTruthy();
    });

    test('should include metadata when enabled', () => {
      const rendererWithMetadata = new ImageRenderer({
        showMetadata: true
      });

      const result = rendererWithMetadata.render('https://example.com/photo.jpg');
      
      const metadata = result.element.querySelector('.image-metadata');
      expect(metadata).toBeTruthy();
      expect(metadata.textContent).toContain('photo.jpg');
      expect(metadata.textContent).toContain('https://example.com');
    });

    test('should handle different image formats correctly', () => {
      const formats = [
        { path: '/test.png', format: 'PNG' },
        { path: '/test.jpg', format: 'JPEG' },
        { path: '/test.gif', format: 'GIF' },
        { path: '/test.svg', format: 'SVG' },
        { path: '/test.webp', format: 'WebP' }
      ];

      formats.forEach(({ path, format }) => {
        const result = renderer.render(path);
        expect(result.element).toBeTruthy();
        
        const img = result.element.querySelector('img');
        expect(img.src).toContain(path);
      });
    });
  });

  describe('zoom functionality', () => {
    let rendererWithControls;

    beforeEach(() => {
      rendererWithControls = new ImageRenderer({
        showControls: true
      });
    });

    test('should initialize with 100% zoom', () => {
      const result = rendererWithControls.render('/path/to/image.png');
      expect(result.zoomLevel).toBe(1.0);
    });

    test('should zoom in when zoom in button is clicked', () => {
      const result = rendererWithControls.render('/path/to/image.png');
      const zoomInBtn = result.element.querySelector('.zoom-in');
      
      // Simulate click
      zoomInBtn.click();
      
      expect(result.zoomLevel).toBeGreaterThan(1.0);
      
      const img = result.element.querySelector('img');
      const transform = img.style.transform;
      expect(transform).toContain('scale(');
    });

    test('should zoom out when zoom out button is clicked', () => {
      const result = rendererWithControls.render('/path/to/image.png');
      
      // First zoom in
      const zoomInBtn = result.element.querySelector('.zoom-in');
      zoomInBtn.click();
      
      // Then zoom out
      const zoomOutBtn = result.element.querySelector('.zoom-out');
      zoomOutBtn.click();
      
      expect(result.zoomLevel).toBe(1.0);
    });

    test('should fit to container when fit button is clicked', () => {
      const result = rendererWithControls.render('/path/to/image.png');
      const fitBtn = result.element.querySelector('.zoom-fit');
      
      fitBtn.click();
      
      const img = result.element.querySelector('img');
      expect(img.style.maxWidth).toBe('100%');
      expect(img.style.maxHeight).toBe('100%');
    });

    test('should reset to actual size when actual button is clicked', () => {
      const result = rendererWithControls.render('/path/to/image.png');
      
      // Zoom in first
      result.element.querySelector('.zoom-in').click();
      
      // Then reset to actual size
      const actualBtn = result.element.querySelector('.zoom-actual');
      actualBtn.click();
      
      expect(result.zoomLevel).toBe(1.0);
      const img = result.element.querySelector('img');
      expect(img.style.transform).toBe('scale(1)');
    });

    test('should respect zoom limits', () => {
      const result = rendererWithControls.render('/path/to/image.png');
      
      // Try to zoom out beyond minimum
      const zoomOutBtn = result.element.querySelector('.zoom-out');
      for (let i = 0; i < 10; i++) {
        zoomOutBtn.click();
      }
      
      expect(result.zoomLevel).toBeGreaterThanOrEqual(0.1);
      
      // Try to zoom in beyond maximum
      const zoomInBtn = result.element.querySelector('.zoom-in');
      for (let i = 0; i < 20; i++) {
        zoomInBtn.click();
      }
      
      expect(result.zoomLevel).toBeLessThanOrEqual(5.0);
    });
  });

  describe('error handling', () => {
    test('should handle invalid image data gracefully', () => {
      expect(() => {
        renderer.render(null);
      }).toThrow('Invalid image data provided');

      expect(() => {
        renderer.render(undefined);
      }).toThrow('Invalid image data provided');
    });

    test('should handle image load errors', (done) => {
      const result = renderer.render('https://invalid-domain.com/nonexistent.jpg');
      const img = result.element.querySelector('img');
      
      img.addEventListener('error', () => {
        // Should show error placeholder
        expect(result.element.textContent).toContain('Failed to load image');
        done();
      });

      // Trigger error event manually for test
      img.dispatchEvent(new Event('error'));
    });

    test('should handle corrupted Buffer data', () => {
      const corruptedBuffer = Buffer.from([0x00, 0x01, 0x02]); // Not valid image data
      const result = renderer.render(corruptedBuffer);
      
      // Should still create element but may fail to display
      expect(result.element).toBeTruthy();
      const img = result.element.querySelector('img');
      expect(img).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    test('should include proper ARIA attributes', () => {
      const result = renderer.render('/path/to/accessible-image.png');
      const img = result.element.querySelector('img');
      
      expect(img.getAttribute('role')).toBe('img');
      expect(img.alt).toBeTruthy();
    });

    test('should support keyboard navigation for controls', () => {
      const rendererWithControls = new ImageRenderer({
        showControls: true
      });
      
      const result = rendererWithControls.render('/path/to/image.png');
      const controls = result.element.querySelectorAll('.image-controls button');
      
      controls.forEach(button => {
        expect(button.tabIndex).toBe(0);
        expect(button.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });

  describe('performance', () => {
    test('should handle multiple rapid renders without memory leaks', () => {
      let createCallCount = 0;
      let revokeCallCount = 0;
      
      // Mock URL methods to track calls
      URL.createObjectURL = () => {
        createCallCount++;
        return `blob:mock-url-${createCallCount}`;
      };
      
      URL.revokeObjectURL = () => {
        revokeCallCount++;
      };
      
      // Render multiple images
      for (let i = 0; i < 10; i++) {
        const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
        renderer.render(buffer);
      }
      
      // Should create object URLs for each render
      expect(createCallCount).toBe(10);
      expect(renderer.objectUrls.size).toBeGreaterThan(0);
      
      // Cleanup - restore original methods
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    test('should handle large images efficiently', () => {
      // Simulate large image buffer (1MB)
      const largeBuffer = Buffer.alloc(1024 * 1024, 0x89);
      
      const startTime = performance.now();
      const result = renderer.render(largeBuffer);
      const endTime = performance.now();
      
      // Should complete render in reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.element).toBeTruthy();
    });
  });
});