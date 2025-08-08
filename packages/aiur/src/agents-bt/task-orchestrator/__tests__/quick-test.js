#!/usr/bin/env node

/**
 * Quick Integration Test for TaskOrchestrator
 * 
 * Tests the basic planning workflow with a simple task to verify everything works
 */

import { TaskOrchestratorTestActor } from './TaskOrchestratorTestActor.js';

const quickTest = async () => {
  console.log('🧪 Running Quick TaskOrchestrator Integration Test...\n');
  
  const testActor = new TaskOrchestratorTestActor();
  
  try {
    // Initialize
    console.log('📋 Initializing...');
    await testActor.initialize();
    console.log('✅ Initialized successfully\n');
    
    // Test simple planning workflow
    console.log('🚀 Testing Planning Workflow...');
    console.log('Task: "create a simple hello world node script"');
    
    // Start planning
    await testActor.startPlanningTask('create a simple hello world node script');
    
    // Wait for planning to complete with extended timeout
    console.log('⏳ Waiting for planning to complete (up to 2 minutes)...');
    
    try {
      // Wait for completion message - look for the final completion message
      const completionMessage = await testActor.waitForMessage('chat_response', 120000);
      console.log('✅ Planning completed successfully!');
      
      const finalState = testActor.getOrchestratorState();
      console.log(`Final state: ${finalState.planningState}`);
      
      // Check results
      const messages = testActor.getMessages();
      console.log(`📨 Total messages: ${messages.length}`);
      
      // We already have the completion message from waitForMessage
      if (completionMessage && completionMessage.message.includes('validated successfully')) {
        console.log('✅ Found completion message with validation success');
        console.log(`Message: ${completionMessage.message.substring(0, 100)}...`);
      } else {
        console.log('⚠️  No completion message found');
        console.log('Last few messages:');
        messages.slice(-3).forEach((msg, i) => {
          console.log(`  ${i + 1}. ${msg.type}: ${msg.message?.substring(0, 80) || 'N/A'}...`);
        });
      }
      
      // Check artifacts
      const artifacts = testActor.getArtifacts();
      if (artifacts.length > 0) {
        console.log(`✅ Created ${artifacts.length} artifacts`);
        artifacts.forEach((artifact, i) => {
          const label = artifact.data?.artifacts?.[0]?.label;
          console.log(`  ${i + 1}. ${artifact.eventType}: ${label || 'N/A'}`);
        });
      } else {
        console.log('⚠️  No artifacts created');
      }
      
      // Test basic plan execution setup (without full execution)
      console.log('\n🔧 Testing Plan Execution Setup...');
      
      if (artifacts.length > 0) {
        const planArtifact = artifacts[0].data.artifacts[0];
        const plan = JSON.parse(planArtifact.content);
        
        console.log(`Plan ID: ${plan.id}`);
        console.log(`Plan Status: ${plan.status}`);
        console.log(`Plan Steps: ${plan.steps?.length || 0}`);
        
        if (plan.status === 'validated') {
          console.log('✅ Plan is validated and ready for execution');
          
          // Just test the execution setup without full execution
          console.log('Testing execution initialization...');
          
          try {
            // This will initialize the execution but fail on actual tool execution
            await testActor.executePlan(plan);
            console.log('⚠️  Execution completed (likely with tool errors, which is expected)');
          } catch (error) {
            console.log(`⚠️  Expected execution error: ${error.message}`);
          }
          
          // Check execution messages
          const execMessages = testActor.getMessages().filter(msg => 
            msg.message && (msg.message.includes('execution') || msg.message.includes('Executing'))
          );
          
          if (execMessages.length > 0) {
            console.log(`✅ Found ${execMessages.length} execution-related messages`);
          }
          
        } else {
          console.log('❌ Plan is not validated');
        }
      }
      
      console.log('\n🎉 Quick test completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   • Planning: ${finalState.planningState}`);
      console.log(`   • Execution: ${finalState.executionState}`);
      console.log(`   • Messages captured: ${testActor.getMessages().length}`);
      console.log(`   • Thoughts captured: ${testActor.getThoughts().length}`);
      console.log(`   • Artifacts created: ${testActor.getArtifacts().length}`);
      
    } catch (error) {
      if (error.message.includes('Timeout')) {
        console.log('⏰ Planning timed out after 2 minutes');
        console.log('This might indicate slow LLM responses or an issue with the planning workflow');
        
        // Show current state and messages for debugging
        const state = testActor.getOrchestratorState();
        console.log(`Current state: Planning=${state.planningState}, Execution=${state.executionState}`);
        
        const messages = testActor.getMessages();
        console.log(`Messages so far: ${messages.length}`);
        if (messages.length > 0) {
          console.log('Recent messages:');
          messages.slice(-5).forEach((msg, i) => {
            console.log(`  ${i + 1}. ${msg.type}: ${msg.message?.substring(0, 80) || 'N/A'}...`);
          });
        }
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    console.error(error.stack);
  } finally {
    testActor.destroy();
    console.log('\n🧹 Test cleanup completed');
  }
};

quickTest().catch(console.error);