/**
 * SDObservabilityAgent - Intelligent observability and chat agent for SD system
 * 
 * Provides real-time monitoring of the SD system with an intelligent chat interface
 * that can answer questions about the development process, locate artifacts, and
 * explain the SD methodology.
 */

import { SDAgentBase } from '../SDAgentBase.js';
import { ArtifactIndexer } from './services/ArtifactIndexer.js';
import { AgentMonitor } from './services/AgentMonitor.js';
import { DiagramGenerator } from './services/DiagramGenerator.js';
import { SDSystemKnowledge } from './knowledge/SDSystemKnowledge.js';

export class SDObservabilityAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'SDObservabilityAgent',
      description: 'Intelligent observability and chat agent for SD system monitoring'
    });
    
    // Chat capabilities
    this.conversationHistory = [];
    this.maxHistoryLength = 20;
    
    // System knowledge base
    this.systemKnowledge = new SDSystemKnowledge();
    
    // Services
    this.artifactIndexer = null;
    this.agentMonitor = null;
    this.diagramGenerator = null;
    
    // Current monitoring state
    this.currentProjectId = null;
    this.subscriptions = new Map(); // clientId -> subscriptions
    this.changeStreams = new Map(); // collection -> change stream
    
    // System prompt for chat intelligence
    this.systemPrompt = `You are the SD System Observer, an intelligent assistant that monitors and explains the autonomous software development process.

You have access to:
1. All project artifacts (requirements, domain models, architecture, code)
2. Real-time agent activity and status
3. Validation results and error logs
4. Complete development timeline and metrics
5. The entire SD system methodology and how it works

You can answer questions about:
- What agents are currently working on
- Where specific deliverables are located
- How the SD methodology works (DDD, Clean Architecture, Immutable Design)
- Why certain design decisions were made
- The current state of the project
- Any errors or issues that have occurred
- Performance metrics and quality scores

When asked about artifacts or deliverables, you can:
- Provide exact file paths and MongoDB locations
- Show artifact relationships
- Explain the artifact's purpose
- Display the actual content if requested

Be helpful, specific, and use your knowledge of the system to provide insightful answers.
Always format responses with markdown for clarity.`;
  }

  async initialize() {
    await super.initialize();
    
    // Initialize services
    this.artifactIndexer = new ArtifactIndexer(this.databaseService);
    this.agentMonitor = new AgentMonitor(this.resourceManager);
    this.diagramGenerator = new DiagramGenerator(this.databaseService);
    
    console.log('[SDObservabilityAgent] Initialized with chat intelligence');
  }

  getCurrentPhase() {
    return 'observability';
  }

  async receive(message) {
    const { type, payload, envelope } = message;
    
    try {
      switch(type) {
        case 'chat_message':
          return await this.handleChatMessage(payload);
        
        case 'get_project_status':
          return await this.getProjectStatus(payload);
        
        case 'subscribe_project':
          return await this.subscribeToProject(payload);
        
        case 'get_artifacts':
          return await this.getArtifacts(payload);
        
        case 'get_agent_status':
          return await this.getAgentStatus(payload);
        
        case 'get_diagram':
          return await this.getDiagram(payload);
        
        case 'get_metrics':
          return await this.getProjectMetrics(payload);
        
        case 'get_timeline':
          return await this.getProjectTimeline(payload);
        
        default:
          return {
            success: false,
            error: `Unknown message type: ${type}`
          };
      }
    } catch (error) {
      console.error(`[SDObservabilityAgent] Error handling ${type}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle chat messages with full system context
   */
  async handleChatMessage(payload) {
    const { content, projectId, sessionId } = payload;
    
    // Build comprehensive context
    const context = await this.buildChatContext(projectId);
    
    // Add to conversation history
    this.conversationHistory.push({ role: 'user', content });
    
    // Prepare messages for LLM
    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'system', content: `Current System Context:\n${this.formatContext(context)}` },
      ...this.conversationHistory.slice(-this.maxHistoryLength)
    ];
    
    // Get LLM response
    const llmClient = await this.getLLMClient();
    const response = await llmClient.complete({
      messages,
      temperature: 0.7,
      maxTokens: 2000
    });
    
    // Add assistant response to history
    this.conversationHistory.push({ role: 'assistant', content: response });
    
    // Extract any artifact references or commands from response
    const { artifacts, commands } = await this.extractReferences(response, context);
    
    // Execute any commands if present
    let commandResults = null;
    if (commands.length > 0) {
      commandResults = await this.executeCommands(commands, projectId);
    }
    
    return {
      success: true,
      data: {
        type: 'chat_response',
        content: response,
        artifacts: artifacts,
        commands: commandResults,
        metadata: {
          projectId: projectId || this.currentProjectId,
          timestamp: new Date().toISOString(),
          contextUsed: Object.keys(context)
        }
      }
    };
  }

  /**
   * Build comprehensive context for chat
   */
  async buildChatContext(projectId) {
    const pid = projectId || this.currentProjectId;
    
    const context = {
      currentProject: pid,
      activeAgents: await this.agentMonitor.getActiveAgents(),
      currentPhase: await this.getCurrentProjectPhase(pid),
      recentArtifacts: await this.artifactIndexer.getRecentArtifacts(pid, 10),
      projectStructure: await this.getProjectStructure(pid),
      metrics: await this.getProjectMetrics(pid),
      errors: await this.getRecentErrors(pid, 5),
      deliverables: await this.getDeliverables(pid),
      validationStatus: await this.getValidationStatus(pid)
    };
    
    return context;
  }

  /**
   * Format context for LLM consumption
   */
  formatContext(context) {
    return `
## Current Project: ${context.currentProject || 'No project selected'}

## Active Agents
${context.activeAgents.map(a => `- ${a.name}: ${a.status} (${a.currentTask || 'idle'})`).join('\n')}

## Current Phase: ${context.currentPhase || 'Unknown'}

## Recent Artifacts (Last 10)
${context.recentArtifacts.map(a => `- ${a.type}: ${a.name} (${a.id})`).join('\n')}

## Project Metrics
- Total Artifacts: ${context.metrics?.totalArtifacts || 0}
- Validation Passes: ${context.metrics?.validationPasses || 0}
- Validation Failures: ${context.metrics?.validationFailures || 0}
- Code Coverage: ${context.metrics?.codeCoverage || 'N/A'}%

## Recent Errors
${context.errors.length > 0 ? context.errors.map(e => `- ${e.type}: ${e.message}`).join('\n') : 'No recent errors'}

## Deliverables
${context.deliverables.map(d => `- ${d.type}: ${d.path || d.location}`).join('\n')}
`;
  }

  /**
   * Extract artifact references and commands from chat response
   */
  async extractReferences(response, context) {
    const artifacts = [];
    const commands = [];
    
    // Look for artifact IDs mentioned in response
    const artifactIdPattern = /artifact[_-]([a-z0-9]+)/gi;
    const matches = response.matchAll(artifactIdPattern);
    for (const match of matches) {
      const artifact = await this.artifactIndexer.getArtifactById(match[1]);
      if (artifact) {
        artifacts.push(artifact);
      }
    }
    
    // Look for command patterns
    if (response.includes('show diagram')) {
      commands.push({ type: 'show_diagram', target: 'class' });
    }
    if (response.includes('show timeline')) {
      commands.push({ type: 'show_timeline' });
    }
    if (response.includes('show validation')) {
      commands.push({ type: 'show_validation' });
    }
    
    return { artifacts, commands };
  }

  /**
   * Get current project status
   */
  async getProjectStatus(payload) {
    const { projectId } = payload;
    
    const status = {
      projectId,
      phase: await this.getCurrentProjectPhase(projectId),
      agents: await this.agentMonitor.getActiveAgents(),
      artifactCount: await this.artifactIndexer.getArtifactCount(projectId),
      lastActivity: await this.getLastActivity(projectId),
      health: await this.getProjectHealth(projectId)
    };
    
    return {
      success: true,
      data: status
    };
  }

  /**
   * Subscribe to project updates
   */
  async subscribeToProject(payload) {
    const { projectId, clientId } = payload;
    
    this.currentProjectId = projectId;
    
    // Set up MongoDB change streams for real-time updates
    if (this.databaseService) {
      await this.setupChangeStreams(projectId);
    }
    
    // Register subscription
    if (!this.subscriptions.has(clientId)) {
      this.subscriptions.set(clientId, new Set());
    }
    this.subscriptions.get(clientId).add(projectId);
    
    return {
      success: true,
      data: {
        subscribed: true,
        projectId,
        message: `Subscribed to project ${projectId} updates`
      }
    };
  }

  /**
   * Set up MongoDB change streams for real-time monitoring
   */
  async setupChangeStreams(projectId) {
    // Monitor artifact collections
    const collections = ['artifacts', 'domain_models', 'generated_code', 'validation_results'];
    
    for (const collection of collections) {
      if (!this.changeStreams.has(collection)) {
        const stream = await this.databaseService.watchCollection(collection, {
          fullDocument: 'updateLookup',
          match: { 'fullDocument.projectId': projectId }
        });
        
        stream.on('change', (change) => {
          this.handleDatabaseChange(collection, change);
        });
        
        this.changeStreams.set(collection, stream);
      }
    }
  }

  /**
   * Handle database changes and broadcast to subscribers
   */
  handleDatabaseChange(collection, change) {
    const event = {
      type: 'database_change',
      collection,
      operation: change.operationType,
      document: change.fullDocument,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all subscribed clients
    this.broadcastToSubscribers(event);
    
    // Specific handling based on collection
    if (collection === 'artifacts') {
      this.broadcastToSubscribers({
        type: 'artifact_created',
        artifact: change.fullDocument
      });
    } else if (collection === 'validation_results') {
      this.broadcastToSubscribers({
        type: 'validation_result',
        result: change.fullDocument
      });
    }
  }

  /**
   * Broadcast event to all subscribers
   */
  broadcastToSubscribers(event) {
    // This would send through the remote actor connection
    if (this.remoteActor) {
      this.remoteActor.receive(event);
    }
  }

  /**
   * Get project artifacts with filtering
   */
  async getArtifacts(payload) {
    const { projectId, filter = {} } = payload;
    
    const artifacts = await this.artifactIndexer.getArtifacts(projectId, filter);
    
    return {
      success: true,
      data: {
        artifacts,
        count: artifacts.length,
        filter
      }
    };
  }

  /**
   * Get agent status
   */
  async getAgentStatus(payload) {
    const status = await this.agentMonitor.getAllAgentStatus();
    
    return {
      success: true,
      data: {
        agents: status,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate and return diagram data
   */
  async getDiagram(payload) {
    const { projectId, diagramType = 'class' } = payload;
    
    let diagram;
    switch(diagramType) {
      case 'class':
        diagram = await this.diagramGenerator.generateClassDiagram(projectId);
        break;
      case 'architecture':
        diagram = await this.diagramGenerator.generateArchitectureDiagram(projectId);
        break;
      case 'sequence':
        diagram = await this.diagramGenerator.generateSequenceDiagram(projectId);
        break;
      default:
        throw new Error(`Unknown diagram type: ${diagramType}`);
    }
    
    return {
      success: true,
      data: {
        type: diagramType,
        diagram,
        projectId
      }
    };
  }

  /**
   * Get project metrics
   */
  async getProjectMetrics(projectId) {
    const metrics = {
      totalArtifacts: await this.artifactIndexer.getArtifactCount(projectId),
      byType: await this.artifactIndexer.getArtifactsByType(projectId),
      validationResults: await this.getValidationMetrics(projectId),
      agentActivity: await this.agentMonitor.getActivityMetrics(),
      codeMetrics: await this.getCodeMetrics(projectId),
      timeline: await this.getTimelineMetrics(projectId)
    };
    
    return {
      success: true,
      data: metrics
    };
  }

  /**
   * Get project timeline
   */
  async getProjectTimeline(payload) {
    const { projectId } = payload;
    
    const timeline = await this.buildProjectTimeline(projectId);
    
    return {
      success: true,
      data: {
        timeline,
        currentPhase: await this.getCurrentProjectPhase(projectId),
        projectId
      }
    };
  }

  // Helper methods
  
  async getCurrentProjectPhase(projectId) {
    // Query latest artifacts to determine phase
    const latestArtifact = await this.artifactIndexer.getLatestArtifact(projectId);
    if (!latestArtifact) return 'not-started';
    
    const phaseMap = {
      'requirement': 'requirements',
      'domain_model': 'domain-modeling',
      'architecture': 'architecture-design',
      'state_design': 'state-design',
      'test': 'testing',
      'code': 'implementation',
      'validation': 'quality-assurance'
    };
    
    return phaseMap[latestArtifact.type] || 'unknown';
  }

  async getProjectStructure(projectId) {
    // Build tree structure of artifacts
    const artifacts = await this.artifactIndexer.getAllArtifacts(projectId);
    
    const structure = {
      requirements: artifacts.filter(a => a.type === 'requirement'),
      domain: artifacts.filter(a => a.type.includes('domain')),
      architecture: artifacts.filter(a => a.type.includes('architecture')),
      code: artifacts.filter(a => a.type === 'code'),
      tests: artifacts.filter(a => a.type === 'test')
    };
    
    return structure;
  }

  async getRecentErrors(projectId, limit = 5) {
    // Query validation results for errors
    if (!this.databaseService) return [];
    
    const errors = await this.databaseService.query('validation_results', {
      projectId,
      valid: false
    }, { limit, sort: { timestamp: -1 } });
    
    return errors.map(e => ({
      type: e.validationType,
      message: e.error || e.message,
      timestamp: e.timestamp
    }));
  }

  async getDeliverables(projectId) {
    // Get all generated code and documentation
    const deliverables = [];
    
    // Code files
    const code = await this.artifactIndexer.getArtifactsByType(projectId, 'code');
    deliverables.push(...code.map(c => ({
      type: 'code',
      name: c.name,
      path: c.path || c.location,
      id: c.id
    })));
    
    // Documentation
    const docs = await this.artifactIndexer.getArtifactsByType(projectId, 'documentation');
    deliverables.push(...docs.map(d => ({
      type: 'documentation',
      name: d.name,
      path: d.path || d.location,
      id: d.id
    })));
    
    return deliverables;
  }

  async getValidationStatus(projectId) {
    // Get latest validation results
    if (!this.databaseService) return { status: 'unknown' };
    
    const validations = await this.databaseService.query('validation_results', {
      projectId
    }, { limit: 10, sort: { timestamp: -1 } });
    
    const passed = validations.filter(v => v.valid).length;
    const failed = validations.filter(v => !v.valid).length;
    
    return {
      status: failed === 0 ? 'passing' : 'failing',
      passed,
      failed,
      total: validations.length,
      lastValidation: validations[0]?.timestamp
    };
  }

  async executeCommands(commands, projectId) {
    const results = [];
    
    for (const command of commands) {
      switch(command.type) {
        case 'show_diagram':
          const diagram = await this.getDiagram({ 
            projectId, 
            diagramType: command.target 
          });
          results.push({ command: command.type, result: diagram });
          break;
        
        case 'show_timeline':
          const timeline = await this.getProjectTimeline({ projectId });
          results.push({ command: command.type, result: timeline });
          break;
        
        case 'show_validation':
          const validation = await this.getValidationStatus(projectId);
          results.push({ command: command.type, result: validation });
          break;
      }
    }
    
    return results;
  }

  async getLastActivity(projectId) {
    const latest = await this.artifactIndexer.getLatestArtifact(projectId);
    return latest?.timestamp || null;
  }

  async getProjectHealth(projectId) {
    const validation = await this.getValidationStatus(projectId);
    const errors = await this.getRecentErrors(projectId, 10);
    
    if (validation.status === 'passing' && errors.length === 0) {
      return 'healthy';
    } else if (errors.length > 5) {
      return 'critical';
    } else {
      return 'warning';
    }
  }

  async getValidationMetrics(projectId) {
    const validation = await this.getValidationStatus(projectId);
    return {
      ...validation,
      successRate: validation.total > 0 ? 
        (validation.passed / validation.total * 100).toFixed(2) + '%' : 'N/A'
    };
  }

  async getCodeMetrics(projectId) {
    const code = await this.artifactIndexer.getArtifactsByType(projectId, 'code');
    
    return {
      totalFiles: code.length,
      totalLines: code.reduce((sum, c) => sum + (c.lines || 0), 0),
      languages: [...new Set(code.map(c => c.language || 'unknown'))],
      coverage: 'Not yet implemented'
    };
  }

  async getTimelineMetrics(projectId) {
    // This would calculate time spent in each phase
    return {
      totalTime: 'Not yet implemented',
      phaseBreakdown: {}
    };
  }

  async buildProjectTimeline(projectId) {
    // Build Gantt-style timeline data
    const artifacts = await this.artifactIndexer.getAllArtifacts(projectId);
    
    const phases = [
      'requirements', 'domain-modeling', 'architecture', 
      'state-design', 'testing', 'implementation', 'quality-assurance'
    ];
    
    const timeline = phases.map(phase => {
      const phaseArtifacts = artifacts.filter(a => {
        // Map artifact types to phases
        if (phase === 'requirements') return a.type.includes('requirement');
        if (phase === 'domain-modeling') return a.type.includes('domain');
        // ... etc
        return false;
      });
      
      return {
        phase,
        start: phaseArtifacts[0]?.timestamp,
        end: phaseArtifacts[phaseArtifacts.length - 1]?.timestamp,
        artifactCount: phaseArtifacts.length,
        status: phaseArtifacts.length > 0 ? 'completed' : 'pending'
      };
    });
    
    return timeline;
  }

  getMetadata() {
    return {
      type: 'observability',
      name: this.name,
      capabilities: [
        'chat_intelligence',
        'real_time_monitoring',
        'artifact_tracking',
        'agent_monitoring',
        'diagram_generation',
        'metrics_collection'
      ],
      intelligence: {
        hasChat: true,
        hasContext: true,
        canExplain: true,
        canLocate: true,
        canAnalyze: true
      }
    };
  }
}