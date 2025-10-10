/**
 * ConvFinQAParser - Parse ConvFinQA dataset documents
 *
 * Extracts:
 * - Metadata from document ID (company, year, page)
 * - Narrative text (pre_text + post_text)
 * - Structured table data
 * - Derives context for entity extraction
 */

export class ConvFinQAParser {
  /**
   * Parse a ConvFinQA document record
   * @param {Object} record - ConvFinQA record
   * @returns {Object} - Parsed document with metadata and content
   */
  parse(record) {
    // Extract metadata from ID
    const metadata = this.parseId(record.id);

    // Parse table structure
    const tableData = this.parseTable(record.doc.table);

    // Combine text content
    const narrativeText = this.combineNarrativeText(
      record.doc.pre_text,
      record.doc.post_text
    );

    // Derive topic/context from pre_text
    const topic = this.deriveTopic(record.doc.pre_text);

    return {
      id: record.id,
      metadata: {
        ...metadata,
        topic,
        hasTable: tableData.periods.length > 0,
        hasDialogue: record.dialogue ? record.dialogue.conv_questions.length > 0 : false
      },
      content: {
        pre_text: record.doc.pre_text,
        post_text: record.doc.post_text,
        narrative: narrativeText,
        table: tableData
      },
      // Keep dialogue for later verification (but don't use for extraction)
      dialogue: record.dialogue,
      features: record.features
    };
  }

  /**
   * Parse document ID to extract metadata
   * @param {string} id - Document ID like "Single_JKHY/2009/page_28.pdf-3"
   * @returns {Object} - Metadata
   */
  parseId(id) {
    // Format: "Single_TICKER/YEAR/page_NN.pdf-section"
    const parts = id.split('/');

    const companyPart = parts[0] || '';
    const yearPart = parts[1] || '';
    const pagePart = parts[2] || '';

    // Extract company ticker
    const companyMatch = companyPart.match(/Single_([A-Z]+)/);
    const company = companyMatch ? companyMatch[1] : null;

    // Extract year
    const year = yearPart ? parseInt(yearPart, 10) : null;

    // Extract page number
    const pageMatch = pagePart.match(/page_(\d+)/);
    const page = pageMatch ? parseInt(pageMatch[1], 10) : null;

    // Extract section number
    const sectionMatch = pagePart.match(/-(\d+)$/);
    const section = sectionMatch ? parseInt(sectionMatch[1], 10) : null;

    return {
      company,
      year,
      page,
      section,
      source: `${company}_${year}_p${page}`
    };
  }

  /**
   * Parse table structure into normalized format
   * @param {Object} table - Table data
   * @returns {Object} - Normalized table data
   */
  parseTable(table) {
    const periods = Object.keys(table);
    const metrics = new Set();
    const data = [];

    // Extract all metrics and data points
    for (const period of periods) {
      const periodData = table[period];
      for (const [metric, value] of Object.entries(periodData)) {
        metrics.add(metric);
        data.push({
          period,
          metric,
          value,
          valueType: typeof value === 'number' ? 'numeric' : 'string'
        });
      }
    }

    return {
      periods: periods,
      metrics: Array.from(metrics),
      data: data,
      rowCount: periods.length,
      columnCount: metrics.size
    };
  }

  /**
   * Combine narrative text (pre + post)
   * @param {string} preText
   * @param {string} postText
   * @returns {string} - Combined narrative
   */
  combineNarrativeText(preText, postText) {
    const combined = [];
    if (preText && preText.trim()) {
      combined.push(preText.trim());
    }
    if (postText && postText.trim()) {
      combined.push(postText.trim());
    }
    return combined.join('\n\n');
  }

  /**
   * Derive topic/section from pre_text
   * @param {string} preText
   * @returns {string|null} - Derived topic
   */
  deriveTopic(preText) {
    if (!preText) return null;

    // Look for common financial report section headers
    const sectionPatterns = [
      /liquidity and capital resources/i,
      /cash flow/i,
      /operating activities/i,
      /gross margin/i,
      /revenue/i,
      /income/i,
      /expenses/i,
      /balance sheet/i,
      /shareholders.?equity/i,
      /acquisitions/i,
      /divestitures/i,
      /backlog/i
    ];

    for (const pattern of sectionPatterns) {
      if (pattern.test(preText)) {
        const match = preText.match(pattern);
        return match[0];
      }
    }

    // Fallback: use first sentence
    const firstSentence = preText.split('.')[0];
    if (firstSentence && firstSentence.length < 100) {
      return firstSentence.trim();
    }

    return null;
  }

  /**
   * Format table data as text for entity extraction
   * @param {Object} tableData - Parsed table data
   * @returns {string} - Text representation of table
   */
  formatTableAsText(tableData) {
    const lines = [];

    // Group by period
    const periodGroups = {};
    for (const dataPoint of tableData.data) {
      if (!periodGroups[dataPoint.period]) {
        periodGroups[dataPoint.period] = [];
      }
      periodGroups[dataPoint.period].push(dataPoint);
    }

    // Format each period
    for (const [period, dataPoints] of Object.entries(periodGroups)) {
      lines.push(`In ${period}:`);
      for (const dp of dataPoints) {
        if (dp.valueType === 'numeric') {
          lines.push(`  ${dp.metric}: ${dp.value}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Create extraction context for pipeline
   * @param {Object} parsedDoc - Parsed document
   * @returns {Object} - Context for entity extraction
   */
  createExtractionContext(parsedDoc) {
    return {
      company: parsedDoc.metadata.company,
      year: parsedDoc.metadata.year,
      source: parsedDoc.metadata.source,
      topic: parsedDoc.metadata.topic,
      documentType: 'financial_report',
      // Table periods for temporal context
      periods: parsedDoc.content.table.periods
    };
  }
}
