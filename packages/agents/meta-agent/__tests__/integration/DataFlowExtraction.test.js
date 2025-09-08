/**
 * Integration tests for data flow extraction from task hierarchies
 */

import { jest } from '@jest/globals';
import { AgentCreator } from '../../src/AgentCreator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Data Flow Extraction Integration', () => {
  let agentCreator;
  let resourceManager;

  beforeEach(async () => {
    jest.setTimeout(60000); // 60 second timeout
    
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create AgentCreator
    agentCreator = new AgentCreator(resourceManager);
    await agentCreator.initialize();
  });

  afterEach(async () => {
    if (agentCreator) {
      await agentCreator.cleanup();
    }
  });

  describe('Basic Data Flow Extraction', () => {
    test('should extract data flow from simple linear hierarchy', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Data processing pipeline',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Read input file',
            suggestedInputs: ['file_path'],
            suggestedOutputs: ['raw_data']
          },
          {
            complexity: 'SIMPLE',
            description: 'Parse data',
            suggestedInputs: ['raw_data'],
            suggestedOutputs: ['parsed_data']
          },
          {
            complexity: 'SIMPLE',
            description: 'Save results',
            suggestedInputs: ['parsed_data'],
            suggestedOutputs: ['output_file']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow).toBeDefined();
      expect(dataFlow).toBeInstanceOf(Map);
      expect(dataFlow.size).toBe(3);
      
      // Check first step
      expect(dataFlow.has('Read input file')).toBe(true);
      expect(dataFlow.get('Read input file')).toEqual({
        from: 'file_path',
        to: 'raw_data'
      });
      
      // Check second step - should chain from first
      expect(dataFlow.has('Parse data')).toBe(true);
      expect(dataFlow.get('Parse data')).toEqual({
        from: 'raw_data',
        to: 'parsed_data'
      });
      
      // Check third step - should chain from second
      expect(dataFlow.has('Save results')).toBe(true);
      expect(dataFlow.get('Save results')).toEqual({
        from: 'parsed_data',
        to: 'output_file'
      });
    });

    test('should extract data flow from nested hierarchy', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Main workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Initialize',
            suggestedInputs: ['config'],
            suggestedOutputs: ['context']
          },
          {
            complexity: 'COMPLEX',
            description: 'Process batch',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Load batch data',
                suggestedInputs: ['context', 'batch_id'],
                suggestedOutputs: ['batch_data']
              },
              {
                complexity: 'SIMPLE',
                description: 'Transform batch',
                suggestedInputs: ['batch_data'],
                suggestedOutputs: ['transformed_data']
              },
              {
                complexity: 'SIMPLE',
                description: 'Validate batch',
                suggestedInputs: ['transformed_data'],
                suggestedOutputs: ['validated_data']
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Finalize',
            suggestedInputs: ['validated_data'],
            suggestedOutputs: ['final_result']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow).toBeDefined();
      expect(dataFlow.size).toBe(5); // 1 + 3 + 1 simple tasks
      
      // Check top-level flow
      expect(dataFlow.get('Initialize')).toEqual({
        from: 'config',
        to: 'context'
      });
      
      // Check nested flow
      expect(dataFlow.get('Load batch data')).toEqual({
        from: 'context, batch_id',
        to: 'batch_data'
      });
      
      expect(dataFlow.get('Transform batch')).toEqual({
        from: 'batch_data',
        to: 'transformed_data'
      });
      
      expect(dataFlow.get('Validate batch')).toEqual({
        from: 'transformed_data',
        to: 'validated_data'
      });
      
      // Check final step uses output from nested tasks
      expect(dataFlow.get('Finalize')).toEqual({
        from: 'validated_data',
        to: 'final_result'
      });
    });

    test('should handle multiple inputs and outputs', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Multi-input workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Fetch from API',
            suggestedInputs: ['api_key', 'endpoint'],
            suggestedOutputs: ['api_data']
          },
          {
            complexity: 'SIMPLE',
            description: 'Read from database',
            suggestedInputs: ['db_connection', 'query'],
            suggestedOutputs: ['db_data']
          },
          {
            complexity: 'SIMPLE',
            description: 'Merge data sources',
            suggestedInputs: ['api_data', 'db_data'],
            suggestedOutputs: ['merged_data', 'merge_report']
          },
          {
            complexity: 'SIMPLE',
            description: 'Generate output',
            suggestedInputs: ['merged_data'],
            suggestedOutputs: ['final_output', 'statistics']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow).toBeDefined();
      expect(dataFlow.size).toBe(4);
      
      // Check multiple inputs
      expect(dataFlow.get('Fetch from API')).toEqual({
        from: 'api_key, endpoint',
        to: 'api_data'
      });
      
      expect(dataFlow.get('Read from database')).toEqual({
        from: 'db_connection, query',
        to: 'db_data'
      });
      
      // Check merging step with multiple inputs and outputs
      expect(dataFlow.get('Merge data sources')).toEqual({
        from: 'api_data, db_data',
        to: 'merged_data, merge_report'
      });
      
      // Check final step with multiple outputs
      expect(dataFlow.get('Generate output')).toEqual({
        from: 'merged_data',
        to: 'final_output, statistics'
      });
    });

    test('should handle tasks without explicit I/O', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Workflow with implicit I/O',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Setup environment'
            // No explicit inputs/outputs
          },
          {
            complexity: 'SIMPLE',
            description: 'Process data',
            suggestedInputs: ['data'],
            suggestedOutputs: ['result']
          },
          {
            complexity: 'SIMPLE',
            description: 'Cleanup'
            // No explicit inputs/outputs
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow).toBeDefined();
      
      // Should only include tasks with explicit I/O
      expect(dataFlow.size).toBe(1);
      expect(dataFlow.has('Process data')).toBe(true);
      expect(dataFlow.get('Process data')).toEqual({
        from: 'data',
        to: 'result'
      });
      
      // Tasks without I/O should not be in the flow map
      expect(dataFlow.has('Setup environment')).toBe(false);
      expect(dataFlow.has('Cleanup')).toBe(false);
    });
  });

  describe('Complex Data Flow Patterns', () => {
    test('should extract data flow for ETL pipeline', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'ETL Pipeline',
        subtasks: [
          {
            complexity: 'COMPLEX',
            description: 'Extract',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Connect to sources',
                suggestedInputs: ['connection_configs'],
                suggestedOutputs: ['connections']
              },
              {
                complexity: 'SIMPLE',
                description: 'Extract raw data',
                suggestedInputs: ['connections'],
                suggestedOutputs: ['raw_datasets']
              }
            ]
          },
          {
            complexity: 'COMPLEX',
            description: 'Transform',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Clean data',
                suggestedInputs: ['raw_datasets'],
                suggestedOutputs: ['cleaned_data']
              },
              {
                complexity: 'SIMPLE',
                description: 'Apply business rules',
                suggestedInputs: ['cleaned_data', 'business_rules'],
                suggestedOutputs: ['processed_data']
              },
              {
                complexity: 'SIMPLE',
                description: 'Aggregate metrics',
                suggestedInputs: ['processed_data'],
                suggestedOutputs: ['aggregated_data', 'metrics']
              }
            ]
          },
          {
            complexity: 'COMPLEX',
            description: 'Load',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Prepare for loading',
                suggestedInputs: ['aggregated_data'],
                suggestedOutputs: ['load_ready_data']
              },
              {
                complexity: 'SIMPLE',
                description: 'Load to warehouse',
                suggestedInputs: ['load_ready_data', 'warehouse_config'],
                suggestedOutputs: ['load_result']
              },
              {
                complexity: 'SIMPLE',
                description: 'Verify load',
                suggestedInputs: ['load_result'],
                suggestedOutputs: ['verification_report']
              }
            ]
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow).toBeDefined();
      expect(dataFlow.size).toBe(8); // All simple tasks across all phases
      
      // Extract phase flow
      expect(dataFlow.get('Connect to sources')).toEqual({
        from: 'connection_configs',
        to: 'connections'
      });
      expect(dataFlow.get('Extract raw data')).toEqual({
        from: 'connections',
        to: 'raw_datasets'
      });
      
      // Transform phase flow - should connect to extract output
      expect(dataFlow.get('Clean data')).toEqual({
        from: 'raw_datasets',
        to: 'cleaned_data'
      });
      expect(dataFlow.get('Apply business rules')).toEqual({
        from: 'cleaned_data, business_rules',
        to: 'processed_data'
      });
      expect(dataFlow.get('Aggregate metrics')).toEqual({
        from: 'processed_data',
        to: 'aggregated_data, metrics'
      });
      
      // Load phase flow - should connect to transform output
      expect(dataFlow.get('Prepare for loading')).toEqual({
        from: 'aggregated_data',
        to: 'load_ready_data'
      });
      expect(dataFlow.get('Load to warehouse')).toEqual({
        from: 'load_ready_data, warehouse_config',
        to: 'load_result'
      });
      expect(dataFlow.get('Verify load')).toEqual({
        from: 'load_result',
        to: 'verification_report'
      });
    });

    test('should extract parallel data flow', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Parallel processing workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Split data',
            suggestedInputs: ['input_data'],
            suggestedOutputs: ['chunk_1', 'chunk_2', 'chunk_3']
          },
          {
            complexity: 'COMPLEX',
            description: 'Parallel processing',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Process chunk 1',
                suggestedInputs: ['chunk_1'],
                suggestedOutputs: ['result_1']
              },
              {
                complexity: 'SIMPLE',
                description: 'Process chunk 2',
                suggestedInputs: ['chunk_2'],
                suggestedOutputs: ['result_2']
              },
              {
                complexity: 'SIMPLE',
                description: 'Process chunk 3',
                suggestedInputs: ['chunk_3'],
                suggestedOutputs: ['result_3']
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Merge results',
            suggestedInputs: ['result_1', 'result_2', 'result_3'],
            suggestedOutputs: ['final_result']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow).toBeDefined();
      expect(dataFlow.size).toBe(5);
      
      // Split step
      expect(dataFlow.get('Split data')).toEqual({
        from: 'input_data',
        to: 'chunk_1, chunk_2, chunk_3'
      });
      
      // Parallel processing steps
      expect(dataFlow.get('Process chunk 1')).toEqual({
        from: 'chunk_1',
        to: 'result_1'
      });
      expect(dataFlow.get('Process chunk 2')).toEqual({
        from: 'chunk_2',
        to: 'result_2'
      });
      expect(dataFlow.get('Process chunk 3')).toEqual({
        from: 'chunk_3',
        to: 'result_3'
      });
      
      // Merge step
      expect(dataFlow.get('Merge results')).toEqual({
        from: 'result_1, result_2, result_3',
        to: 'final_result'
      });
    });

    test('should handle conditional data flow', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Conditional workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Validate input',
            suggestedInputs: ['user_input'],
            suggestedOutputs: ['validation_result', 'validated_data']
          },
          {
            complexity: 'COMPLEX',
            description: 'Process based on validation',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Process valid data',
                suggestedInputs: ['validated_data'],
                suggestedOutputs: ['processed_result']
              },
              {
                complexity: 'SIMPLE',
                description: 'Handle invalid data',
                suggestedInputs: ['validation_result'],
                suggestedOutputs: ['error_report']
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Generate response',
            suggestedInputs: ['processed_result', 'error_report'],
            suggestedOutputs: ['final_response']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow).toBeDefined();
      expect(dataFlow.size).toBe(4);
      
      // Validation step with multiple outputs
      expect(dataFlow.get('Validate input')).toEqual({
        from: 'user_input',
        to: 'validation_result, validated_data'
      });
      
      // Conditional branches
      expect(dataFlow.get('Process valid data')).toEqual({
        from: 'validated_data',
        to: 'processed_result'
      });
      
      expect(dataFlow.get('Handle invalid data')).toEqual({
        from: 'validation_result',
        to: 'error_report'
      });
      
      // Final step that combines both branches
      expect(dataFlow.get('Generate response')).toEqual({
        from: 'processed_result, error_report',
        to: 'final_response'
      });
    });
  });

  describe('Data Flow Analysis', () => {
    test('should identify data dependencies', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Dependent workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Step A',
            suggestedInputs: ['initial_input'],
            suggestedOutputs: ['output_a']
          },
          {
            complexity: 'SIMPLE',
            description: 'Step B',
            suggestedInputs: ['output_a'],
            suggestedOutputs: ['output_b']
          },
          {
            complexity: 'SIMPLE',
            description: 'Step C',
            suggestedInputs: ['output_a', 'output_b'],
            suggestedOutputs: ['output_c']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      // Analyze dependencies
      const dependencies = new Map();
      dataFlow.forEach((flow, step) => {
        const inputs = flow.from.split(', ');
        dependencies.set(step, inputs);
      });

      // Step A has no internal dependencies
      expect(dependencies.get('Step A')).toEqual(['initial_input']);
      
      // Step B depends on Step A's output
      expect(dependencies.get('Step B')).toEqual(['output_a']);
      
      // Step C depends on both A and B's outputs
      expect(dependencies.get('Step C')).toEqual(['output_a', 'output_b']);
    });

    test('should detect circular dependencies', () => {
      // Note: This hierarchy has intentional circular dependency for testing
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Circular workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Step 1',
            suggestedInputs: ['input', 'feedback'],
            suggestedOutputs: ['output_1']
          },
          {
            complexity: 'SIMPLE',
            description: 'Step 2',
            suggestedInputs: ['output_1'],
            suggestedOutputs: ['output_2']
          },
          {
            complexity: 'SIMPLE',
            description: 'Step 3',
            suggestedInputs: ['output_2'],
            suggestedOutputs: ['feedback']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      // Check for circular dependency
      const hasCircular = () => {
        // Step 1 needs 'feedback' which comes from Step 3
        // Step 3 needs 'output_2' which comes from Step 2
        // Step 2 needs 'output_1' which comes from Step 1
        // This forms a cycle: 1 -> 2 -> 3 -> 1
        
        const step1Flow = dataFlow.get('Step 1');
        const step3Flow = dataFlow.get('Step 3');
        
        return step1Flow.from.includes('feedback') && 
               step3Flow.to.includes('feedback');
      };

      expect(hasCircular()).toBe(true);
    });

    test('should track data transformation through pipeline', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Data transformation pipeline',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Load CSV',
            suggestedInputs: ['csv_file'],
            suggestedOutputs: ['csv_data']
          },
          {
            complexity: 'SIMPLE',
            description: 'Convert to JSON',
            suggestedInputs: ['csv_data'],
            suggestedOutputs: ['json_data']
          },
          {
            complexity: 'SIMPLE',
            description: 'Transform schema',
            suggestedInputs: ['json_data'],
            suggestedOutputs: ['transformed_json']
          },
          {
            complexity: 'SIMPLE',
            description: 'Convert to XML',
            suggestedInputs: ['transformed_json'],
            suggestedOutputs: ['xml_data']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      // Track data transformation path
      const transformationPath = [];
      let currentData = 'csv_file';
      
      dataFlow.forEach((flow, step) => {
        if (flow.from === currentData || flow.from.includes(currentData)) {
          transformationPath.push({
            step,
            from: flow.from,
            to: flow.to
          });
          currentData = flow.to.split(', ')[0]; // Take first output
        }
      });

      expect(transformationPath).toHaveLength(4);
      expect(transformationPath[0].from).toBe('csv_file');
      expect(transformationPath[3].to).toBe('xml_data');
      
      // Verify complete transformation chain
      expect(transformationPath.map(t => t.to)).toEqual([
        'csv_data',
        'json_data',
        'transformed_json',
        'xml_data'
      ]);
    });
  });

  describe('End-to-End Data Flow', () => {
    test('should extract data flow from real decomposition', async () => {
      const requirements = {
        purpose: 'Create an API that fetches user data, enriches it with external data, and returns a formatted response',
        taskType: 'task'
      };

      // Real decomposition
      const decomposition = await agentCreator.decomposeRequirements(requirements);
      expect(decomposition.success).toBe(true);
      
      // Extract data flow from real hierarchy
      const dataFlow = agentCreator.extractDataFlow(decomposition.hierarchy);
      
      expect(dataFlow).toBeDefined();
      expect(dataFlow).toBeInstanceOf(Map);
      
      // Should have some data flow if the hierarchy has I/O
      if (dataFlow.size > 0) {
        // Check that flow makes sense
        dataFlow.forEach((flow, step) => {
          expect(flow).toBeDefined();
          expect(flow.from).toBeDefined();
          expect(flow.to).toBeDefined();
          expect(typeof flow.from).toBe('string');
          expect(typeof flow.to).toBe('string');
        });
      }
    });

    test('should integrate data flow with behavior tree generation', async () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Integrated workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Fetch data',
            suggestedInputs: ['api_endpoint'],
            suggestedOutputs: ['raw_data'],
            tools: [{ name: 'http_get' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Process data',
            suggestedInputs: ['raw_data'],
            suggestedOutputs: ['processed_data'],
            tools: [{ name: 'data_processor' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Store results',
            suggestedInputs: ['processed_data'],
            suggestedOutputs: ['storage_id'],
            tools: [{ name: 'db_insert' }]
          }
        ]
      };

      // Extract data flow
      const dataFlow = agentCreator.extractDataFlow(hierarchy);
      
      // Generate behavior tree
      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);
      
      // Both should be compatible and represent the same workflow
      expect(dataFlow.size).toBe(3);
      expect(behaviorTree.children).toHaveLength(3);
      
      // Data flow should match behavior tree execution order
      const flowSteps = Array.from(dataFlow.keys());
      const btSteps = behaviorTree.children.map(child => child.description || child.tool);
      
      // The order should be preserved
      expect(flowSteps[0]).toBe('Fetch data');
      expect(flowSteps[1]).toBe('Process data');
      expect(flowSteps[2]).toBe('Store results');
    });
  });
});