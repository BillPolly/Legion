import { PromptTemplate } from './PromptTemplate.js';

/**
 * Create default prompt for Z3 program generation
 * @returns {PromptTemplate} Configured prompt template
 */
export function createDefaultZ3Prompt() {
  const templateText = `You are an expert at formal reasoning using the Z3 theorem prover. Given a natural language question, generate a Z3 program in JSON format that can be used to answer the question.

The Z3 program JSON format is:
{
  "variables": [
    { "name": "variable_name", "sort": "Int" | "Bool" | "Real" }
  ],
  "constraints": [
    { "type": "constraint_type", "args": [...] }
  ],
  "query": {
    "type": "check-sat",
    "goal": "description of what to find"
  }
}

Constraint types:
- Comparison: "gt" (>), "lt" (<), "ge" (>=), "le" (<=), "eq" (==), "ne" (!=)
- Logical: "and", "or", "not", "implies"
- Arithmetic: "add" (+), "sub" (-), "mul" (*), "div" (/)

Constraint args can be:
- Variable names (strings)
- Literal values (numbers, booleans)
- Nested constraints (objects with "type" and "args")

Examples:
{{examples}}

Question: {{question}}{{errorFeedback}}

Output only valid JSON for the Z3 program, nothing else.`;

  const prompt = new PromptTemplate(templateText);

  // Add few-shot examples
  prompt.addExample({
    question: 'Is there a number greater than 5 and less than 10?',
    program: JSON.stringify({
      variables: [
        { name: 'x', sort: 'Int' }
      ],
      constraints: [
        { type: 'gt', args: ['x', 5] },
        { type: 'lt', args: ['x', 10] }
      ],
      query: {
        type: 'check-sat',
        goal: 'find if such a number exists'
      }
    }, null, 2)
  });

  prompt.addExample({
    question: 'Can p and q both be true if p implies not q?',
    program: JSON.stringify({
      variables: [
        { name: 'p', sort: 'Bool' },
        { name: 'q', sort: 'Bool' }
      ],
      constraints: [
        { type: 'eq', args: ['p', true] },
        { type: 'eq', args: ['q', true] },
        { type: 'implies', args: ['p', { type: 'not', args: ['q'] }] }
      ],
      query: {
        type: 'check-sat',
        goal: 'check if both can be true'
      }
    }, null, 2)
  });

  prompt.addExample({
    question: 'Find a real number between 0.5 and 1.5',
    program: JSON.stringify({
      variables: [
        { name: 'r', sort: 'Real' }
      ],
      constraints: [
        { type: 'gt', args: ['r', 0.5] },
        { type: 'lt', args: ['r', 1.5] }
      ],
      query: {
        type: 'check-sat',
        goal: 'find real number in range'
      }
    }, null, 2)
  });

  // Custom formatter for examples
  prompt.setExampleFormatter((example, index) => {
    return `Example ${index + 1}:\nQuestion: ${example.question}\nProgram:\n${example.program}`;
  });

  return prompt;
}
