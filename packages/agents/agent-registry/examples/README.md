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
npm run example:live                    # Live agent execution
npm run example:scificat                # Sci-fi cat image generator

# Or run directly with Node
NODE_OPTIONS='--experimental-vm-modules' node examples/simple-usage.js
NODE_OPTIONS='--experimental-vm-modules' node examples/agent-builder-example.js
NODE_OPTIONS='--experimental-vm-modules' node examples/live-agent-runner.js
NODE_OPTIONS='--experimental-vm-modules' node examples/scificat-agent.js
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

### 3. Live Agent Runner Example (`live-agent-runner.js`)

**🎯 The complete solution that actually builds and runs live agents!**

This example demonstrates the full agent lifecycle from configuration to execution:

#### 🚀 **Live Agent Execution**
- **Agent Configuration**: Store agent config in MongoDB
- **Live Agent Building**: Convert configuration into executable agent instance
- **Real Task Execution**: Process actual user requests and commands
- **Tool Integration**: Execute real tools (FAQ search, ticket creation, email sending)
- **Performance Tracking**: Monitor execution times and success rates

#### 🛠️ **Tool Demonstration**
- **Conversational Tools**: Intelligent response generation with context awareness
- **Support Tools**: FAQ search, product information lookup
- **Action Tools**: Ticket creation, email sending (mocked but realistic)
- **Data Tools**: Context maintenance, user session tracking

#### 📊 **Complete Metrics**
- **Execution Metrics**: Response times, success rates, token usage
- **Business Metrics**: Task completion, user satisfaction tracking
- **System Metrics**: Resource usage, deployment status

#### 🔄 **Agent Lifecycle Management**
- **Registration**: Store agent configuration in database
- **Initialization**: Build live agent with tools and capabilities  
- **Execution**: Run tasks and process user requests
- **Monitoring**: Track performance and collect metrics
- **Deployment Tracking**: Record deployment status and resources

### 4. Sci-Fi Cat Image Generator (`scificat-agent.js`)

**🎨 A creative AI agent that generates sci-fi themed cat images!**

This example showcases a specialized creative agent with file system integration:

#### 🚀 **Creative Image Generation**
- **Theme-based Generation**: Cyberpunk, Space, Steampunk, and Alien themes
- **Detailed Prompts**: Creative, descriptive prompts for high-quality imagery
- **Multiple Formats**: Ready for real image generation APIs (DALL-E, Midjourney, etc.)
- **Fallback Demo**: ASCII art demonstration when image APIs unavailable

#### 📁 **File System Operations**  
- **Directory Creation**: Automatically creates `/images` directory
- **File Management**: Saves generated images and metadata
- **Organized Storage**: Timestamp-based filenames and JSON metadata
- **File Listing**: Tools to browse and manage generated content

#### 🎯 **Specialized Agent Capabilities**
- **Creative Prompts**: Generates detailed, artistic image descriptions
- **Metadata Generation**: Rich metadata with tags, themes, and technical specs
- **Multi-theme Support**: 4 different sci-fi themes with unique characteristics
- **Performance Tracking**: Specialized metrics for creative generation tasks

#### 🖼️ **Generated Content**
Each image generation creates:
- **Image File**: ASCII art (demo) or actual image data
- **Metadata File**: JSON with prompt, theme, tags, and technical details
- **Performance Metrics**: Success rates, generation times, theme distribution

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