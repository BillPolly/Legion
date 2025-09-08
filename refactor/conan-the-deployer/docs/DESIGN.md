# Conan-the-Deployer Design Document

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Provider Architecture](#provider-architecture)
5. [Deployment Lifecycle](#deployment-lifecycle)
6. [Monitoring System](#monitoring-system)
7. [Security Considerations](#security-considerations)
8. [API Specifications](#api-specifications)
9. [Integration Points](#integration-points)
10. [Future Considerations](#future-considerations)

## Overview

Conan-the-Deployer is a sophisticated deployment and monitoring system designed specifically for Node.js applications and frontends. It provides a unified interface for deploying applications across multiple providers while maintaining consistent monitoring, logging, and management capabilities.

### Goals
- **Provider Agnostic**: Deploy to local, Docker, or cloud environments with the same interface
- **Monitoring First**: Built-in monitoring and health checks for all deployments
- **Developer Friendly**: Simple API with sensible defaults
- **Production Ready**: Robust error handling and recovery mechanisms
- **Extensible**: Easy to add new providers and monitoring capabilities

### Non-Goals
- Not a CI/CD pipeline (but can be integrated into one)
- Not a container orchestration platform (uses existing solutions)
- Not a log aggregation service (integrates with existing tools)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ConanTheDeployer Module                   │
├─────────────────────────────────────────────────────────────┤
│                      Tool Interface Layer                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Deploy    │  │   Monitor    │  │     Update       │  │
│  │ Application │  │  Deployment  │  │   Deployment     │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Core Orchestration Layer                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Deployment  │  │   Health     │  │    Metrics       │  │
│  │  Manager    │  │   Monitor    │  │   Collector      │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      Provider Layer                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │    Local    │  │    Docker    │  │    Railway       │  │
│  │  Provider   │  │   Provider   │  │   Provider       │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Request → Tool Interface → Deployment Manager → Provider
                                        ↓
                                  Health Monitor
                                        ↓
                                 Metrics Collector
                                        ↓
                                    Response
```

## Core Components

### 1. ConanTheDeployer (Main Module)

The main module class that implements the jsEnvoy module interface:

```javascript
class ConanTheDeployer extends Module {
  constructor(config) {
    super();
    this.deploymentManager = new DeploymentManager(config);
    this.monitoringSystem = new MonitoringSystem(config);
    this.providers = this.initializeProviders(config);
  }
}
```

**Responsibilities:**
- Module initialization and configuration
- Tool registration and exposure
- Provider management
- Event emission for deployment lifecycle

### 2. DeploymentManager

Orchestrates deployments across providers:

```javascript
class DeploymentManager {
  async deploy(projectPath, provider, config) {
    // Validation
    // Provider selection
    // Pre-deployment hooks
    // Deployment execution
    // Post-deployment verification
    // Registration with monitoring
  }
}
```

**Key Features:**
- Deployment state management
- Provider abstraction
- Rollback capabilities
- Deployment history

### 3. MonitoringSystem

Provides unified monitoring across all deployments:

```javascript
class MonitoringSystem {
  constructor() {
    this.healthMonitor = new HealthMonitor();
    this.metricsCollector = new MetricsCollector();
    this.logAggregator = new LogAggregator();
  }
}
```

**Components:**
- **HealthMonitor**: Periodic health checks
- **MetricsCollector**: CPU, memory, request metrics
- **LogAggregator**: Centralized log collection

## Provider Architecture

### BaseProvider Interface

All providers must implement this interface:

```javascript
class BaseProvider {
  // Deployment operations
  async deploy(config) { throw new Error('Not implemented'); }
  async update(deploymentId, config) { throw new Error('Not implemented'); }
  async stop(deploymentId) { throw new Error('Not implemented'); }
  async remove(deploymentId) { throw new Error('Not implemented'); }
  
  // Monitoring operations
  async getStatus(deploymentId) { throw new Error('Not implemented'); }
  async getLogs(deploymentId, options) { throw new Error('Not implemented'); }
  async getMetrics(deploymentId) { throw new Error('Not implemented'); }
  
  // Provider capabilities
  getCapabilities() {
    return {
      supportsRollingUpdate: false,
      supportsBlueGreen: false,
      supportsHealthChecks: false,
      supportsMetrics: false,
      supportsCustomDomains: false
    };
  }
}
```

### LocalProvider

Deploys applications to the local filesystem:

**Features:**
- Process management using child_process
- Port allocation and management
- File system isolation
- Hot reload support for development

**Implementation Details:**
```javascript
class LocalProvider extends BaseProvider {
  constructor(config) {
    this.processManager = new ProcessManager();
    this.portManager = new PortManager();
    this.deployments = new Map();
  }
  
  async deploy(config) {
    const port = await this.portManager.allocatePort(config.preferredPort);
    const process = await this.processManager.start({
      command: config.startCommand || 'npm start',
      cwd: config.projectPath,
      env: { ...config.env, PORT: port }
    });
    
    return {
      id: generateId(),
      port,
      pid: process.pid,
      status: 'running'
    };
  }
}
```

### DockerProvider

Manages Docker container deployments:

**Features:**
- Dockerfile generation (if not present)
- Image building and caching
- Container lifecycle management
- Network bridge for browser access
- Volume mounting for development

**Implementation Details:**
```javascript
class DockerProvider extends BaseProvider {
  constructor(config) {
    this.docker = new Docker(config.dockerOptions);
    this.networkManager = new DockerNetworkManager();
  }
  
  async deploy(config) {
    const image = await this.buildImage(config);
    const container = await this.createContainer(image, config);
    await container.start();
    
    return {
      id: container.id,
      image: image.id,
      ports: await this.getExposedPorts(container),
      status: 'running'
    };
  }
  
  async buildImage(config) {
    const dockerfile = await this.generateDockerfile(config);
    const tarStream = await this.createBuildContext(config.projectPath);
    return await this.docker.buildImage(tarStream, {
      dockerfile,
      t: config.imageName
    });
  }
}
```

### RailwayProvider

Integrates with Railway's cloud platform:

**Features:**
- GraphQL API integration
- Project and service management
- Environment variable configuration
- Custom domain support
- Deployment tracking

**Implementation Details:**
```javascript
class RailwayProvider extends BaseProvider {
  constructor(config) {
    this.apiToken = config.railwayToken;
    this.graphqlClient = new RailwayGraphQLClient(this.apiToken);
  }
  
  async deploy(config) {
    const project = await this.createOrGetProject(config.projectName);
    const service = await this.createService(project.id, config);
    
    const deployment = await this.graphqlClient.mutation({
      deployService: {
        projectId: project.id,
        serviceId: service.id,
        source: await this.prepareSource(config.projectPath)
      }
    });
    
    return {
      id: deployment.id,
      projectId: project.id,
      serviceId: service.id,
      status: 'deploying',
      url: deployment.url
    };
  }
}
```

## Deployment Lifecycle

### 1. Pre-Deployment Phase
- **Validation**: Check project structure, dependencies
- **Build**: Run build scripts if configured
- **Resource Allocation**: Ports, containers, cloud resources

### 2. Deployment Phase
- **Provider Selection**: Choose appropriate provider
- **Execution**: Provider-specific deployment
- **Verification**: Initial health checks

### 3. Post-Deployment Phase
- **Health Monitoring**: Continuous health checks
- **Metrics Collection**: Start collecting metrics
- **Event Emission**: Notify success/failure

### State Machine

```
    ┌─────────┐
    │ PENDING │
    └────┬────┘
         │
    ┌────▼────┐
    │DEPLOYING│
    └────┬────┘
         │
    ┌────▼────┐     ┌─────────┐
    │ RUNNING ├────►│ UPDATING│
    └────┬────┘     └────┬────┘
         │                │
    ┌────▼────┐     ┌────▼────┐
    │ STOPPED │     │  FAILED │
    └─────────┘     └─────────┘
```

## Monitoring System

### Health Checks

Different health check strategies per provider:

**Local Provider:**
- Process alive check
- HTTP endpoint verification
- Port availability

**Docker Provider:**
- Container status
- Docker health checks
- Network connectivity

**Railway Provider:**
- Deployment status via API
- Service health endpoints
- Custom health checks

### Metrics Collection

**Standard Metrics:**
- CPU usage
- Memory usage
- Request count
- Error rate
- Response time

**Provider-Specific Metrics:**
- Local: Process metrics via OS
- Docker: Container stats API
- Railway: Platform metrics via GraphQL

### Log Aggregation

Unified log collection across providers:

```javascript
class LogAggregator {
  async streamLogs(deploymentId, options = {}) {
    const provider = this.getProvider(deploymentId);
    const logStream = await provider.getLogs(deploymentId, options);
    
    return logStream.pipe(
      this.parseLogFormat(),
      this.enrichWithMetadata(),
      this.filterByLevel(options.level)
    );
  }
}
```

## Security Considerations

### Authentication & Authorization
- API tokens stored securely
- Provider credentials isolation
- Deployment access control

### Network Security
- Local: Process isolation
- Docker: Network segmentation
- Railway: Platform security

### Secrets Management
- Environment variable encryption
- Secure token storage
- Runtime secret injection

## API Specifications

### Tool: deploy_application

**Purpose**: Deploy a Node.js application to a specified provider

**Parameters:**
```typescript
interface DeployApplicationParams {
  projectPath: string;        // Path to Node.js project
  provider: 'local' | 'docker' | 'railway';
  name: string;              // Deployment name
  config?: {
    env?: Record<string, string>;
    port?: number;
    startCommand?: string;
    buildCommand?: string;
    healthCheckPath?: string;
    // Provider-specific options
    docker?: {
      dockerfile?: string;
      buildArgs?: Record<string, string>;
      network?: string;
    };
    railway?: {
      projectId?: string;
      environment?: string;
      region?: string;
    };
  };
}
```

**Response:**
```typescript
interface DeploymentResponse {
  id: string;
  name: string;
  provider: string;
  status: 'pending' | 'deploying' | 'running' | 'failed';
  url?: string;
  port?: number;
  startTime: string;
  metadata: Record<string, any>;
}
```

### Tool: monitor_deployment

**Purpose**: Monitor health and metrics of a deployment

**Parameters:**
```typescript
interface MonitorDeploymentParams {
  deploymentId: string;
  metrics?: Array<'health' | 'cpu' | 'memory' | 'requests' | 'errors'>;
  interval?: number;  // Monitoring interval in ms
}
```

**Response:**
```typescript
interface MonitoringResponse {
  deploymentId: string;
  timestamp: string;
  health: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    checks: HealthCheck[];
  };
  metrics: {
    cpu?: { usage: number; limit: number };
    memory?: { usage: number; limit: number };
    requests?: { count: number; rate: number };
    errors?: { count: number; rate: number };
  };
}
```

### Tool: update_deployment

**Purpose**: Update an existing deployment with new code

**Parameters:**
```typescript
interface UpdateDeploymentParams {
  deploymentId: string;
  projectPath: string;
  strategy?: 'rolling' | 'recreate' | 'blue-green';
  config?: DeploymentConfig;
}
```

### Events

The module emits the following events:

```typescript
// Deployment lifecycle
'deployment:started': { deploymentId: string; provider: string }
'deployment:progress': { deploymentId: string; progress: number; message: string }
'deployment:completed': { deployment: DeploymentResponse }
'deployment:failed': { deploymentId: string; error: Error }

// Monitoring events
'deployment:health': { deploymentId: string; status: string; details: any }
'deployment:metrics': { deploymentId: string; metrics: MetricsData }
'deployment:logs': { deploymentId: string; logs: LogEntry[] }

// Provider events
'provider:connected': { provider: string }
'provider:error': { provider: string; error: Error }
```

## Integration Points

### 1. jsEnvoy Module System
- Implements Module base class
- Exposes tools via JSON descriptor
- Uses ResourceManager for dependencies

### 2. Other jsEnvoy Modules
- **node-runner**: Process management for LocalProvider
- **log-manager**: Log aggregation and analysis
- **file-tools**: Project file operations

### 3. External Services
- Docker Engine API
- Railway GraphQL API
- Process monitoring tools

### 4. Development Tools
- Git integration for source control
- CI/CD webhook support
- IDE extensions

## Future Considerations

### Additional Providers
- **Kubernetes**: Container orchestration
- **AWS ECS/Fargate**: AWS container services
- **Vercel**: Frontend deployment
- **Fly.io**: Edge deployment

### Advanced Features
- **Auto-scaling**: Based on metrics
- **Multi-region**: Geographic distribution
- **Canary Deployments**: Gradual rollout
- **A/B Testing**: Traffic splitting

### Monitoring Enhancements
- **APM Integration**: Application performance monitoring
- **Custom Metrics**: User-defined metrics
- **Alerting**: Threshold-based alerts
- **Dashboards**: Real-time visualization

### Developer Experience
- **CLI Tool**: Standalone deployment CLI
- **Web UI**: Management dashboard
- **IDE Plugins**: Direct deployment from editors
- **Templates**: Pre-configured deployment templates

## Conclusion

Conan-the-Deployer provides a comprehensive solution for deploying and monitoring Node.js applications across multiple providers. Its modular architecture, consistent API, and robust monitoring capabilities make it an ideal choice for developers who need flexible deployment options without sacrificing simplicity or reliability.

The provider-based architecture ensures that new deployment targets can be added easily while maintaining backward compatibility. The built-in monitoring system provides visibility into application health and performance regardless of where the application is deployed.

Through its integration with the jsEnvoy ecosystem, Conan-the-Deployer becomes a powerful tool in the AI agent toolkit, enabling automated deployment and management of generated applications.