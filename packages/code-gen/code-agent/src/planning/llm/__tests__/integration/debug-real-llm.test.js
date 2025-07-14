/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import GenericPlanner from '../../../../../llm-planner/src/GenericPlanner.js';

describe('Debug Real LLM Test', () => {
  let resourceManager;
  let llmClient;
  let genericPlanner;
  
  beforeAll(async () => {
    console.log('🚀 Setting up debug test...');
    
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229',
      maxRetries: 1
    });
    
    genericPlanner = new GenericPlanner({ llmClient });
    
    console.log('✅ Debug test setup complete');
  });

  test('should create plan with real LLM and check validation', async () => {
    console.log('\n🔍 Step 1: Making LLM call...');
    
    const objective = "Analyze todo list requirements";
    const allowableActions = [
      { type: "determine_project_type", description: "Determine if frontend/backend/fullstack" },
      { type: "extract_features", description: "Extract features from requirements" }
    ];
    
    console.log('📋 Objective:', objective);
    console.log('🛠️ Allowable actions:', allowableActions.map(a => a.type));
    
    let plan;
    try {
      console.log('\n🚀 Calling GenericPlanner.createPlan...');
      plan = await genericPlanner.createPlan(objective, allowableActions, { maxRetries: 1 });
      
      console.log('\n✅ Plan created successfully!');
      console.log('📄 Plan structure:', {
        name: plan.name,
        stepCount: plan.steps?.length || 0,
        hasExecutionOrder: !!plan.executionOrder
      });
      
    } catch (error) {
      console.log('\n❌ Plan creation failed:', error.message);
      
      // Let's try to see what the raw LLM response was
      console.log('\n🔍 Let me check what the LLM actually returned...');
      
      const prompt = `Create a structured plan for: ${objective}

Available actions you can use in your plan:
${allowableActions.map(action => `- ${action.type}: ${action.description}`).join('\n')}

Return a JSON object with this structure:
{
  "name": "Plan name",
  "description": "Plan description", 
  "steps": [
    {
      "id": "step-1",
      "name": "Step Name",
      "description": "What this step does",
      "type": "implementation",
      "actions": [
        {
          "type": "determine_project_type",
          "parameters": {}
        }
      ]
    }
  ]
}`;

      console.log('\n📤 Raw prompt being sent:');
      console.log(prompt);
      
      const rawResponse = await llmClient.complete(prompt);
      console.log('\n📥 Raw LLM response:');
      console.log(rawResponse);
      
      // Try to parse it
      try {
        const parsed = JSON.parse(rawResponse);
        console.log('\n✅ JSON is valid!');
        console.log('📊 Parsed structure:', JSON.stringify(parsed, null, 2));
      } catch (parseError) {
        console.log('\n❌ JSON parsing failed:', parseError.message);
        
        // Try to extract JSON from response
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('\n🔍 Found JSON in response, trying to parse...');
          try {
            const extracted = JSON.parse(jsonMatch[0]);
            console.log('✅ Extracted JSON is valid!');
            console.log('📊 Extracted structure:', JSON.stringify(extracted, null, 2));
          } catch (extractError) {
            console.log('❌ Extracted JSON also invalid:', extractError.message);
          }
        }
      }
      
      throw error;
    }
    
    expect(plan).toBeDefined();
    expect(plan.name).toBeDefined();
    expect(plan.steps).toBeDefined();
    
  }, 60000);
});