const { Tool } = require('../../src/tools/base/base-tool');

describe('Tool Base Class', () => {
    class ValidTool extends Tool {
        constructor() {
            super();
            this.name = 'Valid Tool';
            this.identifier = 'valid_tool';
            this.abilities = ['Test ability'];
            this.instructions = ['Test instruction'];
            this.functions = [{
                name: 'testFunction',
                purpose: 'Test purpose',
                arguments: [],
                response: 'Test response'
            }];
            this.functionMap = {
                testFunction: () => 'test result'
            };
        }
    }

    class InvalidTool extends Tool {
        constructor() {
            super();
            // Missing required properties
        }
    }

    describe('constructor validation', () => {
        it('should create a valid tool instance', (done) => {
            const tool = new ValidTool();
            
            // Validation happens in next tick
            process.nextTick(() => {
                expect(tool.name).toBe('Valid Tool');
                expect(tool.identifier).toBe('valid_tool');
                expect(tool.abilities).toEqual(['Test ability']);
                expect(tool.instructions).toEqual(['Test instruction']);
                expect(tool.functions).toHaveLength(1);
                expect(tool.functionMap).toHaveProperty('testFunction');
                done();
            });
        });

        it('should throw error for missing name', (done) => {
            class NoNameTool extends Tool {
                constructor() {
                    super();
                    this.identifier = 'no_name';
                    this.abilities = [];
                    this.instructions = [];
                    this.functions = [];
                    this.functionMap = {};
                }
            }

            // Mock process.exit
            const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
            const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

            new NoNameTool();

            process.nextTick(() => {
                expect(mockError).toHaveBeenCalledWith(
                    expect.stringContaining('Tool subclass must define: name')
                );
                expect(mockExit).toHaveBeenCalledWith(1);
                
                mockExit.mockRestore();
                mockError.mockRestore();
                done();
            });
        });

        it('should throw error for invalid property types', (done) => {
            class InvalidTypeTool extends Tool {
                constructor() {
                    super();
                    this.name = 'Invalid Type Tool';
                    this.identifier = 'invalid_type';
                    this.abilities = 'not an array'; // Should be array
                    this.instructions = [];
                    this.functions = [];
                    this.functionMap = {};
                }
            }

            const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
            const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

            new InvalidTypeTool();

            process.nextTick(() => {
                expect(mockError).toHaveBeenCalledWith(
                    expect.stringContaining("Tool implementation error: 'abilities' must be an array")
                );
                expect(mockExit).toHaveBeenCalledWith(1);
                
                mockExit.mockRestore();
                mockError.mockRestore();
                done();
            });
        });
    });

    describe('setExecutingAgent', () => {
        it('should set the executing agent', () => {
            const tool = new ValidTool();
            const mockAgent = { name: 'Test Agent' };

            tool.setExecutingAgent(mockAgent);

            expect(tool.executingAgent).toBe(mockAgent);
        });
    });
});