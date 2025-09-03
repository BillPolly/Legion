/**
 * SlashCommandAgent Tests
 * 
 * Tests slash command execution with real chat context access.
 * Follows fail-fast principles with no mocks - uses real dependencies.
 */

import { SlashCommandAgent } from '../SlashCommandAgent.js';
import { ToolUsingChatAgent } from '../ToolUsingChatAgent.js';
import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('SlashCommandAgent - Real Integration Tests', () => {
  let slashCommandAgent;
  let mockChatAgent;
  let realToolRegistry;
  let realLLMClient;
  
  beforeAll(async () => {
    // Get real dependencies - no mocks!
    realToolRegistry = await getToolRegistry();
    expect(realToolRegistry).toBeDefined();

    const resourceManager = await ResourceManager.getInstance();
    realLLMClient = await resourceManager.get('llmClient');
    expect(realLLMClient).toBeDefined();
    
    console.log('✅ Real dependencies loaded for slash command tests');
  });

  beforeEach(async () => {
    // Create real slash command agent
    slashCommandAgent = new SlashCommandAgent(
      realToolRegistry,
      realLLMClient,
      (eventType, data) => {
        console.log(`[Test Event] ${eventType}:`, data);
      }
    );

    // Create mock chat agent with realistic context
    mockChatAgent = {
      chatHistory: [
        {
          role: 'user',
          content: 'Calculate 2 + 2',
          timestamp: Date.now() - 60000
        },
        {
          role: 'agent', 
          content: 'The result is 4.',
          timestamp: Date.now() - 30000
        }
      ],
      executionContext: {
        artifacts: {
          calculation_result: 4,
          user_name: 'TestUser',
          session_data: { count: 5, active: true }
        }
      },
      operationHistory: [
        {
          tool: 'calculator',
          inputs: { expression: '2 + 2' },
          outputs: { result: 4 },
          outputVariable: 'calculation_result',
          timestamp: Date.now() - 45000,
          success: true
        },
        {
          tool: 'data_store',
          inputs: { key: 'user_name', value: 'TestUser' },
          outputs: { stored: true },
          outputVariable: 'user_name',
          timestamp: Date.now() - 30000,
          success: true
        }
      ],
      llmInteractions: [
        {
          id: 'llm-1',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          purpose: 'tool-need-analysis',
          success: true
        },
        {
          id: 'llm-2', 
          timestamp: new Date(Date.now() - 30000).toISOString(),
          purpose: 'tool-sequence-planning',
          success: true
        }
      ],
      clearContext: jest.fn(() => {
        mockChatAgent.chatHistory = [];
        mockChatAgent.executionContext.artifacts = {};
        mockChatAgent.operationHistory = [];
      })
    };
  });

  describe('Command Recognition and Routing', () => {
    test('identifies slash commands correctly', () => {
      expect(slashCommandAgent.isSlashCommand('/help')).toBe(true);
      expect(slashCommandAgent.isSlashCommand('/context')).toBe(true);
      expect(slashCommandAgent.isSlashCommand('regular message')).toBe(false);
      expect(slashCommandAgent.isSlashCommand('')).toBe(false);
    });

    test('rejects non-slash commands', async () => {
      await expect(
        slashCommandAgent.processSlashCommand('regular message', mockChatAgent)
      ).rejects.toThrow('Input is not a slash command');
    });
  });

  describe('/help Command', () => {
    test('shows general help', async () => {
      const result = await slashCommandAgent.processSlashCommand('/help', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Available Slash Commands');
      expect(result.text).toContain('Core Commands');
      expect(result.text).toContain('Debug Commands');
      expect(result.text).toContain('Session Commands');
      expect(result.text).toContain('/help');
      expect(result.text).toContain('/context');
      expect(result.text).toContain('/clear');
      expect(result.command).toBe('help');
    });

    test('shows specific command help', async () => {
      const result = await slashCommandAgent.processSlashCommand('/help context', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('/context');
      expect(result.text).toContain('Display current execution context');
      expect(result.text).toContain('Usage:');
    });

    test('handles unknown command help request', async () => {
      const result = await slashCommandAgent.processSlashCommand('/help unknown', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Unknown command: /unknown');
      expect(result.text).toContain('Use /help to see available commands');
    });
  });

  describe('/context Command', () => {
    test('shows current context with variables', async () => {
      const result = await slashCommandAgent.processSlashCommand('/context', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Current Context Variables');
      expect(result.text).toContain('calculation_result');
      expect(result.text).toContain('user_name');
      expect(result.text).toContain('session_data');
      expect(result.text).toContain('Context Statistics');
      expect(result.text).toContain('Variables: 3');
      expect(result.text).toContain('Chat history: 2');
      expect(result.text).toContain('Operations: 2');
    });

    test('handles empty context', async () => {
      mockChatAgent.executionContext.artifacts = {};
      mockChatAgent.chatHistory = [];
      mockChatAgent.operationHistory = [];

      const result = await slashCommandAgent.processSlashCommand('/context', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Current Context:**');
      expect(result.text).toContain('No variables or artifacts stored');
    });
  });

  describe('/clear Command', () => {
    test('clears context successfully', async () => {
      const result = await slashCommandAgent.processSlashCommand('/clear', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Context Cleared Successfully');
      expect(result.text).toContain('Variables: 3'); // Before clearing
      expect(result.text).toContain('Chat messages: 2');
      expect(result.text).toContain('Operations: 2');
      
      // Verify clearContext was called
      expect(mockChatAgent.clearContext).toHaveBeenCalled();
    });
  });

  describe('/debug Command', () => {
    test('shows complete debug information', async () => {
      const result = await slashCommandAgent.processSlashCommand('/debug', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Complete Debug Information');
      expect(result.text).toContain('Context Summary');
      expect(result.text).toContain('Variables: 3');
      expect(result.text).toContain('Chat messages: 2');
      expect(result.text).toContain('Recent Activities');
    });

    test('shows LLM debug information', async () => {
      const result = await slashCommandAgent.processSlashCommand('/debug llm', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('LLM Debug Information');
      expect(result.text).toContain('tool-need-analysis');
      expect(result.text).toContain('tool-sequence-planning');
    });

    test('shows operation debug information', async () => {
      const result = await slashCommandAgent.processSlashCommand('/debug operations', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Recent Operations');
      expect(result.text).toContain('calculator');
      expect(result.text).toContain('data_store');
    });
  });

  describe('/history Command', () => {
    test('shows operation history with default count', async () => {
      const result = await slashCommandAgent.processSlashCommand('/history', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Recent Operations (last 2)');
      expect(result.text).toContain('calculator');
      expect(result.text).toContain('data_store');
      expect(result.text).toContain('✅'); // Success indicators
    });

    test('shows operation history with custom count', async () => {
      const result = await slashCommandAgent.processSlashCommand('/history 1', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Recent Operations (last 1)');
      expect(result.text).toContain('data_store'); // Most recent
    });

    test('handles empty operation history', async () => {
      mockChatAgent.operationHistory = [];
      const result = await slashCommandAgent.processSlashCommand('/history', mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Operation History:**');
      expect(result.text).toContain('No operations have been performed yet');
    });
  });

  describe('Session Management', () => {
    const testSessionName = `test-session-${Date.now()}`;
    const invalidSessionName = 'test/invalid';
    
    afterEach(async () => {
      // Clean up test session files
      try {
        const sessionPath = path.join(process.cwd(), 'saved-sessions', `${testSessionName}.json`);
        await fs.unlink(sessionPath);
      } catch {
        // Ignore if file doesn't exist
      }
    });

    test('/save command saves session successfully', async () => {
      const result = await slashCommandAgent.processSlashCommand(`/save ${testSessionName}`, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain(`Session Saved: ${testSessionName}`);
      expect(result.text).toContain('Chat messages: 2');
      expect(result.text).toContain('Variables: 3');
      expect(result.text).toContain('Operations: 2');
      expect(result.text).toContain(`/load ${testSessionName}`);
      
      // Verify file was created
      const sessionPath = path.join(process.cwd(), 'saved-sessions', `${testSessionName}.json`);
      const sessionExists = await fs.access(sessionPath).then(() => true).catch(() => false);
      expect(sessionExists).toBe(true);
    });

    test('/save command validates session name', async () => {
      const result = await slashCommandAgent.processSlashCommand(`/save ${invalidSessionName}`, mockChatAgent);
      
      expect(result.success).toBe(false);
      expect(result.text).toContain('Session name can only contain letters, numbers, underscores and dashes');
    });

    test('/load command loads session successfully', async () => {
      // First save a session
      await slashCommandAgent.processSlashCommand(`/save ${testSessionName}`, mockChatAgent);
      
      // Clear current context to verify load works
      mockChatAgent.chatHistory = [];
      mockChatAgent.executionContext.artifacts = {};
      mockChatAgent.operationHistory = [];
      
      // Load the session
      const result = await slashCommandAgent.processSlashCommand(`/load ${testSessionName}`, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain(`Session Loaded: ${testSessionName}`);
      expect(result.text).toContain('Messages: 2');
      expect(result.text).toContain('Variables: 3');
      expect(result.text).toContain('Operations: 2');
      expect(result.text).toContain('Session restored successfully');
      
      // Verify context was restored
      expect(mockChatAgent.chatHistory.length).toBe(2);
      expect(Object.keys(mockChatAgent.executionContext.artifacts).length).toBe(3);
      expect(mockChatAgent.operationHistory.length).toBe(2);
    });

    test('/load command handles missing session', async () => {
      const result = await slashCommandAgent.processSlashCommand('/load nonexistent', mockChatAgent);
      
      expect(result.success).toBe(false);
      expect(result.text).toContain("Session 'nonexistent' not found");
      expect(result.text).toContain('Available sessions:');
    });
  });

  describe('Error Handling', () => {
    test('handles invalid command syntax', async () => {
      const result = await slashCommandAgent.processSlashCommand('/save', mockChatAgent);
      
      expect(result.success).toBe(false);
      expect(result.text).toContain('Missing required arguments');
      expect(result.usage).toBe('/save <name>');
    });

    test('handles command with extra arguments', async () => {
      const result = await slashCommandAgent.processSlashCommand('/clear extra args', mockChatAgent);
      
      expect(result.success).toBe(false);
      expect(result.text).toContain('Unexpected arguments: extra args');
    });

    test('handles unknown command', async () => {
      const result = await slashCommandAgent.processSlashCommand('/unknown', mockChatAgent);
      
      expect(result.success).toBe(false);
      expect(result.text).toContain('Unknown command: /unknown');
      expect(result.text).toContain('Use /help to see available commands');
    });
  });

  describe('Context Access Validation', () => {
    test('has full access to chat agent context', async () => {
      // Test that slash command agent can access all expected context
      const result = await slashCommandAgent.processSlashCommand('/context', mockChatAgent);
      
      expect(result.success).toBe(true);
      
      // Verify access to execution context
      expect(result.text).toContain('calculation_result');
      expect(result.text).toContain('TestUser');
      
      // Verify access to operation history
      const historyResult = await slashCommandAgent.processSlashCommand('/history', mockChatAgent);
      expect(historyResult.text).toContain('calculator');
      expect(historyResult.text).toContain('data_store');
      
      console.log('✅ Slash command agent has full context access');
    });
  });
});