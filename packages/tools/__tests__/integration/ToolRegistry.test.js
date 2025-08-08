import { ToolRegistry } from '../../src/integration/ToolRegistry.js';

describe('ToolRegistry', () => {
  let toolRegistry;
  
  beforeEach(() => {
    toolRegistry = new ToolRegistry();
  });
  
  test('should work with file-like tools module', async () => {
    console.log('🧪 Testing file-like tools module');
    
    // This mimics the structure we're using in the test
    const fileTools = {
      getTools: () => [
        {
          name: 'directory_create',
          description: 'Create a directory',
          execute: async (args) => {
            console.log(`Creating directory: ${args.path}`);
            return { success: true, message: 'Directory created' };
          }
        },
        {
          name: 'file_write',
          description: 'Write content to a file',
          execute: async (args) => {
            console.log(`Writing file: ${args.filepath || args.path}`);
            return { success: true, message: 'File written successfully' };
          }
        }
      ],
      // This is what's missing in our test!
      getTool: function(name) {
        const tools = this.getTools();
        return tools.find(t => t.name === name) || null;
      }
    };
    
    console.log('📋 Registering fileTools module...');
    await toolRegistry.registerModule(fileTools, 'file_tools');
    
    // Check if module was registered
    console.log('✅ Module registered. Checking availability...');
    expect(toolRegistry.hasProvider('file_tools')).toBe(true);
    
    // Debug: Check what metadata was created
    console.log('🔍 Debug: Checking metadata...');
    const metadata = await toolRegistry.getModuleMetadata('file_tools');
    console.log('  Metadata:', JSON.stringify(metadata, null, 2));
    
    // Debug: Check what providers exist
    console.log('  Providers:', toolRegistry.listProviders());
    
    // Now try to get the tools
    console.log('🔍 Getting tools...');
    const dirCreateTool = await toolRegistry.getTool('directory_create');
    const fileWriteTool = await toolRegistry.getTool('file_write');
    
    console.log('📊 Results:');
    console.log('  directory_create found:', !!dirCreateTool);
    console.log('  file_write found:', !!fileWriteTool);
    
    expect(dirCreateTool).toBeDefined();
    expect(fileWriteTool).toBeDefined();
    expect(dirCreateTool.name).toBe('directory_create');
    expect(fileWriteTool.name).toBe('file_write');
    
    // Execute them
    console.log('⚡ Testing execution...');
    const result1 = await dirCreateTool.execute({ path: '/tmp/test' });
    expect(result1.success).toBe(true);
    
    const result2 = await fileWriteTool.execute({ filepath: '/tmp/test.txt', content: 'hello' });
    expect(result2.success).toBe(true);
    
    console.log('✅ All tests passed!');
  });
  
  test('should retrieve tool by simple name', async () => {
    const testModule = {
      getTools: () => [
        {
          name: 'simple_tool',
          description: 'A simple tool',
          execute: async (args) => ({ success: true, result: 'executed' })
        }
      ],
      getTool: function(name) {
        const tools = this.getTools();
        return tools.find(t => t.name === name) || null;
      }
    };
    
    await toolRegistry.registerModule(testModule, 'test_module');
    
    // Get tool by simple name
    const tool = await toolRegistry.getTool('simple_tool');
    
    expect(tool).toBeDefined();
    expect(tool.name).toBe('simple_tool');
    
    // Execute the tool
    const result = await tool.execute({});
    expect(result.success).toBe(true);
    expect(result.result).toBe('executed');
  });
  
  test('should return null for non-existent tool', async () => {
    const tool = await toolRegistry.getTool('non_existent_tool');
    expect(tool).toBeNull();
  });
});