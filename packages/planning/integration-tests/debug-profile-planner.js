/**
 * Debug script to test ProfilePlannerTool execution step by step
 */

import { ResourceManager } from '@legion/tools';
import { ProfilePlannerModule } from '@legion/profile-planner';

async function debugProfilePlanner() {
  console.log('🐛 Debugging ProfilePlannerTool execution...\n');
  
  try {
    // 1. Setup ResourceManager
    console.log('1. Setting up ResourceManager...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const envVars = resourceManager.get('env');
    const apiKey = envVars?.ANTHROPIC_API_KEY;
    console.log(`   ✅ API Key found: ${apiKey?.substring(0, 10)}...`);
    
    // 2. Create ProfilePlannerModule
    console.log('\n2. Creating ProfilePlannerModule...');
    const module = await ProfilePlannerModule.create({ resourceManager });
    console.log('   ✅ Module created successfully');
    
    // 3. Get the ProfilePlannerTool
    console.log('\n3. Getting ProfilePlannerTool...');
    const tools = module.getTools();
    console.log(`   ✅ Found ${tools.length} tools`);
    
    const profilePlannerTool = tools.find(t => t.name === 'profile_planner');
    if (!profilePlannerTool) {
      console.error('   ❌ ProfilePlannerTool not found!');
      return;
    }
    console.log('   ✅ ProfilePlannerTool found');
    
    // 4. Test simple execution
    console.log('\n4. Testing ProfilePlannerTool execution...');
    const result = await profilePlannerTool.execute({
      profileName: 'javascript-development', // This triggers _planWithProfile
      profile: 'javascript-development',     // This is what _planWithProfile expects
      task: 'Create a file called hello.txt with the content "Hello World"'
    });
    
    console.log('\n📋 Execution result:');
    console.log('   success:', result.success);
    console.log('   error:', result.error);
    if (result.data) {
      console.log('   data keys:', Object.keys(result.data));
      if (result.data.behaviorTree) {
        console.log('   behaviorTree type:', result.data.behaviorTree.type);
        console.log('   behaviorTree id:', result.data.behaviorTree.id);
      }
    }
    
    // 5. If failed, try to understand why
    if (!result.success) {
      console.log('\n🔍 Debugging failure...');
      
      // Check profile manager
      try {
        console.log('   Checking profile manager...');
        const profiles = await profilePlannerTool.profileManager?.getAvailableProfiles?.();
        console.log('   Available profiles:', profiles?.map(p => p.name) || 'Method not available');
      } catch (error) {
        console.log('   Profile manager error:', error.message);
      }
      
      // Check LLM client creation
      try {
        console.log('   Checking LLM client creation...');
        const llmClient = await profilePlannerTool._createLLMClient?.();
        console.log('   LLM client created:', !!llmClient);
      } catch (error) {
        console.log('   LLM client error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugProfilePlanner();