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

### Scenario 5: Collaborative Research (BT-Based)

Using behavior trees for the same collaborative research scenario:

```javascript
import { BlackboardActorSpace } from './blackboard/BlackboardActorSpace.js';
import { AgentFactory } from './agents/AgentFactory.js';

async function btCollaborativeResearch(topic) {
  const blackboardSpace = new BlackboardActorSpace(
    'bt-research-space',
    { actorPairs: [] },
    { llmClient, toolRegistry }
  );
  
  await blackboardSpace.setupActors('backend');
  const blackboard = blackboardSpace.getActor('blackboard');
  
  // Define research workflow as behavior tree
  const researchWorkflow = {
    type: 'agent',
    agentType: 'ResearchCoordinator',
    id: 'research-coordinator',
    behaviorTree: {
      type: 'sequence',
      name: 'research-pipeline',
      children: [
        {
          type: 'parallel',
          name: 'gather-sources',
          successThreshold: 0.8,
          children: [
            {
              type: 'agent',
              agentType: 'LiteratureReviewAgent',
              behaviorTree: {
                type: 'retry',
                maxAttempts: 3,
                child: {
                  type: 'action',
                  tool: 'search_literature',
                  params: { topic: topic },
                  outputVariable: 'papers'
                }
              }
            },
            {
              type: 'agent',
              agentType: 'WebSearchAgent',
              behaviorTree: {
                type: 'action',
                tool: 'search_web',
                params: { query: topic },
                outputVariable: 'web_sources'
              }
            },
            {
              type: 'agent',
              agentType: 'PatentSearchAgent',
              behaviorTree: {
                type: 'action',
                tool: 'search_patents',
                params: { domain: topic },
                outputVariable: 'patents'
              }
            }
          ]
        },
        {
          type: 'sequence',
          name: 'analyze-sources',
          children: [
            {
              type: 'agent',
              agentType: 'NLPAgent',
              behaviorTree: {
                type: 'parallel',
                children: [
                  {
                    type: 'action',
                    tool: 'extract_concepts',
                    params: { sources: '@papers' },
                    outputVariable: 'concepts'
                  },
                  {
                    type: 'action',
                    tool: 'extract_entities',
                    params: { sources: '@papers' },
                    outputVariable: 'entities'
                  },
                  {
                    type: 'action',
                    tool: 'extract_relationships',
                    params: { sources: '@papers' },
                    outputVariable: 'relationships'
                  }
                ]
              }
            }
          ]
        },
        {
          type: 'agent',
          agentType: 'ReasoningAgent',
          behaviorTree: {
            type: 'selector',
            name: 'reasoning-strategy',
            children: [
              {
                type: 'sequence',
                children: [
                  {
                    type: 'condition',
                    condition: 'context.concepts.length > 10',
                    child: {
                      type: 'action',
                      tool: 'hierarchical_reasoning',
                      params: { 
                        concepts: '@concepts',
                        relationships: '@relationships'
                      },
                      outputVariable: 'reasoning_result'
                    }
                  }
                ]
              },
              {
                type: 'action',
                tool: 'simple_reasoning',
                params: { concepts: '@concepts' },
                outputVariable: 'reasoning_result'
              }
            ]
          }
        },
        {
          type: 'agent',
          agentType: 'ValidationAgent',
          behaviorTree: {
            type: 'parallel',
            children: [
              {
                type: 'action',
                tool: 'fact_check',
                params: { claims: '@reasoning_result.claims' }
              },
              {
                type: 'action',
                tool: 'cross_reference',
                params: { 
                  findings: '@reasoning_result.findings',
                  sources: '@papers'
                }
              }
            ]
          }
        },
        {
          type: 'agent',
          agentType: 'SynthesisAgent',
          behaviorTree: {
            type: 'action',
            tool: 'generate_report',
            params: {
              concepts: '@concepts',
              reasoning: '@reasoning_result',
              validation: '@validation_results'
            },
            outputVariable: 'final_report'
          }
        }
      ]
    }
  };
  
  // Create and execute the research coordinator
  const coordinator = await AgentFactory.createFromJSON(
    researchWorkflow,
    toolRegistry,
    blackboard
  );
  
  const result = await coordinator.execute({ 
    topic,
    maxTime: 3600000,
    minConfidence: 0.8
  });
  
  return result.data.final_report;
}
```

### Scenario 6: Self-Organizing Tool Discovery Network (BT-Based)

```javascript
async function btToolDiscoveryNetwork() {
  const blackboardSpace = new BlackboardActorSpace(
    'bt-tool-space',
    { actorPairs: [] },
    { toolRegistry }
  );
  
  await blackboardSpace.setupActors('backend');
  const blackboard = blackboardSpace.getActor('blackboard');
  
  // Self-organizing tool discovery team
  const toolDiscoveryTeam = {
    type: 'agent',
    agentType: 'ToolDiscoveryCoordinator',
    behaviorTree: {
      type: 'sequence',
      children: [
        {
          type: 'action',
          tool: 'analyze_tool_requirements',
          outputVariable: 'requirements'
        },
        {
          type: 'action',
          tool: 'determine_search_categories',
          params: { requirements: '@requirements' },
          outputVariable: 'categories'
        },
        {
          type: 'parallel',
          name: 'spawn-discovery-agents',
          children: '@categories.map(cat => ({ ' +
            'type: "agent", ' +
            'agentType: "ToolDiscoveryAgent", ' +
            'behaviorTree: { ' +
              'type: "retry", ' +
              'maxAttempts: 5, ' +
              'backoffMs: 2000, ' +
              'child: { ' +
                'type: "sequence", ' +
                'children: [ ' +
                  '{ type: "action", tool: "search_tools", params: { category: cat } }, ' +
                  '{ type: "action", tool: "test_tools", params: { tools: "@found_tools" } }, ' +
                  '{ type: "action", tool: "publish_discoveries", params: { validated: "@tested_tools" } } ' +
                '] ' +
              '} ' +
            '} ' +
          '}))'
        },
        {
          type: 'agent',
          agentType: 'ToolValidatorAgent',
          behaviorTree: {
            type: 'sequence',
            children: [
              {
                type: 'action',
                tool: 'subscribe_to_discoveries',
                outputVariable: 'discoveries'
              },
              {
                type: 'selector',
                children: [
                  {
                    type: 'action',
                    tool: 'validate_with_tests',
                    params: { tools: '@discoveries' }
                  },
                  {
                    type: 'action',
                    tool: 'validate_with_llm',
                    params: { tools: '@discoveries' }
                  }
                ]
              },
              {
                type: 'action',
                tool: 'update_tool_registry',
                params: { validated_tools: '@validated' }
              }
            ]
          }
        }
      ]
    }
  };
  
  const coordinator = await AgentFactory.createFromJSON(
    toolDiscoveryTeam,
    toolRegistry,
    blackboard
  );
  
  // Execute continuously with monitoring
  const monitor = {
    type: 'retry',
    condition: 'context.continuous',
    delay: 60000,
    child: coordinator
  };
  
  return coordinator.execute({ continuous: true });
}
```

### Scenario 7: Adaptive Problem Solving (BT-Based)

```javascript
async function btAdaptiveProblemSolving(userQuery) {
  const blackboardSpace = new BlackboardActorSpace(
    'bt-adaptive-space',
    { actorPairs: [] },
    { llmClient, toolRegistry }
  );
  
  await blackboardSpace.setupActors('backend');
  const blackboard = blackboardSpace.getActor('blackboard');
  
  // Adaptive problem-solving behavior tree
  const adaptiveSolver = {
    type: 'agent',
    agentType: 'AdaptiveSolver',
    behaviorTree: {
      type: 'sequence',
      children: [
        {
          type: 'action',
          tool: 'understand_query',
          params: { query: userQuery },
          outputVariable: 'understanding'
        },
        {
          type: 'selector',
          name: 'select-strategy',
          children: [
            {
              type: 'sequence',
              name: 'simple-direct-solution',
              children: [
                {
                  type: 'condition',
                  condition: 'context.understanding.complexity === "simple"',
                  child: {
                    type: 'action',
                    tool: 'direct_solve',
                    params: { problem: '@understanding' },
                    outputVariable: 'solution'
                  }
                }
              ]
            },
            {
              type: 'sequence',
              name: 'multi-agent-solution',
              children: [
                {
                  type: 'condition',
                  condition: 'context.understanding.complexity === "complex"',
                  child: {
                    type: 'sequence',
                    children: [
                      {
                        type: 'action',
                        tool: 'decompose_problem',
                        params: { problem: '@understanding' },
                        outputVariable: 'subproblems'
                      },
                      {
                        type: 'action',
                        tool: 'determine_required_expertise',
                        params: { subproblems: '@subproblems' },
                        outputVariable: 'required_agents'
                      },
                      {
                        type: 'action',
                        tool: 'spawn_specialist_agents',
                        params: { specifications: '@required_agents' },
                        outputVariable: 'specialists'
                      },
                      {
                        type: 'parallel',
                        name: 'execute-specialists',
                        successThreshold: 0.9,
                        children: '@specialists.map(spec => ({ ' +
                          'type: "agent", ' +
                          'id: spec.id, ' +
                          'agentType: spec.type, ' +
                          'behaviorTree: spec.behaviorTree ' +
                        '}))'
                      },
                      {
                        type: 'action',
                        tool: 'integrate_solutions',
                        params: { 
                          partial_solutions: '@specialist_results',
                          original_problem: '@understanding'
                        },
                        outputVariable: 'solution'
                      }
                    ]
                  }
                }
              ]
            },
            {
              type: 'sequence',
              name: 'llm-fallback',
              children: [
                {
                  type: 'retry',
                  maxAttempts: 3,
                  child: {
                    type: 'action',
                    tool: 'llm_solve',
                    params: { 
                      problem: '@understanding',
                      context: '@context'
                    },
                    outputVariable: 'solution'
                  }
                }
              ]
            }
          ]
        },
        {
          type: 'action',
          tool: 'validate_solution',
          params: { 
            solution: '@solution',
            original_query: userQuery
          },
          outputVariable: 'validated_solution'
        },
        {
          type: 'action',
          tool: 'learn_from_solution',
          params: {
            query: userQuery,
            understanding: '@understanding',
            solution: '@validated_solution',
            strategy_used: '@selected_strategy'
          }
        }
      ]
    }
  };
  
  const solver = await AgentFactory.createFromJSON(
    adaptiveSolver,
    toolRegistry,
    blackboard
  );
  
  return await solver.execute({ userQuery });
}
```

### Scenario 8: Consensus-Based Debugging (BT-Based)

```javascript
async function btConsensusDebugging(codebase) {
  const blackboardSpace = new BlackboardActorSpace(
    'bt-debug-space',
    { actorPairs: [] },
    { codebase, toolRegistry }
  );
  
  await blackboardSpace.setupActors('backend');
  const blackboard = blackboardSpace.getActor('blackboard');
  
  // Consensus-based debugging workflow
  const debugWorkflow = {
    type: 'agent',
    agentType: 'DebugCoordinator',
    behaviorTree: {
      type: 'sequence',
      children: [
        {
          type: 'parallel',
          name: 'analysis-phase',
          children: [
            {
              type: 'agent',
              agentType: 'StaticAnalyzer',
              behaviorTree: {
                type: 'sequence',
                children: [
                  { type: 'action', tool: 'analyze_code_smells', outputVariable: 'smells' },
                  { type: 'action', tool: 'analyze_complexity', outputVariable: 'complexity' },
                  { type: 'action', tool: 'analyze_dependencies', outputVariable: 'deps' },
                  {
                    type: 'action',
                    tool: 'post_to_blackboard',
                    params: { 
                      key: 'static-analysis',
                      value: { smells: '@smells', complexity: '@complexity', deps: '@deps' }
                    }
                  }
                ]
              }
            },
            {
              type: 'agent',
              agentType: 'RuntimeMonitor',
              behaviorTree: {
                type: 'retry',
                maxAttempts: 3,
                child: {
                  type: 'sequence',
                  children: [
                    { type: 'action', tool: 'start_monitoring', outputVariable: 'monitor_id' },
                    { type: 'action', tool: 'run_scenarios', outputVariable: 'runtime_errors' },
                    { type: 'action', tool: 'collect_traces', outputVariable: 'traces' },
                    {
                      type: 'action',
                      tool: 'post_to_blackboard',
                      params: { 
                        key: 'runtime-analysis',
                        value: { errors: '@runtime_errors', traces: '@traces' }
                      }
                    }
                  ]
                }
              }
            },
            {
              type: 'agent',
              agentType: 'TestRunner',
              behaviorTree: {
                type: 'sequence',
                children: [
                  { type: 'action', tool: 'run_unit_tests', outputVariable: 'unit_results' },
                  { type: 'action', tool: 'run_integration_tests', outputVariable: 'integration_results' },
                  { type: 'action', tool: 'analyze_coverage', outputVariable: 'coverage' },
                  {
                    type: 'action',
                    tool: 'post_to_blackboard',
                    params: { 
                      key: 'test-analysis',
                      value: { 
                        unit: '@unit_results',
                        integration: '@integration_results',
                        coverage: '@coverage'
                      }
                    }
                  }
                ]
              }
            }
          ]
        },
        {
          type: 'agent',
          agentType: 'ConsensusBuilder',
          behaviorTree: {
            type: 'sequence',
            children: [
              {
                type: 'action',
                tool: 'query_blackboard',
                params: { 
                  keys: ['static-analysis', 'runtime-analysis', 'test-analysis']
                },
                outputVariable: 'all_findings'
              },
              {
                type: 'action',
                tool: 'correlate_issues',
                params: { findings: '@all_findings' },
                outputVariable: 'correlated_issues'
              },
              {
                type: 'action',
                tool: 'build_consensus',
                params: { 
                  issues: '@correlated_issues',
                  threshold: 0.8
                },
                outputVariable: 'critical_issues'
              },
              {
                type: 'action',
                tool: 'prioritize_issues',
                params: { issues: '@critical_issues' },
                outputVariable: 'prioritized_issues'
              }
            ]
          }
        },
        {
          type: 'parallel',
          name: 'fix-generation',
          children: '@prioritized_issues.slice(0, 5).map(issue => ({ ' +
            'type: "agent", ' +
            'agentType: "FixGenerator", ' +
            'behaviorTree: { ' +
              'type: "selector", ' +
              'children: [ ' +
                '{ type: "action", tool: "generate_automated_fix", params: { issue: issue } }, ' +
                '{ type: "action", tool: "generate_llm_fix", params: { issue: issue } }, ' +
                '{ type: "action", tool: "suggest_manual_fix", params: { issue: issue } } ' +
              '] ' +
            '} ' +
          '}))'
        },
        {
          type: 'action',
          tool: 'apply_fixes',
          params: { 
            fixes: '@generated_fixes',
            validation: true
          },
          outputVariable: 'fix_results'
        }
      ]
    }
  };
  
  const debugCoordinator = await AgentFactory.createFromJSON(
    debugWorkflow,
    toolRegistry,
    blackboard
  );
  
  return await debugCoordinator.execute({ codebase });
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

## Behavior Tree Based Agents

### Overview

Building on the actor-based foundation, agents can be implemented as specialized Behavior Trees (BTs), providing a powerful coordination language for complex agent behaviors. Since `BehaviorTreeNode` already extends `Actor`, BT-based agents naturally integrate with the actor system while adding sophisticated decision-making capabilities.

**Key Insight**: Agents don't just *use* behavior trees or *contain* behavior trees - agents *ARE* behavior trees. This means an agent is simultaneously:
- An **Actor**: Can send/receive messages, be distributed, serialized
- A **BehaviorTreeNode**: Can be executed, composed into larger trees, coordinated
- An **Agent**: Has beliefs, goals, plans, and domain expertise

### Why Behavior Trees for Agents?

Behavior Trees offer significant advantages for agent implementation:

1. **Hierarchical Decision Making**: BTs naturally model the hierarchical nature of agent reasoning
2. **Composable Behaviors**: Complex behaviors built from simple, reusable nodes
3. **Visual Debugging**: Tree structure makes agent logic transparent and debuggable
4. **Dynamic Reconfiguration**: JSON-based configuration allows runtime behavior changes
5. **Built-in Coordination**: Native support for sequences, fallbacks, and parallel execution
6. **Message-Passing Integration**: Inherits actor messaging for blackboard communication
7. **Dual Nature**: Agents ARE behavior trees AND actors simultaneously, not just using them

### Agent Architecture with Behavior Trees

#### Class Hierarchy

The agent architecture leverages a powerful inheritance chain:

```
Actor (base class from @legion/actors)
  ↓ extends
BehaviorTreeNode (from @legion/bt-task)
  ↓ extends
BaseAgentBT (our agent base class)
  ↓ extends
Specialized Agents (PlannerAgentBT, ValidatorAgentBT, etc.)
```

This hierarchy provides:
- **From Actor**: Location transparency, message passing, serialization, GUID addressing, actor space participation
- **From BehaviorTreeNode**: Tree execution, parent/child relationships, tool integration, coordination patterns
- **From BaseAgentBT**: Agent-specific features like beliefs, goals, blackboard integration
- **From Specialized Agents**: Domain expertise, specialized behaviors, tool preferences

#### Benefits of the Layered Approach

1. **Unified Communication**: All levels use the same actor messaging system
2. **Composability**: Agents can be composed into larger agent trees
3. **Tool Compatibility**: Agents have the same interface as tools (execute/getMetadata)
4. **Orchestration**: Agents can be orchestrated by higher-level coordinators
5. **Distribution**: Agents inherit location transparency from actors
6. **Coordination**: Built-in support for sequences, selectors, parallel execution
7. **Introspection**: Each layer adds metadata for debugging and monitoring

#### Practical Implications

The inheritance chain (Actor → BehaviorTreeNode → BaseAgentBT) has important practical implications:

1. **Agent as Tool**: Since agents implement the tool interface (execute/getMetadata), they can be used anywhere a tool is expected
2. **Agent as Node**: Agents can be children of other BT nodes, enabling hierarchical agent organizations
3. **Agent as Actor**: Agents can be distributed across actor spaces, enabling scalable multi-agent systems
4. **Unified Execution**: The same BehaviorTreeExecutor can execute both agents and regular BT nodes
5. **Message Routing**: Messages flow through the same channels whether between agents, nodes, or actors

Example of an agent being used as a BT node:
```javascript
// An agent can be a child in a larger behavior tree
const systemTree = {
  type: 'sequence',
  children: [
    {
      type: 'agent',  // PlannerAgentBT
      config: { domain: 'planning' }
    },
    {
      type: 'selector',
      children: [
        {
          type: 'agent',  // ValidatorAgentBT
          config: { domain: 'validation' }
        },
        {
          type: 'agent',  // FallbackAgentBT
          config: { domain: 'error-recovery' }
        }
      ]
    }
  ]
};
```

#### BaseAgentBT Class

```javascript
import { BehaviorTreeNode, NodeStatus } from '@legion/bt-task';
import { BehaviorTreeExecutor } from '@legion/bt-task';

/**
 * BaseAgentBT - Foundation for all behavior tree based agents
 * 
 * Inheritance chain: Actor → BehaviorTreeNode → BaseAgentBT
 * 
 * This class extends BehaviorTreeNode (which extends Actor), providing:
 * - Actor messaging and distribution capabilities (from Actor)
 * - Behavior tree coordination and execution (from BehaviorTreeNode)
 * - Agent-specific cognitive features (added by BaseAgentBT)
 * 
 * The agent IS a behavior tree node, not just using one.
 * This means it can be executed like any other BT node and
 * can be composed into larger behavior trees.
 */
export class BaseAgentBT extends BehaviorTreeNode {
  constructor(config, toolRegistry, blackboard) {
    // Create executor for this agent's sub-trees
    const executor = new BehaviorTreeExecutor(toolRegistry);
    
    // Call BehaviorTreeNode constructor, which calls Actor constructor
    super(config, toolRegistry, executor);
    
    this.blackboard = blackboard;
    this.agentId = config.agentId || this.generateId();
    this.domain = config.domain;
    this.capabilities = config.capabilities || [];
    
    // Agent state managed through BT context
    this.beliefs = new Map();
    this.goals = [];
    this.plans = [];
    
    // Subscribe to blackboard events via actor messaging
    // Uses Actor's message passing inherited through BehaviorTreeNode
    this.setupBlackboardSubscriptions();
  }
  
  static getTypeName() {
    return 'agent';
  }
  
  /**
   * Override Actor's receive method to handle agent-specific messages
   * This demonstrates the inheritance chain - we're overriding a method
   * that comes from Actor through BehaviorTreeNode
   */
  receive(message) {
    // Handle agent-specific messages
    if (message.type === 'BLACKBOARD_UPDATE') {
      this.handleBlackboardUpdate(message);
    } else if (message.type === 'AGENT_QUERY') {
      this.handleAgentQuery(message);
    } else {
      // Delegate to BehaviorTreeNode's receive (which delegates to Actor)
      super.receive(message);
    }
  }
  
  setupBlackboardSubscriptions() {
    // Use actor messaging to subscribe to blackboard events
    this.blackboard.subscribe('knowledge-updated', (event) => {
      this.handleKnowledgeUpdate(event);
    });
    
    this.blackboard.subscribe('task-posted', (event) => {
      if (this.canHandleTask(event.task)) {
        this.handleNewTask(event.task);
      }
    });
  }
  
  async executeNode(context) {
    // Agent main execution loop as a behavior tree
    const agentContext = {
      ...context,
      agent: this,
      beliefs: this.beliefs,
      goals: this.goals,
      blackboard: this.blackboard
    };
    
    // Execute the agent's behavior tree
    if (this.children.length > 0) {
      // Agent behavior defined by child nodes
      const result = await this.executeAllChildren(agentContext);
      return this.processResults(result);
    }
    
    // Default behavior if no children defined
    return await this.defaultBehavior(agentContext);
  }
  
  async defaultBehavior(context) {
    // Perceive → Reason → Act cycle
    const perception = await this.perceive(context);
    const reasoning = await this.reason(perception, context);
    const action = await this.act(reasoning, context);
    
    return {
      status: action.success ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
      data: {
        perception,
        reasoning,
        action,
        agentId: this.agentId
      }
    };
  }
  
  // Agent-specific methods (beyond what BehaviorTreeNode provides)
  async perceive(context) {
    // Query blackboard for relevant information
    return await this.blackboard.query({
      domain: this.domain,
      timestamp: { $gte: context.lastPerception || 0 }
    });
  }
  
  async reason(perception, context) {
    // Use BT nodes for reasoning logic
    // This could be a sub-tree of condition and selector nodes
    return {
      beliefs: this.updateBeliefs(perception),
      goals: this.generateGoals(perception, context),
      plan: this.selectPlan(context)
    };
  }
  
  async act(reasoning, context) {
    // Execute selected plan using action nodes
    if (reasoning.plan) {
      return await this.executePlan(reasoning.plan, context);
    }
    return { success: false, message: 'No plan available' };
  }
  
  // Override Actor's receive method for agent-specific messaging
  receive(message, data) {
    // First check if it's a BT execution request
    if (message === 'execute') {
      return this.execute(data);
    }
    
    // Handle agent-specific messages
    if (message === 'updateBeliefs') {
      return this.updateBeliefs(data);
    }
    
    if (message === 'setGoal') {
      this.goals.push(data);
      return { success: true, goalId: data.id };
    }
    
    // Fall back to BehaviorTreeNode's receive (which falls back to Actor's)
    return super.receive(message, data);
  }
}
```

#### Specialized Agent Types

```javascript
// Planner Agent using BT patterns
export class PlannerAgentBT extends BaseAgentBT {
  static getTypeName() {
    return 'planner-agent';
  }
  
  constructor(config, toolRegistry, blackboard) {
    super(config, toolRegistry, blackboard);
    
    // Initialize with planning-specific behavior tree
    this.initializePlanningBehavior();
  }
  
  initializePlanningBehavior() {
    // Create a behavior tree for planning
    const planningTree = {
      type: 'sequence',
      children: [
        {
          type: 'action',
          tool: 'analyze_requirements',
          outputVariable: 'requirements'
        },
        {
          type: 'selector',  // Try multiple planning strategies
          children: [
            {
              type: 'sequence',
              children: [
                {
                  type: 'condition',
                  condition: 'context.complexity === "simple"',
                  child: {
                    type: 'action',
                    tool: 'simple_planner',
                    params: { requirements: '@requirements' }
                  }
                }
              ]
            },
            {
              type: 'sequence',
              children: [
                {
                  type: 'condition',
                  condition: 'context.complexity === "complex"',
                  child: {
                    type: 'action',
                    tool: 'hierarchical_planner',
                    params: { requirements: '@requirements' }
                  }
                }
              ]
            },
            {
              type: 'retry',
              maxAttempts: 3,
              child: {
                type: 'action',
                tool: 'llm_planner',
                params: { requirements: '@requirements' }
              }
            }
          ]
        },
        {
          type: 'action',
          tool: 'validate_plan',
          params: { plan: '@plan' }
        },
        {
          type: 'action',
          tool: 'publish_to_blackboard',
          params: { 
            data: '@validated_plan',
            topic: 'plan-ready'
          }
        }
      ]
    };
    
    // Convert to BT nodes and set as children
    this.initializeChildren([planningTree]);
  }
}

// Executor Agent with error handling
export class ExecutorAgentBT extends BaseAgentBT {
  static getTypeName() {
    return 'executor-agent';
  }
  
  initializeExecutionBehavior() {
    const executionTree = {
      type: 'sequence',
      children: [
        {
          type: 'action',
          tool: 'subscribe_to_plans',
          outputVariable: 'plan'
        },
        {
          type: 'retry',
          maxAttempts: 3,
          backoffMs: 1000,
          child: {
            type: 'sequence',
            children: [
              {
                type: 'action',
                tool: 'setup_execution_environment',
                params: { plan: '@plan' }
              },
              {
                type: 'parallel',  // Execute independent steps in parallel
                successThreshold: 0.8,  // Allow some failures
                children: '@plan.parallelSteps'  // Dynamic children from plan
              },
              {
                type: 'action',
                tool: 'cleanup_environment'
              }
            ]
          }
        },
        {
          type: 'action',
          tool: 'report_results',
          params: { results: '@execution_results' }
        }
      ]
    };
    
    this.initializeChildren([executionTree]);
  }
}
```

### Agent Coordination Patterns

Behavior Trees provide powerful coordination patterns for multi-agent systems:

#### Sequential Coordination
```javascript
// Agents work in sequence, each building on previous results
const sequentialCoordination = {
  type: 'sequence',
  children: [
    { type: 'agent', agentType: 'analyzer', outputVariable: 'analysis' },
    { type: 'agent', agentType: 'planner', params: { input: '@analysis' }, outputVariable: 'plan' },
    { type: 'agent', agentType: 'executor', params: { plan: '@plan' } }
  ]
};
```

#### Parallel Processing
```javascript
// Multiple agents work simultaneously on different aspects
const parallelProcessing = {
  type: 'parallel',
  successThreshold: 1.0,  // All must succeed
  children: [
    { type: 'agent', agentType: 'security_checker' },
    { type: 'agent', agentType: 'performance_analyzer' },
    { type: 'agent', agentType: 'documentation_generator' }
  ]
};
```

#### Fallback Strategies
```javascript
// Try different agents until one succeeds
const fallbackStrategy = {
  type: 'selector',
  children: [
    { type: 'agent', agentType: 'expert_system' },
    { type: 'agent', agentType: 'llm_agent' },
    { type: 'agent', agentType: 'human_in_loop' }
  ]
};
```

### Blackboard Integration

BT-based agents integrate seamlessly with the blackboard through actor messaging:

```javascript
export class BlackboardIntegratedAgent extends BaseAgentBT {
  async postToBlackboard(key, value) {
    // Use actor messaging to post to blackboard
    await this.blackboard.receive({
      type: 'post',
      key: key,
      value: value,
      agentId: this.agentId,
      timestamp: Date.now()
    });
  }
  
  async queryBlackboard(pattern) {
    // Query blackboard via actor protocol
    const result = await this.blackboard.receive({
      type: 'query',
      pattern: pattern,
      agentId: this.agentId
    });
    
    return result;
  }
  
  subscribeToBlackboard(eventType, handler) {
    // Subscribe using actor event system
    this.blackboard.on(eventType, (event) => {
      // Handle event in BT context
      this.handleBlackboardEvent(event, handler);
    });
  }
  
  handleBlackboardEvent(event, handler) {
    // Create a temporary BT node to handle the event
    const eventNode = {
      type: 'sequence',
      children: [
        {
          type: 'action',
          execute: async () => handler(event)
        },
        {
          type: 'action',
          tool: 'update_agent_state',
          params: { event: event }
        }
      ]
    };
    
    // Execute event handler in agent context
    this.executor.executeTree(eventNode, { event, agent: this });
  }
}
```

### JSON Configuration for BT Agents

Agents can be fully configured in JSON, enabling dynamic agent creation:

```json
{
  "type": "agent",
  "agentType": "ResearchAgent",
  "id": "research-agent-001",
  "domain": "scientific-research",
  "capabilities": ["literature-review", "hypothesis-generation", "experiment-design"],
  "behaviorTree": {
    "type": "sequence",
    "children": [
      {
        "type": "parallel",
        "children": [
          {
            "type": "action",
            "tool": "subscribe_to_research_topics",
            "outputVariable": "topics"
          },
          {
            "type": "action",
            "tool": "monitor_arxiv",
            "params": { "categories": ["cs.AI", "cs.LG"] }
          }
        ]
      },
      {
        "type": "selector",
        "name": "research-strategy",
        "children": [
          {
            "type": "sequence",
            "name": "literature-based",
            "children": [
              {
                "type": "condition",
                "condition": "context.topics.length > 0",
                "child": {
                  "type": "action",
                  "tool": "semantic_search",
                  "params": { "query": "@topics[0]" },
                  "outputVariable": "papers"
                }
              },
              {
                "type": "action",
                "tool": "extract_key_concepts",
                "params": { "papers": "@papers" },
                "outputVariable": "concepts"
              }
            ]
          },
          {
            "type": "sequence",
            "name": "hypothesis-driven",
            "children": [
              {
                "type": "action",
                "tool": "generate_hypothesis",
                "params": { "domain": "@domain" },
                "outputVariable": "hypothesis"
              },
              {
                "type": "action",
                "tool": "design_experiment",
                "params": { "hypothesis": "@hypothesis" }
              }
            ]
          }
        ]
      },
      {
        "type": "action",
        "tool": "publish_findings",
        "params": {
          "findings": "@research_output",
          "blackboard_key": "research_results"
        }
      }
    ]
  }
}
```

### Dynamic Agent Creation

```javascript
export class AgentFactory {
  static async createFromJSON(config, toolRegistry, blackboard) {
    // Parse agent configuration
    const agentConfig = typeof config === 'string' ? JSON.parse(config) : config;
    
    // Determine agent class
    const AgentClass = this.getAgentClass(agentConfig.agentType);
    
    // Create agent instance
    const agent = new AgentClass(agentConfig, toolRegistry, blackboard);
    
    // Initialize behavior tree if provided
    if (agentConfig.behaviorTree) {
      await agent.initializeChildren([agentConfig.behaviorTree]);
    }
    
    // Register with blackboard
    await blackboard.registerAgent(agent);
    
    return agent;
  }
  
  static getAgentClass(agentType) {
    const agentClasses = {
      'planner': PlannerAgentBT,
      'executor': ExecutorAgentBT,
      'monitor': MonitorAgentBT,
      'research': ResearchAgentBT,
      'default': BaseAgentBT
    };
    
    return agentClasses[agentType] || agentClasses.default;
  }
}

// Usage
const researchAgent = await AgentFactory.createFromJSON(
  researchAgentConfig,
  toolRegistry,
  blackboard
);

await researchAgent.execute(initialContext);
```

### Migration Path from Traditional Agents

Converting existing agents to BT-based implementation:

#### Before (Traditional Agent)
```javascript
class TraditionalAgent {
  async run() {
    while (this.active) {
      const perception = await this.perceive();
      const plan = await this.reason(perception);
      const result = await this.execute(plan);
      await this.learn(result);
    }
  }
}
```

#### After (BT-Based Agent)
```javascript
const btAgent = {
  type: 'agent',
  agentType: 'TraditionalMigrated',
  behaviorTree: {
    type: 'retry',
    condition: 'context.active',
    child: {
      type: 'sequence',
      children: [
        { type: 'action', tool: 'perceive', outputVariable: 'perception' },
        { type: 'action', tool: 'reason', params: { input: '@perception' }, outputVariable: 'plan' },
        { type: 'action', tool: 'execute', params: { plan: '@plan' }, outputVariable: 'result' },
        { type: 'action', tool: 'learn', params: { result: '@result' } }
      ]
    }
  }
};
```

### Best Practices for BT Agents

1. **Keep Agent Trees Shallow**: Deep nesting makes debugging difficult
2. **Use Named Nodes**: Always provide meaningful names for nodes
3. **Leverage Selectors for Robustness**: Use fallback strategies for critical operations
4. **Parallelize When Possible**: Use parallel nodes for independent operations
5. **Handle Failures Gracefully**: Use retry nodes with appropriate backoff
6. **Maintain Clear Contracts**: Define clear input/output schemas for agent interactions
7. **Use Conditions Wisely**: Keep condition logic simple and testable
8. **Monitor Performance**: Use BT events for observability

### Advanced Patterns

#### Negotiation Between Agents
```javascript
const negotiationPattern = {
  type: 'sequence',
  children: [
    {
      type: 'parallel',
      children: [
        { type: 'agent', id: 'buyer', action: 'make_offer' },
        { type: 'agent', id: 'seller', action: 'evaluate_offer' }
      ]
    },
    {
      type: 'retry',
      maxAttempts: 5,
      child: {
        type: 'selector',
        children: [
          {
            type: 'condition',
            condition: 'context.agreement_reached',
            child: { type: 'action', tool: 'finalize_deal' }
          },
          {
            type: 'sequence',
            children: [
              { type: 'action', tool: 'adjust_terms' },
              { type: 'action', tool: 'continue_negotiation' }
            ]
          }
        ]
      }
    }
  ]
};
```

#### Self-Organizing Agent Teams
```javascript
const selfOrganizingTeam = {
  type: 'sequence',
  children: [
    {
      type: 'action',
      tool: 'discover_available_agents',
      outputVariable: 'available_agents'
    },
    {
      type: 'action',
      tool: 'analyze_task_requirements',
      outputVariable: 'requirements'
    },
    {
      type: 'action',
      tool: 'form_optimal_team',
      params: {
        agents: '@available_agents',
        requirements: '@requirements'
      },
      outputVariable: 'team'
    },
    {
      type: 'parallel',
      children: '@team.map(agent => ({ type: "agent", id: agent.id, role: agent.role }))'
    }
  ]
};
```

## Conclusion

This architecture provides a powerful, flexible framework for building sophisticated multi-agent AI systems. By combining Legion's knowledge graph, NLP, and prompting systems with a blackboard architecture, and implementing agents as behavior trees built on the actor system, we enable:

- Dynamic agent creation and specialization
- Rich semantic knowledge sharing
- Autonomous tool discovery and learning
- Emergent collective intelligence
- Sophisticated coordination patterns through behavior trees
- Location-transparent distributed agent systems

The system is designed to scale from simple two-agent collaborations to complex networks of hundreds of specialized agents, all coordinating through the semantic blackboard to solve increasingly complex problems.