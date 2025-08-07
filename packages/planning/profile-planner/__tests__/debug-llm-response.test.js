/**
 * DEBUG: Capture actual LLM response to see what's failing
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ProfilePlannerModule } from '../src/ProfilePlannerModule.js';
import { ResourceManager, ModuleLoader } from '@legion/tool-system';

describe('DEBUG LLM Response', () => {
  let profilePlannerModule;

  beforeAll(async () => {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    resourceManager.register('moduleLoader', moduleLoader);

    profilePlannerModule = await ProfilePlannerModule.create(resourceManager);
  }, 60000);

  test('CAPTURE EXACT LLM RESPONSE', async () => {
    if (!process.env.ANTHROPIC_API_KEY && process.env.RUN_REAL_LLM_TESTS !== 'true') {
      console.log('Skipping - need API key');
      return;
    }

    const tools = profilePlannerModule.getTools();
    console.log('Available tools:', tools.map(t => t.name));
    
    const jsDevTool = tools.find(tool => tool.name === 'javascript_dev_working_planner') || 
                      tools.find(tool => tool.name === 'javascript_dev_planner');
    
    console.log('🔍 STARTING LLM REQUEST...');
    
    try {
      const result = await jsDevTool.execute({
        function: {
          name: jsDevTool.name,
          arguments: {
            task: 'create a simple Node.js server with an API endpoint that adds two numbers'
          }
        }
      });
      
      console.log('🔍 FINAL RESULT:', JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.error('🔍 CAUGHT ERROR:', error.message);
      console.error('🔍 STACK:', error.stack);
    }
  }, 300000);
});