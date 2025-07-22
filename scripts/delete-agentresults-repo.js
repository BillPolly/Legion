#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';

async function deleteRepo() {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Setup GitHub
    resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    resourceManager.register('GITHUB_ORG', resourceManager.get('env.GITHUB_ORG'));
    resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));
    
    const moduleFactory = new ModuleFactory(resourceManager);
    const githubModule = moduleFactory.createModule(GitHubModule);
    const tools = githubModule.getTools();
    const githubTool = tools.find(tool => tool.name === 'github');
    
    console.log('🗑️  Deleting test-express-railway from AgentResults...\n');
    
    try {
        const deleteResult = await githubTool.invoke({
            function: {
                name: 'github_delete_repo',
                arguments: JSON.stringify({
                    owner: 'AgentResults',
                    repo: 'test-express-railway'
                })
            }
        });
        
        if (deleteResult.success) {
            console.log('✅ Repository deleted successfully!');
            console.log(deleteResult.data.message);
        } else {
            console.log('❌ Failed to delete repository');
            if (deleteResult.error) {
                console.log('Error:', deleteResult.error);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

deleteRepo().catch(console.error);