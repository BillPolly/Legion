/**
 * SimpleNodeTestStrategy - Strategy for testing simple Node.js applications
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';
import path from 'path';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createSimpleNodeTestStrategy = createTypedStrategy(
  'simple-node-test',                                    // Strategy type for prompt path resolution
  ['file_write', 'file_read', 'command_executor'],       // Required tools (loaded at construction)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    analyzeCode: 'analyzeCode',
    generateTest: 'generateTest', 
    generateTestConfig: 'generateTestConfig'
  },
  {
    projectRoot: '/tmp/roma-projects'                    // Additional config
  }
);

// Export default for backward compatibility
export default createSimpleNodeTestStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createSimpleNodeTestStrategy.doWork = async function doWork() {
  console.log(`🧪 Generating tests for: ${this.description}`);
  
  // Get code to test (from artifacts or description)
  const codeToTest = await getCodeToTest(this);
  if (!codeToTest) {
    return this.failWithError(new Error('No code found to test'), 'Cannot proceed without code to test');
  }
  
  // Analyze code for testing using declarative prompt (schema in YAML frontmatter)
  const analysisPrompt = this.getPrompt('analyzeCode');
  const analysisResult = await analysisPrompt.execute({ code: codeToTest });
  
  if (!analysisResult.success) {
    return this.failWithError(
      new Error(`Failed to analyze code: ${analysisResult.errors?.join(', ')}`),
      'Code analysis step failed'
    );
  }
  
  const analysis = analysisResult.data;
  this.addConversationEntry('system', `Found ${analysis.testTargets.length} test targets`);
  
  // Generate tests for each target
  const tests = [];
  const testPrompt = this.getPrompt('generateTest');
  
  for (const target of analysis.testTargets) {
    const edgeCasesStr = (analysis.edgeCases || []).map(e => `- ${e}`).join('\n');
    
    const testResult = await testPrompt.execute({
      targetName: target.name,
      targetType: target.type,
      targetDescription: target.description,
      edgeCases: edgeCasesStr
    });
    
    if (!testResult.success) {
      return this.failWithError(
        new Error(`Failed to generate test: ${testResult.errors?.join(', ')}`),
        `Test generation failed for target: ${target.name}`
      );
    }
    
    tests.push(testResult.data);
  }
  
  // Write test files and create test configuration
  const testDir = await setupTestDirectory(this.config);
  const testFiles = await writeTestFiles(tests, testDir, this.config);
  const configResult = await generateTestConfig(testFiles, this);
  
  if (!configResult.success) {
    return this.failWithError(configResult.error, 'Test configuration generation failed');
  }
  
  const testConfig = configResult.data;
  
  // Store test configuration
  await this.config.tools.file_write.execute({ 
    filepath: path.join(testDir, 'jest.config.js'), 
    content: `module.exports = ${JSON.stringify(testConfig.jestConfig, null, 2)};` 
  });
  
  // Run tests if requested
  let testResults = null;
  if (this.description.includes('run') || this.description.includes('execute')) {
    testResults = await runTests(testDir, this.config);
  }
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
  const artifacts = {};
  testFiles.forEach((filename, i) => {
    artifacts[filename] = {
      value: tests[i].testCode,
      description: tests[i].testDescription,
      type: 'file'
    };
  });
  
  artifacts['jest.config.js'] = {
    value: `module.exports = ${JSON.stringify(testConfig.jestConfig, null, 2)};`,
    description: 'Jest test configuration',
    type: 'file'
  };
  
  this.completeWithArtifacts(artifacts, {
    success: true,
    message: `Generated ${tests.length} test files`,
    testDir: testDir,
    testFiles: testFiles,
    testResults: testResults
  });
};

// ============================================================================
// Helper functions - now much simpler since all boilerplate is handled
// ============================================================================

async function getCodeToTest(task) {
  // Try to get requirements from artifacts first
  const artifacts = task.getAllArtifacts();
  for (const artifact of Object.values(artifacts)) {
    if (artifact.type === 'file' && artifact.name.endsWith('.js')) {
      return artifact.value;
    }
  }
  
  // Try to extract file path from description
  const fileMatch = task.description.match(/test\s+(.+\.js)/i);
  if (fileMatch && task.config.tools.file_read) {
    try {
      const result = await task.config.tools.file_read.execute({ filepath: fileMatch[1] });
      return result.content;
    } catch (error) {
      console.log(`Could not read file ${fileMatch[1]}: ${error.message}`);
    }
  }
  
  // Fall back to task description
  return task.description || 'Create tests for this code';
}

async function setupTestDirectory(config) {
  const timestamp = Date.now();
  const testDirName = `node-tests-${timestamp}`;
  const testDir = path.join(config.projectRoot, testDirName);
  
  await config.tools.file_write.execute({ 
    filepath: path.join(testDir, '.gitkeep'), 
    content: '' 
  });
  
  return testDir;
}

async function writeTestFiles(tests, testDir, config) {
  const testFiles = [];
  
  for (let i = 0; i < tests.length; i++) {
    const testFilename = `test-${i + 1}.test.js`;
    const testPath = path.join(testDir, testFilename);
    await config.tools.file_write.execute({ 
      filepath: testPath, 
      content: tests[i].testCode 
    });
    testFiles.push(testFilename);
  }
  
  return testFiles;
}

async function generateTestConfig(testFiles, task) {
  const configPrompt = task.getPrompt('generateTestConfig');
  
  const result = await configPrompt.execute({
    testFiles: testFiles.join(', ')
  });
  
  if (!result.success) {
    // Helper functions can't call this.failWithError, so return error object
    return { 
      success: false, 
      error: new Error(`Failed to generate test config: ${result.errors?.join(', ')}`)
    };
  }
  
  return { success: true, data: result.data };
}

async function runTests(testDir, config) {
  if (!config.tools.command_executor) {
    return null;
  }
  
  try {
    // Install Jest first
    await config.tools.command_executor.execute({
      command: 'npm init -y && npm install --save-dev jest',
      cwd: testDir
    });
    
    // Run tests
    const result = await config.tools.command_executor.execute({
      command: 'npx jest',
      cwd: testDir
    });
    
    return {
      success: result.success,
      output: result.output,
      exitCode: result.exitCode
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
