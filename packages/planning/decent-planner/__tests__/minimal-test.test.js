import { ResourceManager } from '/Users/williampearson/Documents/p/agents/Legion/packages/resource-manager/src/ResourceManager.js';
import { ToolRegistry } from '/Users/williampearson/Documents/p/agents/Legion/packages/tools-registry/src/integration/ToolRegistry.js';

console.log('Getting singletons at module level...');
const resourceManager = await ResourceManager.getInstance();
const toolRegistry = await ToolRegistry.getInstance();
console.log('✅ Got singletons successfully');

describe('Minimal Test', () => {
  it('should use pre-initialized singletons', async () => {
    expect(resourceManager).toBeDefined();
    expect(toolRegistry).toBeDefined();
    console.log('Test passed with pre-initialized singletons');
  });
});