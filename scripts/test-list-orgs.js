#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';

async function testListOrgs() {
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
    
    console.log('📚 Testing GitHub list organizations...\n');
    
    try {
        // Test listing organizations
        const orgsResult = await githubTool.invoke({
            function: {
                name: 'github_list_orgs',
                arguments: JSON.stringify({
                    per_page: 100
                })
            }
        });
        
        console.log('Organizations Result:', JSON.stringify(orgsResult, null, 2));
        
        if (orgsResult.success && orgsResult.data) {
            const orgs = orgsResult.data.organizations || [];
            console.log(`\nFound ${orgs.length} organizations:\n`);
            
            for (const org of orgs) {
                console.log(`  - ${org.login}`);
                if (org.description) {
                    console.log(`    Description: ${org.description}`);
                }
                console.log('');
            }
            
            // Test listing repos for the first organization
            if (orgs.length > 0) {
                console.log(`\n📂 Testing list repos for organization: ${orgs[0].login}\n`);
                
                const reposResult = await githubTool.invoke({
                    function: {
                        name: 'github_list_org_repos',
                        arguments: JSON.stringify({
                            org: orgs[0].login,
                            type: 'all',
                            sort: 'created',
                            per_page: 10
                        })
                    }
                });
                
                if (reposResult.success && reposResult.data) {
                    const repos = reposResult.data.repositories || [];
                    console.log(`Found ${repos.length} repositories in ${orgs[0].login}:\n`);
                    
                    for (const repo of repos) {
                        const visibility = repo.private ? '🔒' : '🌐';
                        console.log(`  ${visibility} ${repo.name}`);
                        if (repo.description) {
                            console.log(`     ${repo.description}`);
                        }
                        console.log(`     Created: ${new Date(repo.createdAt).toLocaleDateString()}`);
                        console.log('');
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testListOrgs().catch(console.error);