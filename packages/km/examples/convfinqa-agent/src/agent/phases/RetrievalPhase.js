/**
 * RetrievalPhase - Iterative data retrieval using native tool calling
 *
 * Uses Anthropic's native tool use API to:
 * - Call query_kg to retrieve metric values
 * - Iteratively gather all needed data points
 * - Return structured data for calculation
 *
 * NO REGEX PARSING - Claude SDK handles everything
 */

import { QueryKGTool, CalculateTool } from '../tools/index.js';

export class RetrievalPhase {
  constructor({ llmClient, kgIndex, logger }) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    if (!kgIndex) {
      throw new Error('KG index is required');
    }

    this.llmClient = llmClient;
    this.kgIndex = kgIndex;
    this.logger = logger || console;
  }

  /**
   * Execute the retrieval phase using native tool calling
   *
   * @param {string} question - The question being answered
   * @param {Object} understanding - Understanding from semantic phase
   * @param {Object} context - Additional context (entities, years, categories)
   * @returns {Promise<Object>} Retrieved data and tool call history
   */
  async execute(question, understanding, context = {}) {
    this.logger.debug('retrieval_phase_start', { question });

    try {
      // Prepare tools in Anthropic SDK format
      const tools = this._prepareTools();

      // Build initial prompt
      const initialPrompt = this._buildInitialPrompt(question, understanding, context);

      // Execute agentic loop with native tool calling
      const { retrievedData, toolCalls } = await this._executeAgenticLoop(
        initialPrompt,
        tools,
        understanding
      );

      this.logger.info('retrieval_phase_complete', {
        dataPointsRetrieved: retrievedData.length,
        toolCallsMade: toolCalls.length
      });

      return {
        success: true,
        retrievedData,
        toolCalls
      };

    } catch (error) {
      this.logger.error('retrieval_phase_error', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Prepare tools in Anthropic SDK format
   * @private
   */
  _prepareTools() {
    return [
      {
        name: QueryKGTool.name,
        description: QueryKGTool.description,
        input_schema: QueryKGTool.input_schema
      },
      {
        name: CalculateTool.name,
        description: CalculateTool.description,
        input_schema: CalculateTool.input_schema
      }
    ];
  }

  /**
   * Build initial prompt for retrieval
   * @private
   */
  _buildInitialPrompt(question, understanding, context) {
    const { entities = [], temporalScope = {}, categoricalScope = {} } = understanding;

    let prompt = `You are retrieving data from a knowledge graph to answer this question:

Question: "${question}"

Understanding:
- Entities: ${entities.join(', ') || 'none specified'}
- Temporal scope: ${temporalScope.years?.join(', ') || temporalScope.period || 'none'}
- Categories: ${categoricalScope.categories?.join(', ') || 'none'}

Available entities in the knowledge graph:
${context.sampleLabels ? context.sampleLabels.slice(0, 20).map(l => `  - "${l}"`).join('\n') : '(none)'}

Your task:
1. Use the query_kg tool to retrieve each metric value you need
2. Use EXACT entity labels from the list above (do not paraphrase!)
3. After retrieving all values, if calculation is needed, use the calculate tool
4. When you have the final numerical answer, respond with just the number

Work step-by-step and retrieve all necessary data.`;

    return prompt;
  }

  /**
   * Execute agentic loop with native tool calling
   * @private
   */
  async _executeAgenticLoop(initialPrompt, tools, understanding) {
    const messages = [{ role: 'user', content: initialPrompt }];
    const toolCalls = [];
    const retrievedData = [];
    const maxIterations = 10;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      this.logger.debug('agentic_loop_iteration', { iteration });

      // Call LLM with native tool support
      const response = await this.llmClient.request({
        messages,
        tools,
        maxTokens: 2000,
        temperature: 0
      });

      // Check if LLM wants to use tools
      if (response.toolUses && response.toolUses.length > 0) {
        // Execute each tool call
        for (const toolUse of response.toolUses) {
          const toolResult = await this._executeTool(toolUse.name, toolUse.input);

          toolCalls.push({
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input,
            result: toolResult
          });

          // If it's a query_kg call that succeeded, save the data
          if (toolUse.name === 'query_kg' && toolResult.success) {
            retrievedData.push({
              label: toolResult.label,
              value: toolResult.value,
              rawValue: toolResult.rawValue,
              unit: toolResult.unit,
              year: toolResult.year,
              category: toolResult.category
            });
          }

          // Build tool result message for Claude
          messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(toolResult)
            }]
          });
        }
      } else {
        // No more tool calls - LLM has final answer
        this.logger.info('agentic_loop_complete', {
          iterations: iteration + 1,
          finalResponse: response.textContent
        });

        break;
      }
    }

    return { retrievedData, toolCalls };
  }

  /**
   * Execute a tool
   * @private
   */
  async _executeTool(toolName, toolInput) {
    const toolContext = {
      kgIndex: this.kgIndex,
      logger: this.logger
    };

    try {
      if (toolName === 'query_kg') {
        return await QueryKGTool.execute(toolInput, toolContext);
      } else if (toolName === 'calculate') {
        return await CalculateTool.execute(toolInput, toolContext);
      } else {
        return {
          error: `Unknown tool: ${toolName}`
        };
      }
    } catch (error) {
      this.logger.error('tool_execution_error', {
        toolName,
        error: error.message
      });

      return {
        error: `Tool execution failed: ${error.message}`
      };
    }
  }
}
