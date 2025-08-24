/**
 * SDObservabilityBackend - Backend server with intelligent chat agent
 * 
 * Provides real intelligence about the SD system using the SDObservabilityAgent
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActorSpace } from '../../../../shared/actors/src/ActorSpace.js';
import { Actor } from '../../../../shared/actors/src/Actor.js';
import { ResourceManager } from '@legion/tool-core';
import { LLMClient } from '@legion/llm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Backend SD Observability Agent with real intelligence
 */
class SDObservabilityAgent extends Actor {
  constructor(config = {}) {
    super();
    this.llmClient = config.llmClient;
    this.knowledgeBase = this.initializeKnowledgeBase();
    this.conversationHistory = new Map(); // Per-session history
    this.activeProjects = new Map();
    this.agentStatus = this.initializeAgentStatus();
  }

  initializeKnowledgeBase() {
    return {
      systemPrompt: `You are an intelligent assistant for the SD (Software Development) autonomous system. You have deep knowledge of:

1. **The SD System Architecture**:
   - 9 specialized AI agents working in sequence
   - Validation-regeneration loops for quality assurance
   - Database-centric design with MongoDB storage
   - Each phase produces artifacts that feed into the next

2. **The Methodologies**:
   - Domain-Driven Design (DDD) - Bounded contexts, aggregates, entities, value objects
   - Clean Architecture - Layered architecture with dependency inversion
   - Immutable Architecture - Pure functions and immutable state
   - Flux Architecture - Unidirectional data flow
   - Test-Driven Development (TDD) - Red-Green-Refactor cycle
   - Clean Code principles

3. **The Agent Phases**:
   - Requirements Analysis (5-10 min) - Parse and structure requirements
   - Domain Modeling (10-15 min) - Create DDD domain model
   - Architecture Design (15-20 min) - Design clean architecture layers
   - State Design (10-15 min) - Design immutable state management
   - Flux Architecture (10-15 min) - Implement unidirectional data flow
   - Test Generation (10-15 min) - Generate comprehensive test suites
   - Code Generation (30-45 min) - Generate production code
   - Quality Assurance (10-15 min) - Validate all methodologies
   - Live Testing (15-20 min) - Run and test the application

4. **Current System State**:
   You can access real-time information about:
   - Which agents are currently active
   - What phase the project is in
   - Recent validation results
   - Generated artifacts and their locations
   - Any errors or issues

Answer questions clearly and concisely. When discussing the current state, use the context provided. 
If asked about deliverables, explain they are stored in MongoDB and can be exported to the file system.
Be helpful and informative about how the SD system works and what it's currently doing.`,

      agents: {
        RequirementsAgent: {
          purpose: 'Parse and structure requirements into user stories',
          inputs: ['Raw requirements text'],
          outputs: ['User stories', 'Acceptance criteria'],
          duration: '5-10 minutes'
        },
        DomainModelingAgent: {
          purpose: 'Create DDD domain models from requirements',
          inputs: ['Structured requirements'],
          outputs: ['Entities', 'Value objects', 'Aggregates', 'Domain events'],
          duration: '10-15 minutes'
        },
        ArchitectureAgent: {
          purpose: 'Design clean architecture with proper layering',
          inputs: ['Domain model'],
          outputs: ['Layer definitions', 'Use cases', 'Interfaces'],
          duration: '15-20 minutes'
        },
        StateDesignAgent: {
          purpose: 'Design immutable state management',
          inputs: ['Architecture design'],
          outputs: ['State schemas', 'Reducers', 'State transitions'],
          duration: '10-15 minutes'
        },
        FluxAgent: {
          purpose: 'Implement unidirectional data flow',
          inputs: ['State design'],
          outputs: ['Actions', 'Stores', 'Dispatchers'],
          duration: '10-15 minutes'
        },
        TestGenerationAgent: {
          purpose: 'Generate comprehensive test suites',
          inputs: ['All design artifacts'],
          outputs: ['Unit tests', 'Integration tests', 'E2E tests'],
          duration: '10-15 minutes'
        },
        CodeGenerationAgent: {
          purpose: 'Generate production code from designs',
          inputs: ['All artifacts', 'Tests'],
          outputs: ['Source code', 'Configuration', 'Documentation'],
          duration: '30-45 minutes'
        },
        QualityAssuranceAgent: {
          purpose: 'Validate all methodologies and fix issues',
          inputs: ['All artifacts'],
          outputs: ['Validation reports', 'Fixed code'],
          duration: '10-15 minutes'
        },
        LiveTestingAgent: {
          purpose: 'Run applications and capture runtime behavior',
          inputs: ['Generated code'],
          outputs: ['Runtime logs', 'Performance metrics', 'Error reports'],
          duration: '15-20 minutes'
        }
      }
    };
  }

  initializeAgentStatus() {
    const status = new Map();
    Object.keys(this.knowledgeBase.agents).forEach(agent => {
      status.set(agent, {
        name: agent,
        status: 'idle',
        currentTask: null,
        lastActivity: null,
        progress: 0
      });
    });
    return status;
  }

  async receive(payload, envelope) {
    const { type } = payload;
    console.log(`[SDObservabilityAgent] Received ${type}:`, payload);

    switch(type) {
      case 'chat_message':
        return await this.handleChatMessage(payload);
      
      case 'get_agent_status':
        return this.getAgentStatus();
      
      case 'get_project_status':
        return this.getProjectStatus(payload);
      
      case 'subscribe_project':
        return this.subscribeToProject(payload);
      
      case 'get_artifacts':
        return this.getArtifacts(payload);
      
      case 'get_diagram':
        return this.getDiagram(payload);
      
      case 'get_metrics':
        return this.getMetrics(payload);
      
      case 'get_timeline':
        return this.getTimeline(payload);
      
      default:
        return { success: false, error: `Unknown message type: ${type}` };
    }
  }

  async handleChatMessage(payload) {
    console.log('[SDObservabilityAgent] Handling chat message:', payload);
    const { content, sessionId, projectId } = payload;
    
    // Get or create conversation history for this session
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    const history = this.conversationHistory.get(sessionId);
    
    // Add user message to history
    history.push({ role: 'user', content });
    
    // Build context about current state
    const context = this.buildCurrentContext(projectId);
    
    try {
      // Generate response using LLM if available
      let response;
      
      if (this.llmClient) {
        // Use combined system prompt with context for better understanding
        
        const messages = [
          { role: 'system', content: this.knowledgeBase.systemPrompt + `\n\nCurrent Context:\n${context}` },
          ...history
        ];
        
        const llmResponse = await this.llmClient.sendAndReceiveResponse(messages, {
          model: 'claude-3-haiku-20240307',
          maxTokens: 1000,
          temperature: 0.7
        });
        
        response = llmResponse;
      } else {
        // Fallback intelligent responses without LLM
        response = this.generateIntelligentResponse(content, context);
      }
      
      // Add assistant response to history
      history.push({ role: 'assistant', content: response });
      
      // Keep history size manageable
      if (history.length > 20) {
        history.splice(0, 2);
      }
      
      // Extract any artifacts or commands mentioned
      const { artifacts, commands } = this.extractReferences(response, content);
      
      const responseData = {
        type: 'chat_response',
        data: {
          content: response,
          artifacts,
          commands,
          metadata: {
            timestamp: new Date().toISOString(),
            sessionId,
            projectId
          }
        }
      };

      // Send response back through remoteActor if available
      if (this.remoteActor) {
        console.log('[SDObservabilityAgent] Sending response through remoteActor');
        this.remoteActor.receive(responseData);
      }

      return responseData;
      
    } catch (error) {
      console.error('[SDObservabilityAgent] Chat error:', error);
      
      const errorResponse = {
        type: 'chat_response',
        data: {
          content: `I apologize, but I encountered an error processing your request. ${error.message}. I can still provide information about the SD system based on my knowledge base.`,
          artifacts: [],
          commands: [],
          metadata: {
            timestamp: new Date().toISOString(),
            error: true
          }
        }
      };

      // Send error response back through remoteActor if available
      if (this.remoteActor) {
        console.log('[SDObservabilityAgent] Sending error response through remoteActor');
        this.remoteActor.receive(errorResponse);
      }

      return errorResponse;
    }
  }

  buildCurrentContext(projectId) {
    const contexts = [];
    
    // Add active agents
    const activeAgents = Array.from(this.agentStatus.values())
      .filter(a => a.status !== 'idle');
    
    if (activeAgents.length > 0) {
      contexts.push(`Active Agents: ${activeAgents.map(a => 
        `${a.name} (${a.status}${a.currentTask ? ': ' + a.currentTask : ''})`
      ).join(', ')}`);
    } else {
      contexts.push('All agents are currently idle');
    }
    
    // Add project info
    if (projectId && this.activeProjects.has(projectId)) {
      const project = this.activeProjects.get(projectId);
      contexts.push(`Current Project: ${projectId}`);
      contexts.push(`Phase: ${project.phase || 'Not started'}`);
      contexts.push(`Progress: ${project.progress || 0}%`);
    }
    
    // Add recent activity
    contexts.push(`System Status: Operational`);
    contexts.push(`Total Agents: 9`);
    
    return contexts.join('\n');
  }

  generateIntelligentResponse(question, context) {
    const lowerQuestion = question.toLowerCase();
    
    // Check for specific topics
    if (lowerQuestion.includes('what') && lowerQuestion.includes('happening')) {
      return `Based on the current system state:\n\n${context}\n\nThe SD system orchestrates 9 specialized agents through a complete software development lifecycle. Each agent focuses on a specific aspect, from requirements analysis to live testing. The entire process typically takes 2-3 hours for a complete application.`;
    }
    
    if (lowerQuestion.includes('deliverable') || lowerQuestion.includes('artifact')) {
      return `All deliverables and artifacts are stored in MongoDB with complete traceability. The system generates:\n\n• **Requirements**: User stories and acceptance criteria\n• **Domain Models**: DDD entities, value objects, and aggregates\n• **Architecture**: Clean architecture layers and use cases\n• **State Design**: Immutable state schemas and reducers\n• **Code**: Complete source code with tests\n• **Documentation**: API docs and architecture diagrams\n\nArtifacts can be browsed in the Artifacts view or exported to the file system at any time.`;
    }
    
    if (lowerQuestion.includes('ddd') || lowerQuestion.includes('domain')) {
      return `Domain-Driven Design (DDD) is a core methodology in the SD system. The DomainModelingAgent creates:\n\n• **Bounded Contexts**: Linguistic boundaries around domain models\n• **Aggregates**: Consistency boundaries with invariant protection\n• **Entities**: Objects with identity that persist over time\n• **Value Objects**: Immutable objects defined by their attributes\n• **Domain Events**: Significant business occurrences\n\nThese artifacts form the foundation for the Clean Architecture layers that follow.`;
    }
    
    if (lowerQuestion.includes('phase') || lowerQuestion.includes('workflow')) {
      return `The SD system follows a 9-phase workflow:\n\n1. **Requirements** (5-10 min) - Parse and structure requirements\n2. **Domain Modeling** (10-15 min) - Create DDD domain model\n3. **Architecture** (15-20 min) - Design clean architecture\n4. **State Design** (10-15 min) - Design immutable state\n5. **Flux Architecture** (10-15 min) - Implement data flow\n6. **Test Generation** (10-15 min) - Generate test suites\n7. **Code Generation** (30-45 min) - Generate production code\n8. **Quality Assurance** (10-15 min) - Validate and fix issues\n9. **Live Testing** (15-20 min) - Runtime validation\n\nTotal time: ~2-3 hours for a complete application`;
    }
    
    if (lowerQuestion.includes('error') || lowerQuestion.includes('validation')) {
      return `The SD system uses validation-regeneration loops to ensure quality. Each phase validates its outputs against methodology rules:\n\n• **Structural Validation**: Syntax and format checks\n• **Semantic Validation**: Logic and consistency checks\n• **Methodological Validation**: DDD, Clean Architecture compliance\n• **Runtime Validation**: Live testing with log capture\n\nWhen validation fails, the agent regenerates the artifact with fixes. This continues until all validations pass.`;
    }
    
    if (lowerQuestion.includes('agent')) {
      const agentList = Object.entries(this.knowledgeBase.agents)
        .map(([name, info]) => `• **${name}**: ${info.purpose}`)
        .join('\n');
      
      return `The SD system employs 9 specialized AI agents:\n\n${agentList}\n\nEach agent is an expert in its domain, using targeted prompts and validation rules to ensure high-quality outputs.`;
    }
    
    if (lowerQuestion.includes('how') && lowerQuestion.includes('work')) {
      return `The SD system works through intelligent orchestration:\n\n1. **Input**: You provide requirements in natural language\n2. **Analysis**: RequirementsAgent structures them into user stories\n3. **Design**: Multiple agents create domain models, architecture, and state design\n4. **Implementation**: Agents generate tests and production code\n5. **Validation**: Continuous validation against methodology rules\n6. **Output**: Complete, tested application with documentation\n\nThe key innovation is the validation-regeneration loop that ensures quality at each step.`;
    }
    
    // Default response
    return `The SD system is an autonomous software development platform that combines Domain-Driven Design, Clean Architecture, and Immutable Architecture patterns. It uses 9 specialized AI agents to transform requirements into production-ready applications.\n\n${context}\n\nWhat specific aspect would you like to know more about?`;
  }

  extractReferences(response, question) {
    const artifacts = [];
    const commands = [];
    
    // Check for artifact references
    if (response.includes('artifact') || response.includes('deliverable')) {
      artifacts.push({
        type: 'reference',
        name: 'View Artifacts',
        id: 'artifacts-panel'
      });
    }
    
    // Check for diagram references
    if (response.includes('diagram') || response.includes('architecture')) {
      commands.push({
        type: 'show_diagram',
        diagram: 'architecture'
      });
    }
    
    // Check for timeline references
    if (response.includes('phase') || response.includes('timeline')) {
      commands.push({
        type: 'show_timeline'
      });
    }
    
    return { artifacts, commands };
  }

  getAgentStatus() {
    const agents = Array.from(this.agentStatus.values());
    
    // Simulate some activity for demo
    if (Math.random() > 0.7) {
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      randomAgent.status = 'working';
      randomAgent.currentTask = 'Processing...';
      randomAgent.progress = Math.floor(Math.random() * 100);
    }
    
    return {
      success: true,
      data: { agents }
    };
  }

  getProjectStatus(payload) {
    const { projectId } = payload;
    
    if (!this.activeProjects.has(projectId)) {
      this.activeProjects.set(projectId, {
        id: projectId,
        phase: 'requirements',
        progress: 15,
        startTime: new Date().toISOString()
      });
    }
    
    return {
      success: true,
      data: this.activeProjects.get(projectId)
    };
  }

  subscribeToProject(payload) {
    const { projectId, clientId } = payload;
    
    console.log(`[SDObservabilityAgent] Client ${clientId} subscribed to project ${projectId}`);
    
    return {
      success: true,
      data: { projectId, subscribed: true }
    };
  }

  getArtifacts(payload) {
    // Mock artifacts for demo
    return {
      success: true,
      data: {
        artifacts: [
          { id: 'req-1', type: 'requirements', name: 'User Stories', created: new Date().toISOString() },
          { id: 'dom-1', type: 'domain', name: 'Domain Model', created: new Date().toISOString() },
          { id: 'arch-1', type: 'architecture', name: 'Clean Architecture', created: new Date().toISOString() }
        ]
      }
    };
  }

  getDiagram(payload) {
    const { type } = payload;
    
    return {
      success: true,
      data: {
        type,
        nodes: [
          { id: 'user', label: 'User Entity', type: 'entity' },
          { id: 'task', label: 'Task Entity', type: 'entity' },
          { id: 'project', label: 'Project Aggregate', type: 'aggregate' }
        ],
        edges: [
          { source: 'user', target: 'task', label: 'owns' },
          { source: 'project', target: 'task', label: 'contains' }
        ]
      }
    };
  }

  getMetrics(payload) {
    return {
      success: true,
      data: {
        totalAgents: 9,
        activeAgents: 2,
        artifactsGenerated: 42,
        validationsPassed: 38,
        validationsFailed: 4,
        averagePhaseTime: '12 minutes'
      }
    };
  }

  getTimeline(payload) {
    return {
      success: true,
      data: {
        phases: [
          { name: 'Requirements', status: 'completed', duration: '8 min' },
          { name: 'Domain Modeling', status: 'completed', duration: '12 min' },
          { name: 'Architecture', status: 'in-progress', duration: '5 min', progress: 60 },
          { name: 'State Design', status: 'pending', duration: '-' }
        ]
      }
    };
  }
}

/**
 * Main backend server class
 */
class SDObservabilityBackend {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.actorSpace = null;
    this.agent = null;
    this.clients = new Map();
    this.resourceManager = null;
  }

  async initialize() {
    console.log('[SDObservabilityBackend] Initializing...');
    
    // Initialize ResourceManager
    this.resourceManager = ResourceManager.getInstance();
    await this.resourceManager.initialize();
    
    // Initialize LLM client if API key available
    let llmClient = null;
    const anthropicKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
    
    if (anthropicKey) {
      console.log('[SDObservabilityBackend] Anthropic API key found, initializing LLM client');
      llmClient = new LLMClient({ 
        provider: 'anthropic',
        apiKey: anthropicKey 
      });
    } else {
      console.log('[SDObservabilityBackend] No Anthropic API key found, using fallback responses');
    }
    
    // Setup Express
    this.setupExpress();
    
    // Create HTTP server
    this.server = createServer(this.app);
    
    // Setup WebSocket server
    this.setupWebSocket(llmClient);
    
    // Start server
    const PORT = process.env.SD_BACKEND_PORT || 3007;
    this.server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║     SD Observability Backend Server Started           ║
╠════════════════════════════════════════════════════════╣
║  HTTP Server:   http://localhost:${PORT}              ║
║  WebSocket:     ws://localhost:${PORT}                ║
║  LLM Status:    ${llmClient ? 'Connected' : 'Using Fallback'}              ║
╚════════════════════════════════════════════════════════╝
      `);
    });
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Serve static files from public directory
    const publicPath = path.join(__dirname, '../../public');
    const srcPath = path.join(__dirname, '../');
    
    // Serve public files (HTML, CSS, etc.)
    this.app.use(express.static(publicPath));
    
    // Serve src files for ES modules
    this.app.use('/src', express.static(srcPath));
    
    // Serve shared modules (Actor system)
    this.app.use('/shared', express.static(path.join(__dirname, '../../../../shared')));
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'sd-observability-backend',
        hasLLM: !!this.agent?.llmClient,
        clients: this.clients.size,
        timestamp: new Date().toISOString()
      });
    });
  }

  setupWebSocket(llmClient) {
    this.wss = new WebSocketServer({ server: this.server });
    
    // Create actor space for backend
    this.actorSpace = new ActorSpace(`backend-${Date.now()}`);
    
    // Create and register the SD Observability Agent globally
    this.agent = new SDObservabilityAgent({ llmClient });
    const agentGuid = `${this.actorSpace.spaceId}-observability`;
    this.actorSpace.register(this.agent, agentGuid);
    console.log(`[SDObservabilityBackend] Agent registered globally with GUID: ${agentGuid}`);
    
    this.wss.on('connection', (ws) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[SDObservabilityBackend] New client connected: ${clientId}`);
      
      // Store client info
      const client = {
        ws,
        id: clientId,
        actorGuid: null,
        channel: null
      };
      this.clients.set(clientId, client);
      
      // Handle messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`[SDObservabilityBackend] Received message from ${clientId}:`, message);
          
          if (message.type === 'actor_handshake') {
            // Handle actor handshake
            await this.handleActorHandshake(client, message);
          } else if (client.channel) {
            // Route through actor channel - fix the event format to match what Channel expects
            console.log(`[SDObservabilityBackend] Routing message through channel:`, message);
            client.channel._handleEndpointMessage({ data: data.toString() });
          } else {
            console.log(`[SDObservabilityBackend] No channel available for client ${clientId}, message:`, message);
          }
        } catch (error) {
          console.error(`[SDObservabilityBackend] Error processing message:`, error);
        }
      });
      
      ws.on('close', () => {
        console.log(`[SDObservabilityBackend] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });
      
      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connection_established',
        clientId,
        timestamp: new Date().toISOString()
      }));
    });
  }

  async handleActorHandshake(client, message) {
    console.log(`[SDObservabilityBackend] Actor handshake from ${client.id}`);
    
    // Agent should already be registered globally
    const agentGuid = `${this.actorSpace.spaceId}-observability`;
    
    // Create channel for this client
    client.channel = this.actorSpace.addChannel(client.ws);
    client.actorGuid = message.clientActors.observability;
    
    // Send handshake acknowledgment
    client.ws.send(JSON.stringify({
      type: 'actor_handshake_ack',
      serverActors: {
        observability: agentGuid
      }
    }));
    
    // Create remote actor reference for client
    const remoteActor = client.channel.makeRemote(client.actorGuid);
    this.agent.remoteActor = remoteActor;
  }
}

// Start the backend server
const backend = new SDObservabilityBackend();
backend.initialize().catch(console.error);

export { SDObservabilityBackend, SDObservabilityAgent };