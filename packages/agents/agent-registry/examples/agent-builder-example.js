/**
 * Comprehensive Example: Building Agents with AgentRegistry
 * 
 * This example demonstrates:
 * 1. Creating different types of agents
 * 2. Using the MongoDB persistence layer
 * 3. Managing agent configurations
 * 4. Tracking deployments and metrics
 * 5. Searching and filtering agents
 */

import { AgentRegistry } from '../src/AgentRegistry.js';
import { ResourceManager } from '@legion/resource-manager';

async function main() {
  console.log('🚀 AgentRegistry Example: Building and Managing Agents\n');
  
  // Initialize the registry
  const resourceManager = await ResourceManager.getInstance();
  const registry = new AgentRegistry(resourceManager);
  await registry.initialize();
  
  try {
    // Clear any existing test data
    await cleanupExistingData(registry);
    
    console.log('1️⃣ Building Different Types of Agents\n');
    await buildExampleAgents(registry);
    
    console.log('2️⃣ Searching and Filtering Agents\n');
    await demonstrateSearch(registry);
    
    console.log('3️⃣ Managing Agent Versions\n');
    await demonstrateVersioning(registry);
    
    console.log('4️⃣ Deployment and Metrics Tracking\n');
    await demonstrateDeploymentTracking(registry);
    
    console.log('5️⃣ Agent Statistics and Analytics\n');
    await demonstrateStatistics(registry);
    
    console.log('6️⃣ Export/Import Functionality\n');
    await demonstrateExportImport(registry);
    
    console.log('✅ Example completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Example failed:', error.message);
    throw error;
  } finally {
    await registry.cleanup();
  }
}

async function buildExampleAgents(registry) {
  // 1. Conversational Agent - Customer Support
  const customerSupportAgent = {
    agent: {
      id: 'customer-support-001',
      name: 'CustomerSupportAgent',
      type: 'conversational',
      version: '1.0.0',
      description: 'AI agent for handling customer support inquiries with empathy and efficiency',
      tags: ['customer-service', 'support', 'production'],
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096
      },
      prompts: {
        system: `You are a helpful customer support agent. Always be polite, empathetic, and solution-focused.
                 When customers have issues, guide them step-by-step through solutions.
                 If you cannot resolve an issue, escalate to human support.`,
        greeting: 'Hello! I\'m here to help you with any questions or issues you might have. How can I assist you today?'
      },
      capabilities: [
        {
          module: 'knowledge-base',
          tools: ['search_faq', 'get_product_info', 'check_order_status']
        },
        {
          module: 'communication',
          tools: ['send_email', 'create_ticket', 'schedule_callback']
        }
      ],
      behavior: {
        maxConversationLength: 50,
        escalationTriggers: ['refund_request', 'billing_dispute', 'technical_failure'],
        responseStyle: 'friendly_professional'
      }
    }
  };

  const supportResult = await registry.registerAgent(customerSupportAgent);
  console.log(`✅ Created Customer Support Agent: ${supportResult.agentId || 'registered successfully'}`);

  // 2. Task Agent - Data Processor
  const dataProcessorAgent = {
    agent: {
      id: 'data-processor-001',
      name: 'DataProcessorAgent',
      type: 'task',
      version: '1.0.0',
      description: 'Automated agent for processing, analyzing, and transforming data pipelines',
      tags: ['data-processing', 'automation', 'analytics'],
      llm: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.2,
        maxTokens: 2048
      },
      capabilities: [
        {
          module: 'file-operations',
          tools: ['read_csv', 'write_json', 'process_xlsx', 'validate_data']
        },
        {
          module: 'data-analysis',
          tools: ['calculate_statistics', 'detect_anomalies', 'generate_report']
        },
        {
          module: 'database',
          tools: ['query_database', 'update_records', 'create_indexes']
        }
      ],
      execution: {
        timeout: 300000, // 5 minutes
        retryAttempts: 3,
        parallelTasks: 5,
        memoryLimit: '1GB'
      },
      triggers: {
        schedule: '0 2 * * *', // Daily at 2 AM
        events: ['file_uploaded', 'data_updated'],
        conditions: ['file_size > 1MB', 'data_changed > 100_records']
      }
    }
  };

  const processorResult = await registry.registerAgent(dataProcessorAgent);
  console.log(`✅ Created Data Processor Agent: ${processorResult.agentId || 'registered successfully'}`);

  // 3. Analytical Agent - Financial Advisor
  const financialAdvisorAgent = {
    agent: {
      id: 'financial-advisor-001',
      name: 'FinancialAdvisorAgent',
      type: 'analytical',
      version: '1.0.0',
      description: 'AI financial advisor providing investment analysis and portfolio recommendations',
      tags: ['finance', 'advisory', 'analysis'],
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.3,
        maxTokens: 6000
      },
      capabilities: [
        {
          module: 'financial-data',
          tools: ['get_stock_price', 'analyze_market_trends', 'calculate_risk_metrics']
        },
        {
          module: 'portfolio-management',
          tools: ['optimize_portfolio', 'rebalance_assets', 'generate_recommendations']
        },
        {
          module: 'reporting',
          tools: ['create_charts', 'generate_pdf_report', 'send_notifications']
        }
      ],
      analysis: {
        riskTolerance: 'moderate',
        timeHorizon: 'long_term',
        investmentStyle: 'diversified_growth',
        complianceChecks: true
      },
      security: {
        dataEncryption: true,
        auditLogging: true,
        accessControl: 'role_based'
      }
    }
  };

  const advisorResult = await registry.registerAgent(financialAdvisorAgent);
  console.log(`✅ Created Financial Advisor Agent: ${advisorResult.agentId || 'registered successfully'}\n`);
}

async function demonstrateSearch(registry) {
  // List all agents
  const allAgents = await registry.listAgents();
  console.log(`📋 Total Agents: ${allAgents.length}`);
  
  // Filter by type
  const taskAgents = await registry.listAgents({ type: 'task' });
  console.log(`🤖 Task Agents: ${taskAgents.length}`);
  
  // Filter by tags
  const productionAgents = await registry.listAgents({ tags: ['production'] });
  console.log(`🏭 Production Agents: ${productionAgents.length}`);
  
  // Filter by LLM provider
  const anthropicAgents = await registry.listAgents({ provider: 'anthropic' });
  console.log(`🧠 Anthropic-powered Agents: ${anthropicAgents.length}`);
  
  // Search by name
  const customerAgents = await registry.searchAgents('Customer');
  console.log(`🔍 Customer-related Agents: ${customerAgents.length}`);
  
  // Get specific agent
  const agent = await registry.getAgent('customer-support-001');
  console.log(`📖 Retrieved Agent: ${agent.agent.name} (${agent.agent.type})\n`);
}

async function demonstrateVersioning(registry) {
  // Update the customer support agent with new version
  const updatedAgent = {
    agent: {
      id: 'customer-support-001',
      name: 'CustomerSupportAgent',
      type: 'conversational',
      version: '1.1.0',
      description: 'Enhanced AI agent with multilingual support and sentiment analysis',
      tags: ['customer-service', 'support', 'production', 'multilingual'],
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.6, // Slightly lower for more consistency
        maxTokens: 4096
      },
      capabilities: [
        {
          module: 'knowledge-base',
          tools: ['search_faq', 'get_product_info', 'check_order_status']
        },
        {
          module: 'communication',
          tools: ['send_email', 'create_ticket', 'schedule_callback']
        },
        {
          module: 'language-processing',
          tools: ['detect_language', 'translate_text', 'analyze_sentiment']
        }
      ],
      enhancements: {
        languageSupport: ['english', 'spanish', 'french', 'german'],
        sentimentAnalysis: true,
        emotionalIntelligence: 'enhanced'
      }
    }
  };

  const updateResult = await registry.registerAgent(updatedAgent, { allowUpdate: true });
  console.log(`🔄 Updated Agent to version: ${updateResult.version}`);
  
  // Get agent metadata to see the changes
  const metadata = await registry.getAgentMetadata('customer-support-001');
  console.log(`📊 Agent Metadata:`);
  console.log(`   Version: ${metadata.version}`);
  console.log(`   Tags: ${metadata.tags.join(', ')}`);
  console.log(`   Tool Count: ${metadata.toolCount}\n`);
}

async function demonstrateDeploymentTracking(registry) {
  // Simulate deployment tracking for the data processor
  // We need to get the agent from the repository directly to get the MongoDB _id
  const agentRecord = await registry.repository.getAgentById('data-processor-001');
  if (!agentRecord) {
    console.log('❌ Agent not found for deployment tracking');
    return;
  }
  const agentId = agentRecord._id.toString();
  
  // Save deployment information
  const deploymentData = {
    environment: 'production',
    status: 'active',
    version: '1.0.0',
    instanceCount: 3,
    resources: {
      cpu: '2 cores',
      memory: '4GB',
      storage: '100GB'
    },
    configuration: {
      maxConcurrentTasks: 10,
      queueSize: 1000,
      healthCheckInterval: 30
    }
  };

  const deployResult = await registry.repository.saveDeployment(agentId, deploymentData);
  console.log(`🚀 Deployment Created: ${deployResult.deploymentId}`);

  // Track some performance metrics
  const metricsData = [
    {
      metricType: 'performance',
      responseTime: 125,
      throughput: 500,
      errorRate: 0.001,
      cpuUsage: 45,
      memoryUsage: 60
    },
    {
      metricType: 'usage',
      totalRequests: 10000,
      successfulRequests: 9990,
      failedRequests: 10,
      averageProcessingTime: 2.3
    },
    {
      metricType: 'business',
      recordsProcessed: 50000,
      dataQualityScore: 0.98,
      customerSatisfaction: 4.7,
      costPerOperation: 0.02
    }
  ];

  for (const metrics of metricsData) {
    const metricResult = await registry.repository.saveMetrics(agentId, metrics);
    console.log(`📈 Saved ${metrics.metricType} metrics: ${metricResult.metricId}`);
    
    // Small delay between metrics
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Retrieve performance metrics
  const perfMetrics = await registry.repository.getMetrics(agentId, { 
    metricType: 'performance',
    limit: 5 
  });
  console.log(`📊 Retrieved ${perfMetrics.length} performance metric entries\n`);
}

async function demonstrateStatistics(registry) {
  const stats = await registry.getStatistics();
  
  console.log('📈 Registry Statistics:');
  console.log(`   Total Agents: ${stats.totalAgents}`);
  console.log('   By Type:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`     ${type}: ${count}`);
  });
  console.log('   By Provider:');
  Object.entries(stats.byProvider).forEach(([provider, count]) => {
    console.log(`     ${provider}: ${count}`);
  });
  console.log('   By Status:');
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`     ${status}: ${count}`);
  });
  console.log('');
}

async function demonstrateExportImport(registry) {
  // Export specific agents
  const exportData = await registry.exportAgents([
    'customer-support-001',
    'financial-advisor-001'
  ]);
  
  console.log(`📦 Exported ${exportData.agents.length} agents`);
  console.log(`   Export Version: ${exportData.version}`);
  console.log(`   Exported At: ${exportData.exportedAt}`);
  
  // Show what the export looks like (first agent only)
  const firstAgent = exportData.agents[0];
  console.log(`   Sample Export - Agent: ${firstAgent.agent.name}`);
  console.log(`   Capabilities: ${firstAgent.agent.capabilities.length} modules`);
  console.log('');
  
  // Could import to another registry instance (demonstration only)
  console.log('💾 Export data ready for backup or migration to other environments\n');
}

async function cleanupExistingData(registry) {
  // Clean up any existing example data
  await registry.repository.collections.agents.deleteMany({
    'agent.id': { $in: ['customer-support-001', 'data-processor-001', 'financial-advisor-001'] }
  });
}

// Run the example
if (import.meta.url === new URL(import.meta.url).href) {
  main().catch(error => {
    console.error('Example failed:', error);
    process.exit(1);
  });
}

export { main as runAgentBuilderExample };