import { getResourceManager } from '@legion/module-loader';
import { PlanExecutorModule } from '../../src/PlanExecutorModule.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runPlanWithLogging() {
  console.log('Starting plan execution with logging...\n');
  
  // Get the singleton ResourceManager
  const resourceManager = await getResourceManager();
  
  // Set up workspace configuration
  const workspaceDir = path.join(__dirname, '../tmp');
  resourceManager.register('workspace.workspaceDir', workspaceDir);
  
  // Create PlanExecutorModule using the static create method
  const planExecutorModule = await PlanExecutorModule.create();
  
  // Get the plan executor tool
  const tools = planExecutorModule.getTools();
  const planExecutorTool = tools.find(t => t.name === 'plan_execute');
  
  // Load the test plan - using the webpage version with screenshot
  const planPath = path.join(__dirname, '../fixtures/simple-api-plan-with-webpage.json');
  const planJson = await fs.readFile(planPath, 'utf8');
  const plan = JSON.parse(planJson);
  
  // Execute the plan
  console.log('Executing plan:', plan.name);
  console.log('Plan ID:', plan.id);
  console.log('Target directory: __tests__/tmp/');
  console.log('Plan has', plan.steps.length, 'steps');
  console.log('');
  
  try {
    const result = await planExecutorTool.execute({
      plan: plan,
      mode: 'sequential',
      continueOnError: false
    });
    
    console.log('\nPlan execution completed!');
    console.log('Success:', result.success);
    console.log('Status:', result.status);
    
    if (result.executedSteps && result.executedSteps.length > 0) {
      console.log('\nExecuted steps:');
      result.executedSteps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step.id} - ${step.status}`);
      });
    }
    
    if (result.error) {
      console.log('\nError:', result.error);
    }
    
    // List generated artifacts
    console.log('\nGenerated artifacts:');
    const tmpDir = path.join(__dirname, '../tmp');
    try {
      const entries = await fs.readdir(tmpDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          console.log(`  📁 ${entry.name}/`);
          const subEntries = await fs.readdir(path.join(tmpDir, entry.name));
          for (const subEntry of subEntries) {
            console.log(`     - ${subEntry}`);
          }
        } else {
          console.log(`  📄 ${entry.name}`);
        }
      }
    } catch (error) {
      console.log('  (no artifacts found)');
    }
    
    // Check the log file - it's in __tests__/tmp/logs/
    const logFile = path.join(__dirname, '../tmp/logs/plan-execution.log');
    console.log('\nLog file location:', logFile);
    
    try {
      const logContent = await fs.readFile(logFile, 'utf8');
      const logLines = logContent.trim().split('\n');
      console.log(`\nLog file contains ${logLines.length} entries:`);
      
      // Parse and display log entries
      logLines.forEach((line, i) => {
        try {
          const entry = JSON.parse(line);
          console.log(`  ${i + 1}. [${entry.level.toUpperCase()}] ${entry.eventType} - ${entry.planId || entry.stepId || ''}`);
        } catch (e) {
          console.log(`  ${i + 1}. (invalid JSON)`);
        }
      });
      
      // Show last few log entries
      console.log('\nLast log entry:');
      const lastEntry = JSON.parse(logLines[logLines.length - 1]);
      console.log(JSON.stringify(lastEntry, null, 2));
      
    } catch (error) {
      console.log('Error reading log file:', error.message);
    }
    
  } catch (error) {
    console.error('\nPlan execution failed:', error);
  }
}

// Run the plan
runPlanWithLogging().catch(console.error);