/**
 * Test to verify behavior trees contain real Tool objects with serialize methods
 * and that ActorSerializer properly calls Tool.serialize()
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { ActorSerializer } from '@legion/actors';
import { Tool } from '@legion/tools-registry';

describe('Behavior Tree Tool Serialization', () => {
  let decentPlanner;
  let resourceManager;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    decentPlanner = new DecentPlanner({
      maxDepth: 5,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true,
      validateBehaviorTrees: true,
      logLevel: 'info'
    });
    await decentPlanner.initialize();
  }, 30000);
  
  afterAll(async () => {
    if (decentPlanner) {
      await decentPlanner.shutdown();
    }
  });

  test('should create behavior tree with real Tool objects that have serialize methods', async () => {
    console.log('=== Testing Tool Objects in Behavior Tree ===');
    
    // Create a plan with behavior tree
    const goal = "please write a hello world program";
    const result = await decentPlanner.plan(goal, {}, (message) => {
      console.log(`Progress: ${message}`);
    });
    
    expect(result.success).toBe(true);
    expect(result.data.behaviorTrees).toBeDefined();
    expect(result.data.behaviorTrees.length).toBeGreaterThan(0);
    
    const behaviorTree = result.data.behaviorTrees[0];
    console.log('Behavior tree structure:', JSON.stringify(behaviorTree, null, 2).substring(0, 500) + '...');
    
    // Check that the behavior tree has action nodes
    expect(behaviorTree.children).toBeDefined();
    expect(behaviorTree.children.length).toBeGreaterThan(0);
    
    // Find action nodes with tool objects
    const actionNodes = behaviorTree.children.filter(child => child.type === 'action' && child.tool);
    expect(actionNodes.length).toBeGreaterThan(0);
    
    console.log(`Found ${actionNodes.length} action nodes with tools`);
    
    // Test each action node's tool - CHECK CLASS SPECIFICALLY
    for (const node of actionNodes) {
      console.log(`\n=== DETAILED TOOL CLASS ANALYSIS for Node ${node.id} ===`);
      console.log('Tool type:', typeof node.tool);
      console.log('Tool constructor name:', node.tool?.constructor?.name);
      console.log('Tool class (prototype):', Object.getPrototypeOf(node.tool)?.constructor?.name);
      console.log('Tool prototype chain:', Object.getPrototypeOf(Object.getPrototypeOf(node.tool))?.constructor?.name);
      console.log('Tool instanceof Tool:', node.tool instanceof Tool);
      console.log('Tool has serialize method:', typeof node.tool?.serialize === 'function');
      console.log('Tool name property:', node.tool?.name);
      console.log('Tool module property:', node.tool?.module);
      console.log('Tool toolName property:', node.tool?.toolName);
      
      // Show all properties and methods
      console.log('Tool own properties:', Object.getOwnPropertyNames(node.tool));
      console.log('Tool prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(node.tool)));
      
      // Verify it's a real Tool object
      expect(typeof node.tool).toBe('object');
      expect(node.tool).not.toBeNull();
      
      // CRITICAL: Check the exact class
      expect(node.tool.constructor.name).toBe('Tool');
      expect(node.tool instanceof Tool).toBe(true);
      
      console.log('✅ Confirmed: Tool is instance of Tool class');
      expect(node.tool.serialize).toBeInstanceOf(Function);
      
      // Test calling serialize method directly
      console.log('Calling tool.serialize()...');
      const serialized = node.tool.serialize();
      console.log('Tool serializes to:', JSON.stringify(serialized, null, 2));
      
      // Verify serialized result has no circular references
      expect(typeof serialized).toBe('object');
      expect(serialized.name).toBeDefined();
      expect(serialized.$type).toBe('Tool');
      console.log(`✅ Tool ${serialized.name} serializes correctly`);
    }
  }, 60000);

  test('should serialize behavior tree through ActorSerializer without circular references', async () => {
    console.log('\n=== Testing ActorSerializer on Behavior Tree ===');
    
    // Create a plan with behavior tree
    const goal = "write a simple test function";
    const result = await decentPlanner.plan(goal, {});
    
    expect(result.success).toBe(true);
    const behaviorTree = result.data.behaviorTrees[0];
    
    // Create a mock ActorSpace for testing
    class MockActorSpace {
      constructor() {
        this.objectToGuid = new Map();
        this.guidToObject = new Map();
        this.spaceId = 'test-space';
      }
    }
    
    const mockActorSpace = new MockActorSpace();
    const serializer = new ActorSerializer(mockActorSpace);
    
    console.log('Testing ActorSerializer on behavior tree...');
    
    // Test serialization
    let serializedTree;
    try {
      serializedTree = serializer.serialize(behaviorTree);
      console.log('✅ Serialization succeeded');
      
      // Verify no [Circular] references in the result
      expect(serializedTree).not.toContain('[Circular]');
      console.log('✅ No [Circular] references found');
      
      // Parse back to verify it's valid JSON
      const parsed = JSON.parse(serializedTree);
      console.log('✅ Result is valid JSON');
      
      // Check that action nodes have proper tool data
      if (parsed.children) {
        const actionNodes = parsed.children.filter(child => child.type === 'action');
        for (const node of actionNodes) {
          console.log(`\nNode ${node.id} tool:`, typeof node.tool, JSON.stringify(node.tool, null, 2));
          
          if (typeof node.tool === 'object' && node.tool !== null) {
            expect(node.tool.name).toBeDefined();
            expect(typeof node.tool.name).toBe('string');
            console.log(`✅ Tool ${node.tool.name} properly serialized`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Serialization failed:', error);
      throw error;
    }
  }, 60000);
});