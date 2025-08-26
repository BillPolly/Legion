/**
 * Quick LLM debug test with mock response
 */

import { extractJSON } from '@legion/planner/src/utils/json-parser.js';

describe('Quick LLM Debug', () => {
  test('show what LLM would generate', async () => {
    // This is what a correct plan should look like
    const correctPlan = {
      "type": "sequence",
      "id": "hello-world-program",
      "description": "Create and run a hello world JavaScript program",
      "children": [
        {
          "type": "action",
          "id": "write-hello-js",
          "tool": "file_write",
          "description": "Write hello world JavaScript file",
          "outputs": {
            "filepath": "jsFilePath",
            "bytesWritten": "fileBytes",
            "created": "fileCreated"
          },
          "inputs": {
            "filepath": "hello.js",
            "content": "console.log('Hello, World!');"
          }
        },
        {
          "type": "condition",
          "id": "verify-file",
          "check": "context.artifacts['fileCreated'] === true",
          "description": "Verify file was created"
        },
        {
          "type": "action",
          "id": "run-program",
          "tool": "run_node",
          "description": "Execute the hello world program",
          "outputs": {
            "exitCode": "programExitCode",
            "stdout": "programOutput"
          },
          "inputs": {
            "projectPath": ".",
            "command": "node hello.js"
          }
        }
      ]
    };
    
    console.log('=== CORRECT PLAN STRUCTURE ===');
    console.log(JSON.stringify(correctPlan, null, 2));
    
    // Simulate what LLM might generate based on the prompt
    const llmResponse = `I'll create a behavior tree to write and execute a simple hello world JavaScript program.

\`\`\`json
${JSON.stringify(correctPlan, null, 2)}
\`\`\`

This plan:
1. Writes a hello.js file with a simple console.log statement
2. Verifies the file was created successfully
3. Executes the program using Node.js`;

    console.log('\n=== SIMULATED LLM RESPONSE ===');
    console.log(llmResponse);
    
    // Test JSON extraction
    const extracted = extractJSON(llmResponse);
    console.log('\n=== EXTRACTED JSON ===');
    console.log(JSON.stringify(extracted, null, 2));
    
    expect(extracted).toBeDefined();
    expect(extracted.type).toBe('sequence');
    expect(extracted.children).toHaveLength(3);
  });
});