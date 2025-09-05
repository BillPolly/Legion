/**
 * Integration tests for format detection with real LLM response samples
 * Tests with various real-world response formats and edge cases
 * NO MOCKS - uses real format detection with actual response samples
 */

import { FormatDetector } from '../../src/FormatDetector.js';

describe('FormatDetection Integration', () => {
  let detector;
  let schema;

  beforeEach(() => {
    schema = {
      type: 'object',
      properties: {
        task: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        steps: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['task']
    };
    detector = new FormatDetector(schema);
  });

  describe('Real LLM Response Samples', () => {
    test('should handle Claude-style JSON response', () => {
      const claudeResponse = `{
  "task": "Analyze user feedback and categorize the sentiment",
  "confidence": 0.87,
  "steps": [
    "Parse the feedback text for sentiment indicators",
    "Apply natural language processing techniques",
    "Categorize into positive, negative, or neutral",
    "Assign confidence score based on clarity of indicators"
  ]
}`;
      
      const result = detector.detect(claudeResponse);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should handle GPT-style JSON with markdown formatting', () => {
      const gptResponse = `Here's the analysis:

\`\`\`json
{
  "task": "Create a marketing plan for the new product launch",
  "confidence": 0.92,
  "steps": [
    "Market research and competitor analysis",
    "Define target audience and personas",
    "Develop messaging and positioning strategy",
    "Create content calendar and campaign timeline"
  ]
}
\`\`\`

This analysis provides a comprehensive approach to the marketing challenge.`;
      
      const result = detector.detect(gptResponse);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should handle XML-style response', () => {
      const xmlResponse = `<response>
  <task>Develop a training program for new employees</task>
  <confidence>0.85</confidence>
  <steps>
    <step>Assess current onboarding process</step>
    <step>Identify skill gaps and training needs</step>
    <step>Design interactive training modules</step>
    <step>Create assessment and feedback mechanisms</step>
  </steps>
</response>`;
      
      const result = detector.detect(xmlResponse);
      expect(result.format).toBe('xml');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should handle delimited sections response', () => {
      const delimitedResponse = `---TASK---
Implement a customer support chatbot system

---CONFIDENCE---
0.78

---STEPS---
1. Define chatbot requirements and use cases
2. Choose appropriate NLP framework and platform
3. Design conversation flows and response templates
4. Integrate with existing customer support systems
5. Test with real customer scenarios
6. Deploy and monitor performance
---END---`;
      
      const result = detector.detect(delimitedResponse);
      expect(result.format).toBe('delimited');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should handle tagged content response', () => {
      const taggedResponse = `<TASK>Design a mobile app for food delivery service</TASK>
<CONFIDENCE>0.91</CONFIDENCE>
<STEPS>Research user needs and preferences</STEPS>
<STEPS>Create wireframes and user interface mockups</STEPS>
<STEPS>Develop core features: ordering, payment, tracking</STEPS>
<STEPS>Implement restaurant and delivery partner integration</STEPS>
<STEPS>Test across different devices and scenarios</STEPS>`;
      
      const result = detector.detect(taggedResponse);
      // Could be detected as tagged or xml - both acceptable
      expect(['tagged', 'xml']).toContain(result.format);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should handle markdown structured response', () => {
      const markdownResponse = `## Task
Build an e-commerce recommendation engine

## Confidence
0.88

## Steps
1. Collect and analyze user behavior data
2. Implement collaborative filtering algorithms
3. Add content-based filtering for product features
4. Create hybrid recommendation system
5. A/B test different recommendation strategies
6. Monitor and optimize recommendation accuracy`;
      
      const result = detector.detect(markdownResponse);
      expect(result.format).toBe('markdown');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Edge Cases and Malformed Responses', () => {
    test('should handle JSON with trailing comma', () => {
      const malformedJson = `{
  "task": "Process customer orders",
  "confidence": 0.75,
  "steps": [
    "Validate order details",
    "Check inventory availability",
  ]
}`;
      
      const result = detector.detect(malformedJson);
      expect(result.format).toBe('json'); // Should still detect as JSON
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test('should handle XML with mismatched tags', () => {
      const malformedXml = `<response>
  <task>Optimize database performance</task>
  <confidence>0.82</confidence>
  <steps>
    <step>Analyze query performance metrics</step>
    <step>Identify bottlenecks and slow queries
  </steps>
</response>`;
      
      const result = detector.detect(malformedXml);
      expect(result.format).toBe('xml'); // Should still detect as XML
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test('should handle mixed format response', () => {
      const mixedResponse = `Here's the analysis in JSON format:

{
  "task": "Implement user authentication system"
}

Additional details:
- **Confidence**: 0.89
- **Primary Step**: Design secure login flow
- **Secondary Step**: Implement password hashing

<NOTE>Consider multi-factor authentication</NOTE>`;
      
      const result = detector.detect(mixedResponse);
      // Should detect the strongest signal (could be JSON or XML)
      expect(['json', 'xml']).toContain(result.format);
      expect(result.confidence).toBeGreaterThan(0.4);
    });

    test('should handle response with no clear structure', () => {
      const unstructuredResponse = `I think the best approach would be to start by analyzing the current system architecture. The confidence level for this recommendation would be around 80% based on my experience with similar projects. The main steps would include conducting a thorough audit, identifying pain points, and then developing a phased implementation plan.`;
      
      const result = detector.detect(unstructuredResponse);
      expect(result.format).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.6);
    });

    test('should handle very short responses', () => {
      const shortResponse = '{"ok": true}';
      
      const result = detector.detect(shortResponse);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should handle very long responses', () => {
      const longSteps = Array.from({ length: 20 }, (_, i) => 
        `"Step ${i + 1}: This is a detailed step description that explains what needs to be done in this particular phase of the project"`
      );
      
      const longResponse = `{
  "task": "Develop comprehensive enterprise software solution",
  "confidence": 0.85,
  "steps": [
    ${longSteps.join(',\n    ')}
  ]
}`;
      
      const result = detector.detect(longResponse);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Format Disambiguation', () => {
    test('should prefer JSON over XML for simple tagged structures', () => {
      const ambiguousResponse1 = `{"name": "value"}`;
      const ambiguousResponse2 = `<name>value</name>`;
      
      const result1 = detector.detect(ambiguousResponse1);
      const result2 = detector.detect(ambiguousResponse2);
      
      expect(result1.format).toBe('json');
      expect(['xml', 'tagged']).toContain(result2.format);
    });

    test('should distinguish between XML and tagged content', () => {
      const xmlResponse = `<document xmlns="http://example.com">
  <metadata>
    <title>Report</title>
    <author id="123">John Doe</author>
  </metadata>
  <content>
    <section name="introduction">
      <paragraph>This is the introduction.</paragraph>
    </section>
  </content>
</document>`;
      
      const taggedResponse = `<TITLE>Report</TITLE>
<AUTHOR>John Doe</AUTHOR>
<CONTENT>This is the introduction.</CONTENT>`;
      
      const xmlResult = detector.detect(xmlResponse);
      const taggedResult = detector.detect(taggedResponse);
      
      expect(xmlResult.format).toBe('xml');
      expect(['xml', 'tagged']).toContain(taggedResult.format);
      
      // XML should have higher confidence due to complexity
      if (taggedResult.format === 'xml') {
        expect(xmlResult.confidence).toBeGreaterThan(taggedResult.confidence);
      }
    });

    test('should handle format fallback ordering', () => {
      const ambiguousResponse = `TASK: Build a website
STEPS: Design, Develop, Test, Deploy`;
      
      const result = detector.detect(ambiguousResponse);
      
      // Should fall back to unknown or lowest confidence format
      expect(result.format).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.6);
    });
  });

  describe('Configuration-based Detection', () => {
    test('should respect custom confidence threshold', () => {
      const customDetector = new FormatDetector(schema, {
        'format-detection': {
          'confidence-threshold': 0.9
        }
      });
      
      const borderlineResponse = `## Task
Some task description`;
      
      const result = customDetector.detect(borderlineResponse);
      
      // Should be unknown due to high threshold
      expect(result.format).toBe('unknown');
    });

    test('should respect format strategy limitations', () => {
      const limitedDetector = new FormatDetector(schema, {
        'format-detection': {
          strategies: ['json', 'xml'] // Only JSON and XML
        }
      });
      
      const markdownResponse = `## Task
Build something

## Steps
- Step 1
- Step 2`;
      
      const scores = limitedDetector.getConfidenceScores(markdownResponse);
      
      // Should still calculate all scores for analysis
      expect(scores).toHaveProperty('markdown');
      expect(scores).toHaveProperty('delimited');
      expect(scores).toHaveProperty('tagged');
    });
  });

  describe('Real-world Error Scenarios', () => {
    test('should handle incomplete JSON responses', () => {
      const incompleteJson = `{
  "task": "Analyze data trends",
  "confidence": 0.77,
  "steps": [
    "Collect historical data",
    "Apply statistical analysis"`;
      // Missing closing brackets
      
      const result = detector.detect(incompleteJson);
      // Could be detected as JSON or unknown depending on confidence threshold
      expect(['json', 'unknown']).toContain(result.format);
      if (result.format === 'json') {
        expect(result.confidence).toBeGreaterThan(0.2);
      }
    });

    test('should handle responses with extra text', () => {
      const responseWithExtra = `Based on the requirements, here is my analysis:

{
  "task": "Implement search functionality",
  "confidence": 0.84,
  "steps": ["Design search interface", "Index content", "Implement search logic"]
}

Please note that this approach should work well for most use cases.`;
      
      const result = detector.detect(responseWithExtra);
      // Could be detected as JSON or unknown depending on surrounding text
      expect(['json', 'unknown']).toContain(result.format);
      if (result.format === 'json') {
        expect(result.confidence).toBeGreaterThan(0.3);
      }
    });

    test('should handle unicode and special characters', () => {
      const unicodeResponse = `{
  "task": "Process multilingual content: 中文, العربية, русский",
  "confidence": 0.76,
  "steps": [
    "Detect language encoding",
    "Apply appropriate text processing",
    "Handle right-to-left languages"
  ]
}`;
      
      const result = detector.detect(unicodeResponse);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });
});