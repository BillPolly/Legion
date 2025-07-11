const { fileReaderTool } = require('../../src/tools/file-reader');
const { readFile } = require('fs/promises');

jest.mock('fs/promises');

describe('FileReaderTool', () => {
    const tool = fileReaderTool;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(tool.name).toBe('file reader tool');
            expect(tool.identifier).toBe('file-reader-tool');
            expect(tool.abilities).toEqual(['You can read a given file from disk']);
            expect(tool.instructions).toEqual([
                'Read using read function'
            ]);
            expect(tool.functions).toHaveLength(1);
            expect(tool.functions[0]).toEqual({
                name: 'read',
                purpose: 'Read a file from disk',
                arguments: [{
                    name: 'filePath',
                    description: 'Path of the file to read',
                    dataType: 'string'
                }],
                response: 'Content of the file in string format'
            });
            expect(tool.functionMap).toHaveProperty('read');
        });
    });

    describe('read', () => {
        it('should read file contents successfully', async () => {
            const mockContent = 'This is the file content';
            readFile.mockResolvedValue(mockContent);

            const result = await tool.read('/path/to/file.txt');

            expect(readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
            expect(result).toBe(mockContent);
        });

        it('should handle empty files', async () => {
            readFile.mockResolvedValue('');

            const result = await tool.read('/path/to/empty.txt');

            expect(readFile).toHaveBeenCalledWith('/path/to/empty.txt', 'utf-8');
            expect(result).toBe('');
        });

        it('should handle large files', async () => {
            const largeContent = 'x'.repeat(10000);
            readFile.mockResolvedValue(largeContent);

            const result = await tool.read('/path/to/large.txt');

            expect(result).toBe(largeContent);
        });

        it('should handle file read errors', async () => {
            const error = new Error('ENOENT: no such file or directory');
            readFile.mockRejectedValue(error);

            const result = await tool.read('/nonexistent/file.txt');
            
            expect(result).toBe('Error reading file: Error: ENOENT: no such file or directory');
        });

        it('should handle permission errors', async () => {
            const error = new Error('EACCES: permission denied');
            readFile.mockRejectedValue(error);

            const result = await tool.read('/protected/file.txt');
            
            expect(result).toBe('Error reading file: Error: EACCES: permission denied');
        });
    });

    describe('functionMap', () => {
        it('should have read function properly bound', async () => {
            const mockContent = 'Test content';
            readFile.mockResolvedValue(mockContent);

            const readFn = tool.functionMap['read'];
            const result = await readFn('/test/path.txt');

            expect(result).toBe(mockContent);
            expect(readFile).toHaveBeenCalledWith('/test/path.txt', 'utf-8');
        });
    });
});