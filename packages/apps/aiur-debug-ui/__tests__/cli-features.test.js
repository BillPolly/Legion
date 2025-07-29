/**
 * Tests for CLI Terminal tab cycling and ghost text features
 */

import { jest } from '@jest/globals';
import { CliTerminal } from '../src/client/cli-terminal/components/CliTerminal.js';
import { Autocomplete } from '../src/client/cli-terminal/components/Autocomplete.js';

describe('CLI Terminal Features', () => {
  let terminal;
  let mockContainer;
  let mockAiurConnection;
  
  beforeEach(() => {
    // Create mock DOM
    document.body.innerHTML = '<div id="test-terminal"></div>';
    mockContainer = document.getElementById('test-terminal');
    
    // Mock Aiur connection
    mockAiurConnection = {
      isConnected: () => true,
      sendMessage: jest.fn(),
      sendToolRequest: jest.fn(),
      toolDefinitions: new Map([
        ['module_list', { name: 'module_list', description: 'List modules', inputSchema: { properties: {} } }],
        ['module_load', { 
          name: 'module_load', 
          description: 'Load a module',
          inputSchema: { 
            properties: { name: { type: 'string', description: 'Module name' } },
            required: ['name']
          }
        }],
        ['context_add', {
          name: 'context_add',
          description: 'Add to context',
          inputSchema: {
            properties: {
              name: { type: 'string', description: 'Context name' },
              data: { type: 'object', description: 'Data to store' },
              description: { type: 'string', description: 'Optional description' }
            },
            required: ['name', 'data']
          }
        }]
      ]),
      requestId: 0,
      pendingRequests: new Map()
    };
    
    terminal = new CliTerminal('test-terminal', mockAiurConnection);
  });
  
  describe('Tab Cycling', () => {
    test('should show autocomplete without selection on first tab', () => {
      terminal.elements.input.value = 'mod';
      terminal.currentInput = 'mod';
      
      // Simulate Tab key
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      terminal.handleTabCompletion();
      
      expect(terminal.autocomplete.suggestions.length).toBeGreaterThan(0);
      expect(terminal.autocomplete.selectedIndex).toBe(-1); // No initial selection
    });
    
    test('should cycle through suggestions on subsequent tabs', () => {
      terminal.elements.input.value = 'mod';
      terminal.currentInput = 'mod';
      
      // First tab - show suggestions
      terminal.handleTabCompletion();
      const suggestionCount = terminal.autocomplete.suggestions.length;
      
      // Second tab - select first item
      terminal.handleTabCompletion();
      expect(terminal.autocomplete.selectedIndex).toBe(0);
      
      // Third tab - select second item
      terminal.handleTabCompletion();
      expect(terminal.autocomplete.selectedIndex).toBe(1);
      
      // Cycle through all
      for (let i = 2; i < suggestionCount; i++) {
        terminal.handleTabCompletion();
      }
      expect(terminal.autocomplete.selectedIndex).toBe(suggestionCount - 1);
      
      // Next tab should wrap to no selection
      terminal.handleTabCompletion();
      expect(terminal.autocomplete.selectedIndex).toBe(-1);
      
      // Next tab should wrap to first
      terminal.handleTabCompletion();
      expect(terminal.autocomplete.selectedIndex).toBe(0);
    });
    
    test('should apply suggestion on enter when selected', () => {
      terminal.elements.input.value = 'mod';
      terminal.currentInput = 'mod';
      
      // Show suggestions and select first
      terminal.handleTabCompletion();
      terminal.handleTabCompletion();
      
      // Mock the selected suggestion
      const selected = terminal.autocomplete.getSelected();
      expect(selected).toBeTruthy();
      
      // Apply completion
      terminal.applyCompletion(selected);
      
      expect(terminal.elements.input.value).toContain(selected.text);
    });
  });
  
  describe('Ghost Text', () => {
    test('should show ghost text for commands with parameters', () => {
      terminal.elements.input.value = 'module_load ';
      terminal.currentInput = 'module_load ';
      
      terminal.updateGhostText('module_load ');
      
      expect(terminal.elements.ghostText.textContent).toBe('<name>');
      expect(terminal.elements.ghostText.style.visibility).toBe('visible');
    });
    
    test('should show ghost text even with autocomplete visible', () => {
      terminal.elements.input.value = 'module_load ser';
      terminal.currentInput = 'module_load ser';
      
      // Trigger input handler which shows both autocomplete and ghost text
      terminal.handleInput({ target: { value: 'module_load ser' } });
      
      // Ghost text should still be visible
      expect(terminal.elements.ghostText.style.visibility).toBe('visible');
      expect(terminal.elements.ghostText.textContent).toBe('<name>');
    });
    
    test('should update ghost text for different commands', () => {
      // Test context_add
      terminal.updateGhostText('context_add ');
      expect(terminal.elements.ghostText.textContent).toBe('<name>');
      
      // Test context_list
      terminal.updateGhostText('context_list ');
      expect(terminal.elements.ghostText.textContent).toBe('[filter]');
      
      // Test file_read (from custom hints)
      terminal.updateGhostText('file_read ');
      expect(terminal.elements.ghostText.textContent).toBe('<filepath>');
    });
    
    test('should hide ghost text when input is empty', () => {
      terminal.updateGhostText('');
      expect(terminal.elements.ghostText.style.visibility).toBe('hidden');
    });
    
    test('should position ghost text correctly', () => {
      const input = 'module_load ';
      terminal.elements.input.value = input;
      terminal.currentInput = input;
      
      terminal.showGhostText('<name>', input);
      
      // Check that padding is set (exact value depends on font metrics)
      const paddingLeft = terminal.elements.ghostText.style.paddingLeft;
      expect(paddingLeft).toMatch(/^\d+px$/);
      expect(parseInt(paddingLeft)).toBeGreaterThan(0);
    });
  });
  
  describe('Combined Features', () => {
    test('should transition from autocomplete to ghost text', () => {
      // Type partial command
      terminal.elements.input.value = 'cont';
      terminal.currentInput = 'cont';
      
      // Tab to show suggestions
      terminal.handleTabCompletion();
      expect(terminal.autocomplete.suggestions.length).toBeGreaterThan(0);
      
      // Tab to select context_add
      terminal.handleTabCompletion();
      const selected = terminal.autocomplete.getSelected();
      expect(selected.text).toBe('context_add');
      
      // Apply selection
      terminal.applyCompletion(selected);
      expect(terminal.elements.input.value).toBe('context_add ');
      
      // Ghost text should appear immediately
      terminal.updateGhostText(terminal.elements.input.value);
      expect(terminal.elements.ghostText.textContent).toBe('<name>');
    });
    
    test('should handle typos with ghost text', () => {
      // Typo in command
      terminal.updateGhostText('modul_load ');
      
      // Should still show ghost text based on similar command
      expect(terminal.elements.ghostText.textContent).toBe('<name>');
    });
  });
});

describe('Autocomplete', () => {
  let autocomplete;
  let tools;
  
  beforeEach(() => {
    tools = new Map([
      ['test_command', { name: 'test_command', description: 'Test' }]
    ]);
    
    autocomplete = new Autocomplete(tools, { local: new Map(), context: [] });
    
    // Mock element
    autocomplete.element = document.createElement('div');
  });
  
  test('should wrap around when navigating', () => {
    autocomplete.suggestions = [
      { text: 'item1' },
      { text: 'item2' },
      { text: 'item3' }
    ];
    
    // Start at -1 (no selection)
    expect(autocomplete.selectedIndex).toBe(-1);
    
    // Navigate forward
    autocomplete.navigate(1);
    expect(autocomplete.selectedIndex).toBe(0);
    
    autocomplete.navigate(1);
    expect(autocomplete.selectedIndex).toBe(1);
    
    autocomplete.navigate(1);
    expect(autocomplete.selectedIndex).toBe(2);
    
    // Wrap to no selection
    autocomplete.navigate(1);
    expect(autocomplete.selectedIndex).toBe(-1);
    
    // Wrap to first
    autocomplete.navigate(1);
    expect(autocomplete.selectedIndex).toBe(0);
    
    // Navigate backward from no selection
    autocomplete.selectedIndex = -1;
    autocomplete.navigate(-1);
    expect(autocomplete.selectedIndex).toBe(2); // Wrap to end
  });
});