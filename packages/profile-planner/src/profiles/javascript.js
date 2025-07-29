/**
 * JavaScript Development Profile
 * 
 * Pre-configured environment for JavaScript/Node.js development tasks
 * Includes file operations, Node.js execution, and testing capabilities
 */

export const JavascriptProfile = {
  name: 'javascript',
  description: 'JavaScript and Node.js development environment with testing and file operations',
  
  // Modules that should be loaded for this profile (user loads them via module_load)
  requiredModules: [
    'file',           // File operations (read, write, create directories)
    'node-runner'     // Node.js execution capabilities
  ],
  
  // High-level actions that can be used in plans
  allowableActions: [
    // File Operations
    {
      type: 'create_js_file',
      inputs: ['file_path', 'content'],
      outputs: ['file_created'],
      description: 'Create a JavaScript file with given content'
    },
    {
      type: 'read_js_file', 
      inputs: ['file_path'],
      outputs: ['file_content'],
      description: 'Read contents of a JavaScript file'
    },
    {
      type: 'create_package_json',
      inputs: ['project_name', 'dependencies'],
      outputs: ['package_json_created'],
      description: 'Create a package.json file for a Node.js project'
    },
    {
      type: 'create_test_file',
      inputs: ['test_file_path', 'function_to_test'],
      outputs: ['test_file_created'],
      description: 'Create a Jest test file for a JavaScript function'
    },
    
    // Node.js Operations
    {
      type: 'install_npm_packages',
      inputs: ['package_names'],
      outputs: ['packages_installed'],
      description: 'Install npm packages using npm install'
    },
    {
      type: 'run_node_script',
      inputs: ['script_path'],
      outputs: ['script_output'],
      description: 'Execute a Node.js script and capture output'
    },
    {
      type: 'run_npm_test',
      inputs: ['test_pattern'],
      outputs: ['test_results'],
      description: 'Run npm test command and capture results'
    },
    {
      type: 'run_javascript_code',
      inputs: ['js_code'],
      outputs: ['execution_result'],
      description: 'Execute JavaScript code directly and return result'
    },
    
    // Project Structure
    {
      type: 'create_project_structure',
      inputs: ['project_name'],
      outputs: ['project_created'],
      description: 'Create basic Node.js project structure with directories'
    },
    {
      type: 'setup_testing_environment',
      inputs: ['testing_framework'],
      outputs: ['testing_setup'],
      description: 'Set up testing environment (Jest, Mocha, etc.)'
    }
  ],
  
  // Context prompts to help the LLM understand the environment
  contextPrompts: [
    'You are working in a JavaScript/Node.js development environment.',
    'Use modern JavaScript ES6+ syntax including const/let, arrow functions, and modules.',
    'When creating functions, include proper JSDoc comments.',
    'For testing, use Jest as the testing framework unless specified otherwise.',
    'Test files should be named with .test.js suffix.',
    'Follow Node.js best practices for file organization.',
    'Include error handling in your code.',
    'When creating package.json, include appropriate scripts for testing and running code.',
    'Use Legion tools: file_write for creating files, file_read for reading files, node_run_command for executing commands.'
  ],
  
  // Default inputs and outputs for most JavaScript tasks
  defaultInputs: ['user_request', 'project_context'],
  defaultOutputs: ['completed_task', 'created_files', 'test_results'],
  
  // Output mapping - how individual action outputs map to plan outputs
  outputMapping: {
    'completed_task': ['project_created', 'file_created', 'test_results'], // Any file/project creation indicates task completion
    'created_files': ['file_created', 'project_created'], // File creation actions
    'test_results': ['test_results'] // Direct mapping
  },
  
  // Maximum number of steps for plans in this profile
  maxSteps: 25,
  
  // Common patterns and templates
  templates: {
    simpleFunction: `/**
 * {{FUNCTION_DESCRIPTION}}
 * @param {{PARAM_TYPE}} {{PARAM_NAME}} - {{PARAM_DESCRIPTION}}
 * @returns {{RETURN_TYPE}} {{RETURN_DESCRIPTION}}
 */
function {{FUNCTION_NAME}}({{PARAM_NAME}}) {
  // TODO: Implement function logic
  return {{DEFAULT_RETURN}};
}

module.exports = { {{FUNCTION_NAME}} };`,
    
    testFile: `const { {{FUNCTION_NAME}} } = require('./{{SOURCE_FILE}}');

describe('{{FUNCTION_NAME}}', () => {
  test('{{TEST_DESCRIPTION}}', () => {
    // Arrange
    const input = {{TEST_INPUT}};
    const expected = {{EXPECTED_OUTPUT}};
    
    // Act
    const result = {{FUNCTION_NAME}}(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});`,
    
    packageJson: `{
  "name": "{{PROJECT_NAME}}",
  "version": "1.0.0",
  "description": "{{PROJECT_DESCRIPTION}}",
  "main": "index.js",
  "scripts": {
    "test": "jest",
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`
  }
};

export default JavascriptProfile;