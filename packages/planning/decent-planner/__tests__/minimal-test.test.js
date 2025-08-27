import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

console.log('Getting singletons at module level...');
const resourceManager = await ResourceManager.getInstance();
const toolRegistry = await getToolRegistry();
console.log('✅ Got singletons successfully');

describe('Minimal Test', () => {
  it('should use pre-initialized singletons', async () => {
    expect(resourceManager).toBeDefined();
    expect(toolRegistry).toBeDefined();
    console.log('Test passed with pre-initialized singletons');
  });
});