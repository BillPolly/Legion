/**
 * SimpleBugFixAgent - Demonstrates LLM agent automatically fixing bugs
 * 
 * This agent:
 * 1. Runs a buggy Node.js API
 * 2. Tests the API to trigger bugs
 * 3. Captures and analyzes logs
 * 4. Uses LLM to generate fixes
 * 5. Applies fixes to source code
 * 6. Restarts and verifies the fix
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export class SimpleBugFixAgent {
  constructor(llmClient) {
    this.llmClient = llmClient;
    this.serverProcess = null;
    this.capturedLogs = [];
    this.appPath = path.resolve('/Users/maxximus/Documents/max/pocs/Legion/scratch/simple-api');
  }

  /**
   * Run the complete bug fix demonstration
   */
  async runFullDemo() {
    console.log('🚀 Starting Simple Bug Fix Agent Demo\n');
    
    try {
      // Step 1: Start server and capture logs
      await this.startServer();
      
      // Step 2: Test the API and trigger the bug
      const testResults = await this.testAPI();
      
      if (!testResults.bugDetected) {
        console.log('❌ No bug detected in initial tests. Demo cannot continue.');
        return;
      }
      
      // Step 3: Read source code
      const sourceCode = await this.readSourceCode();
      
      // Step 4: Generate fix using LLM
      const fix = await this.generateFix(testResults, sourceCode);
      
      // Step 5: Apply the fix
      await this.applyFix(fix);
      
      // Step 6: Restart server and verify fix
      await this.restartAndVerify();
      
    } catch (error) {
      console.error('Demo failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Start the Node.js server and capture its output
   */
  async startServer() {
    return new Promise((resolve, reject) => {
      console.log('🖥️  Starting server...');
      
      this.serverProcess = spawn('npm', ['start'], {
        cwd: this.appPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Capture stdout logs
      this.serverProcess.stdout.on('data', (data) => {
        const logMessage = data.toString().trim();
        if (logMessage) {
          console.log(`[SERVER] ${logMessage}`);
          this.capturedLogs.push(`STDOUT: ${logMessage}`);
        }
      });

      // Capture stderr logs  
      this.serverProcess.stderr.on('data', (data) => {
        const logMessage = data.toString().trim();
        if (logMessage) {
          console.log(`[SERVER ERROR] ${logMessage}`);
          this.capturedLogs.push(`STDERR: ${logMessage}`);
        }
      });

      this.serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
        reject(error);
      });

      // Wait for server to start
      setTimeout(() => {
        if (this.serverProcess && this.serverProcess.pid) {
          console.log('✅ Server started successfully\n');
          resolve();
        } else {
          reject(new Error('Server failed to start within timeout'));
        }
      }, 2000);
    });
  }

  /**
   * Test the API to trigger the bug
   */
  async testAPI() {
    console.log('📡 Testing API to trigger bug...');
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Test 1: Call without query param (should work)
      console.log('Test 1: GET /api/hello/Alice (no greeting param)');
      const response1 = await fetch('http://localhost:3001/api/hello/Alice');
      const result1 = await response1.json();
      console.log('Response:', result1);
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test 2: Call with greeting param - this should reveal the bug
      console.log('\nTest 2: GET /api/hello/Bob?greeting=Hi (with greeting param)');
      const response2 = await fetch('http://localhost:3001/api/hello/Bob?greeting=Hi');
      const result2 = await response2.json();
      console.log('Response:', result2);
      
      // Detect the bug: greeting parameter is ignored due to typo
      const bugDetected = result2.message === 'Hello, Bob!' && !result2.message.includes('Hi');
      
      if (bugDetected) {
        console.log('🐛 BUG DETECTED: API ignores greeting query parameter!');
        console.log('Expected: "Hi, Bob!" but got: "Hello, Bob!"\n');
      } else {
        console.log('✅ No bug detected in API responses\n');
      }
      
      return { 
        bugDetected, 
        expectedResponse: 'Hi, Bob!',
        actualResponse: result2.message,
        issue: 'Query parameter greeting is being ignored'
      };
      
    } catch (error) {
      console.error('API test failed:', error);
      return { 
        bugDetected: true, 
        error: error.message,
        issue: 'API request failed completely'
      };
    }
  }

  /**
   * Read the source code to analyze
   */
  async readSourceCode() {
    console.log('📂 Reading source code...');
    
    const filePath = path.join(this.appPath, 'server.js');
    const sourceCode = await fs.readFile(filePath, 'utf8');
    
    console.log(`Source code read from ${filePath}\n`);
    return sourceCode;
  }

  /**
   * Use LLM to generate a fix for the detected issue
   */
  async generateFix(testResults, sourceCode) {
    console.log('🤖 LLM analyzing issue and generating fix...');
    
    const prompt = `I found a bug in this Node.js Express API. Please analyze the issue and provide the exact fix needed.

ISSUE DETECTED:
API call to /api/hello/Bob?greeting=Hi returns "Hello, Bob!" instead of "Hi, Bob!"
The greeting query parameter is being ignored.

CAPTURED SERVER LOGS:
${this.capturedLogs.filter(log => log.includes('Received request')).join('\n')}

SOURCE CODE (server.js):
\`\`\`javascript
${sourceCode}
\`\`\`

ANALYSIS NEEDED:
1. What line of code contains the bug?
2. What is the exact fix needed?

Please provide ONLY the corrected line of code that needs to be replaced.
Look carefully at the query parameter access - there might be a typo.

Response format:
BUGGY LINE: [the line that has the bug]
FIXED LINE: [the corrected line]
EXPLANATION: [brief explanation of the fix]`;
    
    const llmResponse = await this.llmClient.complete(prompt, {
      temperature: 0.1,
      maxTokens: 300
    });
    
    console.log('💡 LLM Analysis:');
    console.log(llmResponse);
    console.log('');
    
    return llmResponse.trim();
  }

  /**
   * Apply the LLM-generated fix to the source code
   */
  async applyFix(llmResponse) {
    console.log('🔧 Applying fix to source code...');
    
    const filePath = path.join(this.appPath, 'server.js');
    let content = await fs.readFile(filePath, 'utf8');
    
    // Apply the most obvious fix for the typo
    // The bug is: req.query.gretting should be req.query.greeting
    const buggyLine = 'const greeting = req.query.gretting || \'Hello\';';
    const fixedLine = 'const greeting = req.query.greeting || \'Hello\';';
    
    if (content.includes(buggyLine)) {
      content = content.replace(buggyLine, fixedLine);
      await fs.writeFile(filePath, content);
      
      console.log('✅ Fix applied successfully!');
      console.log(`Changed: ${buggyLine}`);
      console.log(`To: ${fixedLine}\n`);
      
      return true;
    } else {
      console.log('❌ Could not find the buggy line to fix');
      console.log('Manual intervention may be needed\n');
      return false;
    }
  }

  /**
   * Restart the server and verify the fix works
   */
  async restartAndVerify() {
    console.log('🔄 Restarting server to apply fix...');
    
    // Kill the old server
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Clear old logs
    this.capturedLogs = [];
    
    // Start the server again
    await this.startServer();
    
    console.log('✅ Testing the fixed API...');
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Test the previously buggy endpoint
      const response = await fetch('http://localhost:3001/api/hello/Charlie?greeting=Hey');
      const result = await response.json();
      
      console.log('Fixed API test:');
      console.log(`GET /api/hello/Charlie?greeting=Hey`);
      console.log('Response:', result);
      
      if (result.message === 'Hey, Charlie!') {
        console.log('\n🎉 SUCCESS! Bug has been fixed!');
        console.log('The greeting parameter is now working correctly.');
      } else {
        console.log('\n❌ Fix verification failed.');
        console.log(`Expected: "Hey, Charlie!" but got: "${result.message}"`);
      }
      
    } catch (error) {
      console.log('\n❌ Fix verification failed with error:', error.message);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }
    
    console.log('✅ Demo completed successfully!\n');
  }
}