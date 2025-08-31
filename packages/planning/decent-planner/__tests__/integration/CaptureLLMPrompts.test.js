/**
 * Test to capture actual LLM prompts and responses for behavior tree generation
 */

import { ResourceManager } from '@legion/resource-manager';
import { DecentPlanner } from '../../src/DecentPlanner.js';
import fs from 'fs';

describe('Capture LLM Prompts', () => {
  let decentPlanner;
  let llmInteractions = [];
  
  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    decentPlanner = new DecentPlanner({
      maxDepth: 5,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true,
      validateBehaviorTrees: true,
      logLevel: 'info'
    });
    await decentPlanner.initialize();
    
    // Capture LLM interactions
    const llmClient = decentPlanner.dependencies.llmClient;
    llmClient.on('interaction', (event) => {
      llmInteractions.push(event);
      console.log(`LLM ${event.type}: ${event.id}`);
    });
  }, 30000);

  test('capture behavior tree generation prompt and response', async () => {
    console.log('=== CAPTURING LLM PROMPTS FOR BEHAVIOR TREE GENERATION ===');
    
    llmInteractions = [];
    
    const result = await decentPlanner.plan("write hello world program in javascript", {});
    
    console.log('Planning success:', result.success);
    console.log('LLM interactions captured:', llmInteractions.length);
    
    let logOutput = '=== LLM INTERACTIONS ===\n\n';
    
    for (let i = 0; i < llmInteractions.length; i++) {
      const interaction = llmInteractions[i];
      
      logOutput += `=== INTERACTION ${i + 1}: ${interaction.type} ===\n`;
      logOutput += `ID: ${interaction.id}\n`;
      logOutput += `Model: ${interaction.model}\n`;
      logOutput += `Provider: ${interaction.provider}\n\n`;
      
      if (interaction.type === 'request') {
        logOutput += 'PROMPT:\n';
        logOutput += interaction.prompt + '\n\n';
        
        // Check if this is behavior tree generation
        if (interaction.prompt.includes('Behavior Tree Generation')) {
          logOutput += '>>> THIS IS BEHAVIOR TREE GENERATION PROMPT <<<\n\n';
          
          // Look for tool information in the prompt
          if (interaction.prompt.includes('Available Tools')) {
            logOutput += '>>> TOOL INFORMATION FOUND IN PROMPT <<<\n\n';
          } else {
            logOutput += '>>> NO TOOL INFORMATION IN PROMPT! <<<\n\n';
          }
        }
      }
      
      if (interaction.type === 'response') {
        logOutput += 'RESPONSE:\n';
        logOutput += interaction.response + '\n\n';
        
        // Check if this is behavior tree JSON
        if (interaction.response.includes('"type": "sequence"')) {
          logOutput += '>>> THIS IS BEHAVIOR TREE RESPONSE <<<\n\n';
          
          try {
            const btJson = JSON.parse(interaction.response);
            logOutput += 'Parsed behavior tree structure:\n';
            logOutput += `- Type: ${btJson.type}\n`;
            logOutput += `- Children: ${btJson.children?.length || 0}\n`;
            
            if (btJson.children) {
              for (let j = 0; j < btJson.children.length; j++) {
                const child = btJson.children[j];
                logOutput += `\nChild ${j + 1}: ${child.id}\n`;
                logOutput += `  Type: ${child.type}\n`;
                logOutput += `  Tool: ${child.tool || 'none'}\n`;
                logOutput += `  Has inputs: ${!!child.inputs}\n`;
                logOutput += `  Has outputs: ${!!child.outputs}\n`;
                if (child.inputs) {
                  logOutput += `  Input keys: ${Object.keys(child.inputs).join(', ')}\n`;
                }
                if (child.outputs) {
                  logOutput += `  Output keys: ${Object.keys(child.outputs).join(', ')}\n`;
                }
              }
            }
          } catch (error) {
            logOutput += `Error parsing behavior tree JSON: ${error.message}\n`;
          }
        }
      }
      
      logOutput += '=' + '='.repeat(60) + '\n\n';
    }
    
    // Write to file
    fs.writeFileSync('/tmp/llm-interactions.log', logOutput);
    console.log('LLM interactions logged to /tmp/llm-interactions.log');
    
    // Verify we captured behavior tree generation
    const btGenerationRequests = llmInteractions.filter(i => 
      i.type === 'request' && i.prompt.includes('Behavior Tree Generation')
    );
    
    console.log('Behavior tree generation requests:', btGenerationRequests.length);
    expect(btGenerationRequests.length).toBeGreaterThan(0);
    
    // Check if tool schemas are included
    if (btGenerationRequests.length > 0) {
      const btPrompt = btGenerationRequests[0].prompt;
      console.log('Tool schemas in prompt:', btPrompt.includes('inputSchema'));
      console.log('Available tools section:', btPrompt.includes('Available Tools'));
    }
    
  }, 60000);
});