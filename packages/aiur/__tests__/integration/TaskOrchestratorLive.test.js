import { ProfilePlannerTool } from '@legion/profile-planner';
import { ResourceManager, ToolRegistry, ModuleLoader } from '@legion/tools';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ProfilePlanner and Plan Validation', () => {
  let testDir;
  let toolRegistry;

  beforeAll(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'test-output-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    console.log('📁 Test directory created:', testDir);
    
    // Create and initialize a proper ToolRegistry with auto-loading capabilities
    console.log('🔧 Initializing ToolRegistry with auto-loading...');
    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    
    console.log('✅ ToolRegistry initialized with ModuleLoader');
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      process.chdir(__dirname);
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });

  test('should create a plan with ProfilePlannerTool', async () => {
    console.log('\n========== TEST: Direct Plan Creation ==========');
    
    const planner = new ProfilePlannerTool({ toolRegistry });
    await planner.initialize();
    console.log('✅ ProfilePlannerTool initialized');
    
    // Create a plan
    console.log('\n📋 Creating plan for: Create a simple hello.js file with a greeting function');
    const planResult = await planner.execute({
      function: {
        name: 'plan_with_profile',
        arguments: JSON.stringify({
          profile: 'javascript-development',
          task: 'Create a simple hello.js file with a greeting function'
        })
      }
    });
    
    console.log('\n📊 Plan Result:', {
      success: planResult.success,
      hasData: !!planResult.data,
      hasBehaviorTree: !!planResult.data?.behaviorTree
    });
    
    expect(planResult.success).toBe(true);
    expect(planResult.data).toBeDefined();
    expect(planResult.data.behaviorTree).toBeDefined();
    
    const behaviorTree = planResult.data.behaviorTree;
    console.log('\n✅ Plan created successfully!');
    console.log('  Plan type:', behaviorTree.type);
    console.log('  Plan id:', behaviorTree.id);
    console.log('  Number of children:', behaviorTree.children?.length || 0);
    
    if (behaviorTree.children && behaviorTree.children.length > 0) {
      console.log('  First few children:');
      behaviorTree.children.slice(0, 3).forEach((child, i) => {
        console.log(`    ${i + 1}. Type: ${child.type}, Tool: ${child.tool || 'N/A'}`);
      });
    }
    
    expect(behaviorTree.children).toBeDefined();
    expect(behaviorTree.children.length).toBeGreaterThan(0);
  }, 60000);

  test('should create, validate and execute Node server with addition API', async () => {
    console.log('\n========== TEST: Complete Node Server Orchestration ==========');
    
    const planner = new ProfilePlannerTool({ toolRegistry });
    await planner.initialize();
    console.log('✅ ProfilePlannerTool initialized');
    
    // STEP 1: Create the plan
    console.log('\n🚀 STEP 1: Creating plan for Node server with addition API...');
    const task = 'Create a Node.js Express server with an API endpoint that adds 2 numbers. Include proper testing and validation.';
    
    const planResult = await planner.execute({
      function: {
        name: 'plan_with_profile',
        arguments: JSON.stringify({
          profile: 'javascript-development',
          task: task
        })
      }
    });
    
    console.log('\n📊 Plan Creation Result:', {
      success: planResult.success,
      hasData: !!planResult.data,
      hasBehaviorTree: !!planResult.data?.behaviorTree,
      error: planResult.error
    });
    
    expect(planResult.success).toBe(true);
    expect(planResult.data).toBeDefined();
    expect(planResult.data.behaviorTree).toBeDefined();
    
    const behaviorTree = planResult.data.behaviorTree;
    console.log('\n✅ Plan created successfully!');
    console.log('  Plan type:', behaviorTree.type);
    console.log('  Plan id:', behaviorTree.id);
    console.log('  Number of children:', behaviorTree.children?.length || 0);
    
    // STEP 2: Validate the plan structure
    console.log('\n🔍 STEP 2: Validating plan structure...');
    
    // Collect all action nodes for validation
    function collectActionNodes(node, actions = []) {
      if (node.type === 'action' && node.tool) {
        actions.push({
          id: node.id,
          tool: node.tool,
          description: node.description,
          params: node.params
        });
      }
      
      if (node.children) {
        node.children.forEach(child => collectActionNodes(child, actions));
      }
      
      if (node.child) {
        collectActionNodes(node.child, actions);
      }
      
      return actions;
    }
    
    const actionNodes = collectActionNodes(behaviorTree);
    console.log(`\n📋 Found ${actionNodes.length} action nodes in the plan:`);
    actionNodes.forEach((action, i) => {
      console.log(`  ${i + 1}. ${action.tool}: ${action.description}`);
    });
    
    // Validate that all tools exist
    console.log('\n✅ STEP 2.1: Validating tool availability...');
    const missingTools = [];
    for (const action of actionNodes) {
      const tool = await toolRegistry.getTool(action.tool);
      if (!tool) {
        missingTools.push(action.tool);
      }
    }
    
    if (missingTools.length > 0) {
      console.error('❌ Missing tools:', missingTools);
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }
    
    console.log('✅ All tools are available in the registry!');
    
    // STEP 3: Execute the plan with tool result capture
    console.log('\n⚡ STEP 3: Executing the plan with tool result capture...');
    
    const { BehaviorTreeExecutor } = await import('../../../shared/actor-BT/src/core/BehaviorTreeExecutor.js');
    
    // Use the singleton ToolRegistry directly
    const executor = new BehaviorTreeExecutor(toolRegistry);
    
    // Capture execution results
    const toolResults = [];
    const nodeResults = [];
    
    executor.on('action:start', (data) => {
      console.log(`🔧 Starting action: ${data.tool} (${data.id})`);
    });
    
    executor.on('action:result', (result) => {
      console.log(`📊 Tool result: ${result.success ? '✅ SUCCESS' : '❌ FAILURE'}`);
      if (result.output) {
        console.log(`   Output: ${result.output.substring(0, 100)}${result.output.length > 100 ? '...' : ''}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      toolResults.push({
        tool: result.tool || 'unknown',
        success: result.success,
        output: result.output,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    });
    
    executor.on('node:complete', (result) => {
      nodeResults.push({
        id: result.id,
        type: result.type,
        status: result.status,
        timestamp: new Date().toISOString()
      });
    });
    
    // Execute the behavior tree
    console.log('\n🚀 Executing behavior tree...');
    console.log('Tree config:', JSON.stringify(behaviorTree, null, 2).substring(0, 500) + '...');
    
    let executionResult;
    try {
      executionResult = await executor.executeTree(behaviorTree, {
        workspaceDir: testDir,
        timeout: 120000 // 2 minutes timeout
      });
      console.log('\n✅ Execution completed without throwing');
    } catch (error) {
      console.error('\n❌ Execution threw error:', error.message);
      console.error('Stack:', error.stack);
      throw error;
    }
    
    console.log('\n📊 Execution Result:', {
      success: executionResult.success,
      status: executionResult.status,
      executionTime: executionResult.executionTime + 'ms',
      nodeCount: Object.keys(executionResult.nodeResults || {}).length
    });
    
    // STEP 4: Analyze and report results
    console.log('\n📈 STEP 4: Analyzing execution results...');
    
    console.log(`\n🔧 Tool Execution Summary (${toolResults.length} tools executed):`);
    toolResults.forEach((result, i) => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${i + 1}. ${status} ${result.tool}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });
    
    console.log(`\n📋 Node Execution Summary (${nodeResults.length} nodes executed):`);
    const nodeStats = nodeResults.reduce((stats, node) => {
      stats[node.status] = (stats[node.status] || 0) + 1;
      return stats;
    }, {});
    
    Object.entries(nodeStats).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} nodes`);
    });
    
    // STEP 5: Validate the created files
    console.log('\n📁 STEP 5: Validating created files...');
    
    try {
      const files = await fs.readdir(testDir);
      console.log('Created files:', files);
      
      // Check for essential files
      const expectedFiles = ['package.json', 'server.js', 'app.js', 'index.js'];
      const foundFiles = expectedFiles.filter(file => files.includes(file));
      console.log('Expected files found:', foundFiles);
      
      // Validate package.json if created
      if (files.includes('package.json')) {
        const packageContent = await fs.readFile(path.join(testDir, 'package.json'), 'utf-8');
        const packageJson = JSON.parse(packageContent);
        console.log('✅ package.json is valid JSON');
        console.log('  Dependencies:', Object.keys(packageJson.dependencies || {}));
      }
      
    } catch (error) {
      console.warn('⚠️  File validation error:', error.message);
    }
    
    // Final assertions
    expect(executionResult.success).toBe(true);
    expect(toolResults.length).toBeGreaterThan(0);
    expect(toolResults.filter(r => r.success).length).toBeGreaterThan(0);
    
    console.log('\n🎉 Complete Node Server Orchestration Test PASSED!');
    
  }, 180000); // 3 minutes timeout

});