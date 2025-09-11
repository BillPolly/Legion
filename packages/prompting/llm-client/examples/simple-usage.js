/**
 * SimplePromptClient Usage Examples
 * 
 * This file demonstrates the most common use cases for the SimplePromptClient
 */

import { ResourceManager } from '@legion/resource-manager';

async function main() {
  // Get the SimplePromptClient from ResourceManager
  const resourceManager = await ResourceManager.getInstance();
  const simpleClient = await resourceManager.get('simplePromptClient');

  console.log('=== SimplePromptClient Examples ===\n');

  // Example 1: Simple Chat
  console.log('1. Simple Chat:');
  try {
    const response1 = await simpleClient.chat("What are the three laws of robotics?");
    console.log('Response:', response1);
  } catch (error) {
    console.log('Note: This requires ANTHROPIC_API_KEY in your .env file');
  }
  console.log();

  // Example 2: Chat with System Prompt
  console.log('2. Chat with System Prompt:');
  try {
    const response2 = await simpleClient.chatWith(
      "Explain quantum computing", 
      "You are a physics professor explaining complex topics to undergraduates"
    );
    console.log('Response:', response2);
  } catch (error) {
    console.log('Note: This requires ANTHROPIC_API_KEY in your .env file');
  }
  console.log();

  // Example 3: Continue a Conversation
  console.log('3. Continue Conversation:');
  const chatHistory = [
    { role: 'user', content: 'I want to learn programming' },
    { role: 'assistant', content: 'Great! Programming is a valuable skill. What language interests you?' },
    { role: 'user', content: 'I heard JavaScript is good for beginners' },
    { role: 'assistant', content: 'Excellent choice! JavaScript is versatile and beginner-friendly.' }
  ];

  try {
    const conversationResponse = await simpleClient.continueChat(
      "What should I learn first in JavaScript?",
      chatHistory,
      "You are a patient programming mentor"
    );
    
    console.log('Response:', conversationResponse.content);
    console.log('Updated chat history length:', conversationResponse.chatHistory.length);
  } catch (error) {
    console.log('Note: This requires ANTHROPIC_API_KEY in your .env file');
  }
  console.log();

  // Example 4: Using Tools
  console.log('4. Using Tools:');
  const calculatorTool = {
    name: 'calculator',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: { 
          type: 'string',
          description: 'Mathematical expression to evaluate'
        }
      },
      required: ['expression']
    }
  };

  try {
    const toolResponse = await simpleClient.useTools(
      "What is 15 * 7 + 23?",
      [calculatorTool],
      "You are a helpful assistant that can perform calculations"
    );
    
    console.log('Response:', toolResponse.content);
    if (toolResponse.toolCalls) {
      console.log('Tool calls detected:', toolResponse.toolCalls);
    }
  } catch (error) {
    console.log('Note: This requires ANTHROPIC_API_KEY in your .env file');
  }
  console.log();

  // Example 5: File Analysis
  console.log('5. File Analysis:');
  const files = [
    {
      name: 'sample.js',
      content: `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
      `,
      type: 'text'
    }
  ];

  try {
    const fileAnalysis = await simpleClient.analyzeFiles(
      files,
      "Review this code for efficiency and suggest improvements"
    );
    
    console.log('Code Analysis:', fileAnalysis.content);
  } catch (error) {
    console.log('Note: This requires ANTHROPIC_API_KEY in your .env file');
  }
  console.log();

  // Example 6: Rich Request with All Features
  console.log('6. Rich Request (All Features):');
  try {
    const richResponse = await simpleClient.request({
      prompt: "Help me optimize this code and calculate its time complexity",
      systemPrompt: "You are an expert software engineer specializing in algorithm optimization",
      chatHistory: [
        { role: 'user', content: 'I need help with algorithm optimization' },
        { role: 'assistant', content: 'I can definitely help with that! What algorithm are you working on?' }
      ],
      files: files,
      tools: [calculatorTool],
      maxTokens: 1500,
      temperature: 0.3
    });

    console.log('Rich Response:', richResponse.content);
    console.log('Metadata:', richResponse.metadata);
  } catch (error) {
    console.log('Note: This requires ANTHROPIC_API_KEY in your .env file');
  }

  console.log('\n=== Examples Complete ===');
  console.log('To run these examples with real responses:');
  console.log('1. Create a .env file in your monorepo root');
  console.log('2. Add: ANTHROPIC_API_KEY=your_key_here');
  console.log('3. Run: node examples/simple-usage.js');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };