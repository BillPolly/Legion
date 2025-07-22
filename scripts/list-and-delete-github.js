#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';

async function listAndDelete() {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Setup GitHub
    resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    resourceManager.register('GITHUB_ORG', resourceManager.get('env.GITHUB_ORG') || 'BillPolly');
    resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));
    
    const moduleFactory = new ModuleFactory(resourceManager);
    const githubModule = moduleFactory.createModule(GitHubModule);
    const tools = githubModule.getTools();
    const githubTool = tools.find(tool => tool.name === 'github');
    
    console.log('📚 Listing GitHub repositories...\n');
    
    try {
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
        
        console.log('List result:', JSON.stringify(listResult, null, 2));
        
        if (listResult.success && listResult.data) {
            const repos = listResult.data.repositories || listResult.data || [];
            console.log(`\nFound ${repos.length} repositories:\n`);
            
            // Show all repos
            for (const repo of repos) {
                console.log(`  - ${repo.owner}/${repo.name} (created: ${new Date(repo.createdAt).toLocaleDateString()})`);
            }
            
            // Look for agent-generated repos
            console.log('\n🔍 Agent-generated repos:');
            const agentRepos = repos.filter(repo => 
                repo.name.includes('demo-webapp') || 
                repo.name.includes('test-app') || 
                repo.name.includes('generated') ||
                repo.name.includes('example') ||
                repo.name.includes('express-provider')
            );
            
            if (agentRepos.length > 0) {
                console.log('\nFound repos to delete:');
                for (const repo of agentRepos) {
                    console.log(`  🗑️  ${repo.owner}/${repo.name}`);
                }
                
                console.log('\nDeleting...');
                for (const repo of agentRepos) {
                    try {
                        const deleteResult = await githubTool.invoke({
                            function: {
                                name: 'github_delete_repo',
                                arguments: JSON.stringify({
                                    owner: repo.owner,
                                    repo: repo.name
                                })
                            }
                        });
                        console.log(`✅ Deleted: ${repo.owner}/${repo.name}`);
                    } catch (error) {
                        console.error(`❌ Failed to delete ${repo.name}: ${error.message}`);
                    }
                }
            } else {
                console.log('✅ No agent-generated repos found');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

listAndDelete().catch(console.error);