/**
 * Example demonstrating bottom-up synthesis and validation
 * 
 * Shows how the decent-planner builds and validates behavior trees
 * from the bottom up, creating validated subtrees at each level.
 */

import { DecentPlanner } from '../src/index.js';

// Mock dependencies for demonstration
async function runExample() {
  console.log('🎯 Bottom-Up Synthesis Example\n');
  console.log('='). repeat(50);
  
  // Create mock dependencies
  const mockLLMClient = {
    generateResponse: async (options) => {
      const message = options.messages[options.messages.length - 1].content;
      
      // Mock decomposition for "Build a web scraper"
      if (message.includes('Build a web scraper')) {
        return {
          content: JSON.stringify({
            task: 'Build a web scraper',
            subtasks: [
              {
                id: 'fetch-data',
                description: 'Fetch web page data',
                complexity: 'COMPLEX',
                reasoning: 'Needs URL handling, HTTP requests, error handling',
                suggestedInputs: ['target_url', 'headers'],
                suggestedOutputs: ['html_content', 'status_code']
              },
              {
                id: 'parse-content',
                description: 'Parse HTML content',
                complexity: 'COMPLEX',
                reasoning: 'Needs HTML parsing, selector logic, data extraction',
                suggestedInputs: ['html_content', 'selectors'],
                suggestedOutputs: ['extracted_data', 'metadata']
              },
              {
                id: 'save-results',
                description: 'Save extracted data',
                complexity: 'SIMPLE',
                reasoning: 'Direct file write operation',
                suggestedInputs: ['extracted_data', 'output_path'],
                suggestedOutputs: ['saved_file', 'file_stats']
              }
            ]
          })
        };
      }
      
      // Mock decomposition for "Fetch web page data"
      if (message.includes('Fetch web page data')) {
        return {
          content: JSON.stringify({
            task: 'Fetch web page data',
            subtasks: [
              {
                id: 'validate-url',
                description: 'Validate and normalize URL',
                complexity: 'SIMPLE',
                reasoning: 'URL parsing and validation',
                suggestedInputs: ['target_url'],
                suggestedOutputs: ['valid_url', 'url_parts']
              },
              {
                id: 'make-request',
                description: 'Make HTTP request',
                complexity: 'SIMPLE',
                reasoning: 'Single HTTP GET operation with retry',
                suggestedInputs: ['valid_url', 'headers'],
                suggestedOutputs: ['response_body', 'response_headers', 'status_code']
              },
              {
                id: 'handle-response',
                description: 'Process HTTP response',
                complexity: 'SIMPLE',
                reasoning: 'Response validation and content extraction',
                suggestedInputs: ['response_body', 'status_code'],
                suggestedOutputs: ['html_content', 'encoding']
              }
            ]
          })
        };
      }
      
      // Mock decomposition for "Parse HTML content"
      if (message.includes('Parse HTML content')) {
        return {
          content: JSON.stringify({
            task: 'Parse HTML content',
            subtasks: [
              {
                id: 'load-html',
                description: 'Load HTML into parser',
                complexity: 'SIMPLE',
                reasoning: 'HTML parsing library usage',
                suggestedInputs: ['html_content', 'encoding'],
                suggestedOutputs: ['dom_tree', 'parse_errors']
              },
              {
                id: 'extract-elements',
                description: 'Extract elements using selectors',
                complexity: 'SIMPLE',
                reasoning: 'CSS selector queries',
                suggestedInputs: ['dom_tree', 'selectors'],
                suggestedOutputs: ['raw_elements', 'element_count']
              },
              {
                id: 'transform-data',
                description: 'Transform extracted data',
                complexity: 'SIMPLE',
                reasoning: 'Data transformation and cleaning',
                suggestedInputs: ['raw_elements'],
                suggestedOutputs: ['extracted_data', 'metadata']
              }
            ]
          })
        };
      }
      
      // Default mock for behavior tree generation
      return {
        content: JSON.stringify({
          type: 'sequence',
          id: 'mock-bt',
          children: [
            {
              type: 'action',
              tool: 'mock_tool',
              params: { test: 'value' }
            }
          ]
        })
      };
    }
  };
  
  // Mock tool discovery
  const mockToolDiscovery = {
    discoverTools: async (task) => {
      const toolMap = {
        'Validate and normalize URL': [
          { name: 'url_parse', description: 'Parse URL components' },
          { name: 'url_validate', description: 'Validate URL format' }
        ],
        'Make HTTP request': [
          { name: 'http_get', description: 'Make HTTP GET request' },
          { name: 'retry_handler', description: 'Handle retries' }
        ],
        'Process HTTP response': [
          { name: 'response_parse', description: 'Parse HTTP response' },
          { name: 'encoding_detect', description: 'Detect content encoding' }
        ],
        'Load HTML into parser': [
          { name: 'html_parse', description: 'Parse HTML document' }
        ],
        'Extract elements using selectors': [
          { name: 'css_select', description: 'Query using CSS selectors' }
        ],
        'Transform extracted data': [
          { name: 'data_transform', description: 'Transform data structures' },
          { name: 'data_clean', description: 'Clean extracted data' }
        ],
        'Save extracted data': [
          { name: 'file_write', description: 'Write to file' },
          { name: 'json_stringify', description: 'Convert to JSON' }
        ]
      };
      
      return toolMap[task.description] || [{ name: 'default_tool' }];
    },
    initialize: async () => {}
  };
  
  // Create planner with mocked dependencies
  const planner = new DecentPlanner({
    llmClient: mockLLMClient,
    toolDiscovery: mockToolDiscovery,
    resourceManager: { get: () => null }
  });
  
  // Initialize synthesizer separately since we're using mocks
  planner.synthesizer = {
    synthesize: async (hierarchy, options) => {
      console.log('\n📊 Bottom-Up Synthesis Process:\n');
      
      // Simulate bottom-up synthesis
      const printSynthesis = (node, indent = '') => {
        const marker = node.complexity === 'SIMPLE' ? '📄' : '📁';
        console.log(`${indent}${marker} ${node.description} [${node.complexity}]`);
        
        if (node.complexity === 'SIMPLE') {
          console.log(`${indent}  ✅ Validated: BT generated with ${node.suggestedInputs?.length || 0} inputs, ${node.suggestedOutputs?.length || 0} outputs`);
        }
        
        if (node.children) {
          node.children.forEach(child => printSynthesis(child, indent + '  '));
          if (node.complexity === 'COMPLEX') {
            console.log(`${indent}  🔄 Composed: ${node.children.length} children → ${node.children.some(c => 
              c.suggestedInputs?.some(i => 
                node.children.some(other => 
                  other !== c && other.suggestedOutputs?.includes(i)
                )
              )
            ) ? 'sequence' : 'parallel'} node`);
            console.log(`${indent}  ✅ Validated: Composite BT with aggregated I/O`);
          }
        }
      };
      
      printSynthesis(hierarchy);
      
      // Return mock validated subtree
      return {
        isValid: true,
        behaviorTree: { type: 'root', children: [] },
        getTotalTasks: () => 7,
        toExecutionPlan: () => [
          { taskId: 'validate-url', description: 'Validate and normalize URL', level: 3 },
          { taskId: 'make-request', description: 'Make HTTP request', level: 3 },
          { taskId: 'handle-response', description: 'Process HTTP response', level: 3 },
          { taskId: 'load-html', description: 'Load HTML into parser', level: 3 },
          { taskId: 'extract-elements', description: 'Extract elements using selectors', level: 3 },
          { taskId: 'transform-data', description: 'Transform extracted data', level: 3 },
          { taskId: 'save-results', description: 'Save extracted data', level: 2 }
        ],
        getContract: () => ({
          inputs: ['target_url', 'headers', 'selectors', 'output_path'],
          outputs: ['saved_file', 'file_stats', 'metadata'],
          internal: ['html_content', 'valid_url', 'dom_tree', 'extracted_data']
        }),
        validation: { valid: true, errors: [] }
      };
    }
  };
  
  // Plan the task
  console.log('\n🎯 Goal: Build a web scraper\n');
  
  const result = await planner.plan('Build a web scraper', {
    domain: 'web-development',
    maxDepth: 3,
    debug: false
  });
  
  if (result.success) {
    console.log('\n✅ Planning Successful!\n');
    console.log('📋 Final Contract:');
    const contract = result.data.contract;
    console.log(`  Inputs: ${contract.inputs.join(', ')}`);
    console.log(`  Outputs: ${contract.outputs.join(', ')}`);
    console.log(`  Internal: ${contract.internal.join(', ')}`);
    
    console.log('\n📈 Statistics:');
    console.log(`  Total tasks: ${result.data.statistics.totalTasks}`);
    console.log(`  Decomposition levels: ${result.data.statistics.decompositionLevels}`);
    console.log(`  Validated levels: ${result.data.statistics.validatedLevels}`);
    
    console.log('\n🔄 Execution Order:');
    result.data.executionPlan.forEach((task, i) => {
      console.log(`  ${i + 1}. [L${task.level}] ${task.description}`);
    });
    
    console.log('\n💡 Key Insight:');
    console.log('  Each validated subtree becomes an atomic unit at the next level up.');
    console.log('  The root behavior tree is a composition of all validated subtrees.');
    console.log('  Validation propagates from leaves to root, ensuring correctness at every level.');
    
  } else {
    console.error('❌ Planning failed:', result.error);
  }
}

// Run the example
runExample().catch(console.error);