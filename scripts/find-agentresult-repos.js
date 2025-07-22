#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';

async function findAgentResultRepos() {
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
    
    console.log('🔍 Searching for agentresult organization repositories...\n');
    
    try {
        // List all user repos
        const listResult = await githubTool.invoke({
            function: {
                name: 'github_list_repos',
                arguments: JSON.stringify({
                    type: 'all',
                    sort: 'created',
                    per_page: 100
                })
            }
        });
        
        if (listResult.success && listResult.data) {
            const repos = listResult.data.repositories || listResult.data || [];
            
            // Filter for agentresult org repos
            const agentResultRepos = repos.filter(repo => 
                repo.owner.toLowerCase() === 'agentresult' ||
                repo.fullName?.toLowerCase().startsWith('agentresult/')
            );
            
            if (agentResultRepos.length > 0) {
                console.log(`Found ${agentResultRepos.length} repositories in agentresult organization:\n`);
                
                for (const repo of agentResultRepos) {
                    const visibility = repo.private ? '🔒 private' : '🌐 public';
                    const date = new Date(repo.createdAt).toLocaleDateString();
                    console.log(`  ${repo.name} (${visibility})`);
                    console.log(`     Owner: ${repo.owner}`);
                    console.log(`     Created: ${date}`);
                    console.log(`     URL: ${repo.url}`);
                    console.log('');
                }
            } else {
                console.log('No repositories found for agentresult organization.');
                console.log('\nChecking all repositories you have access to:');
                
                // Show unique owners
                const owners = [...new Set(repos.map(r => r.owner))];
                console.log(`\nUnique repository owners you have access to:`);
                owners.sort().forEach(owner => {
                    const count = repos.filter(r => r.owner === owner).length;
                    console.log(`  - ${owner} (${count} repos)`);
                });
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

findAgentResultRepos().catch(console.error);