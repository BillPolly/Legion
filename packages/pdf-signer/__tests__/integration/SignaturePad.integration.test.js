import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SignaturePad } from '../../src/client/SignaturePad.js';
import { JSDOM } from 'jsdom';

// Mock signature_pad library behavior
class MockSignaturePadLib {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.options = options;
    this.penColor = options?.penColor || '#000000';
    this.minWidth = options?.minWidth || 0.5;
    this.maxWidth = options?.maxWidth || 2.5;
    this._strokes = [];
    this._isEmpty = true;
  }
  
  isEmpty() {
    return this._isEmpty;
  }
  
  clear() {
    this._strokes = [];
    this._isEmpty = true;
    if (this.canvas && this.canvas.getContext) {
      const ctx = this.canvas.getContext('2d');
      if (ctx && ctx.clearRect) {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }
  
  toDataURL(format = 'image/png') {
    if (this._isEmpty) return null;
    // Simulate real signature data
    return `data:${format};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
  }
  
  fromDataURL(dataUrl) {
    this._isEmpty = false;
    this._strokes = [{ x: 10, y: 10 }];
  }
  
  toData() {
    return [...this._strokes];
  }
  
  fromData(data) {
    this._strokes = [...data];
    this._isEmpty = data.length === 0;
  }
  
  // Simulate drawing
  simulateDraw() {
    this._strokes.push({ x: Math.random() * 100, y: Math.random() * 100 });
    this._isEmpty = false;
  }
}

describe('SignaturePad Integration Tests', () => {
  let dom;
  let container;
  let signaturePad;
  
  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="signature-container" style="width: 800px; height: 600px;"></div>
        </body>
      </html>
    `, { 
      url: 'http://localhost',
      resources: 'usable',
      runScripts: 'dangerously'
    });
    
    global.window = dom.window;
    global.document = dom.window.document;
    
    // Mock SignaturePad library
    global.window.SignaturePad = MockSignaturePadLib;
    
    // Get container
    container = document.getElementById('signature-container');
  });
  
  afterEach(() => {
    if (signaturePad) {
      signaturePad.destroy();
    }
    dom.window.close();
  });

  describe('Complete Signature Workflow', () => {
    it('should handle complete signature capture workflow', async () => {
      let capturedSignature = null;
      
      signaturePad = new SignaturePad(container, {
        onApply: (signature) => {
          capturedSignature = signature;
        }
      });
      
      // Show modal
      await signaturePad.show();
      expect(signaturePad.isVisible).toBe(true);
      
      // Check modal is in DOM
      const modal = container.querySelector('.signature-modal');
      expect(modal).toBeTruthy();
      
      // Check backdrop
      const backdrop = container.querySelector('.signature-backdrop');
      expect(backdrop).toBeTruthy();
      expect(backdrop.style.position).toBe('fixed');
      
      // Check canvas
      const canvas = modal.querySelector('canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(200);
      
      // Simulate drawing
      signaturePad.pad.simulateDraw();
      expect(signaturePad.isEmpty()).toBe(false);
      
      // Apply signature
      const signature = signaturePad.apply();
      
      expect(signature).toBeTruthy();
      expect(signature).toContain('data:image/png;base64');
      expect(capturedSignature).toBe(signature);
      expect(signaturePad.isVisible).toBe(false);
      
      // Modal should be removed
      expect(container.querySelector('.signature-modal')).toBeFalsy();
    });

    it('should handle cancel workflow', async () => {
      let cancelCalled = false;
      
      signaturePad = new SignaturePad(container, {
        onCancel: () => {
          cancelCalled = true;
        }
      });
      
      await signaturePad.show();
      
      // Simulate some drawing
      signaturePad.pad.simulateDraw();
      
      // Cancel
      signaturePad.cancel();
      
      expect(cancelCalled).toBe(true);
      expect(signaturePad.isVisible).toBe(false);
      expect(container.querySelector('.signature-modal')).toBeFalsy();
    });

    it('should clear signature', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      // Draw something
      signaturePad.pad.simulateDraw();
      expect(signaturePad.isEmpty()).toBe(false);
      
      // Clear
      signaturePad.clear();
      expect(signaturePad.isEmpty()).toBe(true);
    });
  });

  describe('Button Interactions', () => {
    it('should handle button clicks', async () => {
      let applyCalled = false;
      let cancelCalled = false;
      
      signaturePad = new SignaturePad(container, {
        onApply: () => { applyCalled = true; },
        onCancel: () => { cancelCalled = true; }
      });
      
      await signaturePad.show();
      
      const modal = container.querySelector('.signature-modal');
      
      // Find buttons
      const buttons = modal.querySelectorAll('button');
      expect(buttons.length).toBe(3);
      
      const clearButton = Array.from(buttons).find(b => b.textContent === 'Clear');
      const cancelButton = Array.from(buttons).find(b => b.textContent === 'Cancel');
      const applyButton = Array.from(buttons).find(b => b.textContent === 'Apply');
      
      expect(clearButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
      expect(applyButton).toBeTruthy();
      
      // Test clear button
      signaturePad.pad.simulateDraw();
      expect(signaturePad.isEmpty()).toBe(false);
      
      clearButton.click();
      expect(signaturePad.isEmpty()).toBe(true);
      
      // Test cancel button
      cancelButton.click();
      expect(cancelCalled).toBe(true);
      expect(signaturePad.isVisible).toBe(false);
      
      // Show again for apply test
      await signaturePad.show();
      signaturePad.pad.simulateDraw();
      
      const modal2 = container.querySelector('.signature-modal');
      const applyButton2 = Array.from(modal2.querySelectorAll('button'))
        .find(b => b.textContent === 'Apply');
      
      applyButton2.click();
      expect(applyCalled).toBe(true);
    });

    it('should not apply empty signature', async () => {
      let applyCalled = false;
      
      signaturePad = new SignaturePad(container, {
        onApply: () => { applyCalled = true; }
      });
      
      await signaturePad.show();
      
      // Try to apply without drawing
      const result = signaturePad.apply();
      
      expect(result).toBeNull();
      expect(applyCalled).toBe(false);
      expect(signaturePad.isVisible).toBe(true); // Should stay open
    });
  });

  describe('Configuration', () => {
    it('should apply custom styling', async () => {
      signaturePad = new SignaturePad(container, {
        width: 600,
        height: 300,
        penColor: '#0000ff',
        backgroundColor: '#f0f0f0'
      });
      
      await signaturePad.show();
      
      const canvas = container.querySelector('canvas');
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(300);
      
      expect(signaturePad.pad.penColor).toBe('#0000ff');
    });

    it('should update configuration dynamically', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      // Change pen color
      signaturePad.setPenColor('#ff0000');
      expect(signaturePad.pad.penColor).toBe('#ff0000');
      
      // Change pen width
      signaturePad.setPenWidth(1, 5);
      expect(signaturePad.pad.minWidth).toBe(1);
      expect(signaturePad.pad.maxWidth).toBe(5);
    });
  });

  describe('Signature Data', () => {
    it('should load existing signature', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      expect(signaturePad.isEmpty()).toBe(true);
      
      // Load signature
      const existingSignature = 'data:image/png;base64,existingdata';
      signaturePad.loadSignature(existingSignature);
      
      expect(signaturePad.isEmpty()).toBe(false);
    });

    it('should export signature in different formats', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      signaturePad.pad.simulateDraw();
      
      // Get as PNG
      const pngSignature = signaturePad.getSignature('image/png');
      expect(pngSignature).toContain('image/png');
      
      // Get as JPEG
      const jpegSignature = signaturePad.getSignature('image/jpeg');
      expect(jpegSignature).toContain('image/jpeg');
    });
  });

  describe('Undo Functionality', () => {
    it('should undo last stroke', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      // Add multiple strokes
      signaturePad.pad._strokes = [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 }
      ];
      signaturePad.pad._isEmpty = false;
      
      expect(signaturePad.pad.toData().length).toBe(3);
      
      // Undo once
      signaturePad.undo();
      expect(signaturePad.pad.toData().length).toBe(2);
      
      // Undo again
      signaturePad.undo();
      expect(signaturePad.pad.toData().length).toBe(1);
    });
  });

  describe('Canvas Resizing', () => {
    it('should resize canvas', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      const canvas = container.querySelector('canvas');
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(200);
      
      // Resize
      signaturePad.resize(800, 400);
      
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(400);
    });

    it('should maintain aspect ratio when configured', async () => {
      signaturePad = new SignaturePad(container, {
        maintainAspectRatio: true,
        aspectRatio: 3  // 3:1 ratio
      });
      await signaturePad.show();
      
      // Try to resize to non-matching ratio
      signaturePad.resize(600, 400);
      
      // Should maintain 3:1 ratio
      const canvas = container.querySelector('canvas');
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(200); // 600/3 = 200
    });
  });

  describe('Modal Lifecycle', () => {
    it('should show and hide modal multiple times', async () => {
      signaturePad = new SignaturePad(container);
      
      // First show
      await signaturePad.show();
      expect(signaturePad.isVisible).toBe(true);
      expect(container.querySelector('.signature-modal')).toBeTruthy();
      
      // Hide
      signaturePad.hide();
      expect(signaturePad.isVisible).toBe(false);
      expect(container.querySelector('.signature-modal')).toBeFalsy();
      
      // Show again
      await signaturePad.show();
      expect(signaturePad.isVisible).toBe(true);
      expect(container.querySelector('.signature-modal')).toBeTruthy();
      
      // Hide again
      signaturePad.hide();
      expect(signaturePad.isVisible).toBe(false);
      expect(container.querySelector('.signature-modal')).toBeFalsy();
    });

    it('should handle multiple show calls', async () => {
      signaturePad = new SignaturePad(container);
      
      await signaturePad.show();
      const firstModal = container.querySelector('.signature-modal');
      
      // Try to show again
      await signaturePad.show();
      const secondModal = container.querySelector('.signature-modal');
      
      // Should be the same modal (not duplicated)
      expect(firstModal).toBe(secondModal);
      expect(container.querySelectorAll('.signature-modal').length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing signature_pad library gracefully', async () => {
      delete global.window.SignaturePad;
      
      signaturePad = new SignaturePad(container);
      signaturePad.getSignaturePadLib = () => 
        Promise.reject(new Error('SignaturePad library not available'));
      
      await expect(signaturePad.show()).rejects.toThrow('SignaturePad library not available');
    });
  });

  describe('Cleanup', () => {
    it('should properly clean up all resources', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      // Verify elements exist
      expect(container.querySelector('.signature-modal')).toBeTruthy();
      expect(container.querySelector('.signature-backdrop')).toBeTruthy();
      expect(signaturePad.pad).toBeTruthy();
      
      // Destroy
      signaturePad.destroy();
      
      // Verify cleanup
      expect(container.querySelector('.signature-modal')).toBeFalsy();
      expect(container.querySelector('.signature-backdrop')).toBeFalsy();
      expect(signaturePad.pad).toBeNull();
      expect(signaturePad.canvas).toBeNull();
      expect(signaturePad.modal).toBeNull();
    });
  });
});