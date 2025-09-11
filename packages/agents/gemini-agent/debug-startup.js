/**
 * Debug script to isolate what's hanging during startup
 */

console.log('1. Starting debug...');

try {
  console.log('2. Importing ResourceManager...');
  const { ResourceManager } = await import('@legion/resource-manager');
  
  console.log('3. Getting ResourceManager instance...');
  const resourceManager = await ResourceManager.getInstance();
  
  console.log('4. ResourceManager ready, importing ConversationManager...');
  const ConversationManager = (await import('./src/conversation/ConversationManager.js')).default;
  
  console.log('5. Creating ConversationManager...');
  const conversationManager = new ConversationManager(resourceManager);
  
  console.log('6. Testing processMessage...');
  const response = await conversationManager.processMessage('Hello');
  
  console.log('7. Success!', response.content.substring(0, 50));
  
} catch (error) {
  console.error('❌ Debug failed at step:', error.message);
  console.error(error.stack);
}

process.exit(0);