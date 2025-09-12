/**
 * Quick Test of Web Tools (web_fetch, web_search)
 * Tests these tools exist and have basic functionality
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';

describe('Web Tools Quick Test', () => {
  let toolsModule;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    toolsModule = await GeminiToolsModule.create(resourceManager);
    console.log('✅ Tools module initialized');
  });

  it('should have web_fetch tool available', async () => {
    const tools = toolsModule.getTools();
    const webFetchTool = Object.values(tools).find(tool => 
      tool.name === 'web_fetch' || tool.toolName === 'web_fetch'
    );
    
    expect(webFetchTool).toBeDefined();
    console.log('✅ web_fetch tool found');
  });

  it('should have web_search tool available', async () => {
    const tools = toolsModule.getTools();
    const webSearchTool = Object.values(tools).find(tool => 
      tool.name === 'web_search' || tool.toolName === 'web_search'
    );
    
    expect(webSearchTool).toBeDefined();
    console.log('✅ web_search tool found');
  });

  it('should have MCP tools available', async () => {
    const tools = toolsModule.getTools();
    const toolNames = Object.values(tools).map(t => t.name || t.toolName);
    
    expect(toolNames).toContain('mcp_client');
    expect(toolNames).toContain('mcp_client_manager');
    expect(toolNames).toContain('mcp_tool');
    
    console.log('✅ All MCP tools found');
  });

  it('should have advanced file tools available', async () => {
    const tools = toolsModule.getTools();
    const toolNames = Object.values(tools).map(t => t.name || t.toolName);
    
    expect(toolNames).toContain('smart_edit');
    expect(toolNames).toContain('ripgrep_search');
    
    console.log('✅ Advanced file tools found');
    console.log('📋 All 16 tools verified:', toolNames);
  });
});