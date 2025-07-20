import RailwayModule from './RailwayModule.js';
import RailwayProvider from './providers/RailwayProvider.js';

// Export main module
export default RailwayModule;

// Export provider for direct usage
export { RailwayProvider };

// Module factory function for jsEnvoy module loader
export function createModule(resourceManager) {
  return new RailwayModule(resourceManager);
}