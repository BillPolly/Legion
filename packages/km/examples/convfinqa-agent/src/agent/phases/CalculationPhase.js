/**
 * CalculationPhase - Extract final numerical answer from retrieval results
 *
 * This phase analyzes the tool calls and retrieved data to extract
 * the final numerical answer. If the last tool call was 'calculate',
 * use its result. Otherwise, extract from text response.
 */

export class CalculationPhase {
  constructor({ logger }) {
    this.logger = logger || console;
  }

  /**
   * Execute the calculation phase
   *
   * @param {Array} toolCalls - Tool calls from retrieval phase
   * @param {Array} retrievedData - Data retrieved from KG
   * @param {string} finalResponse - Final text response from LLM
   * @returns {Promise<Object>} Calculation result
   */
  async execute(toolCalls, retrievedData, finalResponse = '') {
    this.logger.debug('calculation_phase_start', {
      toolCallsCount: toolCalls.length,
      retrievedDataCount: retrievedData.length
    });

    try {
      let rawValue = null;
      let calculation = null;

      // Strategy 1: If last tool call was 'calculate', use its result
      if (toolCalls.length > 0) {
        const lastTool = toolCalls[toolCalls.length - 1];

        if (lastTool.name === 'calculate' && lastTool.result?.success) {
          rawValue = lastTool.result.result;
          calculation = `${lastTool.result.operation}(${lastTool.result.values.join(', ')})`;

          this.logger.info('calculation_from_tool', {
            operation: lastTool.result.operation,
            result: rawValue
          });
        }
      }

      // Strategy 2: If only one data point retrieved, use it directly
      if (rawValue === null && retrievedData.length === 1) {
        rawValue = retrievedData[0].value;
        calculation = `direct_retrieval: ${retrievedData[0].label}`;

        this.logger.info('calculation_direct_value', {
          label: retrievedData[0].label,
          value: rawValue
        });
      }

      // Strategy 3: Extract number from final text response
      if (rawValue === null && finalResponse) {
        rawValue = this._extractNumber(finalResponse);
        calculation = 'extracted_from_response';

        this.logger.info('calculation_from_text', {
          response: finalResponse,
          extracted: rawValue
        });
      }

      // Verify we got a valid number
      if (rawValue === null || typeof rawValue !== 'number' || isNaN(rawValue)) {
        throw new Error(
          `Failed to extract numerical answer. ` +
          `Tool calls: ${toolCalls.length}, Retrieved: ${retrievedData.length}, ` +
          `Response: "${finalResponse}"`
        );
      }

      // Infer appropriate precision from inputs
      const inferredPrecision = this._inferPrecision(retrievedData, toolCalls);

      this.logger.info('calculation_phase_complete', {
        rawValue,
        calculation,
        inferredPrecision
      });

      return {
        success: true,
        rawValue,
        calculation,
        precision: inferredPrecision,
        inputs: retrievedData.map(d => ({
          label: d.label,
          value: d.value,
          precision: d.precision
        }))
      };

    } catch (error) {
      this.logger.error('calculation_phase_error', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Extract numerical value from text response
   * @private
   */
  _extractNumber(text) {
    if (typeof text !== 'string') {
      return null;
    }

    // Remove common symbols
    const cleaned = text.replace(/[$,%]/g, '').trim();

    // Try to extract number from last line first (where answers usually are)
    const lines = cleaned.split('\n');
    const lastLine = lines[lines.length - 1].trim();

    // Check if last line is just a number
    const lastLineMatch = lastLine.match(/^[-+]?[0-9]*\.?[0-9]+$/);
    if (lastLineMatch) {
      const value = parseFloat(lastLineMatch[0]);
      if (!isNaN(value)) return value;
    }

    // Otherwise extract ANY number from the last line
    const lastLineNumberMatch = lastLine.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (lastLineNumberMatch) {
      const value = parseFloat(lastLineNumberMatch[0]);
      if (!isNaN(value)) return value;
    }

    // Fall back to first number in entire text
    const numberMatch = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (numberMatch) {
      const value = parseFloat(numberMatch[0]);
      if (!isNaN(value)) return value;
    }

    return null;
  }

  /**
   * Infer appropriate precision for the answer based on input data
   *
   * Rules:
   * 1. Use max precision from input values (no artificial minimums)
   * 2. Default to 1 decimal for percentages, 2 for other calculations if no input precision
   *
   * @param {Array} retrievedData - Data retrieved from KG
   * @param {Array} toolCalls - Tool calls made
   * @returns {number} Number of decimal places
   * @private
   */
  _inferPrecision(retrievedData, toolCalls) {
    // Get precisions from all retrieved data
    const precisions = retrievedData
      .map(d => d.precision)
      .filter(p => p !== undefined && p !== null);

    // Check if this is a percentage calculation
    const isPercentageCalc = toolCalls.some(tc =>
      tc.name === 'calculate' &&
      (tc.input?.operation === 'percentage_change' ||
       tc.input?.operation === 'percentage' ||
       tc.result?.operation === 'percentage_change' ||
       tc.result?.operation === 'percentage')
    );

    if (precisions.length > 0) {
      const maxPrecision = Math.max(...precisions);

      // For percentage calculations, use minimum 1 decimal (percentages rarely show as integers)
      if (isPercentageCalc && maxPrecision < 1) {
        return 1;
      }

      return maxPrecision;
    }

    // Default fallback only if no input precision available
    return isPercentageCalc ? 1 : 2;
  }
}
