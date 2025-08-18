/**
 * Unit tests for tool sufficiency judgment
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { PlanSynthesizer } from '../../src/core/PlanSynthesizer.js';
import { MockToolDiscovery } from '../mocks/MockToolDiscovery.js';
import { ContextHints } from '../../src/core/ContextHints.js';

describe('Tool Sufficiency Judgment', () => {
  let synthesizer;
  let mockLLMClient;
  
  beforeAll(() => {
    // Create a mock LLM client that returns predictable judgments
    mockLLMClient = {
      generateResponse: async (options) => {
        console.log('[Mock LLM] Called!');
        const prompt = options.messages[0].content;
        
        // Parse the task from the prompt
        const taskMatch = prompt.match(/Task: ([^\n]+)/);
        const task = taskMatch ? taskMatch[1] : '';
        
        // Parse available tools
        const toolsMatch = prompt.match(/Available Tools:\n([\s\S]*?)\n\nQuestion:/);
        const toolsList = toolsMatch ? toolsMatch[1] : '';
        
        // Simple heuristic judgment
        if (task.includes('calculate') && toolsList.includes('calculator')) {
          return {
            content: JSON.stringify({
              sufficient: true,
              reason: 'Calculator tool available for calculation task',
              missing: []
            })
          };
        }
        
        if (task.includes('read') && task.includes('file') && toolsList.includes('file_read')) {
          return {
            content: JSON.stringify({
              sufficient: true,
              reason: 'File read tool available for file reading task',
              missing: []
            })
          };
        }
        
        if (task.includes('parse') && task.includes('JSON') && !toolsList.includes('json_parse')) {
          return {
            content: JSON.stringify({
              sufficient: false,
              reason: 'JSON parsing required but json_parse tool not available',
              missing: ['json_parse']
            })
          };
        }
        
        // Default response
        return {
          content: JSON.stringify({
            sufficient: false,
            reason: 'Required tools not available',
            missing: ['appropriate tools']
          })
        };
      }
    };
    
    // Create synthesizer with mock LLM
    synthesizer = new PlanSynthesizer({
      llmClient: mockLLMClient,
      toolDiscovery: null, // Not needed for this test
      contextHints: new ContextHints()
    });
  });
  
  describe('_judgeToolSufficiency', () => {
    it('should judge calculator tool as sufficient for calculation task', async () => {
      const node = {
        id: 'calc-task',
        description: 'Calculate the sum of two numbers'
      };
      
      const tools = [
        { name: 'calculator', description: 'Perform calculations' }
      ];
      
      const hints = {
        suggestedInputs: ['number1', 'number2'],
        suggestedOutputs: ['result']
      };
      
      const judgment = await synthesizer._judgeToolSufficiency(node, tools, hints);
      
      expect(judgment).toBeDefined();
      expect(judgment.sufficient).toBe(true);
      expect(judgment.reason).toContain('Calculator tool available');
      expect(judgment.missing).toHaveLength(0);
    });
    
    it('should judge file_read tool as sufficient for file reading task', async () => {
      const node = {
        id: 'read-task',
        description: 'Read contents from file'
      };
      
      const tools = [
        { name: 'file_read', description: 'Read file contents' }
      ];
      
      const hints = {
        suggestedInputs: ['file_path'],
        suggestedOutputs: ['content']
      };
      
      const judgment = await synthesizer._judgeToolSufficiency(node, tools, hints);
      
      expect(judgment).toBeDefined();
      expect(judgment.sufficient).toBe(true);
      expect(judgment.reason).toContain('File read tool available');
    });
    
    it('should judge tools as insufficient when json_parse is missing', async () => {
      const node = {
        id: 'parse-task',
        description: 'Parse JSON string to object'
      };
      
      const tools = [
        { name: 'file_read', description: 'Read file contents' }
      ];
      
      const hints = {
        suggestedInputs: ['json_string'],
        suggestedOutputs: ['object']
      };
      
      const judgment = await synthesizer._judgeToolSufficiency(node, tools, hints);
      
      expect(judgment).toBeDefined();
      expect(judgment.sufficient).toBe(false);
      expect(judgment.reason).toContain('JSON parsing required');
      expect(judgment.missing).toContain('json_parse');
    });
    
    it('should handle empty tools array', async () => {
      const node = {
        id: 'any-task',
        description: 'Do something'
      };
      
      const tools = [];
      const hints = {};
      
      const judgment = await synthesizer._judgeToolSufficiency(node, tools, hints);
      
      expect(judgment).toBeDefined();
      expect(judgment.sufficient).toBe(false);
      expect(judgment.reason).toBeDefined();
      expect(judgment.missing.length).toBeGreaterThan(0);
    });
    
    it('should use heuristic fallback when LLM fails', async () => {
      // Create synthesizer with failing LLM
      const failingLLM = {
        generateResponse: async () => {
          throw new Error('LLM service unavailable');
        }
      };
      
      const synthesizerWithFailingLLM = new PlanSynthesizer({
        llmClient: failingLLM,
        toolDiscovery: null,
        contextHints: new ContextHints()
      });
      
      const node = {
        id: 'calc-task',
        description: 'Calculate something'
      };
      
      const tools = [
        { name: 'file_read', description: 'Read files' }
      ];
      
      const hints = {};
      
      // Should fall back to heuristic
      const judgment = await synthesizerWithFailingLLM._judgeToolSufficiency(node, tools, hints);
      
      expect(judgment).toBeDefined();
      expect(judgment.sufficient).toBe(false);
      expect(judgment.reason).toContain('calculator tool not available');
      expect(judgment.missing).toContain('calculator');
    });
  });
});