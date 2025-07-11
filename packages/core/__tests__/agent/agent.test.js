const { Agent } = require('../../src/agent');
const { Model } = require('../../src/model');
const { Tool } = require('../../src/tools');

// Mock dependencies
jest.mock('../../src/model');
jest.mock('ora', () => {
    return () => ({
        start: jest.fn().mockReturnThis(),
        stop: jest.fn()
    });
});
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
    appendFile: jest.fn()
}));

describe('Agent', () => {
    let mockModel;
    let mockTool;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock Model
        mockModel = {
            initializeModel: jest.fn(),
            sendAndReceiveResponse: jest.fn().mockResolvedValue({
                task_completed: true,
                response: { message: 'Test response' }
            })
        };
        Model.mockImplementation(() => mockModel);

        // Mock Tool
        mockTool = {
            name: 'Test Tool',
            identifier: 'test_tool',
            abilities: ['Test ability'],
            instructions: ['Test instruction'],
            functions: [{
                name: 'testFunction',
                purpose: 'Test purpose',
                arguments: [],
                response: 'Test response'
            }],
            setExecutingAgent: jest.fn(),
            functionMap: {
                testFunction: jest.fn().mockResolvedValue('Tool result')
            }
        };
    });

    describe('constructor', () => {
        it('should initialize agent with default values', () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' }
            });

            expect(agent.name).toBe('default_agent');
            expect(agent.bio).toBeUndefined();
            expect(agent.steps).toEqual([]);
            expect(agent.tools).toEqual([]);
            expect(agent._debugMode).toBe(false);
            expect(agent.showToolUsage).toBe(false);
            expect(agent.metaData).toEqual({});
        });

        it('should initialize agent with provided config', () => {
            const mockResponseStructure = { 
                format: 'json',
                toJson: jest.fn().mockReturnValue('{"format":"json"}')
            };
            
            const config = {
                name: 'test_agent',
                bio: 'Test bio',
                steps: ['step1', 'step2'],
                modelConfig: { provider: 'test' },
                tools: [mockTool],
                _debugMode: true,
                responseStructure: mockResponseStructure,
                showToolUsage: true,
                metaData: { key: 'value' }
            };

            const agent = new Agent(config);

            expect(agent.name).toBe('test_agent');
            expect(agent.bio).toBe('Test bio');
            expect(agent.steps).toEqual(['step1', 'step2']);
            expect(agent.tools).toEqual([mockTool]);
            expect(agent._debugMode).toBe(true);
            expect(agent.responseStructure).toEqual(mockResponseStructure);
            expect(agent.showToolUsage).toBe(true);
            expect(agent.metaData).toEqual({ key: 'value' });
        });

        it('should set executing agent on tools', () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' },
                tools: [mockTool]
            });

            expect(mockTool.setExecutingAgent).toHaveBeenCalledWith(agent);
        });

        it('should initialize the model', () => {
            new Agent({
                modelConfig: { provider: 'test' }
            });

            expect(Model).toHaveBeenCalledWith({ modelConfig: { provider: 'test' } });
            expect(mockModel.initializeModel).toHaveBeenCalled();
        });
    });

    describe('addMessage', () => {
        it('should add text message', () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' }
            });

            agent.addMessage('Test message');

            expect(agent.messages[1]).toEqual({
                role: 'user',
                content: [{
                    type: 'text',
                    text: 'Test message'
                }]
            });
        });

        it('should add text message with image', () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' }
            });

            agent.addMessage('Test message', 'base64image');

            expect(agent.messages[1]).toEqual({
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'Test message'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: 'base64image'
                        }
                    }
                ]
            });
        });
    });

    describe('prompt', () => {
        it('should send prompt and receive response', async () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' }
            });

            const response = await agent.prompt('Test prompt');

            expect(mockModel.sendAndReceiveResponse).toHaveBeenCalledWith(agent.messages);
            expect(response).toEqual({
                task_completed: true,
                response: { message: 'Test response' }
            });
        });

        it('should handle prompt with image', async () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' }
            });

            await agent.prompt('Test prompt', 'base64image');

            const userMessage = agent.messages.find(m => m.role === 'user');
            expect(userMessage.content).toHaveLength(2);
            expect(userMessage.content[1].type).toBe('image_url');
        });
    });

    describe('getTool', () => {
        it('should return tool by identifier', () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' },
                tools: [mockTool]
            });

            const tool = agent.getTool('test_tool');
            expect(tool).toBe(mockTool);
        });

        it('should return false if tool not found', () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' },
                tools: [mockTool]
            });

            const tool = agent.getTool('nonexistent_tool');
            expect(tool).toBe(false);
        });
    });

    describe('newProcess', () => {
        let agent;

        beforeEach(() => {
            agent = new Agent({
                modelConfig: { provider: 'test' },
                tools: [mockTool]
            });
        });

        it('should execute tool function when use_tool is provided', async () => {
            const response = {
                task_completed: false,
                use_tool: {
                    identifier: 'test_tool',
                    function_name: 'testFunction',
                    args: ['arg1', 'arg2']
                }
            };

            const result = await agent.newProcess(response);

            expect(mockTool.functionMap.testFunction).toHaveBeenCalledWith('arg1', 'arg2');
            expect(result).toEqual({
                taskCompleted: false,
                nextPrompt: '<tool_response>Tool result</tool_response>. Give me the next one step in JSON format.'
            });
        });

        it('should handle tool function errors', async () => {
            mockTool.functionMap.testFunction.mockRejectedValue(new Error('Tool error'));

            const response = {
                task_completed: false,
                use_tool: {
                    identifier: 'test_tool',
                    function_name: 'testFunction',
                    args: []
                }
            };

            const result = await agent.newProcess(response);

            expect(result.nextPrompt).toContain('Oops! Function call returned error');
        });

        it('should handle image response from tool', async () => {
            mockTool.functionMap.testFunction.mockResolvedValue({
                isImage: true,
                image: 'base64image'
            });

            const response = {
                task_completed: false,
                use_tool: {
                    identifier: 'test_tool',
                    function_name: 'testFunction',
                    args: []
                }
            };

            const result = await agent.newProcess(response);

            expect(result).toEqual({
                taskCompleted: false,
                nextPrompt: 'Here is the image',
                image: 'base64image'
            });
        });

        it('should return task completed when task_completed is true', async () => {
            const response = {
                task_completed: true
            };

            const result = await agent.newProcess(response);

            expect(result).toEqual({
                taskCompleted: true,
                nextPrompt: ''
            });
        });
    });

    describe('run', () => {
        it('should execute autoPrompt and return final response', async () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' }
            });

            const finalResponse = await agent.run('Test prompt');

            expect(finalResponse).toEqual({ message: 'Test response' });
        });
    });

    describe('printResponse', () => {
        let consoleLogSpy;

        beforeEach(() => {
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        });

        afterEach(() => {
            consoleLogSpy.mockRestore();
        });

        it('should print response message', async () => {
            const agent = new Agent({
                modelConfig: { provider: 'test' }
            });

            await agent.printResponse('Test prompt');

            expect(consoleLogSpy).toHaveBeenCalledWith('Test response');
        });
    });
});