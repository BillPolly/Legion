/**
 * ISOLATED DEBUG: Just the LLM call - find exactly what's wrong
 */

import { describe, test } from '@jest/globals';
import { ResourceManager, ModuleLoader } from '@legion/tool-system';

describe('ISOLATED LLM DEBUG', () => {
  test('JUST THE LLM CALL - NOTHING ELSE', async () => {
    if (!process.env.ANTHROPIC_API_KEY && process.env.RUN_REAL_LLM_TESTS !== 'true') {
      console.log('Skipping - need API key');
      return;
    }

    console.log('🔍 ISOLATED LLM TEST STARTING...\n');

    // Minimal setup
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Create LLM client
    const anthropicKey = resourceManager.env.ANTHROPIC_API_KEY;
    const { LLMClient } = await import('@legion/llm');
    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: 'claude-3-5-sonnet-20241022'
    });

    // Simple allowable actions - match what's actually available
    const allowableActions = [
      {
        type: "file_write",
        description: "Write content to a file",
        inputs: ["filepath", "content"],
        outputs: ["file_created"]
      },
      {
        type: "run_command", 
        description: "Execute a command",
        inputs: ["command"],
        outputs: ["stdout"]
      }
    ];

    // Build prompt manually - see exactly what we're sending
    const description = "Create a simple Node.js server with an API endpoint that adds two numbers";
    const inputs = ["user_request"];
    const requiredOutputs = ["file_created"];
    const maxSteps = 5;

    const prompt = `Create a structured plan for: ${description}

REQUIREMENTS:
- Available inputs: ${inputs.join(', ')}
- Required outputs: ${requiredOutputs.join(', ')}
- Maximum steps: ${maxSteps}

ALLOWABLE ACTIONS (you MUST only use these exact action types):
${allowableActions.map(action => 
  `- ${action.type}: ${action.description}
  Parameters: ${action.inputs.join(', ')}
  Outputs: ${action.outputs.join(', ')}`
).join('\n\n')}

CRITICAL: Return a JSON object with this EXACT structure (every field is required):
{
  "id": "plan-unique-id",
  "name": "Plan Name",
  "description": "Plan description", 
  "steps": [
    {
      "id": "step-1",
      "name": "Step Name",
      "description": "Step description",
      "type": "setup",
      "dependencies": [],
      "actions": [
        {
          "toolName": "file_write",
          "inputs": {
            "filepath": "example.js",
            "content": "console.log('hello');"
          }
        }
      ]
    }
  ]
}

CRITICAL REQUIREMENTS:
- Plan MUST have "id" field (unique identifier like "nodejs-server-plan")  
- Each action MUST have "toolName" field (exact tool name to execute)
- Each action MUST have "inputs" object (NOT parameters)
- Action "toolName" field MUST be exactly one of: file_write, run_command
- Step "type" field MUST be exactly one of: setup, implementation, validation, cleanup

Generate a complete plan in this exact format with all required fields.`;

    console.log('=== EXACT PROMPT BEING SENT ===');
    console.log(prompt);
    console.log('\n' + '='.repeat(50) + '\n');

    try {
      console.log('📤 CALLING LLM...');
      const response = await llmClient.complete(prompt, 'claude-3-5-sonnet-20241022');
      
      console.log('=== RAW LLM RESPONSE ===');
      console.log(response);
      console.log('\n' + '='.repeat(50) + '\n');

      // Try to parse the response
      console.log('🔧 ATTEMPTING TO PARSE...');
      
      // Extract JSON from response
      let jsonText = response.trim();
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
        console.log('✅ Extracted from ```json blocks');
      } else {
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonText = jsonText.substring(firstBrace, lastBrace + 1);
          console.log('✅ Extracted JSON object');
        }
      }

      console.log('=== EXTRACTED JSON ===');
      console.log(jsonText);
      console.log('\n' + '='.repeat(50) + '\n');

      const parsed = JSON.parse(jsonText);
      console.log('✅ JSON PARSED SUCCESSFULLY');
      
      console.log('=== PARSED STRUCTURE ANALYSIS ===');
      console.log('Name:', parsed.name);
      console.log('Description:', parsed.description);
      console.log('Steps count:', parsed.steps?.length || 0);
      
      if (parsed.steps && parsed.steps.length > 0) {
        parsed.steps.forEach((step, i) => {
          console.log(`Step ${i + 1}:`);
          console.log(`  - ID: ${step.id}`);
          console.log(`  - Name: ${step.name}`);
          console.log(`  - Type: ${step.type}`);
          console.log(`  - Actions: ${step.actions?.length || 0}`);
          
          if (step.actions) {
            step.actions.forEach((action, j) => {
              console.log(`    Action ${j + 1}: ${action.toolName || action.type}`);
              console.log(`    Parameters/Inputs:`, Object.keys(action.inputs || action.parameters || {}));
            });
          }
        });
      }

    } catch (error) {
      console.log('❌ ERROR:', error.message);
      console.log('Stack:', error.stack);
    }

  }, 60000);
});