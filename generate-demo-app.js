#!/usr/bin/env node
import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateDemoApp() {
    console.log('🚀 Generating demo web app using Code Agent...\n');
    
    try {
        // Initialize ResourceManager
        const resourceManager = new ResourceManager();
        await resourceManager.initialize();
        
        // Create module factory
        const factory = new ModuleFactory(resourceManager);
        
        // Load the code agent module from its module.json
        const moduleJsonPath = path.join(__dirname, 'packages/code-gen/code-agent/module.json');
        const codeAgentModule = await factory.createJsonModule(moduleJsonPath);
        
        // Get the develop_code tool
        const tools = await codeAgentModule.getTools();
        const developTool = tools.find(tool => tool.name === 'develop_code');
        
        if (!developTool) {
            throw new Error('Could not find develop_code tool in code agent module');
        }
        
        console.log('✅ Code Agent tool loaded successfully\n');
        
        // Define the task and requirements
        const task = 'Create a simple demonstration web application';
        
        const requirements = {
            frontend: `
                - Modern, responsive HTML page with clean design
                - Form with text input for entering messages
                - Submit button to send messages to server
                - Display area to show server responses
                - Professional CSS styling with gradients and shadows
                - Client-side JavaScript using fetch API
                - Loading states and error handling
            `,
            backend: `
                - Express.js server running on port 3001
                - POST endpoint /api/message to receive messages
                - Transform the message (reverse it and add timestamp)
                - Return JSON response with original and transformed message
                - CORS configuration for development
                - Basic error handling and validation
                - Health check endpoint at /api/health
            `,
            features: [
                'Real-time message transformation',
                'Clean error messages',
                'Responsive design',
                'Loading indicators',
                'Input validation'
            ]
        };
        
        // Set up working directory
        const workingDirectory = path.join(__dirname, 'generated', 'demo-webapp');
        
        // Create the tool call in OpenAI function format
        const toolCall = {
            id: `call_${uuidv4()}`,
            type: 'function',
            function: {
                name: 'develop_code',
                arguments: JSON.stringify({
                    workingDirectory,
                    task,
                    requirements,
                    projectType: 'fullstack',
                    config: {
                        skipTesting: false,
                        generateTests: true,
                        enableGit: false,
                        llmConfig: {
                            provider: 'anthropic',
                            apiKey: resourceManager.get('env.ANTHROPIC_API_KEY'),
                            model: 'claude-3-sonnet-20240229'
                        }
                    },
                    deploy: false
                })
            }
        };
        
        console.log('📋 Task:', task);
        console.log('📁 Output directory:', workingDirectory);
        console.log('🔧 Project type: fullstack\n');
        console.log('🏗️  Starting code generation...\n');
        
        // Invoke the tool
        const result = await developTool.invoke(toolCall);
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        console.log('\n✅ Code generation completed successfully!');
        console.log('\n📊 Generation Summary:');
        if (result.result) {
            console.log(JSON.stringify(result.result, null, 2));
        }
        
        console.log('\n🎉 Your demo web app is ready!');
        console.log('\n📍 Location: ./generated/demo-webapp');
        console.log('\n🚀 To run the application:');
        console.log('   1. cd generated/demo-webapp');
        console.log('   2. npm install');
        console.log('   3. npm start');
        console.log('\n   Then open http://localhost:3001 in your browser\n');
        
    } catch (error) {
        console.error('\n❌ Error generating demo app:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run the generation
generateDemoApp();