const { Agent } = require('../../src/agent');
const { calculatorTool } = require('../../src/tools/calculator');

// Mock the Model at the module level
jest.mock('../../src/model', () => {
    return {
        Model: jest.fn()
    };
});

const { Model } = require('../../src/model');

describe('Mocked LLM Tool Use Test', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should demonstrate tool usage flow with mocked responses', async () => {
        // Mock the model to simulate LLM responses
        const mockModel = {
            initializeModel: jest.fn(),
            sendAndReceiveResponse: jest.fn()
                .mockResolvedValueOnce({
                    // First response: LLM decides to use the calculator
                    task_completed: false,
                    response: {
                        type: 'string',
                        message: 'I need to calculate 42 * 17 + 123'
                    },
                    use_tool: {
                        identifier: 'calculator_tool',
                        function_name: 'evaluate',
                        args: ['42 * 17 + 123']
                    }
                })
                .mockResolvedValueOnce({
                    // Second response: LLM provides final answer
                    task_completed: true,
                    response: {
                        type: 'string',
                        message: 'The result of 42 * 17 + 123 is 837'
                    }
                })
        };

        Model.mockImplementation(() => mockModel);

        const agent = new Agent({
            name: 'math_assistant',
            bio: 'A helpful math assistant',
            modelConfig: { provider: 'mock' },
            tools: [calculatorTool]
        });

        const response = await agent.run('What is 42 * 17 + 123?');

        // Verify the model was called twice (initial prompt + tool response)
        expect(mockModel.sendAndReceiveResponse).toHaveBeenCalledTimes(2);
        
        // Verify the response
        expect(response).toEqual({
            type: 'string',
            message: 'The result of 42 * 17 + 123 is 837'
        });
    });

    it('should handle tool errors gracefully', async () => {
        const mockModel = {
            initializeModel: jest.fn(),
            sendAndReceiveResponse: jest.fn()
                .mockResolvedValueOnce({
                    task_completed: false,
                    response: {
                        type: 'string',
                        message: 'I will calculate this for you'
                    },
                    use_tool: {
                        identifier: 'calculator_tool',
                        function_name: 'evaluate',
                        args: ['invalid expression {}']
                    }
                })
                .mockResolvedValueOnce({
                    task_completed: true,
                    response: {
                        type: 'string',
                        message: 'I encountered an error while calculating'
                    }
                })
        };

        Model.mockImplementation(() => mockModel);

        const agent = new Agent({
            name: 'math_assistant',
            bio: 'A helpful math assistant',
            modelConfig: { provider: 'mock' },
            tools: [calculatorTool]
        });

        const response = await agent.run('Calculate something invalid');

        expect(mockModel.sendAndReceiveResponse).toHaveBeenCalledTimes(2);
        expect(response.message).toContain('error');
    });
});