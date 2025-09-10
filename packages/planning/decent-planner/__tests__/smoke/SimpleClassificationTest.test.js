/**
 * Simple classification test - test if we can classify tasks as SIMPLE or COMPLEX
 */

// Test functions are provided by the test runner as globals
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Simple Classification Test', () => {
  let anthropic;
  
  beforeAll(async () => {
    // Load .env file
    const envPath = path.join(__dirname, '../../../../../.env');
    dotenv.config({ path: envPath });
    
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('No ANTHROPIC_API_KEY found');
    }
    
    // Use ResourceManager to get LLM client
    const llmClient = await resourceManager.get('llmClient');
    anthropic = llmClient;
  });

  it('should classify a simple task', async () => {
    console.log('\n🎯 Testing SIMPLE task classification...\n');
    
    const task = 'Write the text "Hello World" to a file named output.txt';
    console.log('Task:', task);
    
    // Create the classification prompt
    const prompt = `Classify this task as either SIMPLE or COMPLEX:

Task: ${task}

A SIMPLE task:
- Can be done with a single tool or a few tools
- Has clear, direct steps
- Doesn't require breaking down into subtasks

A COMPLEX task:
- Requires multiple subtasks
- Needs decomposition into smaller parts
- Involves multiple systems or components

Return ONLY a JSON object with this format:
{
  "complexity": "SIMPLE" or "COMPLEX",
  "reasoning": "Brief explanation"
}`;

    const text = await anthropic.complete(prompt);
    console.log('Raw response:', text);
    
    // Parse the JSON
    const result = JSON.parse(text);
    console.log('Parsed:', result);
    
    expect(result.complexity).toBe('SIMPLE');
    expect(result.reasoning).toBeTruthy();
  }, 30000);

  it('should classify a complex task', async () => {
    console.log('\n🎯 Testing COMPLEX task classification...\n');
    
    const task = 'Build a complete e-commerce website with user authentication, product catalog, shopping cart, and payment processing';
    console.log('Task:', task);
    
    const prompt = `Classify this task as either SIMPLE or COMPLEX:

Task: ${task}

A SIMPLE task:
- Can be done with a single tool or a few tools
- Has clear, direct steps
- Doesn't require breaking down into subtasks

A COMPLEX task:
- Requires multiple subtasks
- Needs decomposition into smaller parts
- Involves multiple systems or components

Return ONLY a JSON object with this format:
{
  "complexity": "SIMPLE" or "COMPLEX",
  "reasoning": "Brief explanation"
}`;

    const text = await anthropic.complete(prompt);
    console.log('Raw response:', text);
    
    const result = JSON.parse(text);
    console.log('Parsed:', result);
    
    expect(result.complexity).toBe('COMPLEX');
    expect(result.reasoning).toBeTruthy();
  }, 30000);
});