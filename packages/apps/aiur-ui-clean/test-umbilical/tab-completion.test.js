/**
 * Tab Completion and Parameter Hints Test Suite
 * Tests the terminal's tab completion, ghost text, and parameter hint features
 */

import { Terminal } from '../src/components/terminal/Terminal.js';
import { InputView } from '../src/components/terminal/InputView.js';

describe('Tab Completion and Parameter Hints', () => {
  let container;
  let terminal;
  let inputView;

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create terminal
    terminal = new Terminal(container);
    inputView = terminal.inputView;
    
    // Set up some test tool definitions
    const testTools = new Map([
      ['file_read', {
        name: 'file_read',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          properties: {
            filepath: { type: 'string', description: 'Path to file' }
          },
          required: ['filepath']
        }
      }],
      ['file_write', {
        name: 'file_write',
        description: 'Write a file',
        inputSchema: {
          type: 'object',
          properties: {
            filepath: { type: 'string', description: 'Path to file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['filepath', 'content']
        }
      }],
      ['directory_current', {
        name: 'directory_current',
        description: 'Get current directory',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }]
    ]);
    
    inputView.setToolDefinitions(testTools);
    inputView.setAvailableCommands(['.help', '.clear', 'tools']);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Ghost Text Suggestions', () => {
    test('should show ghost text for command completion', () => {
      // Type partial command
      inputView.setValue('file_r');
      inputView.updateGhostText();
      
      // Should show completion for file_read
      expect(inputView.state.ghostText).toBe('file_read');
    });

    test('should show parameter hints after space', () => {
      // Type command with space
      inputView.setValue('file_read ');
      inputView.updateGhostText();
      
      // Should show parameter hint
      expect(inputView.state.ghostText).toContain('<filepath: string>');
    });

    test('should show multiple parameter hints', () => {
      // Type command with space for multi-param tool
      inputView.setValue('file_write ');
      inputView.updateGhostText();
      
      // Should show both parameter hints
      expect(inputView.state.ghostText).toContain('<filepath: string>');
      expect(inputView.state.ghostText).toContain('<content: string>');
    });

    test('should update hints as arguments are provided', () => {
      // Type command with one argument
      inputView.setValue('file_write /path/to/file ');
      inputView.updateGhostText();
      
      // Should only show remaining parameter
      expect(inputView.state.ghostText).toContain('<content: string>');
      expect(inputView.state.ghostText).not.toContain('<filepath');
    });

    test('should show no hints for parameterless commands', () => {
      // Type command that takes no parameters
      inputView.setValue('directory_current ');
      inputView.updateGhostText();
      
      // Should not show any parameter hints
      expect(inputView.state.ghostText).toBe('');
    });
  });

  describe('Tab Completion', () => {
    test('should cycle through matching commands on Tab', () => {
      inputView.setValue('file');
      
      // Simulate Tab key
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      inputView.elements.input.dispatchEvent(event);
      
      // Should complete to first matching command
      expect(['file_read', 'file_write']).toContain(inputView.state.value);
    });

    test('should cycle through all completions on successive Tabs', () => {
      inputView.setValue('file');
      const completions = [];
      
      // Press Tab multiple times
      for (let i = 0; i < 3; i++) {
        const event = new KeyboardEvent('keydown', { key: 'Tab' });
        inputView.elements.input.dispatchEvent(event);
        completions.push(inputView.state.value);
      }
      
      // Should have cycled through file_read and file_write
      expect(completions).toContain('file_read');
      expect(completions).toContain('file_write');
      // Third press should cycle back
      expect(completions[2]).toBe(completions[0]);
    });

    test('should show all commands when Tab pressed with empty input', () => {
      inputView.setValue('');
      
      // Simulate Tab key
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      inputView.elements.input.dispatchEvent(event);
      
      // Should have selected one of the available commands
      const allCommands = ['.help', '.clear', 'tools', 'file_read', 'file_write', 'directory_current'];
      expect(allCommands).toContain(inputView.state.value);
    });
  });

  describe('Enter Key Behavior', () => {
    test('should execute command on Enter, not accept parameter hints', () => {
      let executedCommand = null;
      inputView.onCommand = (cmd) => { executedCommand = cmd; };
      
      // Type command with space (shows parameter hints)
      inputView.setValue('directory_current ');
      inputView.updateGhostText();
      
      // Press Enter
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      inputView.elements.input.dispatchEvent(event);
      
      // Should execute the command without the hints
      expect(executedCommand).toBe('directory_current');
    });

    test('should accept command completion on Enter when appropriate', () => {
      let executedCommand = null;
      inputView.onCommand = (cmd) => { executedCommand = cmd; };
      
      // Type partial command (shows completion)
      inputView.setValue('directory_cur');
      inputView.updateGhostText();
      
      // Press Enter
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      inputView.elements.input.dispatchEvent(event);
      
      // Should accept the completion and execute
      expect(executedCommand).toBe('directory_current');
    });

    test('should execute command with arguments on Enter', () => {
      let executedCommand = null;
      inputView.onCommand = (cmd) => { executedCommand = cmd; };
      
      // Type command with arguments
      inputView.setValue('file_read /path/to/file');
      inputView.updateGhostText();
      
      // Press Enter
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      inputView.elements.input.dispatchEvent(event);
      
      // Should execute the full command
      expect(executedCommand).toBe('file_read /path/to/file');
    });
  });

  describe('Arrow Key Behavior', () => {
    test('should accept ghost text on right arrow at end of input', () => {
      // Type partial command
      inputView.setValue('file_r');
      inputView.updateGhostText();
      
      // Move cursor to end
      inputView.elements.input.selectionStart = inputView.state.value.length;
      inputView.elements.input.selectionEnd = inputView.state.value.length;
      
      // Press right arrow
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      inputView.elements.input.dispatchEvent(event);
      
      // Should accept the ghost text
      expect(inputView.state.value).toBe('file_read');
    });

    test('should navigate history with up/down arrows', () => {
      let historyDirection = null;
      inputView.onHistoryRequest = (dir) => { historyDirection = dir; };
      
      // Press up arrow
      let event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      inputView.elements.input.dispatchEvent(event);
      expect(historyDirection).toBe(-1);
      
      // Press down arrow
      event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      inputView.elements.input.dispatchEvent(event);
      expect(historyDirection).toBe(1);
    });
  });

  describe('Escape Key', () => {
    test('should cancel completion on Escape', () => {
      inputView.setValue('file');
      inputView.state.completionActive = true;
      inputView.completions = ['file_read', 'file_write'];
      inputView.completionIndex = 0;
      
      // Press Escape
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      inputView.elements.input.dispatchEvent(event);
      
      // Should cancel completion state
      expect(inputView.state.completionActive).toBe(false);
      expect(inputView.completions).toEqual([]);
      expect(inputView.completionIndex).toBe(-1);
    });
  });

  describe('Visual Rendering', () => {
    test('should render ghost text in DOM', () => {
      inputView.setValue('file_read ');
      inputView.updateGhostText();
      
      // Ghost element should contain the hint
      expect(inputView.elements.ghost.textContent).toContain('<filepath: string>');
    });

    test('should position ghost text behind input', () => {
      const ghostStyle = inputView.elements.ghost.style;
      const inputStyle = inputView.elements.input.style;
      
      // Ghost should be absolutely positioned
      expect(ghostStyle.position).toBe('absolute');
      // Input should be relative to overlay
      expect(inputStyle.position).toBe('relative');
      // Ghost should not capture pointer events
      expect(ghostStyle.pointerEvents).toBe('none');
    });
  });

  describe('Integration with Terminal', () => {
    test('should update tool definitions when tools are loaded', () => {
      const newTools = new Map([
        ['new_tool', {
          name: 'new_tool',
          description: 'A new tool',
          inputSchema: {
            type: 'object',
            properties: {
              param: { type: 'string' }
            }
          }
        }]
      ]);
      
      terminal.updateToolDefinitions(newTools);
      
      // Should have the new tool available
      expect(inputView.toolDefinitions.has('new_tool')).toBe(true);
    });
  });
});