// Example usage of the JavaScript EnvoyJS core
const { Agent, Model, calculatorTool } = require('./src');

// Create a simple agent with calculator tool
const agent = new Agent({
    name: 'MathAgent',
    bio: 'I am a helpful math assistant',
    modelConfig: {
        provider: 'OPEN_AI',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
    },
    tools: [calculatorTool],
    showToolUsage: true
});

// Example usage (commented out to avoid requiring actual API key)
// async function runExample() {
//     try {
//         const response = await agent.run('What is 25 * 40?');
//         console.log('Agent response:', response);
//     } catch (error) {
//         console.error('Error:', error);
//     }
// }
// 
// runExample();

console.log('EnvoyJS JavaScript core loaded successfully!');
console.log('Agent created:', agent.name);
console.log('Available tools:', agent.tools.map(t => t.name).join(', '));