# AgentRegistry Examples

This directory contains comprehensive examples demonstrating how to use the AgentRegistry with MongoDB persistence.

## Running the Examples

### Prerequisites
- Node.js 18+ with ES modules support
- MongoDB running (local or remote)
- Legion framework packages installed

### Basic Usage

```bash
# Quick start with simple example
npm run example

# Or run specific examples
npm run example:simple                  # Basic operations
npm run example:comprehensive           # Full feature demonstration

# Or run directly with Node
NODE_OPTIONS='--experimental-vm-modules' node examples/simple-usage.js
NODE_OPTIONS='--experimental-vm-modules' node examples/agent-builder-example.js
```

## Examples Included

### 1. Simple Usage Example (`simple-usage.js`)

A beginner-friendly walkthrough covering:

- **Basic Operations**: Create, retrieve, update, delete agents
- **Agent Configuration**: Essential fields and structure
- **Metadata Access**: Lightweight agent information
- **Registry Statistics**: Basic analytics
- **Clean Workflow**: Step-by-step progression

Perfect for getting started with the AgentRegistry system.

### 2. Agent Builder Example (`agent-builder-example.js`)

A comprehensive demonstration showing:

#### 🏗️ **Agent Creation**
- **Conversational Agent**: Customer support with empathy and escalation
- **Task Agent**: Automated data processing with scheduling
- **Analytical Agent**: Financial advisor with portfolio management

#### 🔍 **Search & Discovery**
- List all agents
- Filter by type (conversational, task, analytical)
- Filter by tags and LLM provider
- Search by name patterns

#### 🔄 **Version Management**
- Update existing agents with new versions
- Track changes and enhancements
- Maintain version history

#### 🚀 **Deployment Tracking**
- Record deployment environments
- Track resource allocation
- Monitor deployment status

#### 📊 **Metrics Collection**
- Performance metrics (response time, throughput)
- Usage statistics (requests, success rates)
- Business metrics (satisfaction scores, costs)

#### 📈 **Analytics & Statistics**
- Registry overview statistics
- Agent distribution by type and provider
- Performance dashboards

#### 💾 **Export/Import**
- Export agent configurations
- Backup and migration support
- Cross-environment deployment

## Example Agent Configurations

### Conversational Agent
```javascript
{
  id: 'customer-support-001',
  name: 'CustomerSupportAgent',
  type: 'conversational',
  llm: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7
  },
  capabilities: [
    { module: 'knowledge-base', tools: ['search_faq', 'get_product_info'] },
    { module: 'communication', tools: ['send_email', 'create_ticket'] }
  ]
}
```

### Task Agent
```javascript
{
  id: 'data-processor-001',
  name: 'DataProcessorAgent',
  type: 'task',
  execution: {
    timeout: 300000,
    retryAttempts: 3,
    parallelTasks: 5
  },
  triggers: {
    schedule: '0 2 * * *', // Daily at 2 AM
    events: ['file_uploaded', 'data_updated']
  }
}
```

### Analytical Agent
```javascript
{
  id: 'financial-advisor-001',
  name: 'FinancialAdvisorAgent',
  type: 'analytical',
  analysis: {
    riskTolerance: 'moderate',
    timeHorizon: 'long_term',
    complianceChecks: true
  },
  security: {
    dataEncryption: true,
    auditLogging: true
  }
}
```

## Key Features Demonstrated

### 🎯 **Agent Types**
- **Conversational**: Customer interaction, support, chat
- **Task**: Automation, data processing, scheduled operations  
- **Analytical**: Analysis, insights, recommendations

### 🧠 **LLM Integration**
- Multiple providers (Anthropic, OpenAI)
- Model selection and configuration
- Temperature and token limits

### 🛠️ **Capabilities System**
- Modular tool organization
- Tool discovery and binding
- Capability-based searching

### 📋 **Metadata Management**
- Tags and categorization
- Version tracking
- Description and documentation

### 🔄 **Lifecycle Management**
- Registration and updates
- Deployment tracking
- Status monitoring
- Metrics collection

### 💾 **Persistence**
- MongoDB storage
- Version history
- Deployment records
- Performance metrics

## Expected Output

When running the example, you'll see:

```
🚀 AgentRegistry Example: Building and Managing Agents

1️⃣ Building Different Types of Agents
✅ Created Customer Support Agent: customer-support-001
✅ Created Data Processor Agent: data-processor-001
✅ Created Financial Advisor Agent: financial-advisor-001

2️⃣ Searching and Filtering Agents
📋 Total Agents: 3
🤖 Task Agents: 1
🏭 Production Agents: 1
🧠 Anthropic-powered Agents: 2
🔍 Customer-related Agents: 1

3️⃣ Managing Agent Versions
🔄 Updated Agent to version: 1.1.0
📊 Agent Metadata:
   Version: 1.1.0
   Tags: customer-service, support, production, multilingual
   Tool Count: 10

4️⃣ Deployment and Metrics Tracking
🚀 Deployment Created: [deployment-id]
📈 Saved performance metrics: [metric-id]
📈 Saved usage metrics: [metric-id]
📈 Saved business metrics: [metric-id]

5️⃣ Agent Statistics and Analytics
📈 Registry Statistics:
   Total Agents: 3
   By Type:
     conversational: 1
     task: 1
     analytical: 1

6️⃣ Export/Import Functionality
📦 Exported 2 agents
   Export Version: 1.0.0
   Sample Export - Agent: CustomerSupportAgent

✅ Example completed successfully!
```

This example provides a complete blueprint for building production-ready AI agents with the Legion AgentRegistry system.