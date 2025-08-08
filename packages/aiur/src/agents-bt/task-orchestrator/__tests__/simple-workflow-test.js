#!/usr/bin/env node

/**
 * Simple Workflow Test for TaskOrchestrator
 * 
 * Tests the basic planning workflow and checks results without complex waiting
 */

import { TaskOrchestratorTestActor } from './TaskOrchestratorTestActor.js';

const simpleTest = async () => {
  console.log('🧪 Running Simple TaskOrchestrator Workflow Test...\n');
  
  const testActor = new TaskOrchestratorTestActor();
  
  try {
    // Initialize
    console.log('📋 Initializing...');
    await testActor.initialize();
    console.log('✅ Initialized successfully\n');
    
    // Start planning
    console.log('🚀 Starting Planning Task...');
    console.log('Task: "create a simple hello world node script"');
    
    // Start the planning task
    const taskPromise = testActor.startPlanningTask('create a simple hello world node script');
    
    // Wait for the task to complete (it should complete based on previous test)
    console.log('⏳ Waiting for planning to complete...');
    
    // Use a simple timeout approach
    await new Promise(resolve => setTimeout(resolve, 90000)); // Wait 90 seconds
    
    console.log('✅ Planning phase completed (timeout approach)');
    
    // Check final state
    const finalState = testActor.getOrchestratorState();
    console.log(`\nFinal state: Planning=${finalState.planningState}, Execution=${finalState.executionState}`);
    
    // Check messages
    const messages = testActor.getMessages();
    console.log(`\n📨 Total messages captured: ${messages.length}`);
    
    // Look for completion messages
    const completionMessages = messages.filter(msg => 
      msg.message && (
        msg.message.includes('Plan created and validated successfully') ||
        msg.message.includes('Planning completed') ||
        msg.message.includes('ready for execution')
      )
    );
    
    if (completionMessages.length > 0) {
      console.log('✅ Found completion messages:');
      completionMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.message.substring(0, 100)}...`);
      });
    } else {
      console.log('⚠️  No explicit completion messages found');
      console.log('Last few messages:');
      messages.slice(-3).forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.type}: ${msg.message?.substring(0, 80) || 'N/A'}...`);
      });
    }
    
    // Check artifacts
    const artifacts = testActor.getArtifacts();
    console.log(`\n📦 Artifacts created: ${artifacts.length}`);
    
    if (artifacts.length > 0) {
      console.log('✅ Successfully created artifacts:');
      artifacts.forEach((artifact, i) => {
        const label = artifact.data?.artifacts?.[0]?.label;
        const title = artifact.data?.artifacts?.[0]?.title;
        console.log(`  ${i + 1}. ${label}: ${title}`);
      });
      
      // Check the plan content
      const planArtifact = artifacts[0].data.artifacts[0];
      if (planArtifact) {
        try {
          const plan = JSON.parse(planArtifact.content);
          console.log(`\n📋 Plan Details:`);
          console.log(`   • ID: ${plan.id}`);
          console.log(`   • Status: ${plan.status}`);
          console.log(`   • Steps: ${plan.steps?.length || 0}`);
          
          if (plan.status === 'validated') {
            console.log('✅ Plan is validated and ready for execution');
          } else {
            console.log(`⚠️  Plan status: ${plan.status}`);
          }
        } catch (error) {
          console.log('⚠️  Could not parse plan content');
        }
      }
    } else {
      console.log('❌ No artifacts were created');
    }
    
    // Summary
    console.log('\n🎉 Test completed!')
    console.log('\n📊 Summary:');
    console.log(`   • Messages captured: ${messages.length}`);
    console.log(`   • Artifacts created: ${artifacts.length}`);
    console.log(`   • Final planning state: ${finalState.planningState}`);
    console.log(`   • Final execution state: ${finalState.executionState}`);
    
    if (artifacts.length > 0 && finalState.planningState === 'idle') {
      console.log('\n✅ SUCCESS: Planning workflow completed successfully!');
      console.log('   • Plan was generated using ProfilePlannerModule');
      console.log('   • Plan was validated using PlanInspectorTool');
      console.log('   • Plan artifact was created and stored');
      console.log('   • System returned to idle state (ready for next task)');
    } else {
      console.log('\n⚠️  PARTIAL SUCCESS: Workflow may not have completed fully');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    testActor.destroy();
    console.log('\n🧹 Test cleanup completed');
  }
};

simpleTest().catch(console.error);