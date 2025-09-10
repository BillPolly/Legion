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
    
    // Step 2: Use ResourceManager to get LLM client
    const llmClient = await resourceManager.get('llmClient');
    
    // Step 3: Send a simple message
    console.log('Sending test message to Claude...');
    const response = await llmClient.complete('Say "Hello from test" and nothing else');
    
    console.log('Response:', response);
    
    expect(response).toBeTruthy();
    expect(response.toLowerCase()).toContain('hello');
  }, 30000);
});