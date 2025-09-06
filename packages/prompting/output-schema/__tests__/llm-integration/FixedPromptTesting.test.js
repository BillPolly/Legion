/**
 * Fixed Prompt Testing with Real LLMs
 * Tests the corrected instruction generation and all format handling
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResponseValidator } from '../../src/ResponseValidator.js';
import { ResourceManager } from '@legion/resource-manager';
import { Anthropic } from '@anthropic-ai/sdk';

describe('Fixed Prompt Testing with Real LLMs', () => {
  let llmClient;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required for testing');
    }
    
    const anthropicClient = new Anthropic({ apiKey });
    llmClient = {
      complete: async (prompt, options = {}) => {
        const response = await anthropicClient.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      }
    };
  });

  describe('Corrected XML Format Testing', () => {
    test('should generate proper XML instructions and get XML response', async () => {
      const schema = {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief summary' },
          score: { type: 'number', minimum: 1, maximum: 10 },
          tags: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 3
          }
        },
        required: ['summary', 'score']
      };

      const validator = new ResponseValidator(schema);
      
      const exampleData = {
        summary: "The code is well-structured but needs better documentation",
        score: 7,
        tags: ["clean-code", "documentation", "refactoring"]
      };

      const instructions = validator.generateInstructions(exampleData, { format: 'xml' });
      
      console.log('\n=== CORRECTED XML INSTRUCTIONS ===');
      console.log(instructions);
      console.log('\n');

      // Should now show XML structure AND XML example!
      expect(instructions).toContain('<response>');
      expect(instructions).toContain('<summary>');
      expect(instructions).toContain('EXAMPLE OUTPUT:');
      expect(instructions).toContain('<item>'); // For array items

      const prompt = `Analyze this JavaScript function:

\`\`\`javascript
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
\`\`\`

${instructions}`;

      console.log('Testing XML with Claude...');
      const response = await llmClient.complete(prompt);
      
      console.log('Claude XML Response:');
      console.log(response);
      console.log('\n');

      const result = validator.process(response);
      console.log('XML Processing Result:', result);

      // Now should get proper XML response!
      expect(result.format).toBe('xml');
      expect(result.confidence).toBeGreaterThan(0.8);
    }, 30000);
  });

  describe('Corrected Delimited Format Testing', () => {
    test('should generate proper delimited instructions and get delimited response', async () => {
      const schema = {
        type: 'object',
        properties: {
          task_name: { type: 'string' },
          difficulty: { 
            type: 'string',
            enum: ['easy', 'medium', 'hard']
          },
          estimated_time: { type: 'number' }
        },
        required: ['task_name', 'difficulty']
      };

      const validator = new ResponseValidator(schema);
      
      const exampleData = {
        task_name: "Implement user authentication system",
        difficulty: "medium",
        estimated_time: 8
      };

      const instructions = validator.generateInstructions(exampleData, { format: 'delimited' });
      
      console.log('\n=== CORRECTED DELIMITED INSTRUCTIONS ===');
      console.log(instructions);
      console.log('\n');

      // Should now show delimited structure AND delimited example!
      expect(instructions).toContain('---TASK_NAME---');
      expect(instructions).toContain('---END-TASK_NAME---');
      expect(instructions).toContain('EXAMPLE OUTPUT:');
      expect(instructions).toContain('Implement user authentication system');

      const prompt = `Plan this development task:

"Build a REST API for a blog application with CRUD operations"

${instructions}`;

      console.log('Testing Delimited with Claude...');
      const response = await llmClient.complete(prompt);
      
      console.log('Claude Delimited Response:');
      console.log(response);
      console.log('\n');

      const result = validator.process(response);
      console.log('Delimited Processing Result:', result);

      // Now should get proper delimited response!
      expect(result.format).toBe('delimited');
      expect(result.confidence).toBeGreaterThan(0.7);
    }, 30000);
  });

  describe('YAML Format Testing', () => {
    test('should generate YAML instructions and parse YAML response', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          dependencies: {
            type: 'array',
            items: { type: 'string' }
          },
          config: {
            type: 'object',
            properties: {
              port: { type: 'number' },
              debug: { type: 'boolean' }
            }
          }
        },
        required: ['name', 'version']
      };

      const validator = new ResponseValidator(schema);
      
      const exampleData = {
        name: "my-app",
        version: "1.0.0",
        dependencies: ["express", "lodash", "axios"],
        config: {
          port: 3000,
          debug: true
        }
      };

      const instructions = validator.generateInstructions(exampleData, { format: 'yaml' });
      
      console.log('\n=== YAML INSTRUCTIONS ===');
      console.log(instructions);
      console.log('\n');

      expect(instructions).toContain('YAML');
      expect(instructions).toContain('name:');
      expect(instructions).toContain('dependencies:');

      const prompt = `Create a configuration for this Node.js project:

"A web scraper that collects product data from e-commerce sites"

${instructions}`;

      console.log('Testing YAML with Claude...');
      const response = await llmClient.complete(prompt);
      
      console.log('Claude YAML Response:');
      console.log(response);
      console.log('\n');

      const result = validator.process(response);
      console.log('YAML Processing Result:', result);

      expect(result.format).toBe('yaml');
      expect(result.confidence).toBeGreaterThan(0.5);
    }, 30000);
  });

  describe('Special Content Types Testing', () => {
    test('should handle code generation in different formats', async () => {
      const codeSchema = {
        type: 'object',
        properties: {
          function_name: { type: 'string' },
          description: { type: 'string' },
          code: { 
            type: 'string',
            description: 'JavaScript function implementation'
          },
          test_cases: {
            type: 'array',
            items: { type: 'string' },
            description: 'Example test cases'
          }
        },
        required: ['function_name', 'code']
      };

      const validator = new ResponseValidator(codeSchema);
      
      const exampleData = {
        function_name: "calculateSum",
        description: "Calculates the sum of an array of numbers",
        code: "function calculateSum(numbers) {\n  return numbers.reduce((sum, num) => sum + num, 0);\n}",
        test_cases: [
          "calculateSum([1, 2, 3]) // returns 6",
          "calculateSum([]) // returns 0"
        ]
      };

      // Test JSON format with code
      const jsonInstructions = validator.generateInstructions(exampleData, { format: 'json' });
      
      console.log('\n=== CODE GENERATION JSON INSTRUCTIONS ===');
      console.log(jsonInstructions);
      
      const codePrompt = `Create a JavaScript function that:

"Validates an email address and returns true/false"

${jsonInstructions}`;

      console.log('\nTesting Code Generation with Claude...');
      const response = await llmClient.complete(codePrompt);
      
      console.log('Claude Code Response:');
      console.log(response);
      console.log('\n');

      const result = validator.process(response);
      console.log('Code Validation Result:', result);

      expect(result.format).toBe('json');
      if (result.success) {
        expect(result.data.function_name).toBeDefined();
        expect(result.data.code).toContain('function');
      }
    }, 30000);

    test('should handle markdown content generation', async () => {
      const docSchema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                heading: { type: 'string' },
                content: { type: 'string' }
              }
            }
          },
          code_examples: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['title']
      };

      const validator = new ResponseValidator(docSchema);
      
      const exampleData = {
        title: "API Documentation Guide",
        sections: [
          {
            heading: "Getting Started",
            content: "This section explains the basic setup process"
          },
          {
            heading: "Authentication", 
            content: "Details about API key authentication"
          }
        ],
        code_examples: [
          "curl -H 'Authorization: Bearer token' https://api.example.com/data",
          "fetch('/api/data', { headers: { 'Authorization': 'Bearer token' }})"
        ]
      };

      const markdownInstructions = validator.generateInstructions(exampleData, { format: 'markdown' });
      
      console.log('\n=== MARKDOWN GENERATION INSTRUCTIONS ===');
      console.log(markdownInstructions);

      const prompt = `Create documentation for:

"How to use the new WebSocket real-time chat API"

${markdownInstructions}`;

      console.log('\nTesting Markdown Generation with Claude...');
      const response = await llmClient.complete(prompt);
      
      console.log('Claude Markdown Response:');
      console.log(response);
      console.log('\n');

      const result = validator.process(response);
      console.log('Markdown Validation Result:', result);

      expect(result.format).toBe('markdown');
      expect(result.confidence).toBeGreaterThan(0.6);
    }, 30000);
  });

  describe('Format Comparison Analysis', () => {
    test('should compare all formats with same schema and measure effectiveness', async () => {
      const universalSchema = {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 5 },
          description: { type: 'string', minLength: 20 },
          category: {
            type: 'string',
            enum: ['tech', 'business', 'science', 'education']
          },
          priority: { type: 'number', minimum: 1, maximum: 5 },
          items: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 4
          }
        },
        required: ['title', 'description', 'category']
      };

      const validator = new ResponseValidator(universalSchema);
      
      const exampleData = {
        title: "Advanced Machine Learning Pipeline",
        description: "Implementation of an end-to-end ML pipeline with automated training and deployment",
        category: "tech",
        priority: 4,
        items: ["Data preprocessing", "Model training", "Validation", "Deployment"]
      };

      const testPrompt = "Create a project plan for: 'Building a customer recommendation system'";

      const formats = ['json', 'xml', 'delimited', 'tagged', 'markdown', 'yaml'];
      const results = {};

      console.log('\n🧪 COMPREHENSIVE FORMAT COMPARISON');
      console.log('=====================================');

      for (const format of formats) {
        console.log(`\n📋 Testing ${format.toUpperCase()} format...`);
        
        const instructions = validator.generateInstructions(exampleData, { format });
        const fullPrompt = `${testPrompt}\n\n${instructions}`;
        
        // Show the key parts of instructions
        console.log(`${format} instruction preview:`, instructions.substring(0, 200) + '...');
        
        try {
          const response = await llmClient.complete(fullPrompt);
          console.log(`${format} response preview:`, response.substring(0, 150) + '...');
          
          const result = validator.process(response);
          console.log(`${format} result: Success=${result.success}, Format=${result.format}, Confidence=${Math.round(result.confidence * 100)}%`);
          
          results[format] = result;
        } catch (error) {
          console.log(`${format} failed:`, error.message);
          results[format] = { success: false, error: error.message };
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('\n📊 FORMAT EFFECTIVENESS SUMMARY:');
      console.log('=====================================');
      
      let successCount = 0;
      for (const [format, result] of Object.entries(results)) {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        const details = result.success 
          ? `${result.format} detected (${Math.round(result.confidence * 100)}%)`
          : `${result.errors?.[0]?.message || result.error || 'Unknown error'}`;
        
        console.log(`${format.toUpperCase()}: ${status} - ${details}`);
        
        if (result.success) successCount++;
      }
      
      const successRate = successCount / formats.length;
      console.log(`\nOverall Success Rate: ${successCount}/${formats.length} (${Math.round(successRate * 100)}%)`);

      // Should have improved success rate with corrected prompts
      expect(successRate).toBeGreaterThan(0.3); // At least 33% success with corrected prompts

      // JSON should definitely work
      expect(results.json.success).toBe(true);
      
      // At least one alternative format should work  
      const alternativeFormats = ['xml', 'delimited', 'tagged', 'markdown', 'yaml'];
      const alternativeSuccess = alternativeFormats.some(format => results[format].success);
      expect(alternativeSuccess).toBe(true);
    }, 120000); // Extended timeout for multiple LLM calls
  });

  describe('Special Content Type Validation', () => {
    test('should handle code blocks and special characters properly', async () => {
      const codeSchema = {
        type: 'object',
        properties: {
          explanation: { type: 'string' },
          javascript_code: { 
            type: 'string',
            description: 'Complete JavaScript function with proper syntax'
          },
          html_snippet: {
            type: 'string',
            description: 'HTML code snippet'
          },
          css_styles: {
            type: 'string', 
            description: 'CSS styling rules'
          }
        },
        required: ['explanation', 'javascript_code']
      };

      const validator = new ResponseValidator(codeSchema);
      
      const exampleData = {
        explanation: "Creates a responsive navigation bar component",
        javascript_code: "function createNavbar() {\n  const nav = document.createElement('nav');\n  nav.innerHTML = '<ul><li>Home</li><li>About</li></ul>';\n  return nav;\n}",
        html_snippet: "<nav class=\"navbar\">\n  <ul>\n    <li><a href=\"#home\">Home</a></li>\n  </ul>\n</nav>",
        css_styles: ".navbar { background: #333; }\n.navbar ul { list-style: none; }"
      };

      const instructions = validator.generateInstructions(exampleData, { format: 'json' });
      
      console.log('\n=== CODE CONTENT INSTRUCTIONS ===');
      console.log(instructions);

      const prompt = `Create a web component for:

"A toggle button that changes theme from light to dark"

${instructions}`;

      console.log('\nTesting Code Content with Claude...');
      const response = await llmClient.complete(prompt);
      
      console.log('Claude Code Response:');
      console.log(response);
      console.log('\n');

      const result = validator.process(response);
      console.log('Code Content Result:', result);

      expect(result.format).toBe('json');
      if (result.success) {
        expect(result.data.javascript_code).toMatch(/function|class|=>/); // Modern JS may use class or arrow functions
        expect(result.data.explanation).toBeDefined();
        
        // Validate that special characters are handled properly
        expect(result.data.javascript_code).toBeTruthy();
        expect(typeof result.data.javascript_code).toBe('string');
      }
    }, 30000);
  });
});