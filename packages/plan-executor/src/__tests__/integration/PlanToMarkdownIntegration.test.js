/**
 * Integration test for PlanToMarkdownTool with real plan JSON
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { PlanExecutorModule } from '../../PlanExecutorModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PlanToMarkdownTool Integration', () => {
  let planExecutorModule;
  let planToMarkdownTool;
  let testPlan;

  beforeAll(async () => {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create PlanExecutorModule 
    planExecutorModule = new PlanExecutorModule({
      resourceManager: resourceManager,
      moduleFactory: new ModuleFactory(resourceManager)
    });

    // Get the plan_to_markdown tool
    const tools = planExecutorModule.getTools();
    planToMarkdownTool = tools.find(tool => tool.name === 'plan_to_markdown');
    
    // Load the test plan
    const planPath = path.join(__dirname, '..', '..', '..', '__tests__', 'fixtures', 'simple-api-plan.json');
    const planContent = await fs.readFile(planPath, 'utf8');
    testPlan = JSON.parse(planContent);
  });

  test('should find plan_to_markdown tool', () => {
    expect(planToMarkdownTool).toBeDefined();
    expect(planToMarkdownTool.name).toBe('plan_to_markdown');
  });

  test('should generate detailed markdown from plan', async () => {
    const toolCall = {
      function: {
        name: 'plan_to_markdown',
        arguments: JSON.stringify({
          plan: testPlan,
          format: 'detailed',
          includeAnalysis: true
        })
      }
    };

    const result = await planToMarkdownTool.invoke(toolCall);
    
    expect(result.success).toBe(true);
    expect(result.data.format).toBe('detailed');
    expect(result.data.markdown).toContain('# Simple Node.js Addition API');
    expect(result.data.markdown).toContain('## Plan Information');
    expect(result.data.markdown).toContain('## Required Modules');
    expect(result.data.markdown).toContain('### Clean Temporary Directory');
    expect(result.data.markdown).toContain('**Inputs**: command');
    expect(result.data.markdown).toContain('**Outputs**: cleanup_result');
    expect(result.data.markdown).toContain('```mermaid');
    expect(result.data.markdown).toContain('## Complexity Analysis');
    
    // Check statistics
    expect(result.data.stats.words).toBeGreaterThan(500);
    expect(result.data.stats.lines).toBeGreaterThan(150);
  });

  test('should generate summary markdown from plan', async () => {
    const toolCall = {
      function: {
        name: 'plan_to_markdown',
        arguments: JSON.stringify({
          plan: testPlan,
          format: 'summary'
        })
      }
    };

    const result = await planToMarkdownTool.invoke(toolCall);
    
    expect(result.success).toBe(true);
    expect(result.data.format).toBe('summary');
    expect(result.data.markdown).toContain('## Quick Overview');
    expect(result.data.markdown).toContain('**Total Steps**: 6');
    expect(result.data.markdown).toContain('**Total Actions**: 11');
    expect(result.data.sections).toEqual(['overview', 'steps']);
  });

  test('should generate execution guide from plan', async () => {
    const toolCall = {
      function: {
        name: 'plan_to_markdown',
        arguments: JSON.stringify({
          plan: testPlan,
          format: 'execution-guide'
        })
      }
    };

    const result = await planToMarkdownTool.invoke(toolCall);
    
    expect(result.success).toBe(true);
    expect(result.data.format).toBe('execution-guide');
    expect(result.data.markdown).toContain('## Prerequisites');
    expect(result.data.markdown).toContain('## Execution Steps');
    expect(result.data.markdown).toContain('1. **Clean Temporary Directory**');
    expect(result.data.markdown).toContain('**Actions to perform:**');
    expect(result.data.sections).toEqual(['overview', 'prerequisites', 'execution-steps']);
  });

  test('should include all step inputs and outputs', async () => {
    const toolCall = {
      function: {
        name: 'plan_to_markdown',
        arguments: JSON.stringify({
          plan: testPlan,
          format: 'detailed'
        })
      }
    };

    const result = await planToMarkdownTool.invoke(toolCall);
    
    expect(result.success).toBe(true);
    
    // Check that step outputs are shown
    expect(result.data.markdown).toContain('**Outputs**: tmp_cleaned');
    expect(result.data.markdown).toContain('**Outputs**: package_created');
    expect(result.data.markdown).toContain('**Outputs**: server_created');
    
    // Check that action inputs/outputs are shown
    expect(result.data.markdown).toContain('**Inputs**: command');
    expect(result.data.markdown).toContain('**Outputs**: cleanup_result');
    expect(result.data.markdown).toContain('**Inputs**: name, dependencies');
    expect(result.data.markdown).toContain('**Outputs**: package_file');
  });

  test('should show proper indentation under step titles', async () => {
    const toolCall = {
      function: {
        name: 'plan_to_markdown',
        arguments: JSON.stringify({
          plan: testPlan,
          format: 'detailed'
        })
      }
    };

    const result = await planToMarkdownTool.invoke(toolCall);
    
    expect(result.success).toBe(true);
    
    const lines = result.data.markdown.split('\n');
    
    // Find step title line
    const stepTitleIndex = lines.findIndex(line => line === '### Clean Temporary Directory');
    expect(stepTitleIndex).toBeGreaterThan(-1);
    
    // Check that description has 2-space indent
    const descriptionLine = lines[stepTitleIndex + 2]; // Skip empty line
    expect(descriptionLine).toBe('  Remove old files from tmp directory');
    
    // Check that metadata has 2-space indent
    const metadataIndex = lines.findIndex(line => line.includes('**Type**: cleanup'));
    expect(lines[metadataIndex]).toMatch(/^  \*\*Type\*\*/);
  });
});