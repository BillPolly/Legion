/**
 * PlaintextRenderer Tests
 * 
 * Testing PlaintextRenderer class and BaseRenderer interface
 */

import { PlaintextRenderer, BaseRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/PlaintextRenderer.js';

describe('BaseRenderer', () => {
  test('should be an abstract class', () => {
    expect(() => {
      new BaseRenderer();
    }).toThrow('BaseRenderer is an abstract class');
  });

  test('should define required abstract methods', () => {
    class TestRenderer extends BaseRenderer {
      render(content, container) {
        return container;
      }
      
      canRender(contentType) {
        return contentType === 'test';
      }
    }

    const renderer = new TestRenderer();
    expect(renderer.render).toBeInstanceOf(Function);
    expect(renderer.canRender).toBeInstanceOf(Function);
    expect(renderer.getName()).toBe('TestRenderer');
  });

  test('should provide default getName method', () => {
    class TestRenderer extends BaseRenderer {
      render() {}
      canRender() { return false; }
    }

    const renderer = new TestRenderer();
    expect(renderer.getName()).toBe('TestRenderer');
  });

  test('should throw for missing abstract methods', () => {
    class IncompleteRenderer extends BaseRenderer {}

    expect(() => {
      const renderer = new IncompleteRenderer();
      renderer.render();
    }).toThrow();

    expect(() => {
      const renderer = new IncompleteRenderer();
      renderer.canRender();
    }).toThrow();
  });
});

describe('PlaintextRenderer', () => {
  let renderer;
  let container;

  beforeEach(() => {
    renderer = new PlaintextRenderer();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Content Type Detection', () => {
    test('should identify plaintext content correctly', () => {
      expect(renderer.canRender('plaintext')).toBe(true);
      expect(renderer.canRender('text')).toBe(true);
      expect(renderer.canRender('plain')).toBe(true);
    });

    test('should reject non-plaintext content types', () => {
      expect(renderer.canRender('markdown')).toBe(false);
      expect(renderer.canRender('html')).toBe(false);
      expect(renderer.canRender('yaml')).toBe(false);
      expect(renderer.canRender('json')).toBe(false);
      expect(renderer.canRender('code')).toBe(false);
    });

    test('should be case insensitive for content types', () => {
      expect(renderer.canRender('PLAINTEXT')).toBe(true);
      expect(renderer.canRender('PlainText')).toBe(true);
      expect(renderer.canRender('TEXT')).toBe(true);
    });

    test('should handle null and undefined content types', () => {
      expect(renderer.canRender(null)).toBe(false);
      expect(renderer.canRender(undefined)).toBe(false);
      expect(renderer.canRender('')).toBe(false);
    });
  });

  describe('Content Rendering', () => {
    test('should render simple text content', () => {
      const content = 'This is simple text content.';
      
      const result = renderer.render(content, container);
      
      expect(result).toBe(container);
      expect(container.innerHTML).toContain(content);
      expect(container.querySelector('.plaintext-content')).toBeDefined();
    });

    test('should preserve line breaks in content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.plaintext-content');
      expect(contentDiv.innerHTML).toContain('Line 1<br>Line 2<br>Line 3');
    });

    test('should handle empty content gracefully', () => {
      renderer.render('', container);
      
      const contentDiv = container.querySelector('.plaintext-content');
      expect(contentDiv).toBeDefined();
      expect(contentDiv.innerHTML).toBe('<em>No content</em>');
    });

    test('should handle null content gracefully', () => {
      renderer.render(null, container);
      
      const contentDiv = container.querySelector('.plaintext-content');
      expect(contentDiv).toBeDefined();
      expect(contentDiv.innerHTML).toBe('<em>No content</em>');
    });

    test('should handle undefined content gracefully', () => {
      renderer.render(undefined, container);
      
      const contentDiv = container.querySelector('.plaintext-content');
      expect(contentDiv).toBeDefined();
      expect(contentDiv.innerHTML).toBe('<em>No content</em>');
    });

    test('should escape HTML characters in content', () => {
      const content = '<script>alert("xss")</script>\n& "quotes" \n<div>HTML content</div>';
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.plaintext-content');
      
      // Check that dangerous HTML tags are escaped
      expect(contentDiv.innerHTML).not.toContain('<script>');
      expect(contentDiv.innerHTML).not.toContain('<div>');
      expect(contentDiv.innerHTML).toContain('&lt;script&gt;');
      expect(contentDiv.innerHTML).toContain('&lt;div&gt;');
      expect(contentDiv.innerHTML).toContain('&amp;');
      
      // Most importantly: the text content should be safe
      expect(contentDiv.textContent).toContain('<script>alert("xss")</script>');
      expect(contentDiv.textContent).toContain('& "quotes"');
      expect(contentDiv.textContent).toContain('<div>HTML content</div>');
      
      // And no actual script or div elements should be created
      expect(contentDiv.querySelector('script')).toBeNull();
      expect(contentDiv.querySelector('div')).toBeNull();
    });

    test('should preserve whitespace in content', () => {
      const content = '  Indented content  \n    More indented\n\n  With spaces  ';
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.plaintext-content');
      expect(contentDiv.style.whiteSpace).toBe('pre-wrap');
    });

    test('should apply correct CSS classes', () => {
      const content = 'Test content';
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.plaintext-content');
      expect(contentDiv.classList.contains('plaintext-content')).toBe(true);
      expect(contentDiv.classList.contains('renderer-content')).toBe(true);
    });

    test('should handle very long content efficiently', () => {
      const longContent = 'A'.repeat(10000) + '\n' + 'B'.repeat(10000);
      
      const startTime = Date.now();
      renderer.render(longContent, container);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should render quickly
      expect(container.querySelector('.plaintext-content')).toBeDefined();
    });
  });

  describe('Container Handling', () => {
    test('should clear existing container content', () => {
      container.innerHTML = '<div>Existing content</div>';
      
      renderer.render('New content', container);
      
      expect(container.innerHTML).not.toContain('Existing content');
      expect(container.innerHTML).toContain('New content');
    });

    test('should return the container element', () => {
      const result = renderer.render('Test content', container);
      
      expect(result).toBe(container);
    });

    test('should handle container with existing CSS classes', () => {
      container.className = 'existing-class another-class';
      
      renderer.render('Test content', container);
      
      expect(container.classList.contains('existing-class')).toBe(true);
      expect(container.classList.contains('another-class')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle null container gracefully', () => {
      expect(() => {
        renderer.render('Content', null);
      }).toThrow('Container is required for rendering');
    });

    test('should handle invalid container type', () => {
      expect(() => {
        renderer.render('Content', 'not-a-dom-element');
      }).toThrow('Container must be a DOM element');
    });

    test('should handle rendering errors gracefully', () => {
      // Mock a container that throws on innerHTML assignment
      const faultyContainer = {
        nodeType: Node.ELEMENT_NODE,
        set innerHTML(value) {
          throw new Error('Mock error');
        }
      };

      expect(() => {
        renderer.render('Content', faultyContainer);
      }).toThrow('Failed to render plaintext content');
    });

    test('should provide meaningful error messages', () => {
      try {
        renderer.render('Content', null);
      } catch (error) {
        expect(error.message).toBe('Container is required for rendering');
      }

      try {
        renderer.render('Content', 'invalid');
      } catch (error) {
        expect(error.message).toBe('Container must be a DOM element');
      }
    });
  });

  describe('Renderer Information', () => {
    test('should provide correct renderer name', () => {
      expect(renderer.getName()).toBe('PlaintextRenderer');
    });

    test('should provide renderer version', () => {
      expect(renderer.getVersion()).toBeDefined();
      expect(typeof renderer.getVersion()).toBe('string');
    });

    test('should provide supported content types', () => {
      const supportedTypes = renderer.getSupportedTypes();
      
      expect(Array.isArray(supportedTypes)).toBe(true);
      expect(supportedTypes).toContain('plaintext');
      expect(supportedTypes).toContain('text');
      expect(supportedTypes).toContain('plain');
    });

    test('should provide renderer description', () => {
      const description = renderer.getDescription();
      
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description).toContain('plaintext');
    });
  });

  describe('Performance', () => {
    test('should render multiple contents efficiently', () => {
      const contents = [
        'Content 1',
        'Content 2\nWith newlines',
        'Content 3 with special chars: <>&"',
        '',
        'Content 5 with lots of text: ' + 'x'.repeat(1000)
      ];

      const startTime = Date.now();
      
      contents.forEach((content, index) => {
        const testContainer = document.createElement('div');
        renderer.render(content, testContainer);
        expect(testContainer.querySelector('.plaintext-content')).toBeDefined();
      });
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });

    test('should not leak memory with repeated renders', () => {
      // Render the same content multiple times to test for memory leaks
      for (let i = 0; i < 100; i++) {
        renderer.render(`Test content ${i}`, container);
      }
      
      // Should only have one content div (previous ones cleaned up)
      const contentDivs = container.querySelectorAll('.plaintext-content');
      expect(contentDivs.length).toBe(1);
    });
  });
});