/**
 * Unit tests for ConvFinQAParser
 */

import { describe, test, expect } from '@jest/globals';
import { ConvFinQAParser } from '../../src/data/ConvFinQAParser.js';

describe('ConvFinQAParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ConvFinQAParser();
  });

  test('should parse document ID correctly', () => {
    const id = 'Single_JKHY/2009/page_28.pdf-3';
    const metadata = parser.parseId(id);

    expect(metadata.company).toBe('JKHY');
    expect(metadata.year).toBe(2009);
    expect(metadata.page).toBe(28);
    expect(metadata.section).toBe(3);
    expect(metadata.source).toBe('JKHY_2009_p28');
  });

  test('should parse table structure', () => {
    const table = {
      '2009': {
        'net income': 103102.0,
        'non-cash expenses': 74397.0,
        'change in receivables': 21214.0
      },
      '2008': {
        'net income': 104222.0,
        'non-cash expenses': 70420.0,
        'change in receivables': -2913.0
      }
    };

    const parsed = parser.parseTable(table);

    expect(parsed.periods).toHaveLength(2);
    expect(parsed.periods).toContain('2009');
    expect(parsed.periods).toContain('2008');
    expect(parsed.metrics).toContain('net income');
    expect(parsed.metrics).toContain('non-cash expenses');
    expect(parsed.metrics).toContain('change in receivables');
    expect(parsed.data.length).toBe(6); // 2 periods × 3 metrics
    expect(parsed.rowCount).toBe(2);
    expect(parsed.columnCount).toBe(3);
  });

  test('should extract data points with correct structure', () => {
    const table = {
      '2009': {
        'net income': 103102.0
      }
    };

    const parsed = parser.parseTable(table);
    const dataPoint = parsed.data[0];

    expect(dataPoint.period).toBe('2009');
    expect(dataPoint.metric).toBe('net income');
    expect(dataPoint.value).toBe(103102.0);
    expect(dataPoint.valueType).toBe('numeric');
  });

  test('should combine narrative text', () => {
    const preText = 'This is the pre text.';
    const postText = 'This is the post text.';

    const combined = parser.combineNarrativeText(preText, postText);

    expect(combined).toBe('This is the pre text.\n\nThis is the post text.');
  });

  test('should handle missing pre or post text', () => {
    const combined1 = parser.combineNarrativeText('Only pre', '');
    expect(combined1).toBe('Only pre');

    const combined2 = parser.combineNarrativeText('', 'Only post');
    expect(combined2).toBe('Only post');

    const combined3 = parser.combineNarrativeText('', '');
    expect(combined3).toBe('');
  });

  test('should derive topic from pre_text', () => {
    const preText = 'liquidity and capital resources we have historically generated positive cash flow...';
    const topic = parser.deriveTopic(preText);

    expect(topic).toMatch(/liquidity and capital resources/i);
  });

  test('should derive topic for gross margin section', () => {
    const preText = 'gross margin for the three fiscal years ended...';
    const topic = parser.deriveTopic(preText);

    expect(topic).toMatch(/gross margin/i);
  });

  test('should parse complete ConvFinQA record', () => {
    const record = {
      id: 'Single_JKHY/2009/page_28.pdf-3',
      doc: {
        pre_text: 'liquidity and capital resources we have historically generated positive cash flow from operations...',
        post_text: 'year ended june 30 , cash provided by operations increased $ 25587...',
        table: {
          '2009': {
            'net income': 103102.0,
            'non-cash expenses': 74397.0
          },
          '2008': {
            'net income': 104222.0,
            'non-cash expenses': 70420.0
          }
        }
      },
      dialogue: {
        conv_questions: ['what is the net cash from operating activities in 2009?'],
        conv_answers: ['206588']
      },
      features: {
        num_dialogue_turns: 4
      }
    };

    const parsed = parser.parse(record);

    expect(parsed.id).toBe('Single_JKHY/2009/page_28.pdf-3');
    expect(parsed.metadata.company).toBe('JKHY');
    expect(parsed.metadata.year).toBe(2009);
    expect(parsed.metadata.topic).toMatch(/liquidity/i);
    expect(parsed.metadata.hasTable).toBe(true);
    expect(parsed.metadata.hasDialogue).toBe(true);
    expect(parsed.content.table.periods).toHaveLength(2);
    expect(parsed.content.table.periods).toContain('2009');
    expect(parsed.content.table.periods).toContain('2008');
    expect(parsed.content.narrative).toContain('liquidity');
    expect(parsed.dialogue).toBeDefined();
    expect(parsed.features.num_dialogue_turns).toBe(4);
  });

  test('should format table as text', () => {
    const tableData = {
      periods: ['2009', '2008'],
      data: [
        { period: '2009', metric: 'net income', value: 103102.0, valueType: 'numeric' },
        { period: '2009', metric: 'expenses', value: 74397.0, valueType: 'numeric' },
        { period: '2008', metric: 'net income', value: 104222.0, valueType: 'numeric' }
      ]
    };

    const text = parser.formatTableAsText(tableData);

    expect(text).toContain('In 2009:');
    expect(text).toContain('net income: 103102');
    expect(text).toContain('In 2008:');
    expect(text).toContain('net income: 104222');
  });

  test('should create extraction context', () => {
    const parsedDoc = {
      metadata: {
        company: 'JKHY',
        year: 2009,
        source: 'JKHY_2009_p28',
        topic: 'liquidity and capital resources'
      },
      content: {
        table: {
          periods: ['2009', '2008', '2007']
        }
      }
    };

    const context = parser.createExtractionContext(parsedDoc);

    expect(context.company).toBe('JKHY');
    expect(context.year).toBe(2009);
    expect(context.topic).toBe('liquidity and capital resources');
    expect(context.documentType).toBe('financial_report');
    expect(context.periods).toEqual(['2009', '2008', '2007']);
  });
});
