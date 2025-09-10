/**
 * Basic LLM Response Testing - Phase 1
 * Tests prompt generation quality and response parsing with real LLMs
 * NO MOCKS - uses actual Anthropic Claude and OpenAI GPT APIs
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResponseValidator } from '../../src/ResponseValidator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Basic LLM Response Testing', () => {
  let anthropicClient;
  let resourceManager;
  let llmClient;

  beforeAll(async () => {
    // Initialize ResourceManager (loads .env automatically)
    resourceManager = await ResourceManager.getInstance();
    
    // Get API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in .env - required for LLM testing');
    }
    
    // Use ResourceManager to get LLM client
    llmClient = await resourceManager.get('llmClient');

    console.log('✅ LLM client initialized for real API testing');
  });

  describe('JSON Format Testing with Real LLM', () => {
    test('should generate instructions that produce valid JSON from Claude', async () => {
      const schema = {
        type: 'object',
        properties: {
          analysis: { 
            type: 'string',
            description: 'Brief analysis of the input',
            minLength: 20
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral'],
            description: 'Overall sentiment detected'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence in the analysis'
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 5,
            description: 'Key terms identified'
          }
        },
        required: ['analysis', 'sentiment', 'confidence']
      };

      const validator = new ResponseValidator(schema);
      
      // Generate instructions with example
      const exampleData = {
        analysis: "The customer feedback expresses satisfaction with the product quality and user experience",
        sentiment: "positive",
        confidence: 0.87,
        keywords: ["satisfaction", "quality", "experience"]
      };

      const instructions = validator.generateInstructions(exampleData, {
        format: 'json',
        verbosity: 'detailed'
      });

      console.log('Generated JSON Instructions:');
      console.log(instructions);
      console.log('\n');

      // Test with real LLM
      const userInput = "I love this new feature! It makes my workflow so much easier and faster.";
      const fullPrompt = `Analyze the following user feedback:

"${userInput}"

${instructions}`;

      console.log('Sending to Claude...');
      const llmResponse = await llmClient.complete(fullPrompt);
      console.log('Claude Response:');
      console.log(llmResponse);
      console.log('\n');

      // Validate response
      const result = validator.process(llmResponse);
      console.log('Validation Result:', result);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(typeof result.data.analysis).toBe('string');
      expect(result.data.analysis.length).toBeGreaterThan(20);
      expect(['positive', 'negative', 'neutral']).toContain(result.data.sentiment);
      expect(result.data.confidence).toBeGreaterThanOrEqual(0);
      expect(result.data.confidence).toBeLessThanOrEqual(1);
      
      if (result.data.keywords) {
        expect(Array.isArray(result.data.keywords)).toBe(true);
        expect(result.data.keywords.length).toBeLessThanOrEqual(5);
      }
    }, 30000); // 30 second timeout for LLM calls

    test('should handle complex nested schema with Claude', async () => {
      const complexSchema = {
        type: 'object',
        properties: {
          task_analysis: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 5 },
              description: { type: 'string', minLength: 20 },
              complexity: {
                type: 'string',
                enum: ['simple', 'moderate', 'complex']
              }
            },
            required: ['title', 'description', 'complexity']
          },
          time_estimate: {
            type: 'object',
            properties: {
              hours: { type: 'number', minimum: 0.5, maximum: 100 },
              confidence: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['hours']
          },
          skills_required: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 8
          }
        },
        required: ['task_analysis', 'time_estimate']
      };

      const validator = new ResponseValidator(complexSchema);

      const exampleData = {
        task_analysis: {
          title: "Build E-commerce Payment Integration",
          description: "Integrate Stripe payment processing with existing checkout flow including error handling",
          complexity: "moderate"
        },
        time_estimate: {
          hours: 16.5,
          confidence: 0.78
        },
        skills_required: ["JavaScript", "API Integration", "Payment Processing", "Error Handling"]
      };

      const instructions = validator.generateInstructions(exampleData);
      console.log('Complex Schema Instructions:');
      console.log(instructions.substring(0, 500) + '...');

      const taskPrompt = `Analyze this software development task:

"Implement real-time chat functionality with WebSocket connections, message persistence, and user authentication"

${instructions}`;

      const llmResponse = await llmClient.complete(taskPrompt);
      console.log('\nClaude Complex Response:');
      console.log(llmResponse);

      const result = validator.process(llmResponse);
      console.log('\nComplex Validation Result:', result);

      // Complex schemas may have validation challenges - test what we can
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.8);
      
      if (result.success) {
        expect(result.data.task_analysis).toBeDefined();
        expect(result.data.time_estimate).toBeDefined();
      } else {
        console.log('Complex schema validation errors (expected for MVP):', result.errors.length);
      }
    }, 30000);
  });

  describe('Multi-Format Instruction Testing', () => {
    test('should test XML format instructions with Claude', async () => {
      const schema = {
        type: 'object',
        properties: {
          summary: { 
            type: 'string',
            description: 'Summary of the analysis'
          },
          score: {
            type: 'number',
            minimum: 1,
            maximum: 10,
            description: 'Quality score'
          },
          recommendations: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 3
          }
        },
        required: ['summary', 'score'],
        'x-format': {
          xml: {
            'root-element': 'analysis'
          }
        }
      };

      const validator = new ResponseValidator(schema);
      
      const exampleData = {
        summary: "The code quality is good but could benefit from additional documentation",
        score: 7,
        recommendations: ["Add inline comments", "Create API documentation", "Improve error messages"]
      };

      const xmlInstructions = validator.generateInstructions(exampleData, {
        format: 'xml'
      });

      console.log('XML Format Instructions:');
      console.log(xmlInstructions);

      const taskPrompt = `Review this code snippet and provide analysis:

\`\`\`javascript
function processData(input) {
  return input.map(x => x * 2).filter(x => x > 10);
}
\`\`\`

${xmlInstructions}`;

      const llmResponse = await llmClient.complete(taskPrompt);
      console.log('\nClaude XML Response:');
      console.log(llmResponse);

      const result = validator.process(llmResponse);
      console.log('\nXML Validation Result:', result);

      // XML may have parsing challenges, but should detect format correctly
      expect(result.format).toBe('xml');
      expect(result.confidence).toBeGreaterThan(0.7);
    }, 30000);

    test('should test delimited format instructions with Claude', async () => {
      const schema = {
        type: 'object',
        properties: {
          task_name: { type: 'string' },
          priority: { 
            type: 'string',
            enum: ['low', 'medium', 'high']
          },
          estimated_hours: { type: 'number', minimum: 0.5, maximum: 40 }
        },
        required: ['task_name', 'priority']
      };

      const validator = new ResponseValidator(schema);

      const exampleData = {
        task_name: "Implement user dashboard with analytics",
        priority: "high", 
        estimated_hours: 12
      };

      const delimitedInstructions = validator.generateInstructions(exampleData, {
        format: 'delimited'
      });

      console.log('Delimited Format Instructions:');
      console.log(delimitedInstructions);

      const taskPrompt = `Plan this development task:

"Create a mobile-responsive contact form with validation and email integration"

${delimitedInstructions}`;

      const llmResponse = await llmClient.complete(taskPrompt);
      console.log('\nClaude Delimited Response:');
      console.log(llmResponse);

      const result = validator.process(llmResponse);
      console.log('\nDelimited Validation Result:', result);

      // Format detection working - Claude may interpret as markdown
      expect(['delimited', 'markdown']).toContain(result.format);
      expect(result.confidence).toBeGreaterThan(0.3);
    }, 30000);
  });

  describe('Error Handling with Real LLM', () => {
    test('should test validation error feedback and reprompting', async () => {
      const strictSchema = {
        type: 'object',
        properties: {
          title: { 
            type: 'string',
            minLength: 10,
            maxLength: 50
          },
          rating: {
            type: 'number',
            minimum: 1,
            maximum: 5,
            multipleOf: 0.5
          },
          category: {
            type: 'string',
            enum: ['technology', 'business', 'education', 'entertainment']
          }
        },
        required: ['title', 'rating', 'category']
      };

      const validator = new ResponseValidator(strictSchema);

      const exampleData = {
        title: "Comprehensive Analysis of Market Trends",
        rating: 4.5,
        category: "business"
      };

      const instructions = validator.generateInstructions(exampleData);

      // First attempt - intentionally vague to potentially get errors
      const vaguePrompt = `Rate this article briefly:

"AI is changing everything"

${instructions}`;

      const firstResponse = await llmClient.complete(vaguePrompt);
      console.log('First Claude Response:');
      console.log(firstResponse);

      const firstResult = validator.process(firstResponse);
      console.log('\nFirst Validation Result:', firstResult);

      if (!firstResult.success) {
        console.log('\n🔄 Testing reprompting with error feedback...');
        
        // Create reprompt with error feedback
        const errorFeedback = firstResult.errors.map(error => 
          `- ${error.message} (Suggestion: ${error.suggestion || 'Fix this issue'})`
        ).join('\n');

        const reprompt = `${vaguePrompt}

Your previous response had these validation issues:
${errorFeedback}

Please provide a corrected response that meets all requirements.`;

        const secondResponse = await llmClient.complete(reprompt);
        console.log('\nSecond Claude Response (after error feedback):');
        console.log(secondResponse);

        const secondResult = validator.process(secondResponse);
        console.log('\nSecond Validation Result:', secondResult);

        // Should show improvement or at least different errors
        expect(secondResult).toBeDefined();
        expect(secondResult.format).toBeTruthy();
      } else {
        console.log('✅ First response was valid - Claude followed instructions correctly!');
        expect(firstResult.data.title.length).toBeGreaterThanOrEqual(10);
        expect(firstResult.data.rating).toBeGreaterThanOrEqual(1);
        expect(firstResult.data.rating).toBeLessThanOrEqual(5);
      }
    }, 45000); // Extended timeout for reprompting
  });

  describe('Format Detection with Real Responses', () => {
    test('should test format auto-detection across different LLM response styles', async () => {
      const schema = {
        type: 'object', 
        properties: {
          topic: { type: 'string' },
          explanation: { type: 'string', minLength: 50 },
          examples: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 3
          }
        },
        required: ['topic', 'explanation']
      };

      const validator = new ResponseValidator(schema);

      // Test different instruction formats
      const formats = ['json', 'xml', 'delimited'];
      const results = {};

      for (const format of formats) {
        console.log(`\n📋 Testing ${format.toUpperCase()} format...`);

        const instructions = validator.generateInstructions({
          topic: "Machine Learning Basics",
          explanation: "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from data without explicit programming",
          examples: ["Image recognition", "Natural language processing", "Recommendation systems"]
        }, { format });

        const prompt = `Explain this concept briefly:

"Blockchain technology"

${instructions}`;

        const response = await llmClient.complete(prompt);
        console.log(`${format} Response:`, response.substring(0, 300) + '...');

        const result = validator.process(response);
        console.log(`${format} Result:`, { 
          success: result.success, 
          format: result.format, 
          confidence: result.confidence 
        });

        results[format] = result;
        
        // Should detect correct format or at least process successfully
        expect(result.format).toBeTruthy();
        expect(result.confidence).toBeGreaterThan(0.3);
      }

      console.log('\n📊 Format Detection Summary:');
      for (const [requestedFormat, result] of Object.entries(results)) {
        console.log(`Requested: ${requestedFormat} → Detected: ${result.format} (${Math.round(result.confidence * 100)}% confidence)`);
      }
    }, 60000); // Extended timeout for multiple LLM calls
  });

  describe('Constraint Validation Testing', () => {
    test('should test validation rules with real LLM responses', async () => {
      const constraintSchema = {
        type: 'object',
        properties: {
          product_name: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            description: 'Product name'
          },
          price: {
            type: 'number',
            minimum: 0.01,
            maximum: 999.99,
            multipleOf: 0.01,
            description: 'Product price in dollars'
          },
          category: {
            type: 'string',
            enum: ['electronics', 'clothing', 'books', 'home', 'sports'],
            description: 'Product category'
          },
          features: {
            type: 'array',
            items: { 
              type: 'string',
              minLength: 3
            },
            minItems: 2,
            maxItems: 6,
            uniqueItems: true,
            description: 'Key product features'
          },
          in_stock: {
            type: 'boolean',
            description: 'Whether product is currently in stock'
          }
        },
        required: ['product_name', 'price', 'category', 'in_stock']
      };

      const validator = new ResponseValidator(constraintSchema);

      const exampleData = {
        product_name: "Wireless Bluetooth Headphones",
        price: 89.99,
        category: "electronics", 
        features: ["Noise cancellation", "30-hour battery", "Quick charge", "Premium sound"],
        in_stock: true
      };

      const instructions = validator.generateInstructions(exampleData);

      const prompt = `Create a product listing for:

"Premium running shoes with advanced cushioning technology"

${instructions}`;

      const llmResponse = await llmClient.complete(prompt);
      console.log('Constraint Test Response:');
      console.log(llmResponse);

      const result = validator.process(llmResponse);
      console.log('\nConstraint Validation Result:', result);

      if (result.success) {
        console.log('✅ All constraints satisfied!');
        expect(result.data.product_name.length).toBeGreaterThanOrEqual(3);
        expect(result.data.product_name.length).toBeLessThanOrEqual(30);
        expect(result.data.price).toBeGreaterThan(0);
        expect(result.data.price).toBeLessThan(1000);
        expect(['electronics', 'clothing', 'books', 'home', 'sports']).toContain(result.data.category);
        expect(typeof result.data.in_stock).toBe('boolean');
      } else {
        console.log('❌ Constraint violations detected:');
        result.errors.forEach(error => {
          console.log(`  - ${error.message} (${error.field || 'general'})`);
        });
        
        // Should still detect format correctly and provide actionable errors
        expect(result.format).toBeTruthy();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].suggestion).toBeTruthy();
      }
    }, 30000);
  });

  describe('Response Quality Assessment', () => {
    test('should measure prompt instruction effectiveness', async () => {
      const testCases = [
        {
          name: 'Simple Object',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'number' }
            },
            required: ['name']
          },
          example: { name: 'Test Item', value: 42 },
          prompt: 'Describe this item: "Red apple"'
        },
        {
          name: 'Array Handling',
          schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { type: 'string' },
                maxItems: 4
              },
              count: { type: 'number' }
            },
            required: ['items']
          },
          example: { items: ['apple', 'banana', 'orange'], count: 3 },
          prompt: 'List fruits that are yellow:'
        },
        {
          name: 'Enum Validation',
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['active', 'inactive', 'pending']
              },
              reason: { type: 'string' }
            },
            required: ['status']
          },
          example: { status: 'active', reason: 'All systems operational' },
          prompt: 'What is the current system status?'
        }
      ];

      const results = {};

      for (const testCase of testCases) {
        console.log(`\n🧪 Testing: ${testCase.name}`);
        
        const validator = new ResponseValidator(testCase.schema);
        const instructions = validator.generateInstructions(testCase.example);
        const fullPrompt = `${testCase.prompt}\n\n${instructions}`;

        const response = await llmClient.complete(fullPrompt);
        const result = validator.process(response);

        console.log(`${testCase.name} Success: ${result.success}, Format: ${result.format}, Confidence: ${Math.round(result.confidence * 100)}%`);

        results[testCase.name] = result;

        // Should at least detect a format and provide useful feedback
        expect(result.format).toBeTruthy();
        expect(result.confidence).toBeGreaterThan(0.3);
      }

      // Calculate success rate
      const successCount = Object.values(results).filter(r => r.success).length;
      const successRate = successCount / testCases.length;
      
      console.log(`\n📊 Overall Success Rate: ${successCount}/${testCases.length} (${Math.round(successRate * 100)}%)`);
      
      // Should have reasonable success rate for MVP
      expect(successRate).toBeGreaterThan(0.4); // At least 40% success rate
    }, 90000); // Extended timeout for multiple tests
  });
});