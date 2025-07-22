/**
 * @module @legion/conan-the-deployer
 * @description Deploy and monitor Node.js applications across multiple providers
 */

export { default as ConanTheDeployer } from './ConanTheDeployer.js';
export { default as BaseProvider } from './providers/BaseProvider.js';
export { default as LocalProvider } from './providers/LocalProvider.js';
export { default as DockerProvider } from './providers/DockerProvider.js';
export { default as RailwayProviderAdapter } from './providers/RailwayProviderAdapter.js';

// Export tools
export { default as CheckDeploymentTool } from './tools/CheckDeploymentTool.js';

// Export models
export { default as Deployment } from './models/Deployment.js';
export { default as DeploymentConfig } from './models/DeploymentConfig.js';
export { DeploymentStatus } from './models/DeploymentStatus.js';

// Export monitoring components
export { default as DeploymentMonitor } from './monitor/DeploymentMonitor.js';
export { default as MetricsCollector } from './monitor/MetricsCollector.js';
export { default as LogAggregator } from './monitor/LogAggregator.js';

// Default export for module loader
export { default } from './ConanTheDeployer.js';