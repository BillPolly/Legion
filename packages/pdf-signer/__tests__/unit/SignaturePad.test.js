import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SignaturePad } from '../../src/client/SignaturePad.js';

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
      removeEventListener: jest.fn(),
      remove: jest.fn(),
      dispatchEvent: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      getContext: jest.fn(() => ({
        drawImage: jest.fn(),
        clearRect: jest.fn(),
        toDataURL: jest.fn(() => 'data:image/png;base64,test')
      })),
      clientWidth: 400,
      clientHeight: 200,
      width: 400,
      height: 200,
      toDataURL: jest.fn(() => 'data:image/png;base64,test')
    };
    
    if (tag === 'canvas') {
      element.width = 400;
      element.height = 200;
      element.getContext = jest.fn(() => ({
        drawImage: jest.fn(),
        clearRect: jest.fn()
      }));
      element.toDataURL = jest.fn(() => 'data:image/png;base64,test');
    }
    
    return element;
  })
};

global.window = {
  SignaturePad: null
};

// Mock signature_pad library
class MockSignaturePadLib {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.options = options;
    this.isEmpty = jest.fn(() => false);
    this.clear = jest.fn();
    this.fromDataURL = jest.fn();
    this.toDataURL = jest.fn(() => 'data:image/png;base64,signature');
    this.on = jest.fn();
    this.off = jest.fn();
    this.penColor = options?.penColor || '#000000';
    this.minWidth = options?.minWidth || 0.5;
    this.maxWidth = options?.maxWidth || 2.5;
  }
}

describe('SignaturePad', () => {
  let container;
  let signaturePad;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create container
    container = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      removeChild: jest.fn(),
      clientWidth: 600,
      clientHeight: 400,
      children: []
    };
    
    // Mock SignaturePad library
    global.window.SignaturePad = MockSignaturePadLib;
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      signaturePad = new SignaturePad(container);
      
      expect(signaturePad.container).toBe(container);
      expect(signaturePad.options.width).toBe(400);
      expect(signaturePad.options.height).toBe(200);
      expect(signaturePad.options.penColor).toBe('#000000');
      expect(signaturePad.options.backgroundColor).toBe('#ffffff');
    });

    it('should accept custom options', () => {
      const options = {
        width: 500,
        height: 250,
        penColor: '#0000ff',
        backgroundColor: '#f0f0f0'
      };
      
      signaturePad = new SignaturePad(container, options);
      
      expect(signaturePad.options.width).toBe(500);
      expect(signaturePad.options.height).toBe(250);
      expect(signaturePad.options.penColor).toBe('#0000ff');
      expect(signaturePad.options.backgroundColor).toBe('#f0f0f0');
    });
  });

  describe('Modal Display', () => {
    beforeEach(() => {
      signaturePad = new SignaturePad(container);
    });

    it('should show modal', async () => {
      await signaturePad.show();
      
      expect(signaturePad.isVisible).toBe(true);
      expect(container.appendChild).toHaveBeenCalled();
    });

    it('should hide modal', () => {
      signaturePad.isVisible = true;
      signaturePad.modal = { remove: jest.fn() };
      
      signaturePad.hide();
      
      expect(signaturePad.isVisible).toBe(false);
      expect(signaturePad.modal.remove).toHaveBeenCalled();
    });

    it('should create modal with correct structure', async () => {
      await signaturePad.show();
      
      const modal = signaturePad.modal;
      expect(modal).toBeDefined();
      expect(modal.className).toContain('signature-modal');
      expect(modal.style.position).toBe('fixed');
    });
  });

  describe('Signature Capture', () => {
    beforeEach(async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
    });

    it('should initialize signature_pad library', () => {
      expect(signaturePad.pad).toBeDefined();
      expect(signaturePad.pad).toBeInstanceOf(MockSignaturePadLib);
    });

    it('should clear signature', () => {
      signaturePad.clear();
      
      expect(signaturePad.pad.clear).toHaveBeenCalled();
    });

    it('should check if empty', () => {
      signaturePad.pad.isEmpty.mockReturnValue(true);
      
      expect(signaturePad.isEmpty()).toBe(true);
      
      signaturePad.pad.isEmpty.mockReturnValue(false);
      
      expect(signaturePad.isEmpty()).toBe(false);
    });

    it('should get signature as base64', () => {
      const signature = signaturePad.getSignature();
      
      expect(signature).toBe('data:image/png;base64,signature');
      expect(signaturePad.pad.toDataURL).toHaveBeenCalled();
    });

    it('should get signature with custom format', () => {
      signaturePad.getSignature('image/jpeg');
      
      expect(signaturePad.pad.toDataURL).toHaveBeenCalledWith('image/jpeg');
    });

    it('should not get signature if empty', () => {
      signaturePad.pad.isEmpty.mockReturnValue(true);
      
      const signature = signaturePad.getSignature();
      
      expect(signature).toBeNull();
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
    });

    it('should set pen color', () => {
      signaturePad.setPenColor('#ff0000');
      
      expect(signaturePad.options.penColor).toBe('#ff0000');
      expect(signaturePad.pad.penColor).toBe('#ff0000');
    });

    it('should set pen width', () => {
      signaturePad.setPenWidth(1, 3);
      
      expect(signaturePad.pad.minWidth).toBe(1);
      expect(signaturePad.pad.maxWidth).toBe(3);
    });

    it('should set background color', () => {
      const canvas = signaturePad.canvas;
      const ctx = {
        fillStyle: '',
        fillRect: jest.fn()
      };
      canvas.getContext.mockReturnValue(ctx);
      
      signaturePad.setBackgroundColor('#cccccc');
      
      expect(signaturePad.options.backgroundColor).toBe('#cccccc');
      expect(ctx.fillStyle).toBe('#cccccc');
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
    });
  });

  describe('User Actions', () => {
    let onApply, onCancel;
    
    beforeEach(async () => {
      onApply = jest.fn();
      onCancel = jest.fn();
      
      signaturePad = new SignaturePad(container, {
        onApply,
        onCancel
      });
      
      await signaturePad.show();
    });

    it('should handle apply action', () => {
      signaturePad.pad.isEmpty.mockReturnValue(false);
      
      const signature = signaturePad.apply();
      
      expect(signature).toBe('data:image/png;base64,signature');
      expect(onApply).toHaveBeenCalledWith(signature);
      expect(signaturePad.isVisible).toBe(false);
    });

    it('should not apply if signature is empty', () => {
      signaturePad.pad.isEmpty.mockReturnValue(true);
      
      const signature = signaturePad.apply();
      
      expect(signature).toBeNull();
      expect(onApply).not.toHaveBeenCalled();
    });

    it('should handle cancel action', () => {
      signaturePad.cancel();
      
      expect(onCancel).toHaveBeenCalled();
      expect(signaturePad.isVisible).toBe(false);
    });

    it('should handle undo action', () => {
      // Mock undo functionality
      const undoData = [];
      signaturePad.pad.toData = jest.fn(() => [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 }
      ]);
      signaturePad.pad.fromData = jest.fn((data) => {
        undoData.length = 0;
        undoData.push(...data);
      });
      
      signaturePad.undo();
      
      expect(signaturePad.pad.toData).toHaveBeenCalled();
      expect(signaturePad.pad.fromData).toHaveBeenCalled();
    });
  });

  describe('Canvas Sizing', () => {
    it('should resize canvas', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      const canvas = signaturePad.canvas;
      
      signaturePad.resize(600, 300);
      
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(300);
    });

    it('should maintain aspect ratio if specified', async () => {
      signaturePad = new SignaturePad(container, {
        maintainAspectRatio: true,
        aspectRatio: 2  // width:height = 2:1
      });
      await signaturePad.show();
      
      signaturePad.resize(600, 600);  // Try to set square
      
      // Should maintain 2:1 ratio
      expect(signaturePad.canvas.width).toBe(600);
      expect(signaturePad.canvas.height).toBe(300);
    });
  });

  describe('Modal Buttons', () => {
    beforeEach(async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
    });

    it('should create action buttons', () => {
      // Should have Clear, Apply, and Cancel buttons
      expect(signaturePad.clearButton).toBeDefined();
      expect(signaturePad.clearButton.textContent).toBe('Clear');
      expect(signaturePad.applyButton).toBeDefined();
      expect(signaturePad.applyButton.textContent).toBe('Apply');
      expect(signaturePad.cancelButton).toBeDefined();
      expect(signaturePad.cancelButton.textContent).toBe('Cancel');
    });

    it('should handle clear button click', () => {
      const clearSpy = jest.spyOn(signaturePad, 'clear');
      
      signaturePad.clearButton.click();
      
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should handle apply button click', () => {
      const applySpy = jest.spyOn(signaturePad, 'apply');
      signaturePad.pad.isEmpty.mockReturnValue(false);
      
      signaturePad.applyButton.click();
      
      expect(applySpy).toHaveBeenCalled();
    });

    it('should handle cancel button click', () => {
      const cancelSpy = jest.spyOn(signaturePad, 'cancel');
      
      signaturePad.cancelButton.click();
      
      expect(cancelSpy).toHaveBeenCalled();
    });
  });

  describe('Signature Loading', () => {
    beforeEach(async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
    });

    it('should load signature from data URL', () => {
      const dataUrl = 'data:image/png;base64,existingsignature';
      
      signaturePad.loadSignature(dataUrl);
      
      expect(signaturePad.pad.fromDataURL).toHaveBeenCalledWith(dataUrl);
    });
  });

  describe('Library Loading', () => {
    it('should use window.SignaturePad if available', async () => {
      signaturePad = new SignaturePad(container);
      
      const lib = await signaturePad.getSignaturePadLib();
      
      expect(lib).toBe(MockSignaturePadLib);
    });

    it('should handle missing library', async () => {
      window.SignaturePad = null;
      signaturePad = new SignaturePad(container);
      
      // Mock dynamic import failure
      signaturePad.getSignaturePadLib = jest.fn(() => 
        Promise.reject(new Error('SignaturePad library not available'))
      );
      
      await expect(signaturePad.show()).rejects.toThrow('SignaturePad library not available');
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      signaturePad = new SignaturePad(container);
      await signaturePad.show();
      
      const modal = signaturePad.modal;
      modal.remove = jest.fn();
      
      signaturePad.destroy();
      
      expect(modal.remove).toHaveBeenCalled();
      expect(signaturePad.pad).toBeNull();
      expect(signaturePad.canvas).toBeNull();
      expect(signaturePad.modal).toBeNull();
    });

    it('should handle destroy without showing', () => {
      signaturePad = new SignaturePad(container);
      
      // Should not throw
      expect(() => signaturePad.destroy()).not.toThrow();
    });
  });
});