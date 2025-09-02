/**
 * Backend Event Data Flow Test
 * Tests actual events sent from backend to frontend during BT execution
 * Captures and analyzes event data to debug missing inputs/outputs/artifacts
 * NO MOCKS - Tests real backend execution actor communication
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';
import ServerPlannerActor from '../../src/server/actors/ServerPlannerActor.js';
import { ServerExecutionActor } from '../../src/server/actors/ServerExecutionActor.js';
import path from 'path';
import fs from 'fs/promises';

describe('Backend Event Data Flow Analysis', () => {
  let resourceManager;
  let toolRegistry;
  let testDir;
  let originalDir;
  let serverPlannerActor;
  let capturedEvents;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up Backend Event Data Flow tests');
    
    resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client required for backend event testing - no fallbacks');
    }
    
    toolRegistry = await getToolRegistry();
    console.log('✅ Real backend components initialized');
    originalDir = process.cwd();
  });

  afterEach(async () => {
    if (originalDir) {
      process.chdir(originalDir);
    }
  });

  test('should capture and analyze real backend execution events', async () => {
    console.log('\n🎯 Testing real backend-to-frontend event data flow');
    
    testDir = path.join('/tmp', `backend-event-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    console.log(`📁 Test directory: ${testDir}`);
    
    // Create mock frontend actor to capture events
    capturedEvents = [];
    const mockFrontendActor = {
      receive: (messageType, data) => {
        console.log(`📨 Frontend received: ${messageType}`);
        
        const event = {
          type: messageType,
          data: data,
          timestamp: new Date().toISOString()
        };
        
        capturedEvents.push(event);
        
        // Log key execution event details
        if (messageType === 'execution-event') {
          console.log(`   🎭 Execution Event: ${data.type}`);
          if (data.data) {
            console.log(`      Node: ${data.data.nodeId} (${data.data.nodeType})`);
          }
          if (data.state) {
            console.log(`      Artifacts: ${Object.keys(data.state.context?.artifacts || {}).length} items`);
            console.log(`      History: ${data.state.history?.length || 0} entries`);
          }
        } else if (messageType === 'step-response') {
          console.log(`   👣 Step Response: complete=${data.data?.complete}`);
          if (data.data?.state?.history?.length > 0) {
            const lastHistory = data.data.state.history[data.data.state.history.length - 1];
            console.log(`      Last history: inputs=${!!lastHistory.inputs}, outputs=${!!lastHistory.outputs}`);
          }
        }
      }
    };
    
    // Create server planner actor
    const services = { toolRegistry };
    serverPlannerActor = new ServerPlannerActor(services);
    await serverPlannerActor.setRemoteActor(mockFrontendActor);
    
    console.log('✅ Server planner actor initialized');
    
    // Step 1: Create a plan
    console.log('\n📋 Step 1: Creating informal plan...');
    await serverPlannerActor.receive('plan-informal', {
      goal: 'write a hello world program in javascript'
    });
    
    // Wait for informal planning to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if informal planning completed
    const informalCompleteEvents = capturedEvents.filter(e => e.type === 'informalPlanComplete');
    expect(informalCompleteEvents.length).toBeGreaterThan(0);
    console.log('✅ Informal planning completed');
    
    // Step 2: Discover tools  
    console.log('\n🔍 Step 2: Discovering tools...');
    await serverPlannerActor.receive('discover-tools', {});
    
    // Wait for tool discovery
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const toolsCompleteEvents = capturedEvents.filter(e => e.type === 'toolsDiscoveryComplete');
    
    console.log(`📊 Tool discovery events captured: ${capturedEvents.filter(e => e.type.includes('tools')).length}`);
    console.log(`   Types: ${capturedEvents.filter(e => e.type.includes('tools')).map(e => e.type).join(', ')}`);
    
    if (toolsCompleteEvents.length === 0) {
      console.log('❌ Tool discovery never completed - checking what happened...');
      console.log(`   All events: ${capturedEvents.map(e => e.type).join(', ')}`);
      
      const errorEvents = capturedEvents.filter(e => e.type.includes('Error') || e.type.includes('error'));
      if (errorEvents.length > 0) {
        console.log('   Errors found:', errorEvents[0].data);
      }
      
      // Continue anyway for testing
      console.log('   Continuing with available events...');
    } else {
      console.log('✅ Tool discovery completed');
    }
    
    // Step 3: Generate formal plan
    console.log('\n🎯 Step 3: Creating formal plan...');
    await serverPlannerActor.receive('plan-formal', {});
    
    // Wait for formal planning
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const formalCompleteEvents = capturedEvents.filter(e => e.type === 'formalPlanComplete');
    expect(formalCompleteEvents.length).toBeGreaterThan(0);
    console.log('✅ Formal planning completed');
    
    // Step 4: Test execution stepping 
    console.log('\n👣 Step 4: Testing execution stepping...');
    
    // Get the execution actor (should be initialized by formal planning completion)
    const executionActor = serverPlannerActor.executionActor;
    expect(executionActor).toBeTruthy();
    
    // Execute steps and capture events
    const maxSteps = 10;
    let stepCount = 0;
    let executionComplete = false;
    
    while (!executionComplete && stepCount < maxSteps) {
      stepCount++;
      console.log(`\n--- Backend Step ${stepCount} ---`);
      
      // Clear events before step
      const eventCountBefore = capturedEvents.length;
      
      // Send step command to backend
      await executionActor.receive('step', {}, mockFrontendActor);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Analyze new events
      const newEvents = capturedEvents.slice(eventCountBefore);
      console.log(`   📨 New events: ${newEvents.length}`);
      
      for (const event of newEvents) {
        console.log(`      ${event.type}: ${JSON.stringify(event.data).substring(0, 100)}...`);
        
        if (event.type === 'step-response' && event.data?.data?.complete) {
          executionComplete = true;
          console.log('   🏁 Execution marked complete');
        }
      }
      
      // Check latest execution state
      const stepResponses = newEvents.filter(e => e.type === 'step-response');
      if (stepResponses.length > 0) {
        const latestResponse = stepResponses[stepResponses.length - 1];
        const state = latestResponse.data?.data?.state;
        
        if (state) {
          console.log(`   📊 State: artifacts=${Object.keys(state.context?.artifacts || {}).length}, history=${state.history?.length || 0}`);
          
          if (state.history && state.history.length > 0) {
            const lastHistoryItem = state.history[state.history.length - 1];
            console.log(`   📜 Last history: inputs=${lastHistoryItem.inputs ? 'EXISTS' : 'NULL'}, outputs=${lastHistoryItem.outputs ? 'EXISTS' : 'NULL'}`);
            
            if (lastHistoryItem.inputs) {
              console.log(`      Inputs: ${JSON.stringify(lastHistoryItem.inputs)}`);
            }
            if (lastHistoryItem.outputs) {
              console.log(`      Outputs: ${JSON.stringify(lastHistoryItem.outputs)}`);
            }
          }
          
          if (state.context?.artifacts) {
            const artifacts = state.context.artifacts;
            const artifactKeys = Object.keys(artifacts);
            console.log(`   🔗 Artifacts: ${artifactKeys.join(', ') || 'NONE'}`);
            
            artifactKeys.forEach(key => {
              console.log(`      ${key}: ${typeof artifacts[key]} = ${artifacts[key]}`);
            });
          }
        }
      }
    }
    
    console.log(`\n📊 Backend Event Analysis Complete:`);
    console.log(`   Total events captured: ${capturedEvents.length}`);
    console.log(`   Execution steps: ${stepCount}`);
    console.log(`   Execution completed: ${executionComplete}`);
    
    // Analyze execution-event and step-response pairs
    const executionEvents = capturedEvents.filter(e => e.type === 'execution-event');
    const stepResponses = capturedEvents.filter(e => e.type === 'step-response');
    
    console.log(`   Execution events: ${executionEvents.length}`);
    console.log(`   Step responses: ${stepResponses.length}`);
    
    // Verify we got proper execution data
    expect(executionEvents.length).toBeGreaterThan(0);
    expect(stepResponses.length).toBeGreaterThan(0);
    
    // Check if any step responses have non-null inputs/outputs
    const responsesWithInputs = stepResponses.filter(r => 
      r.data?.data?.state?.history?.some(h => h.inputs !== null)
    );
    const responsesWithOutputs = stepResponses.filter(r => 
      r.data?.data?.state?.history?.some(h => h.outputs !== null)
    );
    const responsesWithArtifacts = stepResponses.filter(r => 
      r.data?.data?.state?.context?.artifacts && 
      Object.keys(r.data.data.state.context.artifacts).length > 0
    );
    
    console.log(`\n🔍 Data Analysis:`);
    console.log(`   Responses with inputs: ${responsesWithInputs.length}/${stepResponses.length}`);
    console.log(`   Responses with outputs: ${responsesWithOutputs.length}/${stepResponses.length}`);
    console.log(`   Responses with artifacts: ${responsesWithArtifacts.length}/${stepResponses.length}`);
    
    if (responsesWithInputs.length === 0) {
      console.log('❌ NO INPUTS FOUND - Backend executor not storing input data');
    }
    if (responsesWithOutputs.length === 0) {
      console.log('❌ NO OUTPUTS FOUND - Backend executor not storing output data');
    }
    if (responsesWithArtifacts.length === 0) {
      console.log('❌ NO ARTIFACTS FOUND - Backend executor not storing @varName variables');
    }
    
    console.log('\n🎯 Backend event data flow analysis complete');
    
  }, 180000); // 3 minutes for full planning + execution
});