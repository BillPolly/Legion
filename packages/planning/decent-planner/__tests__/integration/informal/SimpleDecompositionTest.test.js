/**
 * Simple decomposition test - test if we can decompose a complex task
 */

import { describe, it, expect } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Simple Decomposition Test', () => {
  let anthropic;
  
  beforeAll(async () => {
    // Load .env file
    const envPath = path.join(__dirname, '../../../../../.env');
    dotenv.config({ path: envPath });
    
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('No ANTHROPIC_API_KEY found');
    }
    
    const { Anthropic } = await import('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: anthropicKey });
  });

  it('should decompose a complex task into subtasks', async () => {
    console.log('\n🔨 Testing task decomposition...\n');
    
    const task = 'Create a simple web scraper that extracts article titles from a news website';
    console.log('Task to decompose:', task);
    
    // Create the decomposition prompt
    const prompt = `Decompose this task into 2-5 subtasks:

Task: ${task}

For each subtask, provide:
1. A clear description
2. Suggested inputs (what it needs)
3. Suggested outputs (what it produces)

Return ONLY a JSON object with this format:
{
  "task": "Original task description",
  "subtasks": [
    {
      "id": "task-1",
      "description": "Clear subtask description",
      "suggestedInputs": ["input1", "input2"],
      "suggestedOutputs": ["output1"],
      "reasoning": "Why this subtask is needed"
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const text = response.content[0].text;
    console.log('Raw response:', text);
    
    // Parse the JSON
    const result = JSON.parse(text);
    console.log('\nDecomposition result:');
    console.log('Original task:', result.task);
    console.log('Number of subtasks:', result.subtasks.length);
    
    result.subtasks.forEach((subtask, i) => {
      console.log(`\nSubtask ${i + 1}: ${subtask.description}`);
      console.log('  Inputs:', subtask.suggestedInputs);
      console.log('  Outputs:', subtask.suggestedOutputs);
      console.log('  Reasoning:', subtask.reasoning);
    });
    
    expect(result.task).toBeTruthy();
    expect(result.subtasks).toBeDefined();
    expect(result.subtasks.length).toBeGreaterThan(1);
    expect(result.subtasks.length).toBeLessThanOrEqual(5);
    
    // Check each subtask has required fields
    result.subtasks.forEach(subtask => {
      expect(subtask.description).toBeTruthy();
      expect(subtask.suggestedInputs).toBeDefined();
      expect(subtask.suggestedOutputs).toBeDefined();
    });
  }, 30000);
});