const { FileModule } = require('@jsenvoy/tools');
const { FileReaderTool, FileWriterTool, DirectoryCreatorTool } = require('@jsenvoy/tools/src/file');
const { OpenAIModule } = require('../../src/core');

describe('FileModule', () => {
  let module;
  let mockDependencies;

  beforeEach(() => {
    // Setup dependencies
    mockDependencies = {
      basePath: '/test/path',
      encoding: 'utf-8',
      createDirectories: true,
      permissions: 0o755
    };

    module = new FileModule(mockDependencies);
  });

  describe('static properties', () => {
    it('should declare required dependencies', () => {
      expect(FileModule.dependencies).toEqual(['basePath', 'encoding', 'createDirectories', 'permissions']);
    });
  });

  describe('constructor', () => {
    it('should extend OpenAIModule', () => {
      expect(module).toBeInstanceOf(OpenAIModule.OpenAIModule);
    });

    it('should set module name', () => {
      expect(module.name).toBe('file');
    });

    it('should create all three file tools', () => {
      expect(module.tools).toHaveLength(3);
      expect(module.tools[0]).toBeInstanceOf(FileReaderTool);
      expect(module.tools[1]).toBeInstanceOf(FileWriterTool);
      expect(module.tools[2]).toBeInstanceOf(DirectoryCreatorTool);
    });

    it('should pass dependencies to FileReaderTool', () => {
      const readerTool = module.tools[0];
      expect(readerTool.basePath).toBe('/test/path');
      expect(readerTool.encoding).toBe('utf-8');
    });

    it('should pass dependencies to FileWriterTool', () => {
      const writerTool = module.tools[1];
      expect(writerTool.basePath).toBe('/test/path');
      expect(writerTool.encoding).toBe('utf-8');
      expect(writerTool.createDirectories).toBe(true);
    });

    it('should pass dependencies to DirectoryCreatorTool', () => {
      const dirTool = module.tools[2];
      expect(dirTool.basePath).toBe('/test/path');
      expect(dirTool.permissions).toBe(0o755);
    });

    it('should handle missing optional dependencies', () => {
      const minimalModule = new FileModule({
        basePath: '/minimal/path'
        // encoding, createDirectories, and permissions not provided
      });

      expect(minimalModule.tools).toHaveLength(3);
      
      // Check defaults are applied in tools
      const readerTool = minimalModule.tools[0];
      expect(readerTool.encoding).toBe('utf-8'); // default

      const writerTool = minimalModule.tools[1];
      expect(writerTool.createDirectories).toBe(false); // default

      const dirTool = minimalModule.tools[2];
      expect(dirTool.permissions).toBe(0o755); // default
    });

    it('should throw error if basePath is missing', () => {
      expect(() => new FileModule({}))
        .toThrow('Missing required dependency: basePath');
    });

    it('should throw error if basePath is not a string', () => {
      expect(() => new FileModule({ basePath: 123 }))
        .toThrow('basePath must be a string');
    });
  });

  describe('getTools()', () => {
    it('should return all three tools', () => {
      const tools = module.getTools();
      expect(tools).toHaveLength(3);
      expect(tools[0].name).toBe('file_reader');
      expect(tools[1].name).toBe('file_writer');
      expect(tools[2].name).toBe('directory_creator');
    });

    it('should return the same tools array reference', () => {
      const tools1 = module.getTools();
      const tools2 = module.getTools();
      expect(tools1).toBe(tools2);
    });
  });

  describe('tool functionality', () => {
    it('should have working file reader tool', () => {
      const readerTool = module.tools[0];
      const description = readerTool.getDescription();
      expect(description.function.name).toBe('file_reader');
      expect(description.function.description).toContain('Reads the contents of a file');
    });

    it('should have working file writer tool', () => {
      const writerTool = module.tools[1];
      const description = writerTool.getDescription();
      expect(description.function.name).toBe('file_writer');
      expect(description.function.description).toContain('Writes content to a file');
    });

    it('should have working directory creator tool', () => {
      const dirTool = module.tools[2];
      const description = dirTool.getDescription();
      expect(description.function.name).toBe('directory_creator');
      expect(description.function.description).toContain('Creates directories');
    });
  });

  describe('multiple instances', () => {
    it('should create independent module instances', () => {
      const module1 = new FileModule(mockDependencies);
      const module2 = new FileModule(mockDependencies);
      
      expect(module1).not.toBe(module2);
      expect(module1.tools[0]).not.toBe(module2.tools[0]);
    });

    it('should not share state between instances', () => {
      const module1 = new FileModule(mockDependencies);
      const module2 = new FileModule({
        basePath: '/different/path',
        encoding: 'utf-8',
        createDirectories: false,
        permissions: 0o700
      });
      
      expect(module1.tools[0].basePath).toBe('/test/path');
      expect(module2.tools[0].basePath).toBe('/different/path');
      
      expect(module1.tools[1].createDirectories).toBe(true);
      expect(module2.tools[1].createDirectories).toBe(false);
      
      expect(module1.tools[2].permissions).toBe(0o755);
      expect(module2.tools[2].permissions).toBe(0o700);
    });
  });

  describe('dependency validation', () => {
    it('should validate encoding is a string if provided', () => {
      expect(() => new FileModule({
        basePath: '/path',
        encoding: 123
      })).toThrow('encoding must be a string');
    });

    it('should validate createDirectories is a boolean if provided', () => {
      expect(() => new FileModule({
        basePath: '/path',
        createDirectories: 'yes'
      })).toThrow('createDirectories must be a boolean');
    });

    it('should validate permissions is a number if provided', () => {
      expect(() => new FileModule({
        basePath: '/path',
        permissions: '755'
      })).toThrow('permissions must be a number');
    });

    it('should accept all valid dependencies', () => {
      const validModule = new FileModule({
        basePath: '/valid/path',
        encoding: 'base64',
        createDirectories: false,
        permissions: 0o700
      });

      expect(validModule.tools[0].encoding).toBe('base64');
      expect(validModule.tools[1].createDirectories).toBe(false);
      expect(validModule.tools[2].permissions).toBe(0o700);
    });
  });

  describe('OpenAI format compatibility', () => {
    it('should have all tools return valid OpenAI function descriptions', () => {
      const tools = module.getTools();
      
      tools.forEach(tool => {
        const description = tool.getDescription();
        expect(description.type).toBe('function');
        expect(description.function).toBeDefined();
        expect(description.function.name).toBeDefined();
        expect(description.function.description).toBeDefined();
        expect(description.function.parameters).toBeDefined();
        expect(description.function.parameters.type).toBe('object');
        expect(description.function.parameters.properties).toBeDefined();
        expect(description.function.parameters.required).toBeInstanceOf(Array);
      });
    });
  });
});