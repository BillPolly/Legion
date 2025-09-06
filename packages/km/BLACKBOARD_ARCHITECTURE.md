# Comprehensive Multi-Agent Blackboard Architecture with Legion KM & Prompting Systems

## Executive Summary

This document presents an innovative architecture for creating cooperating AI agents using a blackboard system built on Legion's Knowledge Management (KM) and Prompting packages. The design enables:

- **Dynamic Agent Discovery & Creation**: Agents can discover tools, test capabilities, and spawn specialized sub-agents
- **Semantic Knowledge Sharing**: Rich knowledge graph as shared blackboard with confidence-weighted beliefs
- **Structured Communication**: Template-based agent prompting with validated responses
- **Tool Learning & Testing**: Agents can discover, test, and learn to use new tools autonomously

## Core Architecture Components

### 1. Knowledge Graph as Dynamic Blackboard

The `KnowledgeGraphSystem` serves as a living, queryable blackboard where:
- Agents post knowledge as semantic triples with confidence scores
- Beliefs evolve over time through agent consensus
- Schema evolution allows new knowledge types to emerge
- RDF compatibility enables knowledge import/export

### 2. Agent Architecture Layers

#### Base Agent Template (Using PromptManager)
Each agent is constructed from:
- **Perception Layer**: ObjectQuery for extracting relevant data from environment
- **Reasoning Layer**: PromptBuilder for structured thought processes  
- **Action Layer**: ResponseValidator for ensuring valid outputs
- **Memory Layer**: Local KG subset for working memory

#### Specialized Agent Types
- **NLP Agents**: Process natural language, extract entities/relationships
- **Tool Discovery Agents**: Find and test new capabilities
- **Reasoning Agents**: Perform logical inference using WordNet relationships
- **Validation Agents**: Fact-check and verify information
- **Orchestrator Agents**: Coordinate multi-agent workflows

### 3. Tool Discovery & Testing Framework

Agents can autonomously:
- Query the ToolRegistry for available capabilities
- Test tools in sandbox environments
- Learn tool usage patterns through examples
- Share successful tool recipes via blackboard

### 4. Dynamic Agent Construction

New specialized agents can be created programmatically:
- Define agent template using PromptManager configuration
- Specify expertise domain via ObjectQuery bindings
- Configure output format with ResponseValidator schemas
- Register capabilities in ToolRegistry

## Detailed System Design

### The Blackboard System

```javascript
class BlackboardSystem extends KnowledgeGraphSystem {
  constructor() {
    super();
    this.agents = new Map();
    this.activeProblems = new Map();
    this.toolDiscoveries = new Map();
    this.agentFactory = new AgentFactory(this);
  }

  // Post knowledge with provenance and confidence
  postKnowledge(agentId, belief) {
    const beliefId = this.addBelief(belief);
    this.notifySubscribers(belief);
    this.updateConsensus(belief);
    return beliefId;
  }

  // Semantic query with agent interests
  queryForAgent(agentId, querySpec) {
    const agent = this.agents.get(agentId);
    const query = this.query()
      .pattern(querySpec.subject, querySpec.predicate, querySpec.object)
      .where('?confidence', '>', agent.minConfidence || 0.5);
    
    return query.execute();
  }

  // Register new tool discovery
  registerToolDiscovery(tool, testResults) {
    const toolId = this.registerTool(tool.class, {
      capabilities: tool.capabilities,
      testResults: testResults,
      discoveredBy: tool.discoveredBy,
      confidence: testResults.successRate
    });
    
    this.toolDiscoveries.set(toolId, {
      tool,
      testResults,
      timestamp: new Date()
    });
    
    return toolId;
  }
}
```

### Agent Base Class with Prompting Integration

```javascript
class PromptingAgent {
  constructor(id, config, blackboard) {
    this.id = id;
    this.blackboard = blackboard;
    
    // Configure the prompting pipeline
    this.promptManager = new PromptManager({
      objectQuery: config.perceptionQuery,  // What to extract from environment
      promptBuilder: config.reasoningTemplate,  // How to think
      outputSchema: config.actionSchema,  // Expected output format
      llmClient: config.llmClient
    });
    
    // Local knowledge subset
    this.workingMemory = new KGEngine();
    this.beliefs = new Map();
  }

  async perceive(environment) {
    // Use ObjectQuery to extract relevant data
    const perception = await this.promptManager.objectQuery.execute(environment);
    
    // Store in working memory
    Object.entries(perception).forEach(([key, value]) => {
      this.workingMemory.addTriple(this.id, `perceived:${key}`, value);
    });
    
    return perception;
  }

  async reason(problem) {
    // Query blackboard for relevant knowledge
    const relevantFacts = await this.blackboard.queryForAgent(this.id, {
      subject: problem.domain,
      predicate: '?relation',
      object: '?knowledge'
    });
    
    // Build reasoning context
    const reasoningContext = {
      problem: problem,
      relevantFacts: relevantFacts,
      workingMemory: this.workingMemory.getAllTriples(),
      availableTools: await this.discoverRelevantTools(problem)
    };
    
    // Execute prompting pipeline
    const reasoning = await this.promptManager.execute(reasoningContext);
    
    return reasoning;
  }

  async act(reasoning) {
    // Validate action through output schema
    if (!reasoning.success) {
      return this.handleFailure(reasoning);
    }
    
    // Convert reasoning to beliefs
    const beliefs = this.extractBeliefs(reasoning.data);
    
    // Post to blackboard
    for (const belief of beliefs) {
      await this.blackboard.postKnowledge(this.id, belief);
    }
    
    // Execute any tool actions
    if (reasoning.data.toolActions) {
      return await this.executeTools(reasoning.data.toolActions);
    }
    
    return reasoning.data;
  }

  extractBeliefs(data) {
    const beliefs = [];
    
    // Convert structured data to beliefs
    if (data.facts) {
      data.facts.forEach(fact => {
        beliefs.push(new Belief(
          this,
          fact.subject,
          fact.predicate,
          fact.object,
          {
            confidence: fact.confidence || 0.8,
            source: this.id,
            reasoning: fact.reasoning
          }
        ));
      });
    }
    
    return beliefs;
  }
}
```

### Tool Discovery & Testing Agent

```javascript
class ToolDiscoveryAgent extends PromptingAgent {
  constructor(blackboard) {
    super('tool-discovery-agent', {
      perceptionQuery: {
        bindings: {
          availableTools: { path: '$.tools', transform: 'array' },
          toolMetadata: { path: '$.tools[*].metadata' },
          requirements: { path: '$.requirements' }
        }
      },
      reasoningTemplate: {
        template: `Given these tools: {{availableTools}}
                   And these requirements: {{requirements}}
                   Determine which tools to test and how.`,
        optimization: { priority: 'accuracy' }
      },
      actionSchema: {
        type: 'object',
        properties: {
          toolsToTest: { type: 'array', items: { type: 'string' } },
          testPlans: { type: 'array' },
          expectedOutcomes: { type: 'object' }
        }
      }
    }, blackboard);
    
    this.testResults = new Map();
  }

  async discoverTools(domain) {
    // Query tool registry for potential tools
    const tools = this.blackboard.findTools({
      capability: domain.capabilities,
      goal: domain.goal
    });
    
    // Test each tool
    for (const tool of tools) {
      const testResult = await this.testTool(tool);
      
      if (testResult.success) {
        // Register successful tool discovery
        await this.blackboard.registerToolDiscovery(tool, testResult);
        
        // Create belief about tool capability
        const belief = new Belief(
          this,
          tool.id,
          'canAchieve',
          domain.goal,
          {
            confidence: testResult.successRate,
            source: 'empirical_testing',
            testData: testResult
          }
        );
        
        await this.blackboard.postKnowledge(this.id, belief);
      }
    }
    
    return this.testResults;
  }

  async testTool(tool) {
    // Create test scenarios
    const testScenarios = await this.generateTestScenarios(tool);
    const results = [];
    
    for (const scenario of testScenarios) {
      try {
        // Execute tool with test input
        const output = await tool.execute(scenario.input);
        
        // Validate output
        const validation = await this.validateToolOutput(
          output,
          scenario.expectedOutput
        );
        
        results.push({
          scenario: scenario.name,
          success: validation.isValid,
          confidence: validation.confidence,
          output: output
        });
        
      } catch (error) {
        results.push({
          scenario: scenario.name,
          success: false,
          error: error.message
        });
      }
    }
    
    // Calculate overall success rate
    const successRate = results.filter(r => r.success).length / results.length;
    
    return {
      tool: tool.id,
      success: successRate > 0.7,
      successRate: successRate,
      results: results,
      timestamp: new Date()
    };
  }
}
```

### Dynamic Agent Factory

```javascript
class AgentFactory {
  constructor(blackboard) {
    this.blackboard = blackboard;
    this.agentTemplates = new Map();
    this.activeAgents = new Map();
  }

  async createSpecializedAgent(specification) {
    const { domain, expertise, goals, constraints } = specification;
    
    // Build ObjectQuery for agent's perception
    const perceptionQuery = this.buildPerceptionQuery(domain, expertise);
    
    // Generate reasoning template based on goals
    const reasoningTemplate = await this.generateReasoningTemplate(goals, expertise);
    
    // Define output schema for agent actions
    const actionSchema = this.defineActionSchema(goals, constraints);
    
    // Create agent configuration
    const config = {
      perceptionQuery,
      reasoningTemplate,
      actionSchema,
      llmClient: await this.selectOptimalLLM(expertise)
    };
    
    // Instantiate new agent
    const agent = new SpecializedAgent(
      `agent_${domain}_${Date.now()}`,
      config,
      this.blackboard
    );
    
    // Register agent capabilities
    await this.blackboard.registerTool(agent.constructor, {
      capabilities: expertise.capabilities,
      dependencies: expertise.dependencies,
      category: domain
    });
    
    this.activeAgents.set(agent.id, agent);
    
    return agent;
  }

  buildPerceptionQuery(domain, expertise) {
    // Dynamically build ObjectQuery configuration
    const bindings = {};
    
    // Add domain-specific extractions
    expertise.requiredInputs.forEach(input => {
      bindings[input.name] = {
        path: input.path,
        transform: input.transform || 'identity',
        required: input.required !== false
      };
    });
    
    // Add context variables
    const contextVariables = {};
    expertise.contextNeeds.forEach(context => {
      contextVariables[context.name] = {
        source: context.source,
        refresh: context.refresh || 'onDemand'
      };
    });
    
    return { bindings, contextVariables };
  }

  async generateReasoningTemplate(goals, expertise) {
    // Use meta-prompting to generate optimal reasoning template
    const metaPrompt = `Create a reasoning template for an agent with:
      Goals: ${JSON.stringify(goals)}
      Expertise: ${JSON.stringify(expertise)}
      
      The template should guide structured thinking with placeholders for inputs.`;
    
    const llmResponse = await this.blackboard.llmClient.complete(metaPrompt, 1000);
    
    return {
      template: llmResponse,
      placeholders: this.extractPlaceholders(llmResponse),
      optimization: {
        priority: goals.priority || 'balanced',
        maxTokens: goals.maxTokens || 2000
      }
    };
  }

  defineActionSchema(goals, constraints) {
    // Build JSON schema for expected agent outputs
    const schema = {
      type: 'object',
      required: ['action', 'confidence'],
      properties: {
        action: {
          type: 'string',
          enum: goals.allowedActions || []
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1
        },
        reasoning: {
          type: 'string',
          maxLength: constraints.reasoningMaxLength || 500
        }
      }
    };
    
    // Add goal-specific properties
    goals.outputs.forEach(output => {
      schema.properties[output.name] = output.schema;
    });
    
    return schema;
  }
}
```

### Multi-Agent Orchestration

```javascript
class MultiAgentOrchestrator {
  constructor(blackboard) {
    this.blackboard = blackboard;
    this.agentFactory = new AgentFactory(blackboard);
    this.activeWorkflows = new Map();
  }

  async solveProblem(problem) {
    // Decompose problem into subproblems
    const subproblems = await this.decomposeProblem(problem);
    
    // Identify required expertise
    const requiredExpertise = await this.identifyExpertise(subproblems);
    
    // Create or assign agents
    const agents = await this.assembleTeam(requiredExpertise);
    
    // Create workflow
    const workflow = new AgentWorkflow(problem, agents, this.blackboard);
    this.activeWorkflows.set(problem.id, workflow);
    
    // Execute workflow with blackboard coordination
    return await workflow.execute();
  }

  async decomposeProblem(problem) {
    // Use NLP agent to understand and decompose
    const nlpAgent = await this.agentFactory.createSpecializedAgent({
      domain: 'problem_decomposition',
      expertise: {
        capabilities: ['text_understanding', 'task_decomposition'],
        requiredInputs: [
          { name: 'problemStatement', path: '$.statement' },
          { name: 'constraints', path: '$.constraints' }
        ],
        contextNeeds: [
          { name: 'domainKnowledge', source: 'blackboard' }
        ]
      },
      goals: {
        outputs: [
          {
            name: 'subproblems',
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  description: { type: 'string' },
                  dependencies: { type: 'array' },
                  requiredCapabilities: { type: 'array' }
                }
              }
            }
          }
        ]
      }
    });
    
    const decomposition = await nlpAgent.reason(problem);
    return decomposition.data.subproblems;
  }

  async assembleTeam(requiredExpertise) {
    const team = [];
    
    for (const expertise of requiredExpertise) {
      // Check if suitable agent already exists
      let agent = this.findExistingAgent(expertise);
      
      if (!agent) {
        // Create new specialized agent
        agent = await this.agentFactory.createSpecializedAgent({
          domain: expertise.domain,
          expertise: expertise,
          goals: expertise.goals,
          constraints: expertise.constraints
        });
      }
      
      team.push(agent);
    }
    
    return team;
  }
}
```

### Agent Communication Protocol

```javascript
class AgentCommunicationProtocol {
  constructor(blackboard) {
    this.blackboard = blackboard;
    this.messageTypes = new Map();
    this.conversationHistory = new Map();
  }

  async sendMessage(fromAgent, toAgent, message) {
    // Structure message with prompting system
    const structuredMessage = await this.structureMessage(message, fromAgent, toAgent);
    
    // Post to blackboard as communication triple
    this.blackboard.addTriple(
      fromAgent.id,
      'sentMessage',
      structuredMessage.id
    );
    
    this.blackboard.addTriple(
      structuredMessage.id,
      'hasRecipient',
      toAgent.id
    );
    
    // Store message content
    this.blackboard.addTriple(
      structuredMessage.id,
      'hasContent',
      JSON.stringify(structuredMessage.content)
    );
    
    // Notify recipient
    return await toAgent.receiveMessage(structuredMessage);
  }

  async structureMessage(message, sender, recipient) {
    const messageId = `msg_${Date.now()}_${sender.id}`;
    
    // Use recipient's expected input format
    const recipientSchema = recipient.promptManager.config.objectQuery;
    
    // Transform message to match recipient's expectations
    const transformer = new ObjectQuery({
      bindings: {
        ...recipientSchema.bindings,
        messageContent: { path: '$.content' },
        messageSender: { value: sender.id },
        messageTimestamp: { value: new Date().toISOString() }
      }
    });
    
    const transformedContent = transformer.execute(message);
    
    return {
      id: messageId,
      sender: sender.id,
      recipient: recipient.id,
      content: transformedContent,
      timestamp: new Date()
    };
  }

  async negotiateProtocol(agent1, agent2) {
    // Agents negotiate communication format
    const agent1Schema = agent1.promptManager.config.outputSchema;
    const agent2Schema = agent2.promptManager.config.objectQuery;
    
    // Find compatible format
    const compatibility = this.analyzeSchemaCompatibility(agent1Schema, agent2Schema);
    
    if (compatibility.isCompatible) {
      return compatibility.protocol;
    }
    
    // Create adapter if needed
    return this.createProtocolAdapter(agent1Schema, agent2Schema);
  }
}
```

### Consensus Building

```javascript
class ConsensusBuilder {
  constructor(blackboard) {
    this.blackboard = blackboard;
    this.consensusThreshold = 0.7;
  }

  async buildConsensus(topic) {
    // Query all beliefs about topic
    const beliefs = await this.blackboard.query()
      .pattern('?agent', 'kg:believes', '?belief')
      .pattern('?belief', 'kg:subject', topic)
      .pattern('?belief', 'kg:confidence', '?confidence')
      .execute();
    
    // Group beliefs by predicate-object pairs
    const beliefGroups = this.groupBeliefs(beliefs);
    
    // Calculate weighted consensus for each group
    const consensusBeliefs = [];
    
    for (const [key, group] of beliefGroups) {
      const weightedConfidence = this.calculateWeightedConfidence(group);
      
      if (weightedConfidence >= this.consensusThreshold) {
        consensusBeliefs.push({
          subject: topic,
          predicate: group[0].predicate,
          object: group[0].object,
          confidence: weightedConfidence,
          supportingAgents: group.map(b => b.agent),
          consensusType: 'weighted_majority'
        });
      }
    }
    
    return consensusBeliefs;
  }

  calculateWeightedConfidence(beliefGroup) {
    // Weight by agent reputation and belief confidence
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const belief of beliefGroup) {
      const agentReputation = this.getAgentReputation(belief.agent);
      const weight = agentReputation * belief.confidence;
      
      totalWeight += weight;
      weightedSum += weight * belief.confidence;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  getAgentReputation(agentId) {
    // Query historical accuracy of agent
    const history = this.blackboard.query()
      .pattern(agentId, 'kg:historicalAccuracy', '?accuracy')
      .execute();
    
    return history.length > 0 ? parseFloat(history[0][2]) : 0.5;
  }
}
```

## Implementation Scenarios

### Scenario 1: Collaborative Research (Actor-Based)

```javascript
import { BlackboardActorSpace } from './blackboard/BlackboardActorSpace.js';
import { OrchestratorAgent } from './agents/OrchestratorAgent.js';
import { ResearchAgent } from './agents/ResearchAgent.js';
import { WebSocketServer } from 'ws';

async function collaborativeResearch(topic) {
  // Create actor space for the research system
  const actorConfig = {
    actorPairs: [
      { name: 'orchestrator', backend: 'OrchestratorAgent' },
      { name: 'literature', backend: 'LiteratureReviewAgent' },
      { name: 'nlp', backend: 'NLPAgent' },
      { name: 'reasoning', backend: 'ReasoningAgent' },
      { name: 'validation', backend: 'ValidationAgent' },
      { name: 'synthesis', backend: 'SynthesisAgent' }
    ]
  };
  
  const blackboardSpace = new BlackboardActorSpace(
    'research-space',
    actorConfig,
    { llmClient, toolRegistry }
  );
  
  // Setup all research agents
  await blackboardSpace.setupActors('backend');
  
  // Get the orchestrator agent
  const orchestrator = blackboardSpace.getActor('orchestrator');
  
  // Define research problem
  const problem = {
    id: 'research_' + Date.now(),
    statement: `Research ${topic} comprehensively`,
    constraints: {
      maxTime: 3600000, // 1 hour
      minConfidence: 0.8,
      requireSources: true
    }
  };
  
  // Send problem to orchestrator via actor message
  const solution = await orchestrator.receive('solveProblem', problem);
  
  // Agents automatically coordinate through blackboard actor:
  // 1. Literature Review Agent posts sources as beliefs
  // 2. NLP Agent extracts concepts via actor messages
  // 3. Reasoning Agent queries blackboard for connections
  // 4. Validation Agent fact-checks through consensus
  // 5. Synthesis Agent aggregates beliefs into report
  
  return solution;
}

// Remote collaboration - agents in different processes
async function distributedResearch(topic, websocketUrl) {
  const ws = new WebSocket(websocketUrl);
  const blackboardSpace = new BlackboardActorSpace('remote-research');
  
  // Connect to remote actor space
  const channel = blackboardSpace.addChannel(ws);
  
  // Wire remote agents
  await channel.on('handshake', (remoteActors) => {
    blackboardSpace.wireActors(channel, remoteActors);
  });
  
  // Now can communicate with remote agents transparently
  const remoteOrchestrator = blackboardSpace.remoteActors.get('orchestrator');
  return await remoteOrchestrator.receive('solveProblem', { topic });
}
```

### Scenario 2: Tool Learning Network (Actor-Based)

```javascript
import { BlackboardActorSpace } from './blackboard/BlackboardActorSpace.js';
import { ToolDiscoveryAgent } from './agents/ToolDiscoveryAgent.js';

async function createToolLearningNetwork() {
  // Create distributed actor spaces for tool discovery
  const actorConfig = {
    actorPairs: [
      { name: 'discovery1', backend: 'ToolDiscoveryAgent' },
      { name: 'discovery2', backend: 'ToolDiscoveryAgent' },
      { name: 'discovery3', backend: 'ToolDiscoveryAgent' },
      { name: 'validator', backend: 'ToolValidatorAgent' },
      { name: 'repository', backend: 'ToolRepositoryAgent' }
    ]
  };
  
  const toolSpace = new BlackboardActorSpace(
    'tool-learning-space',
    actorConfig,
    { toolRegistry }
  );
  
  await toolSpace.setupActors('backend');
  
  // Each discovery agent explores different categories
  const categories = ['data_processing', 'text_analysis', 'computation'];
  const discoveryAgents = [
    toolSpace.getActor('discovery1'),
    toolSpace.getActor('discovery2'),
    toolSpace.getActor('discovery3')
  ];
  
  // Agents discover tools and share via blackboard actor
  discoveryAgents.forEach((agent, i) => {
    // Send discovery task via actor message
    agent.receive('startDiscovery', {
      category: categories[i],
      continuous: true,
      interval: 60000
    });
    
    // Agent will automatically post discoveries to blackboard
    // Other agents receive beliefs through subscriptions
  });
  
  // Validator agent subscribes to tool discoveries
  const validator = toolSpace.getActor('validator');
  const blackboard = toolSpace.getActor('blackboard');
  
  blackboard.receive('subscribe', {
    topic: 'tool-discovery',
    subscriber: validator
  });
  
  // Repository agent stores validated tools
  const repository = toolSpace.getActor('repository');
  blackboard.receive('subscribe', {
    topic: 'tool-validated',
    subscriber: repository
  });
  
  return toolSpace;
}

// Monitor tool discoveries through WebSocket
async function monitorToolDiscoveries(toolSpace) {
  const wss = new WebSocketServer({ port: 8080 });
  
  wss.on('connection', (ws) => {
    // Add monitoring client as actor channel
    const channel = toolSpace.addChannel(ws);
    
    // Create monitoring actor to receive updates
    const monitorActor = {
      isActor: true,
      receive: (message, data) => {
        if (message === 'toolDiscovered') {
          ws.send(JSON.stringify({ type: 'discovery', data }));
        }
      }
    };
    
    // Subscribe monitor to blackboard
    toolSpace.getActor('blackboard').receive('subscribe', {
      topic: 'tool-discovery',
      subscriber: monitorActor
    });
  });
}
```

### Scenario 3: Dynamic Problem Solving (Actor-Based)

```javascript
import { BlackboardActorSpace } from './blackboard/BlackboardActorSpace.js';
import { AgentFactory } from './agents/AgentFactory.js';

async function dynamicProblemSolving(userQuery, websocket) {
  // Create main actor space with factory capability
  const blackboardSpace = new BlackboardActorSpace(
    'problem-solving-space',
    { actorPairs: [] }, // Start with no predefined agents
    { llmClient, toolRegistry }
  );
  
  // Create agent factory as an actor
  const factoryActor = new AgentFactory(blackboardSpace);
  blackboardSpace.register(factoryActor, 'agent-factory');
  
  // Connect to frontend if websocket provided
  if (websocket) {
    const channel = blackboardSpace.addChannel(websocket);
    // Frontend can receive real-time updates
  }
  
  // Create understanding agent dynamically
  const understandingAgent = await factoryActor.receive('createAgent', {
    type: 'understanding',
    config: {
      domain: 'query_understanding',
      expertise: {
        capabilities: ['natural_language_understanding'],
        requiredInputs: [{ name: 'query', path: '$.text' }]
      },
      goals: {
        outputs: [
          { name: 'intent', schema: { type: 'string' } },
          { name: 'entities', schema: { type: 'array' } },
          { name: 'requiredCapabilities', schema: { type: 'array' } }
        ]
      }
    }
  });
  
  // Register the new agent in actor space
  blackboardSpace.register(
    understandingAgent,
    `${blackboardSpace.spaceId}-understanding`
  );
  
  // Understand the query through actor message
  const understanding = await understandingAgent.receive('analyze', {
    text: userQuery
  });
  
  // Dynamically create required agents based on understanding
  const agentPromises = understanding.requiredCapabilities.map(cap =>
    factoryActor.receive('createAgent', {
      type: cap.type,
      config: {
        domain: cap.domain,
        expertise: cap.expertise,
        goals: cap.goals
      }
    })
  );
  
  const agents = await Promise.all(agentPromises);
  
  // Register all created agents
  agents.forEach((agent, i) => {
    const capability = understanding.requiredCapabilities[i];
    blackboardSpace.register(
      agent,
      `${blackboardSpace.spaceId}-${capability.type}`
    );
  });
  
  // Create workflow coordinator
  const workflowAgent = await factoryActor.receive('createAgent', {
    type: 'workflow',
    config: {
      problem: understanding,
      agents: agents.map(a => a.guid)
    }
  });
  
  // Execute workflow through actor messages
  const solution = await workflowAgent.receive('execute');
  
  // All coordination happens through blackboard actor messages
  // Agents post beliefs, query knowledge, and build consensus
  
  return solution;
}

// Enable remote agent participation
async function enableRemoteAgents(blackboardSpace, remoteUrls) {
  for (const url of remoteUrls) {
    const ws = new WebSocket(url);
    const channel = blackboardSpace.addChannel(ws);
    
    // Remote agents can now participate in problem solving
    channel.on('agentAvailable', (remoteAgent) => {
      console.log(`Remote agent ${remoteAgent.type} joined from ${url}`);
    });
  }
}
```

### Scenario 4: Real-Time Multi-Agent Debugging

```javascript
import { BlackboardActorSpace } from './blackboard/BlackboardActorSpace.js';
import { DebuggerAgent } from './agents/DebuggerAgent.js';

async function multiAgentDebugging(codebase) {
  const actorConfig = {
    actorPairs: [
      { name: 'static-analyzer', backend: 'StaticAnalyzerAgent' },
      { name: 'runtime-monitor', backend: 'RuntimeMonitorAgent' },
      { name: 'test-runner', backend: 'TestRunnerAgent' },
      { name: 'debugger', backend: 'DebuggerAgent' },
      { name: 'fixer', backend: 'CodeFixerAgent' }
    ]
  };
  
  const debugSpace = new BlackboardActorSpace(
    'debug-space',
    actorConfig,
    { codebase, toolRegistry }
  );
  
  await debugSpace.setupActors('backend');
  
  // Agents subscribe to different belief topics
  const blackboard = debugSpace.getActor('blackboard');
  const debugger = debugSpace.getActor('debugger');
  
  // Static analyzer posts code smells as beliefs
  blackboard.receive('subscribe', {
    topic: 'code-smell',
    subscriber: debugger
  });
  
  // Runtime monitor posts errors as beliefs
  blackboard.receive('subscribe', {
    topic: 'runtime-error',
    subscriber: debugger
  });
  
  // Test runner posts failures as beliefs
  blackboard.receive('subscribe', {
    topic: 'test-failure',
    subscriber: debugger
  });
  
  // Debugger analyzes all issues and creates fix beliefs
  blackboard.receive('subscribe', {
    topic: 'suggested-fix',
    subscriber: debugSpace.getActor('fixer')
  });
  
  // Start analysis through actor messages
  const agents = ['static-analyzer', 'runtime-monitor', 'test-runner'];
  agents.forEach(name => {
    debugSpace.getActor(name).receive('startAnalysis', { codebase });
  });
  
  // Build consensus on critical issues
  const consensus = await blackboard.receive('buildConsensus', {
    topic: 'critical-issues',
    threshold: 0.8
  });
  
  return consensus;
}
```

## Advanced Features

### Self-Improving Agents

Agents can improve themselves by:
1. Analyzing their performance history on the blackboard
2. Identifying patterns in successful vs failed attempts
3. Adjusting their prompting templates
4. Learning from other agents' successes

### Emergent Behaviors

The system enables emergent behaviors through:
- **Stigmergic coordination**: Agents indirectly coordinate through blackboard modifications
- **Collective intelligence**: Consensus building leads to higher-quality decisions
- **Adaptive specialization**: Agents evolve expertise based on success patterns
- **Tool ecosystem growth**: Successful tools propagate through the network

### Meta-Learning Capabilities

The system can learn about learning:
- Track which agent configurations work best for which problems
- Identify optimal team compositions
- Learn communication patterns that lead to success
- Discover new problem decomposition strategies

## Integration with Existing Legion Systems

### Resource Manager Integration
- Agents access resources through ResourceManager singleton
- LLM clients are shared efficiently
- Environment variables managed centrally

### Tool Registry Integration
- Discovered tools are registered in the main ToolRegistry
- Tool dependencies tracked and resolved
- Tool schemas generated for LLM consumption

### Storage Integration
- Blackboard state persisted to MongoDB
- Agent configurations stored for reuse
- Historical performance data maintained

## Performance Optimizations

### Query Optimization
- Use QueryBuilder's optimization hints for complex blackboard queries
- Index frequently accessed belief predicates
- Cache common query patterns

### Agent Lifecycle Management
- Lazy agent instantiation
- Agent pooling for common expertise areas
- Automatic agent hibernation when inactive

### Blackboard Partitioning
- Partition blackboard by domain for scalability
- Use federated blackboards for distributed systems
- Implement eventual consistency for global knowledge

## Security & Governance

### Access Control
- Agent capabilities restricted by permissions
- Blackboard regions with access controls
- Audit trail of all agent actions

### Trust & Reputation
- Agent reputation scores based on accuracy
- Trust networks between agents
- Byzantine fault tolerance for consensus

### Resource Limits
- Token limits per agent
- Computation quotas
- Storage limits for working memory

## Integration with Legion Actor System

### Overview

The blackboard architecture can be powerfully implemented using Legion's existing actor system (`packages/shared/actors`). This integration provides immediate access to distributed messaging, location transparency, and robust serialization capabilities without rebuilding these complex systems.

### Core Synergies

#### ActorSpace as Blackboard Foundation
The `ActorSpace` class provides essential features for implementing the blackboard:
- **Distributed Messaging**: Actors communicate across process boundaries via channels
- **Location Transparency**: RemoteActors abstract physical actor locations
- **Message Serialization**: Robust handling of circular references and object identity
- **GUID-based Addressing**: Unique identifiers for global actor addressing
- **Channel Management**: WebSocket-based communication between actor spaces

#### ConfigurableActorSpace for Agent Management
The `ConfigurableActorSpace` is particularly well-suited for multi-agent systems:
- **Declarative Agent Creation**: Define agent pairs and configurations
- **Automatic Wiring**: Connects local and remote agents automatically
- **Interface Metadata**: Tracks what agents provide and require
- **Cross-Communication**: Agents can access other remote actors
- **Lifecycle Management**: Handles agent creation, wiring, and destruction

### Actor-Based Implementation Architecture

#### BlackboardActorSpace
Extends `ConfigurableActorSpace` to add knowledge management capabilities:

```javascript
import { ConfigurableActorSpace } from '@legion/actors';
import { KnowledgeGraphSystem } from '../kg/KnowledgeGraphSystem.js';

export class BlackboardActorSpace extends ConfigurableActorSpace {
  constructor(spaceId, actorConfig, dependencies) {
    super(spaceId, actorConfig, dependencies);
    this.knowledgeGraph = new KnowledgeGraphSystem();
    this.beliefs = new Map(); // beliefId -> Belief
    this.consensus = new Map(); // topic -> consensusData
  }

  async setupActors(role = 'agent') {
    await super.setupActors(role);
    
    // Create the central blackboard actor
    const blackboardActor = new BlackboardActor(this.knowledgeGraph);
    const blackboardGuid = `${this.spaceId}-blackboard`;
    this.register(blackboardActor, blackboardGuid);
    this.actors.set('blackboard', blackboardActor);
    
    // Give all agents reference to the blackboard
    for (const [name, agent] of this.actors) {
      if (agent.setBlackboard) {
        agent.setBlackboard(blackboardActor);
      }
    }
  }

  // Post knowledge to the blackboard
  async postKnowledge(agentId, belief) {
    const beliefId = this.knowledgeGraph.addBelief(belief);
    this.beliefs.set(beliefId, belief);
    
    // Broadcast to subscribed agents via actor messages
    const subscribers = this.getSubscribers(belief.topic);
    for (const subscriber of subscribers) {
      subscriber.receive('beliefUpdate', { beliefId, belief });
    }
    
    await this.updateConsensus(belief);
    return beliefId;
  }
}
```

#### BlackboardActor
The central knowledge repository implemented as an Actor:

```javascript
import { Actor } from '@legion/actors';

export class BlackboardActor extends Actor {
  constructor(knowledgeGraph) {
    super();
    this.knowledgeGraph = knowledgeGraph;
    this.subscriptions = new Map(); // topic -> Set<Actor>
  }

  receive(message, ...args) {
    switch(message) {
      case 'postBelief':
        return this.handlePostBelief(...args);
      case 'query':
        return this.handleQuery(...args);
      case 'subscribe':
        return this.handleSubscribe(...args);
      case 'consensus':
        return this.handleConsensus(...args);
      default:
        super.receive(message, ...args);
    }
  }

  async handlePostBelief(belief, senderActor) {
    // Store in knowledge graph
    const beliefId = this.knowledgeGraph.addBelief(belief);
    
    // Notify subscribers
    const subscribers = this.subscriptions.get(belief.topic) || new Set();
    for (const subscriber of subscribers) {
      if (subscriber !== senderActor) {
        subscriber.receive('newBelief', { beliefId, belief, source: senderActor });
      }
    }
    
    return { success: true, beliefId };
  }

  async handleQuery(querySpec, senderActor) {
    const results = this.knowledgeGraph.query()
      .pattern(querySpec.subject, querySpec.predicate, querySpec.object)
      .where('?confidence', '>', querySpec.minConfidence || 0.5)
      .execute();
    
    return { results };
  }
}
```

#### BaseAgent
Base class for all agents, extending Actor:

```javascript
import { Actor } from '@legion/actors';
import { PromptManager } from '@legion/prompting';
import { KGEngine } from '../kg/KGEngine.js';

export class BaseAgent extends Actor {
  constructor(config) {
    super();
    this.config = config;
    this.blackboard = null; // Set by BlackboardActorSpace
    this.remoteActor = null; // For paired remote agents
    this.workingMemory = new KGEngine(); // Local knowledge
    
    // Configure prompting pipeline
    this.promptManager = new PromptManager({
      objectQuery: config.perceptionQuery,
      promptBuilder: config.reasoningTemplate,
      outputSchema: config.actionSchema,
      llmClient: config.llmClient
    });
  }

  receive(message, ...args) {
    switch(message) {
      case 'perceive':
        return this.perceive(...args);
      case 'reason':
        return this.reason(...args);
      case 'act':
        return this.act(...args);
      case 'beliefUpdate':
        return this.handleBeliefUpdate(...args);
      default:
        super.receive(message, ...args);
    }
  }

  async perceive(environment) {
    const perception = await this.promptManager.objectQuery.execute(environment);
    
    // Store in working memory
    Object.entries(perception).forEach(([key, value]) => {
      this.workingMemory.addTriple(this.config.id, `perceived:${key}`, value);
    });
    
    return perception;
  }

  async reason(problem) {
    // Query blackboard for relevant knowledge
    const relevantFacts = await this.blackboard.receive('query', {
      subject: problem.domain,
      predicate: '?relation',
      object: '?knowledge'
    });
    
    // Build reasoning context
    const context = {
      problem,
      relevantFacts: relevantFacts.results,
      workingMemory: this.workingMemory.getAllTriples(),
      availableTools: await this.discoverRelevantTools(problem)
    };
    
    // Execute prompting pipeline
    return await this.promptManager.execute(context);
  }

  async act(reasoning) {
    if (!reasoning.success) {
      return this.handleFailure(reasoning);
    }
    
    // Post beliefs to blackboard
    const beliefs = this.extractBeliefs(reasoning.data);
    for (const belief of beliefs) {
      await this.blackboard.receive('postBelief', belief, this);
    }
    
    return reasoning.data;
  }
  
  setBlackboard(blackboardActor) {
    this.blackboard = blackboardActor;
  }
  
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }
}
```

### Concrete Implementation Classes

#### Tool Discovery Agent
Specialized agent for discovering and testing tools:

```javascript
export class ToolDiscoveryAgent extends BaseAgent {
  constructor(toolRegistry) {
    super({
      id: 'tool-discovery-agent',
      perceptionQuery: {
        bindings: {
          availableTools: { path: '$.tools', transform: 'array' },
          requirements: { path: '$.requirements' }
        }
      },
      reasoningTemplate: {
        template: `Given tools: {{availableTools}}
                   Requirements: {{requirements}}
                   Determine which tools to test.`,
        optimization: { priority: 'accuracy' }
      },
      actionSchema: {
        type: 'object',
        properties: {
          toolsToTest: { type: 'array' },
          testPlans: { type: 'array' }
        }
      }
    });
    
    this.toolRegistry = toolRegistry;
    this.testResults = new Map();
  }

  async discoverTools(domain) {
    // Query tool registry
    const tools = await this.toolRegistry.findTools({
      capability: domain.capabilities,
      goal: domain.goal
    });
    
    // Test each tool and post results to blackboard
    for (const tool of tools) {
      const testResult = await this.testTool(tool);
      
      if (testResult.success) {
        // Create belief about tool capability
        const belief = {
          subject: tool.id,
          predicate: 'canAchieve',
          object: domain.goal,
          confidence: testResult.successRate,
          source: this.config.id,
          evidence: testResult
        };
        
        // Post to blackboard through actor message
        await this.blackboard.receive('postBelief', belief, this);
      }
    }
    
    return this.testResults;
  }
}
```

#### Multi-Agent Orchestrator
Coordinates multiple agents through actor messages:

```javascript
export class OrchestratorAgent extends BaseAgent {
  constructor() {
    super({
      id: 'orchestrator-agent',
      // ... configuration
    });
    this.activeWorkflows = new Map();
  }

  async solveProblem(problem) {
    // Decompose problem
    const subproblems = await this.decomposeProblem(problem);
    
    // Request agent creation through ActorSpace
    const agentRequests = subproblems.map(sp => ({
      type: 'createAgent',
      specification: {
        domain: sp.domain,
        expertise: sp.requiredCapabilities,
        goals: sp.goals
      }
    }));
    
    // Agents are created and automatically wired through ActorSpace
    const agents = await Promise.all(
      agentRequests.map(req => 
        this.actorSpace.createActor(req.specification.domain, req.type)
      )
    );
    
    // Coordinate through actor messages
    for (let i = 0; i < subproblems.length; i++) {
      agents[i].receive('solve', subproblems[i]);
    }
    
    // Monitor progress through blackboard beliefs
    return await this.monitorWorkflow(problem.id, agents);
  }
}
```

### Benefits of Actor-Based Approach

#### Infrastructure Reuse
- **No Rebuilding Required**: Message routing, serialization, and remote communication already exist
- **Battle-Tested**: Actor system has comprehensive tests and proven reliability
- **WebSocket Integration**: Built-in support for real-time communication

#### Natural Agent Model
- **Actor = Agent**: Each agent is an Actor with receive() method
- **Location Independence**: Agents can be local or remote transparently
- **Concurrent Execution**: Actors naturally support autonomous, concurrent agents

#### Scalability and Distribution
- **Process Distribution**: Agents can run in different processes or machines
- **Load Balancing**: Distribute agents based on computational needs
- **Fault Isolation**: Agent failures don't crash the entire system

#### Message-Based Coordination
- **Asynchronous Communication**: Non-blocking message passing
- **Event-Driven**: Agents react to messages and beliefs
- **Protocol Flexibility**: Easy to add new message types

### Migration Path from Conceptual to Actor-Based

#### Phase 1: Foundation (Week 1)
1. Create `packages/km/src/blackboard/BlackboardActorSpace.js`
2. Implement `BlackboardActor` for knowledge management
3. Set up basic actor configuration for agent pairs
4. Write integration tests for actor-based blackboard

#### Phase 2: Base Agents (Week 2)
1. Implement `BaseAgent` class extending Actor
2. Integrate PromptManager for reasoning
3. Add working memory using KGEngine
4. Create agent-blackboard communication protocol

#### Phase 3: Specialized Agents (Week 3)
1. Implement ToolDiscoveryAgent
2. Create ReasoningAgent with WordNet integration
3. Build ValidationAgent for fact-checking
4. Develop OrchestratorAgent for coordination

#### Phase 4: Integration (Week 4)
1. Connect to ToolRegistry through actors
2. Add MongoDB persistence for beliefs
3. Implement consensus mechanisms
4. Create monitoring and metrics collection

#### Phase 5: Testing and Refinement (Week 5)
1. Comprehensive integration tests
2. Performance optimization
3. Documentation and examples
4. Demo applications

### Key Integration Points

#### With ToolRegistry
```javascript
// Tools exposed as actor services
const toolActor = new ToolServiceActor(toolRegistry);
actorSpace.register(toolActor, 'tool-service');

// Agents request tools through actor messages
const tools = await toolActor.receive('findTools', { capability: 'text-analysis' });
```

#### With MongoDB Storage
```javascript
// Persist beliefs through storage actor
const storageActor = new StorageActor(mongoConnection);
actorSpace.register(storageActor, 'storage-service');

// Automatic belief persistence
blackboardActor.on('beliefAdded', belief => 
  storageActor.receive('persist', { collection: 'beliefs', data: belief })
);
```

#### With WebSocket Frontend
```javascript
// Frontend connection through actor channel
const channel = actorSpace.addChannel(websocket);

// Frontend receives belief updates
channel.on('beliefUpdate', update => 
  websocket.send(JSON.stringify({ type: 'belief', data: update }))
);
```

## Future Enhancements

### Quantum-Inspired Superposition
- Agents maintain multiple hypothesis states simultaneously
- Quantum-like collapse when observation (query) occurs
- Entangled agent states for complex reasoning

### Neuromorphic Agent Networks
- Spiking neural network-inspired agent activation
- Asynchronous, event-driven processing
- Energy-efficient agent coordination

### Hybrid Symbolic-Neural Reasoning
- Combine KG symbolic reasoning with neural embeddings
- Use NLP system for semantic similarity in beliefs
- Neural tool selection based on past performance

## Conclusion

This architecture provides a powerful, flexible framework for building sophisticated multi-agent AI systems. By combining Legion's knowledge graph, NLP, and prompting systems with a blackboard architecture, we enable:

- Dynamic agent creation and specialization
- Rich semantic knowledge sharing
- Autonomous tool discovery and learning
- Emergent collective intelligence

The system is designed to scale from simple two-agent collaborations to complex networks of hundreds of specialized agents, all coordinating through the semantic blackboard to solve increasingly complex problems.