/**
 * Generate clean test configuration in a separate process to avoid Jest contamination
 */

// Generate configuration without Jest environment contamination
export function generateCleanConfig() {
  // Use eval to create completely isolated object
  return eval(`({
    agent: {
      id: 'clean-bt-test-agent',
      name: 'CleanBTTestAgent',
      type: 'conversational',
      version: '1.0.0',
      llm: {
        provider: 'anthropic',
        model: 'claude-3-haiku',
        temperature: 0.1,
        maxTokens: 100
      }
    }
  })`);
}

// Alternative: use new Function constructor for isolation
export function generateIsolatedConfig() {
  const configFactory = new Function('return ' + JSON.stringify({
    agent: {
      id: 'simple-bt-test-agent',
      name: 'SimpleBTTestAgent',
      type: 'conversational',
      version: '1.0.0',
      llm: {
        provider: 'anthropic',
        model: 'claude-3-haiku',
        temperature: 0.1,
        maxTokens: 100
      }
    }
  }));
  
  return configFactory();
}