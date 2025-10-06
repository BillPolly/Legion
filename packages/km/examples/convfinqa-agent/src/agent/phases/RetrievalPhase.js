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

Available years: ${context.years && context.years.length > 0 ? context.years.sort().join(', ') : 'unknown'}

Your task:
1. Use the query_kg tool to retrieve each metric value you need
2. Use EXACT entity labels from the list above (do not paraphrase!)
3. For "portion" or "percentage of total" questions with categorical data:
   a. Identify ALL entities from the available list that have the metric
   b. Query the metric for EACH entity separately (use entity parameter)
   c. Add all queried values to get the total
   d. Calculate the portion: specific_value / total
4. After retrieving all values, if calculation is needed, use the calculate tool
5. When you have the final numerical answer, respond with just the number

Example for categorical data:
Question: "what portion of total sales is under product A?"
Available entities: ["product A", "product B", "sales"]
Steps:
  1. Identify entities with sales data: "product A", "product B"
  2. query_kg({ label: "sales", entity: "product A" }) → 100
  3. query_kg({ label: "sales", entity: "product B" }) → 200
  4. calculate({ operation: "add", values: [100, 200] }) → 300 (total)
  5. calculate({ operation: "divide", values: [100, 300] }) → 0.33 (portion)

IMPORTANT: For portion/percentage questions, you MUST query ALL relevant entities to calculate the total, not just the one mentioned in the question!

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
      this.logger.debug('agentic_loop_iteration', { iteration, messagesCount: messages.length });

      // Call LLM with native tool support
      const response = await this.llmClient.request({
        chatHistory: messages,  // Use chatHistory, not messages!
        tools,
        maxTokens: 2000,
        temperature: 0
      });

      // Check if LLM wants to use tools
      if (response.toolUses && response.toolUses.length > 0) {
        // Add assistant's message with tool uses to conversation
        messages.push({
          role: 'assistant',
          content: response.content
        });

        // Collect all tool results
        const toolResultsContent = [];

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
              category: toolResult.category,
              precision: toolResult.precision  // Include precision for answer formatting
            });
          }

          // Add tool result to content array
          toolResultsContent.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult)
          });
        }

        // Add all tool results in a SINGLE user message
        messages.push({
          role: 'user',
          content: toolResultsContent
        });
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
