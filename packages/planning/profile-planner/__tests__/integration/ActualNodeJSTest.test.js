/**
 * ACTUAL Node.js server plan generation test - no excuses
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ProfilePlannerModule } from '../../src/ProfilePlannerModule.js';
import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shouldRunLiveTests = process.env.RUN_REAL_LLM_TESTS === 'true' || process.env.ANTHROPIC_API_KEY;

describe('ACTUAL Node.js Server Generation', () => {
  let resourceManager;
  let profilePlannerModule;
  let moduleLoader;
  let testWorkspaceDir;

  beforeAll(async () => {
    if (!shouldRunLiveTests) {
      console.log('Skipping - need ANTHROPIC_API_KEY or RUN_REAL_LLM_TESTS=true');
      return;
    }

    testWorkspaceDir = path.join(__dirname, '../../test-output', `actual-nodejs-${Date.now()}`);
    await fs.mkdir(testWorkspaceDir, { recursive: true });

    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    resourceManager.register('moduleLoader', moduleLoader);

    profilePlannerModule = await ProfilePlannerModule.create(resourceManager);
  }, 60000);

  afterAll(async () => {
    if (testWorkspaceDir) {
      try {
        await fs.rm(testWorkspaceDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  test('should generate Node.js server plan - NO EXCUSES', async () => {
    if (!shouldRunLiveTests) {
      console.log('Skipping - need API key');
      return;
    }

    console.log('\n=== CHECKING WHAT TOOLS ARE ACTUALLY AVAILABLE ===');
    
    // Get ALL tools available in the module loader
    const allToolNames = await moduleLoader.getAllToolNames();
    console.log('ALL AVAILABLE TOOLS:', allToolNames);
    
    // Check specific tools we might need
    const commonTools = ['file_write', 'directory_create', 'command_execute', 'write_file', 'create_directory'];
    for (const toolName of commonTools) {
      const hasIt = await moduleLoader.hasToolByNameOrAlias(toolName);
      console.log(`Tool ${toolName}: ${hasIt ? '✅ AVAILABLE' : '❌ MISSING'}`);
    }

    console.log('\n=== GETTING PROFILE PLANNER TOOL ===');
    const tools = profilePlannerModule.getTools();
    const jsDevTool = tools.find(tool => tool.name === 'javascript_dev_planner');
    
    expect(jsDevTool).toBeDefined();
    console.log('✅ Found javascript_dev_planner tool');

    console.log('\n=== CHECKING PROFILE DETAILS ===');
    const profile = profilePlannerModule.profileManager.getProfile('javascript-dev');
    console.log('Profile allowable actions:', profile.allowableActions?.map(a => a.type));

    console.log('\n=== ATTEMPTING PLAN GENERATION ===');
    
    const planRequest = {
      function: {
        name: 'javascript_dev_planner',
        arguments: {
          task: 'create a simple Node.js server with an API endpoint that adds two numbers'
        }
      }
    };

    console.log('Making request to LLM...');
    const result = await jsDevTool.execute(planRequest);
    
    console.log('Result:', {
      success: result.success,
      error: result.error,
      hasPlan: !!result.plan
    });

    if (!result.success) {
      console.error('FAILED:', result.error);
      
      // Let's see the full error details
      console.log('Full result object:', JSON.stringify(result, null, 2));
      
      throw new Error(`Plan generation failed: ${result.error}`);
    }

    expect(result.success).toBe(true);
    expect(result.plan).toBeDefined();
    
    console.log('✅ PLAN GENERATED SUCCESSFULLY');
    console.log('Plan has', result.plan.steps?.length || 0, 'steps');
    
    // Save the plan
    const planFile = path.join(testWorkspaceDir, 'generated-plan.json');
    await fs.writeFile(planFile, JSON.stringify(result.plan, null, 2));
    console.log('✅ Plan saved to:', planFile);

  }, 180000);
});