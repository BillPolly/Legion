const { Agent } = require('../../src/agent');
const { calculatorTool } = require('../../src/tools/calculator');
require('dotenv').config();

describe('LLM Tool Use Integration Test', () => {
    // Skip this test in CI or if no API key is available
    const shouldRun = process.env.OPENAI_API_KEY;
    const testCondition = shouldRun ? it : it.skip;

    testCondition('should call an LLM and use the calculator tool', async () => {
        // Use OpenAI provider since it's available
        const modelConfig = {
            provider: 'OPEN_AI',
            apiKey: process.env.OPENAI_API_KEY,
            model: 'gpt-3.5-turbo'
        };

        // Create an agent with the calculator tool
        const agent = new Agent({
            name: 'math_assistant',
            bio: 'A helpful math assistant that can perform calculations',
            modelConfig: modelConfig,
            tools: [calculatorTool],
            showToolUsage: true
        });

        // Test a simple calculation task
        const response = await agent.run('What is 42 * 17 + 123?');

        // Verify the response contains the correct answer
        expect(response).toBeDefined();
        expect(response.message).toBeDefined();
        
        // The answer should be 837
        expect(response.message).toMatch(/837/);
    }, 60000); // 60 second timeout for API calls

    testCondition('should handle a single calculation', async () => {
        const modelConfig = {
            provider: 'OPEN_AI',
            apiKey: process.env.OPENAI_API_KEY,
            model: 'gpt-3.5-turbo'
        };

        const agent = new Agent({
            name: 'math_assistant',
            bio: 'A helpful math assistant that can perform calculations',
            modelConfig: modelConfig,
            tools: [calculatorTool],
            showToolUsage: true
        });

        // Test a single calculation
        const response = await agent.run('What is 99 * 99?');

        expect(response).toBeDefined();
        expect(response.message).toBeDefined();
        
        // Should mention 9801
        const message = response.message.toLowerCase();
        expect(message).toMatch(/9801/);
    }, 60000); // 60 second timeout
});