/**
 * Unit tests for Error Handling utilities
 */

import { describe, it, expect } from '@jest/globals';
import { 
  AgentError, 
  ConfigurationError, 
  CapabilityError, 
  StateError,
  KnowledgeGraphError,
  BehaviorTreeError,
  LLMError,
  createError,
  isAgentError,
  formatErrorMessage
} from '../../src/utils/ErrorHandling.js';

describe('ErrorHandling', () => {
  describe('AgentError', () => {
    it('should create a basic AgentError', () => {
      const error = new AgentError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AgentError');
      expect(error.code).toBe('AGENT_ERROR');
    });

    it('should create AgentError with custom code and context', () => {
      const context = { agentId: 'test-agent', operation: 'receive' };
      const error = new AgentError('Operation failed', 'OPERATION_FAILED', context);
      
      expect(error.message).toBe('Operation failed');
      expect(error.code).toBe('OPERATION_FAILED');
      expect(error.context).toEqual(context);
    });

    it('should capture stack trace', () => {
      const error = new AgentError('Stack test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AgentError');
      expect(error.stack).toContain('Stack test');
    });
  });

  describe('ConfigurationError', () => {
    it('should create ConfigurationError with validation errors', () => {
      const validationErrors = ['Missing field: agent.id', 'Invalid type: agent.type'];
      const error = new ConfigurationError('Invalid configuration', validationErrors);
      
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.message).toBe('Invalid configuration');
      expect(error.context.validationErrors).toEqual(validationErrors);
    });

    it('should handle missing validation errors', () => {
      const error = new ConfigurationError('Config error');
      expect(error.context.validationErrors).toEqual([]);
    });
  });

  describe('CapabilityError', () => {
    it('should create CapabilityError with module and tool info', () => {
      const error = new CapabilityError('Tool not found', 'file', 'file_read');
      
      expect(error).toBeInstanceOf(CapabilityError);
      expect(error.name).toBe('CapabilityError');
      expect(error.code).toBe('CAPABILITY_ERROR');
      expect(error.context.module).toBe('file');
      expect(error.context.tool).toBe('file_read');
    });

    it('should handle permission errors', () => {
      const error = new CapabilityError(
        'Permission denied',
        'file',
        'file_write',
        { path: '/restricted/file.txt', permission: 'write' }
      );
      
      expect(error.context.module).toBe('file');
      expect(error.context.tool).toBe('file_write');
      expect(error.context.details).toEqual({ 
        path: '/restricted/file.txt', 
        permission: 'write' 
      });
    });
  });

  describe('StateError', () => {
    it('should create StateError with state key', () => {
      const error = new StateError('State update failed', 'conversationHistory');
      
      expect(error).toBeInstanceOf(StateError);
      expect(error.name).toBe('StateError');
      expect(error.code).toBe('STATE_ERROR');
      expect(error.context.stateKey).toBe('conversationHistory');
    });

    it('should handle state persistence errors', () => {
      const error = new StateError(
        'Failed to persist state',
        'contextVariables',
        { operation: 'save', storage: 'mongodb' }
      );
      
      expect(error.context.stateKey).toBe('contextVariables');
      expect(error.context.details).toEqual({
        operation: 'save',
        storage: 'mongodb'
      });
    });
  });

  describe('KnowledgeGraphError', () => {
    it('should create KnowledgeGraphError with operation', () => {
      const error = new KnowledgeGraphError('Query failed', 'query');
      
      expect(error).toBeInstanceOf(KnowledgeGraphError);
      expect(error.name).toBe('KnowledgeGraphError');
      expect(error.code).toBe('KG_ERROR');
      expect(error.context.operation).toBe('query');
    });

    it('should handle node and relationship errors', () => {
      const error = new KnowledgeGraphError(
        'Failed to create relationship',
        'createRelationship',
        { from: 'node1', to: 'node2', type: 'DEPENDS_ON' }
      );
      
      expect(error.context.operation).toBe('createRelationship');
      expect(error.context.details).toEqual({
        from: 'node1',
        to: 'node2',
        type: 'DEPENDS_ON'
      });
    });
  });

  describe('BehaviorTreeError', () => {
    it('should create BehaviorTreeError with node info', () => {
      const error = new BehaviorTreeError('Node execution failed', 'action-1', 'action');
      
      expect(error).toBeInstanceOf(BehaviorTreeError);
      expect(error.name).toBe('BehaviorTreeError');
      expect(error.code).toBe('BT_ERROR');
      expect(error.context.nodeId).toBe('action-1');
      expect(error.context.nodeType).toBe('action');
    });

    it('should handle tree execution errors', () => {
      const error = new BehaviorTreeError(
        'Tree execution timeout',
        'root',
        'sequence',
        { timeout: 30000, elapsed: 30500 }
      );
      
      expect(error.context.nodeId).toBe('root');
      expect(error.context.nodeType).toBe('sequence');
      expect(error.context.details).toEqual({
        timeout: 30000,
        elapsed: 30500
      });
    });
  });

  describe('LLMError', () => {
    it('should create LLMError with provider and model', () => {
      const error = new LLMError('API call failed', 'anthropic', 'claude-3-5-sonnet-20241022');
      
      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('LLMError');
      expect(error.code).toBe('LLM_ERROR');
      expect(error.context.provider).toBe('anthropic');
      expect(error.context.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should handle rate limit errors', () => {
      const error = new LLMError(
        'Rate limit exceeded',
        'openai',
        'gpt-4',
        { 
          statusCode: 429, 
          retryAfter: 60,
          tokensUsed: 4096
        }
      );
      
      expect(error.context.provider).toBe('openai');
      expect(error.context.model).toBe('gpt-4');
      expect(error.context.details).toEqual({
        statusCode: 429,
        retryAfter: 60,
        tokensUsed: 4096
      });
    });
  });

  describe('createError', () => {
    it('should create appropriate error based on type', () => {
      const configError = createError('configuration', 'Invalid config');
      expect(configError).toBeInstanceOf(ConfigurationError);
      
      const capError = createError('capability', 'Tool not found');
      expect(capError).toBeInstanceOf(CapabilityError);
      
      const stateError = createError('state', 'State error');
      expect(stateError).toBeInstanceOf(StateError);
      
      const kgError = createError('knowledge', 'KG error');
      expect(kgError).toBeInstanceOf(KnowledgeGraphError);
      
      const btError = createError('behaviortree', 'BT error');
      expect(btError).toBeInstanceOf(BehaviorTreeError);
      
      const llmError = createError('llm', 'LLM error');
      expect(llmError).toBeInstanceOf(LLMError);
    });

    it('should create generic AgentError for unknown type', () => {
      const error = createError('unknown', 'Unknown error');
      expect(error).toBeInstanceOf(AgentError);
      expect(error.code).toBe('AGENT_ERROR');
    });

    it('should pass context to created errors', () => {
      const error = createError('configuration', 'Config error', {
        validationErrors: ['error1', 'error2']
      });
      
      expect(error.context.validationErrors).toEqual(['error1', 'error2']);
    });
  });

  describe('isAgentError', () => {
    it('should identify AgentError instances', () => {
      const agentError = new AgentError('Test');
      const configError = new ConfigurationError('Test');
      const genericError = new Error('Test');
      
      expect(isAgentError(agentError)).toBe(true);
      expect(isAgentError(configError)).toBe(true);
      expect(isAgentError(genericError)).toBe(false);
      expect(isAgentError(null)).toBe(false);
      expect(isAgentError(undefined)).toBe(false);
      expect(isAgentError('string')).toBe(false);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format AgentError with context', () => {
      const error = new CapabilityError('Tool not found', 'file', 'file_read');
      const formatted = formatErrorMessage(error);
      
      expect(formatted).toContain('CapabilityError');
      expect(formatted).toContain('CAPABILITY_ERROR');
      expect(formatted).toContain('Tool not found');
      expect(formatted).toContain('module: file');
      expect(formatted).toContain('tool: file_read');
    });

    it('should format generic Error', () => {
      const error = new Error('Generic error');
      const formatted = formatErrorMessage(error);
      
      expect(formatted).toContain('Error');
      expect(formatted).toContain('Generic error');
    });

    it('should handle non-error values', () => {
      expect(formatErrorMessage('string error')).toBe('string error');
      expect(formatErrorMessage(null)).toBe('Unknown error');
      expect(formatErrorMessage(undefined)).toBe('Unknown error');
      expect(formatErrorMessage({ message: 'Object error' })).toContain('Object error');
    });

    it('should include stack trace when requested', () => {
      const error = new AgentError('Test error');
      const formatted = formatErrorMessage(error, true);
      
      expect(formatted).toContain('Stack:');
      expect(formatted).toContain('at ');
    });
  });
});