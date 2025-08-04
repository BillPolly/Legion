/**
 * Unit tests for TerminalActor
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TerminalActor } from '../../src/actors/TerminalActor.js';

describe('TerminalActor', () => {
  let terminalActor;
  let mockTerminal;
  let mockRemoteAgent;
  
  beforeEach(() => {
    // Create mock terminal UI
    mockTerminal = {
      addOutput: jest.fn(),
      clear: jest.fn(),
      updateToolDefinitions: jest.fn()
    };
    
    // Create mock remote agent
    mockRemoteAgent = {
      receive: jest.fn()
    };
    
    terminalActor = new TerminalActor(mockTerminal);
  });
  
  describe('initialization', () => {
    test('should initialize with terminal reference', () => {
      expect(terminalActor.terminal).toBe(mockTerminal);
      expect(terminalActor.connected).toBe(false);
      expect(terminalActor.remoteAgent).toBeNull();
    });
    
    test('should set remote agent and trigger session creation', () => {
      terminalActor.setRemoteAgent(mockRemoteAgent);
      
      expect(terminalActor.remoteAgent).toBe(mockRemoteAgent);
      expect(terminalActor.connected).toBe(true);
      expect(mockTerminal.addOutput).toHaveBeenCalledWith('Connected to terminal agent', 'success');
      expect(mockRemoteAgent.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_create',
          requestId: expect.stringMatching(/^req_\d+$/)
        })
      );
    });
  });
  
  describe('command sending', () => {
    beforeEach(() => {
      terminalActor.setRemoteAgent(mockRemoteAgent);
      mockRemoteAgent.receive.mockClear();
    });
    
    test('should send tools_list command', () => {
      terminalActor.sendCommand('tools');
      
      expect(mockRemoteAgent.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tools_list',
          requestId: expect.stringMatching(/^req_\d+$/)
        })
      );
    });
    
    test('should send module_list command', () => {
      terminalActor.sendCommand('modules');
      
      expect(mockRemoteAgent.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'module_list',
          requestId: expect.stringMatching(/^req_\d+$/)
        })
      );
    });
    
    test('should send module_load command with module name', () => {
      terminalActor.sendCommand('module_load file');
      
      expect(mockRemoteAgent.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'module_load',
          requestId: expect.stringMatching(/^req_\d+$/),
          moduleName: 'file'
        })
      );
    });
    
    test('should show error for module_load without module name', () => {
      terminalActor.sendCommand('module_load');
      
      expect(mockRemoteAgent.receive).not.toHaveBeenCalled();
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Usage: module_load <module_name>',
        'error'
      );
    });
    
    test('should send tool_request for unknown commands', () => {
      terminalActor.sendCommand('file_read path=/test.txt');
      
      expect(mockRemoteAgent.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_request',
          requestId: expect.stringMatching(/^req_\d+$/),
          tool: 'file_read',
          arguments: expect.objectContaining({
            path: '/test.txt'
          })
        })
      );
    });
    
    test('should parse tool arguments correctly', () => {
      terminalActor.sendCommand('some_tool key1=value1 key2=value2 arg3');
      
      const call = mockRemoteAgent.receive.mock.calls[0][0];
      expect(call.tool).toBe('some_tool');
      expect(call.arguments).toEqual({
        key1: 'value1',
        key2: 'value2',
        arg2: 'arg3'
      });
    });
    
    test('should show error when not connected', () => {
      terminalActor.remoteAgent = null;
      terminalActor.connected = false;
      
      terminalActor.sendCommand('tools');
      
      expect(mockRemoteAgent.receive).not.toHaveBeenCalled();
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Not connected to terminal agent',
        'error'
      );
    });
  });
  
  describe('message receiving', () => {
    beforeEach(() => {
      terminalActor.setRemoteAgent(mockRemoteAgent);
      mockTerminal.addOutput.mockClear();
    });
    
    test('should handle session_created message', () => {
      terminalActor.receive({
        type: 'session_created',
        sessionId: 'test-session-123',
        success: true
      });
      
      expect(terminalActor.sessionId).toBe('test-session-123');
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Session created: test-session-123',
        'success'
      );
    });
    
    test('should handle initial_tools message', () => {
      const tools = [
        { name: 'tool1', description: 'Test tool 1' },
        { name: 'tool2', description: 'Test tool 2' }
      ];
      
      terminalActor.receive({
        type: 'initial_tools',
        tools
      });
      
      expect(terminalActor.toolDefinitions.size).toBe(2);
      expect(terminalActor.toolDefinitions.get('tool1')).toEqual(tools[0]);
      expect(mockTerminal.updateToolDefinitions).toHaveBeenCalledWith(
        terminalActor.toolDefinitions
      );
    });
    
    test('should handle tool_response message', () => {
      terminalActor.receive({
        type: 'tool_response',
        requestId: 'req_123',
        tool: 'file_read',
        result: {
          content: 'File contents',
          filepath: '/test.txt'
        }
      });
      
      // Should format and display the result
      expect(mockTerminal.addOutput).toHaveBeenCalled();
    });
    
    test('should handle tool_error message', () => {
      terminalActor.receive({
        type: 'tool_error',
        requestId: 'req_123',
        tool: 'file_read',
        error: 'File not found'
      });
      
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Tool error: File not found',
        'error'
      );
    });
    
    test('should handle module_loaded message', () => {
      terminalActor.receive({
        type: 'module_loaded',
        requestId: 'req_123',
        moduleName: 'file',
        message: 'Module file loaded',
        toolsLoaded: ['file_read', 'file_write']
      });
      
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Module file loaded',
        'success'
      );
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Added 2 tools',
        'info'
      );
    });
    
    test('should handle module_error message', () => {
      terminalActor.receive({
        type: 'module_error',
        requestId: 'req_123',
        moduleName: 'unknown',
        error: 'Module not found'
      });
      
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Module error: Module not found',
        'error'
      );
    });
    
    test('should handle session_error message', () => {
      terminalActor.receive({
        type: 'session_error',
        requestId: 'req_123',
        error: 'Session expired'
      });
      
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Session error: Session expired',
        'error'
      );
    });
    
    test('should handle pong message silently', () => {
      terminalActor.receive({
        type: 'pong',
        timestamp: Date.now()
      });
      
      // Should not output anything for pong
      expect(mockTerminal.addOutput).not.toHaveBeenCalled();
    });
    
    test('should handle unknown message types', () => {
      terminalActor.receive({
        type: 'unknown_type',
        data: 'some data'
      });
      
      // Should display the raw message
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        expect.stringContaining('unknown_type'),
        'info'
      );
    });
  });
  
  describe('tool definitions', () => {
    beforeEach(() => {
      terminalActor.setRemoteAgent(mockRemoteAgent);
    });
    
    test('should update tool definitions', () => {
      const tools = [
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Tool 2', inputSchema: {} }
      ];
      
      terminalActor.updateToolDefinitions(tools);
      
      expect(terminalActor.toolDefinitions.size).toBe(2);
      expect(mockTerminal.updateToolDefinitions).toHaveBeenCalledWith(
        terminalActor.toolDefinitions
      );
    });
    
    test('should handle invalid tools array', () => {
      terminalActor.updateToolDefinitions(null);
      
      expect(terminalActor.toolDefinitions.size).toBe(0);
      expect(mockTerminal.updateToolDefinitions).not.toHaveBeenCalled();
    });
    
    test('should clear and rebuild tool definitions', () => {
      // Add initial tools
      terminalActor.updateToolDefinitions([
        { name: 'old_tool', description: 'Old tool' }
      ]);
      expect(terminalActor.toolDefinitions.size).toBe(1);
      
      // Update with new tools
      terminalActor.updateToolDefinitions([
        { name: 'new_tool', description: 'New tool' }
      ]);
      
      expect(terminalActor.toolDefinitions.size).toBe(1);
      expect(terminalActor.toolDefinitions.has('old_tool')).toBe(false);
      expect(terminalActor.toolDefinitions.has('new_tool')).toBe(true);
    });
  });
  
  describe('disconnection', () => {
    beforeEach(() => {
      terminalActor.setRemoteAgent(mockRemoteAgent);
      mockTerminal.addOutput.mockClear();
    });
    
    test('should handle disconnection', () => {
      terminalActor.disconnect();
      
      expect(terminalActor.remoteAgent).toBeNull();
      expect(terminalActor.connected).toBe(false);
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Disconnected from terminal agent',
        'warning'
      );
    });
  });
});