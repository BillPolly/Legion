/**
 * TestJsonModule Entry Point
 * Loads the module.json and creates a DynamicJsonModule instance
 */

import { DynamicJsonModule } from '../tools/src/loading/DynamicJsonModule.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load module.json
const moduleJsonPath = join(__dirname, 'module.json');
const moduleDefinition = JSON.parse(readFileSync(moduleJsonPath, 'utf-8'));

// Create module class
class TestJsonModule extends DynamicJsonModule {
  constructor(dependencies = {}) {
    super(moduleDefinition, dependencies);
    // Load tools immediately on construction
    this.loadTools(moduleDefinition);
  }

  static async create(resourceManager) {
    const module = new TestJsonModule({ resourceManager });
    await module.initialize();
    return module;
  }
}

export { TestJsonModule };
export default TestJsonModule;