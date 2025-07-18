# @jsenvoy/node-runner

Node.js process execution and lifecycle management for jsEnvoy AI agents.

## Overview

This package provides comprehensive Node.js process management capabilities for AI agents, including process lifecycle management, web server orchestration, and NPM package operations. It's designed to enable AI agents to execute and manage Node.js applications effectively, particularly useful for testing generated code.

## Features

- **Process Management**: Start, stop, restart, and monitor Node.js processes
- **Server Management**: Web server lifecycle with health checks and port management
- **Package Management**: NPM operations including dependency installation and script execution
- **Port Management**: Automatic port conflict resolution and availability checking
- **Cleanup Handling**: Automatic resource cleanup on exit
- **Log Capture**: Process output capture with buffering
- **Health Monitoring**: Server health checks and status monitoring

## Installation

```bash
npm install @jsenvoy/node-runner
```

## Usage

### As a JSON Module (Recommended)

The package can be loaded as a JSON module using the jsEnvoy module loader:

```javascript
import { ModuleFactory } from '@jsenvoy/module-loader';

const moduleFactory = new ModuleFactory();
const nodeRunnerModule = await moduleFactory.createJsonModule('./node_modules/@jsenvoy/node-runner/module.json');
const tools = await nodeRunnerModule.getTools();
```

### Direct Usage

```javascript
import NodeRunner from '@jsenvoy/node-runner';

const runner = new NodeRunner({
  autoCleanup: true,
  logBufferSize: 1000
});

// Start a Node.js process
const process = await runner.startNodeProcess('node server.js', {
  cwd: '/path/to/project',
  env: { PORT: 3000 }
});

// Start a web server with health checks
const server = await runner.startWebServer('npm start', {
  port: 3000,
  healthCheck: true,
  healthCheckPath: '/health'
});

// Install dependencies
await runner.installDependencies({
  cwd: '/path/to/project',
  production: false
});

// Clean up all resources
await runner.cleanup();
```

## Available Tools

When loaded as a JSON module, the following 9 tools are available:

### start_node_process
Start a Node.js process with full configuration options.

```javascript
{
  "command": "node server.js",
  "cwd": "/path/to/project",
  "env": {
    "NODE_ENV": "development",
    "PORT": "3000"
  }
}
```

### stop_process
Stop a running process gracefully or forcefully.

```javascript
{
  "processId": "process-1234567890-abcd",
  "force": false,
  "timeout": 5000
}
```

### restart_process
Restart a process with new configuration.

```javascript
{
  "processId": "process-1234567890-abcd",
  "env": {
    "NODE_ENV": "production"
  }
}
```

### list_processes
List all managed processes and their status.

```javascript
{}
```

### start_web_server
Start a web server with port management and health checks.

```javascript
{
  "command": "node app.js",
  "port": 3000,
  "host": "localhost",
  "healthCheck": true,
  "healthCheckPath": "/health"
}
```

### start_dev_server
Start a development server with hot reload support.

```javascript
{
  "command": "npm run dev",
  "port": 3000,
  "framework": "react"
}
```

### check_server_health
Check the health status of a running server.

```javascript
{
  "serverId": "process-1234567890-abcd"
}
```

### install_dependencies
Install NPM packages and dependencies.

```javascript
{
  "cwd": "/path/to/project",
  "packageManager": "auto",
  "production": false,
  "force": false
}
```

### run_npm_script
Execute a script defined in package.json.

```javascript
{
  "scriptName": "build",
  "cwd": "/path/to/project",
  "args": ["--production"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

## Configuration

The NodeRunner supports various configuration options:

```javascript
const config = {
  autoCleanup: true,        // Automatically cleanup on exit
  logBufferSize: 1000      // Number of log entries to buffer per process
};
```

## Process Management

### Lifecycle Management

```javascript
// Start a process
const result = await runner.startNodeProcess('node worker.js');
console.log(`Started process ${result.id} with PID ${result.pid}`);

// Check process status
const processes = await runner.listProcesses();
console.log(`Running ${processes.count} processes`);

// Stop a process gracefully
await runner.stopProcess(result.id);

// Force kill a process
await runner.stopProcess(result.id, { force: true });
```

### Server Management

```javascript
// Start a web server
const server = await runner.startWebServer('node server.js', {
  port: 3000,
  healthCheck: true
});

// Wait for server to be ready
console.log(`Server running at ${server.url}`);

// Check server health
const health = await runner.checkServerHealth(server.id);
console.log(`Server status: ${health.status}`);

// Restart server with new configuration
await runner.restartProcess(server.id, {
  env: { DEBUG: 'true' }
});
```

## Package Management

### Installing Dependencies

```javascript
// Auto-detect package manager from lock file
await runner.installDependencies({
  cwd: '/path/to/project'
});

// Use specific package manager
await runner.installDependencies({
  cwd: '/path/to/project',
  packageManager: 'npm',
  production: true
});
```

### Running Scripts

```javascript
// Run a build script
const result = await runner.runNpmScript('build', {
  cwd: '/path/to/project',
  env: { NODE_ENV: 'production' }
});

if (result.success) {
  console.log('Build completed successfully');
} else {
  console.error('Build failed:', result.errors);
}
```

## Port Management

```javascript
// Find an available port
const portResult = await runner.findAvailablePort(3000);
console.log(`Available port: ${portResult.port}`);

// Kill process on specific port
await runner.killProcessOnPort(3000);

// Wait for port to be in use
await runner.waitForPort(3000, { timeout: 10000 });
```

## Integration with Code Generation

This package is designed to work seamlessly with code generation tools:

```javascript
// Generate and test a web application
async function testGeneratedApp(generatedPath) {
  const runner = new NodeRunner();
  
  // Install dependencies
  await runner.installDependencies({ cwd: generatedPath });
  
  // Run tests
  const testResult = await runner.runNpmScript('test', { cwd: generatedPath });
  
  if (testResult.success) {
    // Start the application
    const server = await runner.startWebServer('npm start', {
      cwd: generatedPath,
      port: 3000
    });
    
    // Application is now running and ready for testing
    console.log(`Application running at ${server.url}`);
    
    // Can be integrated with Playwright for E2E testing
    return server;
  }
}
```

## Error Handling

All operations return a consistent result format:

```javascript
{
  success: true/false,
  // Operation-specific data when successful
  error: "Error message when failed"
}
```

## Cleanup

The package automatically handles cleanup when configured:

```javascript
// Automatic cleanup on process exit
const runner = new NodeRunner({ autoCleanup: true });

// Manual cleanup
await runner.cleanup();
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests to the main repository.