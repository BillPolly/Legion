# @legion/meta-agent

## Overview

The MetaAgent is a sophisticated AI agent that can design, test, validate, and deploy other configurable agents. It provides a complete agent lifecycle management system with automated testing, prompt optimization, and performance validation.

## Features

- **Automated Agent Design**: Creates agent configurations based on high-level requirements
- **Prompt Engineering**: Automatically optimizes and refines prompts for better performance  
- **Comprehensive Testing**: Runs behavioral, performance, and integration tests
- **Validation & Refinement**: Validates agents against requirements and refines configurations
- **Agent Registry**: Registers and manages created agents
- **Performance Analysis**: Benchmarks response times, throughput, and accuracy

## Architecture

The MetaAgent integrates several components:

```
MetaAgent
├── AgentDesigner      - Designs agent configurations
├── PromptTester       - Tests and optimizes prompts
├── PromptEvaluator    - Evaluates prompt quality
├── TestRunner         - Executes comprehensive test suites
├── TestValidator      - Validates test results
└── AgentRegistry      - Stores and manages agents
```

## Usage

```javascript
import { MetaAgent } from '@legion/meta-agent';
import { ResourceManager } from '@legion/resource-manager';

// Initialize ResourceManager
const resourceManager = await ResourceManager.getInstance();

// Create MetaAgent
const metaAgent = new MetaAgent({
  agent: {
    id: 'meta-agent-1',
    name: 'Agent Creator'
  }
}, resourceManager);

// Initialize components
await metaAgent.initialize();

// Define requirements for new agent
const requirements = {
  purpose: 'Create a customer support agent',
  type: 'conversational',
  
  behavior: {
    responseStyle: 'friendly',
    technicalLevel: 'adaptable'
  },
  
  capabilities: {
    mustHave: ['answer questions', 'provide instructions'],
    niceToHave: ['search knowledge base']
  },
  
  performance: {
    maxResponseTime: 1000,
    minAccuracy: 0.85
  },
  
  minPassRate: 0.8
};

// Create the agent
const result = await metaAgent.createAgent(requirements);

if (result.success) {
  console.log(`Agent created: ${result.agentName} (${result.agentId})`);
  console.log(`Tests passed: ${result.testsPassed}`);
  console.log(`Registration ID: ${result.registrationId}`);
}
```

## Workflow

The agent creation workflow consists of 6 steps:

1. **Design**: Analyze requirements and generate initial configuration
2. **Optimize**: Test and optimize prompts for quality and effectiveness
3. **Create**: Instantiate the agent with optimized configuration
4. **Test**: Run comprehensive test suites (behavioral, performance, integration)
5. **Validate**: Check test results against requirements, refine if needed
6. **Register**: Store agent in registry for deployment and management

## Commands

The MetaAgent responds to special commands:

- `/create-agent {requirements}` - Create a new agent
- `/test-agent <agent-id>` - Run tests on an existing agent
- `/list-agents` - List all registered agents
- `/agent-report <agent-id>` - Generate comprehensive agent report

## Configuration

MetaAgent configuration includes:

```javascript
{
  agent: {
    id: 'meta-agent',
    name: 'Meta Agent',
    type: 'task'
  },
  
  behavior: {
    responseStyle: 'professional',
    creativity: 0.7,
    verbosity: 'balanced'
  },
  
  capabilities: {
    tools: [
      'agent_design',
      'agent_testing', 
      'prompt_engineering',
      'agent_deployment',
      'performance_analysis'
    ]
  }
}
```

## Testing

The package includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Run unit tests only
npm test -- __tests__/unit

# Run integration tests
npm test -- __tests__/integration
```

## Requirements Analysis

The MetaAgent analyzes requirements to determine:

- **Domain**: technical, creative, analytical, educational, supportive
- **Data Processing**: Whether the agent needs data manipulation capabilities
- **Web Access**: Whether the agent needs web search/fetch capabilities
- **File Operations**: Whether the agent needs file read/write capabilities
- **Precision vs Creativity**: Balance between accurate and creative responses

## Prompt Optimization

The MetaAgent optimizes prompts through:

1. **Batch Testing**: Tests prompts against multiple scenarios
2. **Auto-Optimization**: Adjusts clarity, specificity, and helpfulness
3. **Quality Evaluation**: Assesses prompt clarity and effectiveness
4. **Feedback Generation**: Creates improved versions based on evaluation

## Validation & Refinement

Agents are validated against:

- **Test Pass Rate**: Must meet minimum threshold (default 80%)
- **Behavior Consistency**: Basic behavior tests must pass at 90%+
- **Performance Metrics**: Response time, throughput, error rate
- **Custom Requirements**: Any specific validation criteria

Failed validations trigger automatic refinement:

- Prompt improvements for low pass rates
- Temperature/creativity adjustments for consistency
- Performance optimizations for speed issues
- Tool optimization for capability problems

## Future Enhancements

- Multi-agent orchestration and coordination
- A/B testing for agent variations
- Continuous learning from production metrics
- Agent versioning and rollback capabilities
- Visual agent design interface
- Agent marketplace integration