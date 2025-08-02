/**
 * Tests for TerminalOutputView subcomponent
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('TerminalOutputView', () => {
  let TerminalOutputView;
  let outputView;
  let container;
  
  beforeEach(async () => {
    ({ TerminalOutputView } = await import('../../../../../src/components/terminal/subcomponents/TerminalOutputView.js'));
    
    // Create container
    container = document.createElement('div');
    container.className = 'terminal-output-container';
    document.body.appendChild(container);
    
    // Create output view
    outputView = new TerminalOutputView(container);
  });
  
  afterEach(() => {
    if (outputView) {
      outputView.destroy();
    }
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('DOM Structure Creation', () => {
    test('should create output area structure', () => {
      outputView.render();
      
      expect(container.querySelector('.terminal-output')).toBeDefined();
      expect(outputView.outputElement).toBeDefined();
    });

    test('should apply theme', () => {
      outputView.render({ theme: 'dark' });
      
      const output = container.querySelector('.terminal-output');
      expect(output.classList.contains('terminal-output-theme-dark')).toBe(true);
    });

    test('should set max lines from options', () => {
      outputView.render({ maxLines: 5000 });
      
      expect(outputView.maxLines).toBe(5000);
    });

    test('should bind scroll events', () => {
      outputView.render();
      
      // Verify auto-scroll is enabled by default
      expect(outputView.autoScroll).toBe(true);
    });
  });

  describe('Line Management', () => {
    test('should add output line', () => {
      outputView.render();
      
      const lineId = outputView.addOutput({
        content: 'Test line',
        type: 'info'
      });
      
      expect(lineId).toBeDefined();
      expect(outputView.lines.length).toBe(1);
      
      const lineElement = container.querySelector('.terminal-output-line');
      expect(lineElement).toBeDefined();
      expect(lineElement.textContent).toBe('Test line');
      expect(lineElement.classList.contains('terminal-output-line-info')).toBe(true);
      expect(lineElement.getAttribute('data-line-id')).toBe(lineId);
    });

    test('should add multiple output lines', () => {
      outputView.render();
      
      const outputs = [
        { content: 'Line 1', type: 'info' },
        { content: 'Line 2', type: 'error' },
        { content: 'Line 3', type: 'success' }
      ];
      
      outputView.addOutputs(outputs);
      
      expect(outputView.lines.length).toBe(3);
      
      const lineElements = container.querySelectorAll('.terminal-output-line');
      expect(lineElements.length).toBe(3);
      expect(lineElements[0].textContent).toBe('Line 1');
      expect(lineElements[1].textContent).toBe('Line 2');
      expect(lineElements[2].textContent).toBe('Line 3');
    });

    test('should generate unique line IDs', () => {
      outputView.render();
      
      const id1 = outputView.addOutput({ content: 'Line 1' });
      const id2 = outputView.addOutput({ content: 'Line 2' });
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^line_\d+$/);
      expect(id2).toMatch(/^line_\d+$/);
    });

    test('should use provided line ID', () => {
      outputView.render();
      
      const customId = 'custom-line-123';
      const returnedId = outputView.addOutput({
        id: customId,
        content: 'Custom line'
      });
      
      expect(returnedId).toBe(customId);
      
      const lineElement = container.querySelector(`[data-line-id="${customId}"]`);
      expect(lineElement).toBeDefined();
    });

    test('should add timestamps when requested', () => {
      outputView.render();
      
      const now = new Date();
      outputView.addOutput({
        content: 'Timestamped line',
        timestamp: now,
        metadata: { showTimestamp: true }
      });
      
      const lineElement = container.querySelector('.terminal-output-line');
      const timestamp = lineElement.querySelector('.line-timestamp');
      expect(timestamp).toBeDefined();
      expect(timestamp.textContent).toBe(now.toLocaleTimeString());
    });

    test('should enforce max lines limit', () => {
      outputView.render({ maxLines: 3 });
      
      // Add more lines than the limit
      for (let i = 1; i <= 5; i++) {
        outputView.addOutput({ content: `Line ${i}` });
      }
      
      expect(outputView.lines.length).toBe(3);
      
      const lineElements = container.querySelectorAll('.terminal-output-line');
      expect(lineElements.length).toBe(3);
      
      // Should have the last 3 lines
      expect(lineElements[0].textContent).toBe('Line 3');
      expect(lineElements[1].textContent).toBe('Line 4');
      expect(lineElements[2].textContent).toBe('Line 5');
    });
  });

  describe('Content Rendering', () => {
    test('should render text content', () => {
      outputView.render();
      
      outputView.addOutput({
        content: 'Simple text line',
        type: 'info'
      });
      
      const lineElement = container.querySelector('.terminal-output-line');
      expect(lineElement.textContent).toBe('Simple text line');
    });

    test('should render JSON content with pretty printing', () => {
      outputView.render();
      
      const jsonContent = '{"name":"test","value":123}';
      outputView.addOutput({
        content: jsonContent,
        type: 'result'
      });
      
      const lineElement = container.querySelector('.terminal-output-line');
      const preElement = lineElement.querySelector('pre.json-content');
      expect(preElement).toBeDefined();
      expect(preElement.textContent).toContain('"name": "test"');
      expect(preElement.textContent).toContain('"value": 123');
    });

    test('should handle invalid JSON gracefully', () => {
      outputView.render();
      
      const invalidJson = '{"invalid": json}';
      outputView.addOutput({
        content: invalidJson,
        type: 'result'
      });
      
      const lineElement = container.querySelector('.terminal-output-line');
      expect(lineElement.textContent).toBe(invalidJson);
    });

    test('should render object content with HTML', () => {
      outputView.render();
      
      outputView.addOutput({
        content: {
          html: '<strong>Bold text</strong>'
        },
        type: 'info'
      });
      
      const lineElement = container.querySelector('.terminal-output-line');
      expect(lineElement.innerHTML).toContain('<strong>Bold text</strong>');
    });

    test('should render object content with JSON', () => {
      outputView.render();
      
      outputView.addOutput({
        content: {
          json: { key: 'value', number: 42 }
        },
        type: 'result'
      });
      
      const lineElement = container.querySelector('.terminal-output-line');
      const preElement = lineElement.querySelector('pre.json-content');
      expect(preElement).toBeDefined();
      expect(preElement.textContent).toContain('"key": "value"');
      expect(preElement.textContent).toContain('"number": 42');
    });

    test('should render table content', () => {
      outputView.render();
      
      outputView.addOutput({
        content: {
          table: {
            headers: ['Name', 'Age', 'City'],
            rows: [
              ['Alice', '25', 'New York'],
              ['Bob', '30', 'London']
            ]
          }
        },
        type: 'result'
      });
      
      const lineElement = container.querySelector('.terminal-output-line');
      const table = lineElement.querySelector('table.output-table');
      expect(table).toBeDefined();
      
      const headers = table.querySelectorAll('th');
      expect(headers.length).toBe(3);
      expect(headers[0].textContent).toBe('Name');
      expect(headers[1].textContent).toBe('Age');
      expect(headers[2].textContent).toBe('City');
      
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
      
      const firstRowCells = rows[0].querySelectorAll('td');
      expect(firstRowCells[0].textContent).toBe('Alice');
      expect(firstRowCells[1].textContent).toBe('25');
      expect(firstRowCells[2].textContent).toBe('New York');
    });

    test('should handle fallback for unknown object content', () => {
      outputView.render();
      
      const complexObject = { unknown: 'format', nested: { data: true } };
      outputView.addOutput({
        content: complexObject,
        type: 'info'
      });
      
      const lineElement = container.querySelector('.terminal-output-line');
      expect(lineElement.textContent).toBe(JSON.stringify(complexObject));
    });
  });

  describe('Line Operations', () => {
    test('should remove specific line', () => {
      outputView.render();
      
      const id1 = outputView.addOutput({ content: 'Line 1' });
      const id2 = outputView.addOutput({ content: 'Line 2' });
      const id3 = outputView.addOutput({ content: 'Line 3' });
      
      outputView.removeLine(id2);
      
      expect(outputView.lines.length).toBe(2);
      expect(outputView.lines[0].id).toBe(id1);
      expect(outputView.lines[1].id).toBe(id3);
      
      const lineElements = container.querySelectorAll('.terminal-output-line');
      expect(lineElements.length).toBe(2);
      expect(lineElements[0].textContent).toBe('Line 1');
      expect(lineElements[1].textContent).toBe('Line 3');
    });

    test('should update existing line', () => {
      outputView.render();
      
      const lineId = outputView.addOutput({
        content: 'Original content',
        type: 'info'
      });
      
      outputView.updateLine(lineId, {
        content: 'Updated content',
        type: 'success'
      });
      
      const lineElement = container.querySelector(`[data-line-id="${lineId}"]`);
      expect(lineElement.textContent).toBe('Updated content');
      expect(lineElement.classList.contains('terminal-output-line-success')).toBe(true);
      expect(lineElement.classList.contains('terminal-output-line-info')).toBe(false);
    });

    test('should clear all output', () => {
      outputView.render();
      
      outputView.addOutput({ content: 'Line 1' });
      outputView.addOutput({ content: 'Line 2' });
      
      expect(outputView.lines.length).toBe(2);
      expect(container.querySelectorAll('.terminal-output-line').length).toBe(2);
      
      outputView.clear();
      
      expect(outputView.lines.length).toBe(0);
      expect(container.querySelectorAll('.terminal-output-line').length).toBe(0);
      expect(outputView.lineIdCounter).toBe(0);
    });
  });

  describe('Scrolling Behavior', () => {
    test('should auto-scroll when enabled', () => {
      outputView.render();
      
      const scrollSpy = jest.spyOn(outputView, 'scrollToBottom');
      
      outputView.setAutoScroll(true);
      outputView.addOutput({ content: 'New line' });
      
      expect(scrollSpy).toHaveBeenCalled();
    });

    test('should not auto-scroll when disabled', () => {
      outputView.render();
      
      const scrollSpy = jest.spyOn(outputView, 'scrollToBottom');
      
      outputView.setAutoScroll(false);
      outputView.addOutput({ content: 'New line' });
      
      expect(scrollSpy).not.toHaveBeenCalled();
    });

    test('should scroll to bottom', () => {
      outputView.render();
      
      const outputElement = outputView.outputElement;
      outputElement.scrollTop = 0;
      
      // Mock scrollHeight since it's read-only in JSDOM
      Object.defineProperty(outputElement, 'scrollHeight', {
        value: 1000,
        configurable: true
      });
      
      outputView.scrollToBottom();
      
      expect(outputElement.scrollTop).toBe(1000);
    });

    test('should scroll to top', () => {
      outputView.render();
      
      const outputElement = outputView.outputElement;
      outputElement.scrollTop = 500;
      
      outputView.scrollToTop();
      
      expect(outputElement.scrollTop).toBe(0);
    });

    test('should scroll to specific line', () => {
      outputView.render();
      
      const lineId = outputView.addOutput({ content: 'Target line' });
      const lineElement = container.querySelector(`[data-line-id="${lineId}"]`);
      
      // Mock scrollIntoView for JSDOM
      lineElement.scrollIntoView = jest.fn();
      const scrollIntoViewSpy = jest.spyOn(lineElement, 'scrollIntoView');
      
      outputView.scrollToLine(lineId);
      
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      });
    });

    test('should detect scroll position for auto-scroll', () => {
      outputView.render();
      
      const outputElement = outputView.outputElement;
      
      // Mock scroll dimensions
      Object.defineProperty(outputElement, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(outputElement, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(outputElement, 'clientHeight', { value: 400, writable: true });
      
      outputView.checkAutoScroll();
      expect(outputView.autoScroll).toBe(false); // Not at bottom
      
      // Scroll to bottom
      outputElement.scrollTop = 600; // 600 + 400 = 1000 (at bottom)
      outputView.checkAutoScroll();
      expect(outputView.autoScroll).toBe(true); // At bottom
    });

    test('should temporarily disable auto-scroll on wheel up', (done) => {
      outputView.render();
      
      outputView.setAutoScroll(true);
      
      const wheelEvent = new WheelEvent('wheel', { deltaY: -10 }); // Scroll up
      outputView.outputElement.dispatchEvent(wheelEvent);
      
      expect(outputView.autoScroll).toBe(false);
      
      // Should re-enable after timeout
      setTimeout(() => {
        expect(outputView.autoScroll).toBe(true);
        done();
      }, 1100);
    });
  });

  describe('Search and Query', () => {
    test('should get all lines', () => {
      outputView.render();
      
      outputView.addOutput({ content: 'Line 1', type: 'info' });
      outputView.addOutput({ content: 'Line 2', type: 'error' });
      
      const lines = outputView.getLines();
      expect(lines.length).toBe(2);
      expect(lines[0].content).toBe('Line 1');
      expect(lines[1].content).toBe('Line 2');
      
      // Should return a copy, not the original array
      expect(lines).not.toBe(outputView.lines);
    });

    test('should find lines by type', () => {
      outputView.render();
      
      outputView.addOutput({ content: 'Info line 1', type: 'info' });
      outputView.addOutput({ content: 'Error line', type: 'error' });
      outputView.addOutput({ content: 'Info line 2', type: 'info' });
      
      const infoLines = outputView.findLinesByType('info');
      expect(infoLines.length).toBe(2);
      expect(infoLines[0].content).toBe('Info line 1');
      expect(infoLines[1].content).toBe('Info line 2');
      
      const errorLines = outputView.findLinesByType('error');
      expect(errorLines.length).toBe(1);
      expect(errorLines[0].content).toBe('Error line');
    });

    test('should search lines by content', () => {
      outputView.render();
      
      outputView.addOutput({ content: 'Hello world' });
      outputView.addOutput({ content: 'Test message' });
      outputView.addOutput({ content: 'Another hello there' });
      
      const results = outputView.searchLines('hello');
      expect(results.length).toBe(2);
      expect(results[0].content).toBe('Hello world');
      expect(results[1].content).toBe('Another hello there');
    });

    test('should perform case-insensitive search', () => {
      outputView.render();
      
      outputView.addOutput({ content: 'UPPERCASE TEXT' });
      outputView.addOutput({ content: 'lowercase text' });
      outputView.addOutput({ content: 'MiXeD cAsE TeXt' });
      
      const results = outputView.searchLines('text');
      expect(results.length).toBe(3);
    });
  });

  describe('Configuration', () => {
    test('should set max lines limit', () => {
      outputView.render();
      
      // Add some lines
      for (let i = 1; i <= 5; i++) {
        outputView.addOutput({ content: `Line ${i}` });
      }
      
      expect(outputView.lines.length).toBe(5);
      
      // Reduce max lines
      outputView.setMaxLines(3);
      
      expect(outputView.maxLines).toBe(3);
      expect(outputView.lines.length).toBe(3);
      
      const lineElements = container.querySelectorAll('.terminal-output-line');
      expect(lineElements.length).toBe(3);
      expect(lineElements[0].textContent).toBe('Line 3');
      expect(lineElements[1].textContent).toBe('Line 4');
      expect(lineElements[2].textContent).toBe('Line 5');
    });

    test('should update auto-scroll setting', () => {
      outputView.render();
      
      expect(outputView.autoScroll).toBe(true);
      
      outputView.setAutoScroll(false);
      expect(outputView.autoScroll).toBe(false);
      
      outputView.setAutoScroll(true);
      expect(outputView.autoScroll).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    test('should validate JSON strings', () => {
      expect(outputView.isJsonString('{"valid": "json"}')).toBe(true);
      expect(outputView.isJsonString('[1, 2, 3]')).toBe(true);
      expect(outputView.isJsonString('not json')).toBe(false);
      expect(outputView.isJsonString('{"invalid": json}')).toBe(false);
    });

    test('should create DOM elements with classes', () => {
      const element = outputView.createElement('div', ['class1', 'class2']);
      expect(element.tagName).toBe('DIV');
      expect(element.classList.contains('class1')).toBe(true);
      expect(element.classList.contains('class2')).toBe(true);
    });

    test('should create DOM elements without classes', () => {
      const element = outputView.createElement('span');
      expect(element.tagName).toBe('SPAN');
      expect(element.className).toBe('');
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      outputView.render();
      
      outputView.addOutput({ content: 'Test line' });
      expect(outputView.lines.length).toBe(1);
      
      outputView.destroy();
      
      expect(outputView.lines.length).toBe(0);
    });

    test('should clear timeouts on destroy', () => {
      outputView.render();
      
      // Set up a timeout (simulating wheel event timeout)
      outputView.autoScrollTimeout = setTimeout(() => {}, 1000);
      
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      outputView.destroy();
      
      expect(clearTimeoutSpy).toHaveBeenCalledWith(outputView.autoScrollTimeout);
    });
  });
});