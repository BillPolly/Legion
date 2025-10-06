/**
 * TableParser - Specialized parser for ConvFinQA financial tables
 *
 * Handles complex table structures with multi-row headers, year columns, etc.
 * Can use LLM to understand table structure when needed.
 */

export class TableParser {
  constructor(llmClient = null) {
    this.llmClient = llmClient;
  }

  /**
   * Parse ConvFinQA table structure
   *
   * @param {Array<Array<string>>} table - Raw table data
   * @param {Array<string>} contextText - Context text that may contain year info
   * @returns {Object} Parsed table structure with yearColumns, dataRows, rowLabels
   */
  async parse(table, contextText = []) {
    if (!table || table.length < 3) {
      throw new Error('Table must have at least 2 header rows and one data row');
    }

    // ConvFinQA tables have 2-row headers:
    // Row 0: Main header (may contain first year in text)
    // Row 1: Additional year labels
    // Row 2+: Data rows (col 0 = row label, col 1+ = values)

    const yearColumns = await this._parseYearColumns(table, contextText);
    const dataRows = table.slice(2); // Skip 2 header rows
    const rowLabels = dataRows.map(row => row[0]);

    return {
      yearColumns,  // [{year: '2009', colIdx: 0}, {year: '2008', colIdx: 1}, ...]
      dataRows,     // [[label, val1, val2, ...], ...]
      rowLabels     // [label1, label2, ...]
    };
  }

  /**
   * Parse year columns from table headers
   *
   * Strategy:
   * 1. Extract year from row 0 main header (e.g., "Year ended June 30, 2009")
   * 2. Extract years from row 1 (e.g., "2008", "2007")
   * 3. Fallback to LLM if ambiguous
   * 4. Fallback to context text (e.g., "2009 2008 2007")
   */
  async _parseYearColumns(table, contextText) {
    const yearColumns = [];

    // Step 1: Check row 0 for first year
    const row0Text = table[0].slice(1).join(' ');
    const yearInRow0 = row0Text.match(/\b(20\d{2}|19\d{2})\b/);

    if (yearInRow0) {
      yearColumns.push({ year: yearInRow0[1], colIdx: 0 });
    }

    // Step 2: Extract years from row 1
    const row1Years = table[1].slice(1)
      .map((cell, idx) => {
        const cellStr = String(cell).trim();
        if (/^\d{4}$/.test(cellStr)) {
          return { year: cellStr, colIdx: yearColumns.length > 0 ? idx + 1 : idx };
        }
        return null;
      })
      .filter(Boolean);

    yearColumns.push(...row1Years);

    // Step 3: If we still don't have enough years, try context text
    const numDataCols = table[2].length - 1; // -1 for label column

    if (yearColumns.length < numDataCols) {
      const yearsFromContext = await this._extractYearsFromContext(contextText, numDataCols);

      if (yearsFromContext && yearsFromContext.length === numDataCols) {
        // Replace with years from context
        return yearsFromContext.map((year, idx) => ({ year, colIdx: idx }));
      }
    }

    // Step 4: If still ambiguous and LLM available, use LLM
    if (yearColumns.length < numDataCols && this.llmClient) {
      const yearsFromLLM = await this._useLLMToParseYears(table, contextText);
      if (yearsFromLLM && yearsFromLLM.length === numDataCols) {
        return yearsFromLLM.map((year, idx) => ({ year, colIdx: idx }));
      }
    }

    // Step 5: Final fallback - use what we have or generate placeholders
    while (yearColumns.length < numDataCols) {
      yearColumns.push({
        year: `unknown_${yearColumns.length}`,
        colIdx: yearColumns.length
      });
    }

    return yearColumns;
  }

  /**
   * Extract years from context text
   * Looks for patterns like "2009 2008 2007" which indicate column order
   */
  async _extractYearsFromContext(contextText, expectedCount) {
    const textStr = Array.isArray(contextText) ? contextText.join(' ') : String(contextText);

    // Look for sequence of years (e.g., "2009 2008 2007")
    const yearSequencePattern = /(?:^|\s)((?:20\d{2}|19\d{2})\s+(?:20\d{2}|19\d{2})(?:\s+(?:20\d{2}|19\d{2}))*)/;
    const sequenceMatch = textStr.match(yearSequencePattern);

    if (sequenceMatch) {
      const years = sequenceMatch[1].match(/\b(20\d{2}|19\d{2})\b/g);
      if (years && years.length === expectedCount) {
        return years;
      }
    }

    // Look for any years and take first N
    const allYears = textStr.match(/\b(20\d{2}|19\d{2})\b/g);
    if (allYears && allYears.length >= expectedCount) {
      return allYears.slice(0, expectedCount);
    }

    return null;
  }

  /**
   * Use LLM to parse year columns when heuristics fail
   */
  async _useLLMToParseYears(table, contextText) {
    if (!this.llmClient) {
      return null;
    }

    const prompt = `Analyze this financial table and identify which years each data column represents.

Context text:
${Array.isArray(contextText) ? contextText.slice(0, 3).join('\n') : String(contextText).slice(0, 500)}

Table headers:
Row 0: ${JSON.stringify(table[0])}
Row 1: ${JSON.stringify(table[1])}

First data row:
${JSON.stringify(table[2])}

How many data columns are there (excluding the label column)? What year does each column represent?

Return JSON: {"years": ["2009", "2008", "2007"]} where the array is in column order (left to right).`;

    try {
      const response = await this.llmClient.request({
        prompt,
        maxTokens: 200,
        temperature: 0
      });

      const result = JSON.parse(response.content);
      return result.years || null;
    } catch (error) {
      console.warn('LLM year parsing failed:', error.message);
      return null;
    }
  }

  /**
   * Get value from parsed table
   */
  getValue(parsedTable, rowLabel, year) {
    const rowIdx = parsedTable.rowLabels.findIndex(
      label => label.toLowerCase() === rowLabel.toLowerCase()
    );

    if (rowIdx === -1) {
      return null;
    }

    const yearCol = parsedTable.yearColumns.find(yc => yc.year === String(year));
    if (!yearCol) {
      return null;
    }

    return parsedTable.dataRows[rowIdx][yearCol.colIdx + 1]; // +1 for label column
  }
}
