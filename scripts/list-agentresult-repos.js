#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';

async function listAgentResultRepos() {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Setup GitHub
    resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    resourceManager.register('GITHUB_ORG', 'agentresult');
    resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));
    
    const moduleFactory = new ModuleFactory(resourceManager);
    const githubModule = moduleFactory.createModule(GitHubModule);
    const tools = githubModule.getTools();
    const githubTool = tools.find(tool => tool.name === 'github');
    
    console.log('📚 Listing repositories in agentresult organization...\n');
    
    try {
        // First, try AgentResults (with capital letters)
        let listResult = await githubTool.invoke({
            function: {
                name: 'github_list_org_repos',
                arguments: JSON.stringify({
                    org: 'AgentResults',
                    type: 'all',
                    sort: 'created',
                    per_page: 100
                })
            }
        });
        
        // If that fails, try lowercase version
        if (!listResult.success) {
            listResult = await githubTool.invoke({
                function: {
                    name: 'github_list_org_repos',
                    arguments: JSON.stringify({
                        org: 'agentresult',
                        type: 'all',
                        sort: 'created',
                        per_page: 100
                    })
                }
            });
        }
        
        if (listResult.success && listResult.data) {
            const repos = listResult.data.repositories || listResult.data || [];
            console.log(`Found ${repos.length} repositories in agentresult:\n`);
            
            // Sort by creation date (newest first)
            repos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Display all repos with details
            for (const repo of repos) {
                const isPrivate = repo.isPrivate ? '🔒' : '🌐';
                const date = new Date(repo.createdAt).toLocaleDateString();
                console.log(`  ${isPrivate} ${repo.name}`);
                console.log(`     Created: ${date}`);
                if (repo.description) {
                    console.log(`     Description: ${repo.description}`);
                }
                console.log(`     URL: https://github.com/agentresult/${repo.name}`);
                console.log('');
            }
            
            // Summary
            console.log(`\n📊 Summary:`);
            console.log(`   Total repositories: ${repos.length}`);
            const privateRepos = repos.filter(r => r.isPrivate).length;
            const publicRepos = repos.length - privateRepos;
            console.log(`   Public: ${publicRepos}`);
            console.log(`   Private: ${privateRepos}`);
            
        } else {
            console.log('No repositories found or error accessing organization.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Make sure you have access to the agentresult organization.');
    }
}

listAgentResultRepos().catch(console.error);