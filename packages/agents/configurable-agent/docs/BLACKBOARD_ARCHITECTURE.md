# Blackboard Architecture for Multi-Agent Systems

## Overview

The Blackboard Architecture provides a shared knowledge workspace where multiple agents collaborate to solve complex problems. This architecture leverages Legion's Handle-based data access patterns and task/context management to create a dynamic, distributed problem-solving environment.

## Core Architecture

### Foundation: Handle-Based Blackboard

The blackboard is implemented as a Handle-compatible DataSource that provides:
- Synchronous query operations
- Real-time subscriptions for change notifications  
- Schema-driven entity management
- Transparent access through Handle proxies

```javascript
import { Handle } from '@legion/handle';
import { TripleStoreDataSource, InMemoryTripleStore } from '@legion/triplestore';
import { ResourceManager } from '@legion/resource-manager';

class BlackboardSystem {
  constructor() {
    this.tripleStore = new InMemoryTripleStore();
    this.dataSource = new TripleStoreDataSource(this.tripleStore);
    this.subscriptions = new Map();
    this.agents = new Map();
  }
  
  async initialize() {
    const resourceManager = await ResourceManager.getInstance();
    this.llmClient = await resourceManager.get('llmClient');
    
    // Initialize task orchestrator for agent coordination
    const { TaskOrchestrator } = await import('@legion/bt-task');
    this.taskOrchestrator = new TaskOrchestrator({
      resourceManager,
      sessionId: `blackboard-${Date.now()}`
    });
  }
  
  // Create a Handle for the blackboard root
  createHandle(entityId = 'blackboard-root') {
    return new Handle(this.dataSource, entityId);
  }
  
  // Query the blackboard using Handle query patterns
  query(querySpec) {
    return this.dataSource.query(querySpec);
  }
  
  // Subscribe to blackboard changes
  subscribe(querySpec, callback) {
    return this.dataSource.subscribe(querySpec, callback);
  }
}
```

### Agent Architecture with Task Context

Agents use the task/context Handle system for structured problem solving:

```javascript
import { Actor } from '@legion/actors';
import { Handle } from '@legion/handle';

class BlackboardAgent extends Actor {
  constructor(config) {
    super();
    this.agentId = config.id;
    this.capabilities = config.capabilities;
    this.contextHandle = null;
    this.taskHandle = null;
  }
  
  async initialize(blackboard) {
    this.blackboard = blackboard;
    
    // Create agent's context handle for working memory
    this.contextHandle = this.blackboard.createHandle(`context-${this.agentId}`);
    
    // Subscribe to relevant blackboard changes
    this.subscription = this.blackboard.subscribe(
      { type: 'Problem', status: 'pending' },
      (changes) => this.onBlackboardChange(changes)
    );
  }
  
  async receive(message) {
    switch (message.type) {
      case 'solve':
        return this.solveProblem(message.problem);
      case 'collaborate':
        return this.collaborateOnTask(message.taskId);
      case 'share-knowledge':
        return this.shareKnowledge(message.knowledge);
      default:
        return { status: 'unknown-message-type' };
    }
  }
  
  async solveProblem(problem) {
    // Create task handle for this problem
    this.taskHandle = this.blackboard.createHandle(`task-${problem.id}`);
    
    // Store problem in blackboard
    await this.taskHandle.update({
      type: 'Task',
      problem: problem,
      status: 'analyzing',
      agentId: this.agentId,
      timestamp: Date.now()
    });
    
    // Analyze problem using context
    const analysis = await this.analyzeProblem(problem);
    
    // Update task with analysis
    await this.taskHandle.update({
      analysis: analysis,
      status: 'planning'
    });
    
    // Create solution plan
    const plan = await this.createPlan(analysis);
    
    // Execute plan with progress updates
    return this.executePlan(plan);
  }
  
  async analyzeProblem(problem) {
    // Use LLM to analyze problem with agent's capabilities
    const prompt = this.buildAnalysisPrompt(problem);
    const response = await this.llmClient.sendMessage(prompt);
    
    // Store analysis in context
    await this.contextHandle.update({
      currentAnalysis: response.content,
      timestamp: Date.now()
    });
    
    return response.content;
  }
}
```

### Task Orchestration with Behavior Trees

Complex multi-agent workflows use behavior trees for coordination:

```javascript
import { BehaviorTreeExecutor } from '@legion/bt-task';

class MultiAgentOrchestrator {
  constructor(blackboard) {
    this.blackboard = blackboard;
    this.agents = new Map();
    this.executor = new BehaviorTreeExecutor();
  }
  
  async orchestrateSolution(problem) {
    // Define behavior tree for multi-agent collaboration
    const behaviorTree = {
      type: 'sequence',
      children: [
        {
          type: 'parallel',
          id: 'analyze-phase',
          children: [
            {
              type: 'action',
              id: 'domain-analysis',
              tool: 'agent_execute',
              params: { 
                agentType: 'domain-expert',
                task: 'analyze',
                problem: problem
              }
            },
            {
              type: 'action', 
              id: 'constraint-analysis',
              tool: 'agent_execute',
              params: {
                agentType: 'constraint-solver',
                task: 'identify-constraints',
                problem: problem
              }
            }
          ]
        },
        {
          type: 'action',
          id: 'synthesize',
          tool: 'consensus_builder',
          params: {
            inputs: ['domain-analysis', 'constraint-analysis']
          }
        },
        {
          type: 'selector',
          id: 'solution-strategy',
          children: [
            {
              type: 'sequence',
              condition: { complexity: 'high' },
              children: [
                {
                  type: 'action',
                  id: 'decompose',
                  tool: 'problem_decomposer',
                  params: { problem: problem }
                },
                {
                  type: 'parallel',
                  id: 'solve-subproblems',
                  tool: 'distributed_solver'
                }
              ]
            },
            {
              type: 'action',
              id: 'direct-solve',
              tool: 'single_agent_solver',
              params: { problem: problem }
            }
          ]
        }
      ]
    };
    
    // Execute with blackboard context
    const context = {
      blackboard: this.blackboard,
      agents: this.agents,
      problem: problem
    };
    
    return this.executor.executeTree(behaviorTree, context);
  }
}
```

## Implementation Patterns

### 1. Knowledge Sharing via Handle Subscriptions

```javascript
class CollaborativeAgent extends BlackboardAgent {
  async initialize(blackboard) {
    await super.initialize(blackboard);
    
    // Subscribe to other agents' discoveries
    this.knowledgeSubscription = this.blackboard.subscribe(
      { type: 'Discovery', relevantTo: this.capabilities },
      (discovery) => this.integrateKnowledge(discovery)
    );
  }
  
  async integrateKnowledge(discovery) {
    // Update local context with new knowledge
    const currentKnowledge = await this.contextHandle.value();
    const integrated = this.mergeKnowledge(currentKnowledge, discovery);
    
    await this.contextHandle.update(integrated);
    
    // Re-evaluate current tasks with new knowledge
    if (this.taskHandle) {
      await this.reevaluateTask();
    }
  }
  
  async shareDiscovery(discovery) {
    // Post discovery to blackboard for other agents
    const discoveryHandle = this.blackboard.createHandle(`discovery-${Date.now()}`);
    await discoveryHandle.update({
      type: 'Discovery',
      agentId: this.agentId,
      content: discovery,
      relevantTo: this.extractRelevantCapabilities(discovery),
      timestamp: Date.now()
    });
  }
}
```

### 2. Dynamic Agent Creation with ConfigurableAgent

```javascript
import { ConfigurableAgent } from '@legion/configurable-agent';

class AgentFactory {
  constructor(blackboard) {
    this.blackboard = blackboard;
    this.agentConfigs = new Map();
  }
  
  async createAgent(role, problemContext) {
    // Generate agent configuration based on problem
    const config = await this.generateAgentConfig(role, problemContext);
    
    // Create configurable agent
    const agent = new ConfigurableAgent(config);
    await agent.initialize();
    
    // Connect to blackboard
    const blackboardAdapter = new BlackboardAdapter(this.blackboard, agent);
    await blackboardAdapter.connect();
    
    return agent;
  }
  
  async generateAgentConfig(role, problemContext) {
    return {
      agent: {
        id: `${role}-${Date.now()}`,
        name: `${role} Agent`,
        type: 'task',
        llm: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          systemPrompt: this.buildSystemPrompt(role, problemContext)
        },
        capabilities: this.getCapabilitiesForRole(role),
        behaviorTree: this.getBehaviorTreeForRole(role),
        knowledge: {
          enabled: true,
          persistence: 'session'
        }
      }
    };
  }
}
```

### 3. Tool Discovery and Testing Framework

```javascript
import { ToolRegistry } from '@legion/tools';

class ToolDiscoveryAgent extends BlackboardAgent {
  async initialize(blackboard) {
    await super.initialize(blackboard);
    this.toolRegistry = await ToolRegistry.getInstance();
    this.testedTools = new Set();
  }
  
  async discoverTools(taskRequirements) {
    // Search for relevant tools
    const tools = await this.toolRegistry.searchTools(taskRequirements);
    
    // Test each tool and share results
    for (const tool of tools) {
      if (!this.testedTools.has(tool.name)) {
        const testResult = await this.testTool(tool, taskRequirements);
        await this.shareToolCapability(tool, testResult);
        this.testedTools.add(tool.name);
      }
    }
  }
  
  async testTool(tool, requirements) {
    try {
      // Create test scenario
      const testCase = this.generateTestCase(tool, requirements);
      
      // Execute tool
      const result = await tool.execute(testCase.params);
      
      // Validate result
      const validation = this.validateResult(result, testCase.expected);
      
      return {
        success: validation.passed,
        performance: validation.metrics,
        limitations: validation.limitations
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async shareToolCapability(tool, testResult) {
    const capabilityHandle = this.blackboard.createHandle(`capability-${tool.name}`);
    await capabilityHandle.update({
      type: 'ToolCapability',
      toolName: tool.name,
      description: tool.description,
      testResult: testResult,
      discoveredBy: this.agentId,
      timestamp: Date.now()
    });
  }
}
```

## Use Cases

### 1. Collaborative Research System

```javascript
class ResearchBlackboard extends BlackboardSystem {
  async conductResearch(topic) {
    // Create research task
    const taskHandle = this.createHandle(`research-${Date.now()}`);
    await taskHandle.update({
      type: 'ResearchTask',
      topic: topic,
      status: 'initializing',
      findings: []
    });
    
    // Deploy specialized agents
    const agents = [
      await this.createAgent('literature-reviewer', topic),
      await this.createAgent('data-analyst', topic),
      await this.createAgent('hypothesis-generator', topic),
      await this.createAgent('experiment-designer', topic)
    ];
    
    // Orchestrate research phases
    const orchestrator = new MultiAgentOrchestrator(this);
    const result = await orchestrator.orchestrateSolution({
      type: 'research',
      topic: topic,
      phases: ['literature-review', 'analysis', 'synthesis', 'validation']
    });
    
    return result;
  }
}
```

### 2. Distributed Problem Solving

```javascript
class ProblemSolvingBlackboard extends BlackboardSystem {
  async solveProblem(problem) {
    // Analyze problem complexity
    const complexity = await this.analyzeProblemComplexity(problem);
    
    if (complexity.requiresDecomposition) {
      // Decompose into subproblems
      const subproblems = await this.decomposeProblem(problem);
      
      // Solve subproblems in parallel
      const solutions = await Promise.all(
        subproblems.map(sp => this.solveSubproblem(sp))
      );
      
      // Integrate solutions
      return this.integrateSolutions(solutions);
    } else {
      // Direct solution with appropriate agent
      const agent = await this.selectBestAgent(problem);
      return agent.solve(problem);
    }
  }
  
  async solveSubproblem(subproblem) {
    // Create subproblem handle
    const spHandle = this.createHandle(`subproblem-${subproblem.id}`);
    await spHandle.update({
      type: 'Subproblem',
      parent: subproblem.parentId,
      content: subproblem,
      status: 'pending'
    });
    
    // Wait for agent to claim and solve
    return new Promise((resolve) => {
      const unsubscribe = this.subscribe(
        { id: spHandle.id, status: 'completed' },
        (result) => {
          unsubscribe();
          resolve(result);
        }
      );
    });
  }
}
```

### 3. Learning and Adaptation System

```javascript
class LearningBlackboard extends BlackboardSystem {
  async learnFromExperience(experience) {
    // Store experience
    const expHandle = this.createHandle(`experience-${Date.now()}`);
    await expHandle.update({
      type: 'Experience',
      content: experience,
      timestamp: Date.now()
    });
    
    // Trigger learning agents
    const learningAgents = await this.getAgentsByCapability('learning');
    
    for (const agent of learningAgents) {
      await agent.processExperience(experience);
    }
    
    // Extract patterns
    const patterns = await this.extractPatterns();
    
    // Update agent strategies
    await this.updateAgentStrategies(patterns);
  }
  
  async extractPatterns() {
    // Query all experiences
    const experiences = await this.query({
      type: 'Experience',
      limit: 100,
      orderBy: 'timestamp',
      direction: 'desc'
    });
    
    // Use pattern recognition agent
    const patternAgent = await this.createAgent('pattern-recognizer');
    return patternAgent.analyze(experiences);
  }
}
```

## Integration with Legion Ecosystem

### Actor System Integration

```javascript
import { ActorSpace, RemoteActor } from '@legion/actors';

class DistributedBlackboard extends BlackboardSystem {
  async initialize() {
    await super.initialize();
    
    // Create actor space for distributed agents
    this.actorSpace = new ActorSpace('blackboard-space');
    
    // Enable remote agent participation
    this.remoteAgentProxy = new RemoteActor(this.actorSpace);
  }
  
  async registerRemoteAgent(agentUrl) {
    const remoteAgent = await this.remoteAgentProxy.connect(agentUrl);
    
    // Wrap in blackboard adapter
    const adapter = new BlackboardAgentAdapter(remoteAgent, this);
    this.agents.set(remoteAgent.id, adapter);
    
    return adapter;
  }
}
```

### Handle DSL Integration

```javascript
import { DSL } from '@legion/handle-dsl';

class QueryableBlackboard extends BlackboardSystem {
  constructor() {
    super();
    this.dsl = new DSL(this.dataSource);
  }
  
  // DSL-based queries
  async findSolutions(criteria) {
    return this.dsl.query`
      SELECT solution 
      FROM blackboard
      WHERE solution.type = 'Solution'
        AND solution.problem.matches(${criteria})
        AND solution.confidence > 0.8
      ORDER BY solution.confidence DESC
    `;
  }
  
  // DSL-based updates
  async updateTaskStatus(taskId, status) {
    return this.dsl.update`
      UPDATE task
      SET status = ${status},
          updatedAt = ${Date.now()}
      WHERE task.id = ${taskId}
    `;
  }
}
```

## Best Practices

### 1. Agent Design
- Keep agents focused on specific capabilities
- Use Handle-based context for working memory
- Share discoveries promptly via blackboard
- Subscribe only to relevant changes

### 2. Blackboard Management
- Use schema validation for all entities
- Implement cleanup for old/irrelevant data
- Index frequently queried patterns
- Monitor subscription performance

### 3. Coordination Patterns
- Use behavior trees for complex workflows
- Implement timeouts for agent responses
- Handle partial solutions gracefully
- Build consensus before major decisions

### 4. Error Handling
- Fail fast with clear error messages
- Log all agent actions for debugging
- Implement circuit breakers for failing agents
- Provide fallback strategies

## Migration from Knowledge Graph

For systems currently using the old KnowledgeGraph approach:

1. **Replace KGEngine with TripleStoreDataSource**
```javascript
// Old
this.kg = new KGEngine();

// New
this.tripleStore = new InMemoryTripleStore();
this.dataSource = new TripleStoreDataSource(this.tripleStore);
```

2. **Update entity access to use Handles**
```javascript
// Old
const entity = await this.kg.getEntity(id);

// New
const handle = this.createHandle(id);
const entity = await handle.value();
```

3. **Convert queries to Handle query spec**
```javascript
// Old
const results = await this.kg.query(sparqlQuery);

// New
const results = this.dataSource.query({
  type: 'EntityType',
  where: { property: value }
});
```

4. **Update subscriptions**
```javascript
// Old
this.kg.on('change', callback);

// New
const unsubscribe = this.dataSource.subscribe(querySpec, callback);
```

## Conclusion

The Blackboard Architecture leverages Legion's Handle-based data access and task orchestration to create powerful multi-agent systems. By using synchronous operations, schema-driven entities, and behavior tree coordination, it provides a robust foundation for collaborative problem-solving while maintaining clean separation of concerns and type safety throughout the system.