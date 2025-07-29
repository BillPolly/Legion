/**
 * Test data for WebSocket integration tests
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const testData = {
  // File operations test data
  files: {
    testFile: join(__dirname, 'test-file.txt'),
    testDir: join(__dirname, 'test-dir'),
    nonExistent: join(__dirname, 'non-existent.txt'),
    writeContent: 'This is test content written by integration tests\n',
    appendContent: 'This line was appended\n'
  },
  
  // Calculator test data
  calculations: [
    { expression: '2 + 2', expected: 4 },
    { expression: '10 * 5', expected: 50 },
    { expression: 'Math.sqrt(16)', expected: 4 },
    { expression: 'Math.sin(0)', expected: 0 },
    { expression: '(5 + 3) * 2', expected: 16 }
  ],
  
  // Search test data
  searches: {
    simple: 'JavaScript testing',
    withOptions: {
      query: 'Node.js WebSocket',
      num: 5
    },
    withDateRange: {
      query: 'AI developments',
      dateRange: 'month'
    }
  },
  
  // GitHub test data (using safe read-only operations)
  github: {
    publicRepo: {
      owner: 'nodejs',
      repo: 'node'
    },
    listBranches: {
      owner: 'facebook',
      repo: 'react',
      perPage: 5
    }
  },
  
  // JSON test data
  json: {
    simple: {
      name: 'test',
      value: 123,
      nested: { key: 'value' }
    },
    array: [1, 2, 3, 4, 5],
    complex: {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      settings: {
        theme: 'dark',
        notifications: true
      }
    }
  },
  
  // LLM test data
  llm: {
    simplePrompt: 'What is 2 + 2?',
    jsonPrompt: 'Return a JSON object with a "result" field containing the number 4',
    systemPrompt: {
      system: 'You are a helpful assistant that always responds with exactly 3 words.',
      user: 'Hello there!'
    }
  }
};

// Module test configurations
export const moduleTests = {
  file: {
    name: 'file',
    tools: ['file_read', 'file_write', 'file_append', 'directory_list', 'file_delete'],
    tests: [
      {
        tool: 'file_write',
        args: { filepath: testData.files.testFile, content: testData.files.writeContent },
        assert: 'assertFileOperation'
      },
      {
        tool: 'file_read',
        args: { filepath: testData.files.testFile },
        assert: 'assertFileOperation',
        validate: (result) => {
          expect(result.data.content || result.content).toBe(testData.files.writeContent);
        }
      },
      {
        tool: 'directory_list',
        args: { directory: __dirname },
        assert: 'assertFileOperation',
        validate: (result) => {
          expect(Array.isArray(result.data.contents || result.files)).toBe(true);
        }
      }
    ]
  },
  
  calculator: {
    name: 'calculator',
    tools: ['calculator_evaluate'],
    tests: testData.calculations.map(calc => ({
      tool: 'calculator_evaluate',
      args: { expression: calc.expression },
      assert: 'assertCalculation',
      expected: calc.expected
    }))
  },
  
  serper: {
    name: 'serper',
    tools: ['google_search'],
    tests: [
      {
        tool: 'google_search',
        args: { query: testData.searches.simple },
        assert: 'assertSearchResults'
      },
      {
        tool: 'google_search',
        args: testData.searches.withOptions,
        assert: 'assertSearchResults'
      }
    ]
  },
  
  github: {
    name: 'github',
    tools: ['github_list_repos'],
    tests: [
      {
        tool: 'github_list_repos',
        args: { type: 'all', per_page: 10 },
        assert: 'assertGitHubOperation',
        validate: (result) => {
          expect(result.data).toBeDefined();
          expect(result.data.repositories).toBeDefined();
          expect(Array.isArray(result.data.repositories)).toBe(true);
          expect(result.data.repositories.length).toBeGreaterThan(0);
        }
      }
    ]
  },
  
  json: {
    name: 'json',
    tools: ['json_parse', 'json_stringify', 'json_validate', 'json_extract'],
    tests: [
      {
        tool: 'json_stringify',
        args: { object: testData.json.simple, indent: 2 },
        assert: 'assertJSONOperation',
        validate: (result) => {
          // Handle both direct result and wrapped data responses
          const data = result.data || result;
          expect(data.json || data.json_string).toBeDefined();
          expect(typeof (data.json || data.json_string)).toBe('string');
        }
      },
      {
        tool: 'json_parse',
        args: { json_string: JSON.stringify(testData.json.simple) },
        assert: 'assertJSONOperation',
        validate: (result) => {
          // Handle both direct result and wrapped data responses
          const data = result.data || result;
          expect(data.parsed || data.result).toEqual(testData.json.simple);
        }
      }
    ]
  }
};