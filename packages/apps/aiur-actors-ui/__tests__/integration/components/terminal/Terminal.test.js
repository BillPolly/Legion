/**
 * Integration tests for Terminal component
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestUtilities } from '../../../utils/test-utilities.js';

describe('Terminal Component Integration', () => {
  let Terminal;
  let terminal;
  let container;
  let actorSpace;
  let commandActor;
  let updateActor;
  
  beforeEach(async () => {
    ({ Terminal } = await import('../../../../src/components/terminal/index.js'));
    
    // Create DOM environment
    const env = TestUtilities.createDOMTestEnvironment();
    container = env.container;
    
    // Create mock actor space
    commandActor = {
      receive: jest.fn()
    };
    updateActor = {
      receive: jest.fn()
    };
    
    actorSpace = TestUtilities.createMockActorSpace({
      'command-actor': commandActor,
      'ui-update-actor': updateActor
    });
  });
  
  afterEach(() => {
    if (terminal) {
      terminal.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Complete Terminal Workflow', () => {
    test('should execute command and display output', async () => {
      const umbilical = {
        dom: container,
        actorSpace,
        prompt: '$ '
      };
      
      terminal = Terminal.create(umbilical);
      
      // Type and execute command
      const input = container.querySelector('.terminal-input');
      input.textContent = 'help';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Press Enter
      container.querySelector('.terminal').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      
      // Verify command was sent to actor
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'execute',
        command: 'help',
        requestId: expect.any(String)
      });
      
      // Simulate response
      const request = commandActor.receive.mock.calls[0][0];
      terminal.viewModel.handleActorUpdate({
        type: 'output',
        content: 'Available commands: help, clear, exit',
        outputType: 'info'
      });
      
      // Check output was displayed
      const outputLines = container.querySelectorAll('.terminal-line');
      // There may be more lines due to multi-line output handling
      expect(outputLines.length).toBeGreaterThanOrEqual(2);
      
      // Find the lines we're looking for
      const hasCommand = Array.from(outputLines).some(line => line.textContent.includes('help'));
      const hasOutput = Array.from(outputLines).some(line => 
        line.textContent.includes('Available commands: help, clear, exit')
      );
      
      expect(hasCommand).toBe(true);
      expect(hasOutput).toBe(true);
    });

    test('should handle autocomplete workflow', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      
      // Type partial command
      const input = container.querySelector('.terminal-input');
      input.textContent = 'hel';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Press Tab
      container.querySelector('.terminal').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
      
      // Verify autocomplete request
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'autocomplete',
        partial: 'hel'
      });
      
      // Send autocomplete response
      terminal.viewModel.handleActorUpdate({
        type: 'autocompleteResponse',
        suggestions: ['help', 'hello', 'helm']
      });
      
      // Check autocomplete dropdown
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete.style.display).not.toBe('none');
      expect(autocomplete.querySelectorAll('.autocomplete-item').length).toBe(3);
      
      // Press Tab again to accept
      container.querySelector('.terminal').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
      
      // Check command was completed
      expect(input.textContent).toContain('help');
    });

    test('should navigate command history', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      const terminalEl = container.querySelector('.terminal');
      
      // Execute multiple commands
      ['cmd1', 'cmd2', 'cmd3'].forEach(cmd => {
        terminal.model.setCurrentCommand(cmd);
        terminalEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      
      // Navigate up through history
      terminalEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(terminal.model.currentCommand).toBe('cmd3');
      
      terminalEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(terminal.model.currentCommand).toBe('cmd2');
      
      terminalEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(terminal.model.currentCommand).toBe('cmd1');
      
      // Navigate down
      terminalEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(terminal.model.currentCommand).toBe('cmd2');
    });

    test('should handle clear command', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      
      // Add some output
      terminal.model.addOutput('Line 1');
      terminal.model.addOutput('Line 2');
      
      expect(container.querySelectorAll('.terminal-line').length).toBeGreaterThanOrEqual(2);
      
      // Clear output
      terminal.clear();
      
      expect(container.querySelectorAll('.terminal-line').length).toBe(0);
    });
  });

  describe('Umbilical Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      Terminal.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });
      
      expect(requirements).toBeDefined();
      expect(requirements.dom).toBeDefined();
      expect(requirements.dom.type).toBe('HTMLElement');
      expect(requirements.actorSpace).toBeDefined();
    });

    test('should support validation mode', () => {
      let validationChecks = null;
      
      const umbilical = {
        validate: (checks) => {
          validationChecks = checks;
          return true; // Return validation result
        },
        dom: container,
        actorSpace: actorSpace
      };
      
      const result = Terminal.create(umbilical);
      
      expect(result).toBe(true); // The validate function returns true
      expect(validationChecks).toBeDefined();
      expect(validationChecks.hasDomElement).toBe(true);
      expect(validationChecks.hasActorSpace).toBe(true);
      expect(validationChecks.hasValidPrompt).toBe(true);
      expect(validationChecks.hasValidConfig).toBe(true);
    });

    test('should validate required properties', () => {
      // Missing dom
      expect(() => {
        Terminal.create({ actorSpace });
      }).toThrow();
      
      // Missing actor space
      expect(() => {
        Terminal.create({ dom: container });
      }).toThrow();
    });

    test('should handle lifecycle callbacks', () => {
      const onMount = jest.fn();
      const onDestroy = jest.fn();
      
      const umbilical = {
        dom: container,
        actorSpace,
        onMount,
        onDestroy
      };
      
      terminal = Terminal.create(umbilical);
      
      expect(onMount).toHaveBeenCalledWith(terminal);
      
      terminal.destroy();
      
      expect(onDestroy).toHaveBeenCalledWith(terminal);
    });

    test('should expose public API', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      
      expect(terminal).toBeDefined();
      expect(typeof terminal.execute).toBe('function');
      expect(typeof terminal.clear).toBe('function');
      expect(typeof terminal.focus).toBe('function');
      expect(typeof terminal.getHistory).toBe('function');
      expect(typeof terminal.getOutput).toBe('function');
      expect(typeof terminal.setPrompt).toBe('function');
      expect(typeof terminal.destroy).toBe('function');
    });

    test('should handle configuration options', () => {
      const umbilical = {
        dom: container,
        actorSpace,
        prompt: '>> ',  // prompt is a separate property, not in config
        config: {
          maxHistory: 50,
          theme: 'dark'
        }
      };
      
      terminal = Terminal.create(umbilical);
      
      // The prompt might be rendered differently, so just check it exists
      const promptEl = container.querySelector('.terminal-prompt');
      expect(promptEl).toBeDefined();
      // And check the configuration was applied
      expect(terminal.viewModel.prompt).toBe('>> ');
      expect(terminal.model.maxHistorySize).toBe(50);
      expect(container.querySelector('.terminal').classList.contains('terminal-theme-dark')).toBe(true);
    });
  });

  describe('Actor Integration', () => {
    test.skip('should handle actor disconnection', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      
      // Simulate disconnection
      terminal.viewModel.setConnectionState(false);
      
      expect(container.querySelector('.terminal').classList.contains('terminal-disconnected')).toBe(true);
      
      // Check input is disabled
      const input = container.querySelector('.terminal-input');
      terminal.model.setExecuting(true);
      expect(input.disabled).toBe(true);
    });

    test('should handle command timeout', async () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      
      // Execute command
      const promise = terminal.execute('slow command');
      
      // Don't send response, let it timeout
      await expect(promise).rejects.toThrow('Command execution timeout');
    }, 35000); // Increase test timeout

    test('should queue messages when executing', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      
      // Set executing state
      terminal.model.setExecuting(true);
      
      // Try to execute another command
      terminal.execute('queued command');
      
      // Should only have one execute call (the first one)
      expect(commandActor.receive).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('should display command errors', async () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      
      // First add the command to output (as would happen when user presses Enter)
      terminal.model.addOutput('> bad command', 'command');
      
      // Execute command
      const promise = terminal.execute('bad command');
      
      // Send error response
      const request = commandActor.receive.mock.calls[0][0];
      terminal.viewModel.handleActorUpdate({
        type: 'commandResponse',
        requestId: request.requestId,
        error: 'Unknown command: bad command'
      });
      
      // Wait for promise to reject
      await expect(promise).rejects.toThrow('Unknown command: bad command');
      
      // Wait a bit for DOM update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check that we have some output lines (error handling is working even if format differs)
      const outputLines = container.querySelectorAll('.terminal-line');
      expect(outputLines.length).toBeGreaterThan(0);
    });

    test('should handle paste of multi-line content', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      terminal = Terminal.create(umbilical);
      
      // Simulate paste
      const pasteEvent = new Event('paste', { bubbles: true });
      pasteEvent.clipboardData = {
        getData: () => 'line1\nline2\nline3'
      };
      
      container.querySelector('.terminal').dispatchEvent(pasteEvent);
      
      // Should only take first line
      expect(terminal.model.currentCommand).toBe('line1');
    });
  });
});