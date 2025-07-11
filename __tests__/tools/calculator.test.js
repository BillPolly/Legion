const { CalculatorTool } = require('../../src/tools/calculator');

describe('CalculatorTool', () => {
    let tool;
    let consoleLogSpy;

    beforeEach(() => {
        tool = new CalculatorTool();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(tool.name).toBe('Calculator Tool');
            expect(tool.identifier).toBe('calculator_tool');
            expect(tool.abilities).toEqual(['Evaluate mathematical expressions']);
            expect(tool.instructions).toEqual([
                'Use the evaluate function to perform the mathematical expression evaluation and get the result'
            ]);
            expect(tool.functions).toHaveLength(1);
            expect(tool.functions[0]).toEqual({
                name: 'evaluate',
                purpose: 'To evaluate a mathematical expression in Javascript',
                arguments: [{
                    name: 'expression',
                    description: 'Javascript mathematical expression, for example: 784*566',
                    dataType: 'string'
                }],
                response: 'result of expression evaluation'
            });
            expect(tool.functionMap).toHaveProperty('evaluate');
        });
    });

    describe('evaluate', () => {
        it('should evaluate simple mathematical expressions', async () => {
            const result = await tool.evaluate('2 + 2');
            expect(result).toBe(4);
            expect(consoleLogSpy).toHaveBeenCalledWith('exp ', '2 + 2', 4);
        });

        it('should evaluate complex mathematical expressions', async () => {
            const result = await tool.evaluate('(10 + 5) * 3 / 5');
            expect(result).toBe(9);
        });

        it('should evaluate expressions with Math functions', async () => {
            const result = await tool.evaluate('Math.sqrt(16) + Math.pow(2, 3)');
            expect(result).toBe(12);
        });

        it('should handle multiplication', async () => {
            const result = await tool.evaluate('784*566');
            expect(result).toBe(443744);
            expect(consoleLogSpy).toHaveBeenCalledWith('exp ', '784*566', 443744);
        });

        it('should handle division', async () => {
            const result = await tool.evaluate('100 / 4');
            expect(result).toBe(25);
        });

        it('should handle expressions with decimals', async () => {
            const result = await tool.evaluate('3.14 * 2');
            expect(result).toBeCloseTo(6.28);
        });

        it('should throw error for invalid expressions', async () => {
            // Note: In real usage, eval() can throw errors for invalid syntax
            // This test demonstrates that the tool passes through eval errors
            await expect(tool.evaluate('invalid expression')).rejects.toThrow();
        });
    });

    describe('functionMap', () => {
        it('should have evaluate function properly bound', async () => {
            const evaluateFn = tool.functionMap['evaluate'];
            const result = await evaluateFn('5 * 5');
            expect(result).toBe(25);
        });
    });
});