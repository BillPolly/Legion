/**
 * Debug test to check ModuleLoader path resolution
 */

import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import fs from 'fs/promises';
import path from 'path';

describe('ModuleLoader Debug', () => {
  test('should show path resolution details', async () => {
    const loader = new ModuleLoader({ verbose: true });
    console.log('Current working directory:', process.cwd());
    console.log('Monorepo root detected as:', loader.monorepoRoot);
    
    // Check if the monorepo root is correct
    const packageJsonPath = path.join(loader.monorepoRoot, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      console.log('Root package.json name:', packageJson.name);
      console.log('Root package.json has workspaces:', !!packageJson.workspaces);
    } catch (error) {
      console.log('No package.json at root:', error.message);
    }

    // Check for registry file
    const registryPath = path.join(loader.monorepoRoot, 'packages/tools/src/loading/module-registry.json');
    try {
      await fs.access(registryPath);
      console.log('Registry file exists at expected location');
    } catch (error) {
      console.log('Registry file NOT found at expected location:', registryPath);
    }

    // Read registry and check first module path
    const registryContent = await fs.readFile('src/loading/module-registry.json', 'utf-8');
    const modules = JSON.parse(registryContent);
    const firstModule = modules[0];
    console.log('First module config:', firstModule);
    
    const expectedPath = path.join(loader.monorepoRoot, firstModule.path, 'index.js');
    console.log('Expected module path would be:', expectedPath);
    
    try {
      await fs.access(expectedPath);
      console.log('✅ Expected module path exists');
    } catch (error) {
      console.log('❌ Expected module path does NOT exist');
      
      // Try alternative paths
      const alt1 = path.resolve('../../' + firstModule.path + '/index.js');
      const alt2 = path.resolve('../' + firstModule.path + '/index.js'); 
      const alt3 = path.resolve(firstModule.path + '/index.js');
      
      console.log('Trying alternative paths:');
      console.log('Alt 1:', alt1);
      console.log('Alt 2:', alt2);
      console.log('Alt 3:', alt3);
      
      for (const altPath of [alt1, alt2, alt3]) {
        try {
          await fs.access(altPath);
          console.log(`✅ ${altPath} EXISTS`);
        } catch (e) {
          console.log(`❌ ${altPath} does not exist`);
        }
      }
    }

    expect(true).toBe(true); // Just a placeholder
  });
});