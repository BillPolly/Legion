/**
 * ModuleNotFoundError - Error thrown when a module is not found
 */

export class ModuleNotFoundError extends Error {
  constructor(moduleName, availableModules = []) {
    super(`Module not found: ${moduleName}`);
    this.name = 'ModuleNotFoundError';
    this.moduleName = moduleName;
    this.availableModules = availableModules;
  }
}

export default ModuleNotFoundError;