/**
 * Simplest possible LLM test - just make sure we can talk to the LLM
 */

// Test functions are provided by the test runner as globals
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Simple LLM Test', () => {
  it('should connect to LLM and get a response', async () => {
    console.log('\n🚀 Starting simplest LLM test...\n');
    
    // Step 1: Load .env file
    const envPath = path.join(__dirname, '../../../../../.env');
    console.log('Loading .env from:', envPath);
    dotenv.config({ path: envPath });
    
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    console.log('Anthropic API Key found:', anthropicKey ? 'YES' : 'NO');
    
    if (!anthropicKey) {
      console.log('Skipping - no API key');
      return;
    }
    
    // Step 2: Import and create Anthropic client
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    
    // Step 3: Send a simple message
    console.log('Sending test message to Claude...');
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{ 
        role: 'user', 
        content: 'Say "Hello from test" and nothing else' 
      }]
    });
    
    const text = response.content[0].text;
    console.log('Response:', text);
    
    expect(text).toBeTruthy();
    expect(text.toLowerCase()).toContain('hello');
  }, 30000);
});