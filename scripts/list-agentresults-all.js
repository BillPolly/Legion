#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';

async function listAgentResultsRepos() {
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
    
    console.log('📚 Listing all repositories in AgentResults organization...\n');
    
    try {
        const listResult = await githubTool.invoke({
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
        
        if (listResult.success && listResult.data) {
            const repos = listResult.data.repositories || [];
            console.log(`Found ${repos.length} repositories:\n`);
            
            // Sort by creation date (newest first)
            repos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Display all repos with details
            for (const repo of repos) {
                const visibility = repo.private ? '🔒 Private' : '🌐 Public';
                const stars = repo.stargazersCount ? `⭐ ${repo.stargazersCount}` : '';
                const forks = repo.forksCount ? `🍴 ${repo.forksCount}` : '';
                const lang = repo.language ? `📝 ${repo.language}` : '';
                
                console.log(`${repo.name}`);
                console.log(`  ${visibility} ${stars} ${forks} ${lang}`.trim());
                if (repo.description) {
                    console.log(`  📄 ${repo.description}`);
                }
                console.log(`  🔗 ${repo.url}`);
                console.log(`  📅 Created: ${new Date(repo.createdAt).toLocaleDateString()}`);
                console.log(`  🔄 Updated: ${new Date(repo.updatedAt).toLocaleDateString()}`);
                console.log('');
            }
            
            // Summary statistics
            console.log('─'.repeat(50));
            console.log(`📊 Summary for AgentResults:\n`);
            console.log(`  Total repositories: ${repos.length}`);
            
            const privateCount = repos.filter(r => r.private).length;
            const publicCount = repos.length - privateCount;
            console.log(`  Public: ${publicCount}`);
            console.log(`  Private: ${privateCount}`);
            
            // Language breakdown
            const languages = {};
            repos.forEach(repo => {
                if (repo.language) {
                    languages[repo.language] = (languages[repo.language] || 0) + 1;
                }
            });
            
            if (Object.keys(languages).length > 0) {
                console.log(`\n  Languages:`);
                Object.entries(languages)
                    .sort((a, b) => b[1] - a[1])
                    .forEach(([lang, count]) => {
                        console.log(`    - ${lang}: ${count} repo${count > 1 ? 's' : ''}`);
                    });
            }
        } else {
            console.log('❌ Failed to retrieve repositories');
            if (listResult.error) {
                console.log('Error:', listResult.error);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

listAgentResultsRepos().catch(console.error);