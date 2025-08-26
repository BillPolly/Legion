/**
 * Quick test to debug what prompt is being generated
 */

import { Prompt } from '@legion/planner';

describe('Quick Prompt Debug', () => {
  test('should show what inputs are being formatted', () => {
    const prompt = new Prompt();
    
    // Create mock tools with the actual schemas
    const tools = [
      {
        name: 'directory_create',
        description: 'Create a new directory',
        inputSchema: {
          type: 'object',
          properties: {
            dirpath: {
              type: 'string',
              description: 'The path where the directory should be created'
            }
          },
          required: ['dirpath']
        }
      },
      {
        name: 'search_logs',
        description: 'Search logs',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string'
            }
          },
          required: ['query']
        }
      }
    ];
    
    // Get the initial prompt
    const fullPrompt = prompt.getInitialPrompt('Create a directory and search logs', tools);
    
    // Extract just the tools section
    const toolsMatch = fullPrompt.match(/## Available Tools[\s\S]*?## Requirements/);
    if (toolsMatch) {
      console.log('\n=== TOOLS SECTION IN PROMPT ===\n');
      console.log(toolsMatch[0]);
    }
    
    // Also check if the prompt contains the correct parameter names
    console.log('\n=== CHECKING PARAMETER NAMES ===');
    console.log('Contains "dirpath"?', fullPrompt.includes('dirpath'));
    console.log('Contains "path" (wrong)?', fullPrompt.includes('"path"'));
    console.log('Contains "query"?', fullPrompt.includes('query'));
    console.log('Contains "pattern" (wrong)?', fullPrompt.includes('"pattern"'));
  });
});