#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';
import RailwayProvider from '../packages/railway/src/providers/RailwayProvider.js';

async function cleanup() {
    console.log('🧹 Starting cleanup...\n');
    
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Setup GitHub
    console.log('📚 Checking GitHub repositories...');
    resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    resourceManager.register('GITHUB_ORG', resourceManager.get('env.GITHUB_ORG') || 'BillPolly');
    resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));
    
    const moduleFactory = new ModuleFactory(resourceManager);
    const githubModule = moduleFactory.createModule(GitHubModule);
    const tools = githubModule.getTools();
    const githubTool = tools.find(tool => tool.name === 'github');
    
    // List user repos
    try {
        const listResult = await githubTool.invoke({
            function: {
                name: 'github_list_user_repos',
                arguments: JSON.stringify({})
            }
        });
        
        if (listResult.success && listResult.data) {
            const repos = listResult.data.repositories || listResult.data;
            console.log(`Found ${repos.length} repositories\n`);
            
            // Look for agent-generated repos
            const agentRepos = repos.filter(repo => 
                repo.name.includes('demo-webapp') || 
                repo.name.includes('test-app') || 
                repo.name.includes('generated') ||
                repo.name.includes('example')
            );
            
            if (agentRepos.length > 0) {
                console.log('Found agent-generated repos to delete:');
                for (const repo of agentRepos) {
                    console.log(`  - ${repo.owner}/${repo.name}`);
                }
                
                console.log('\n🗑️  Deleting GitHub repos...');
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
                console.log('✅ No agent-generated GitHub repos found');
            }
        }
    } catch (error) {
        console.error('❌ Failed to list GitHub repos:', error.message);
    }
    
    // Check Railway projects
    console.log('\n🚂 Checking Railway projects...');
    const railwayToken = resourceManager.get('env.RAILWAY_API_TOKEN');
    const railway = new RailwayProvider(railwayToken);
    
    // List projects
    const query = `
        query {
            me {
                projects {
                    edges {
                        node {
                            id
                            name
                            createdAt
                        }
                    }
                }
            }
        }
    `;
    
    try {
        const result = await railway.makeGraphQLRequest(query);
        if (result.success && result.data?.me?.projects?.edges) {
            const projects = result.data.me.projects.edges;
            console.log(`Found ${projects.length} Railway projects\n`);
            
            // Look for demo projects
            const demoProjects = projects.filter(p => 
                p.node.name.includes('demo-webapp') || 
                p.node.name.includes('test-app') ||
                p.node.name.includes('generated')
            );
            
            if (demoProjects.length > 0) {
                console.log('Found demo projects to delete:');
                for (const project of demoProjects) {
                    console.log(`  - ${project.node.name} (${project.node.id})`);
                }
                
                console.log('\n🗑️  Deleting Railway projects...');
                for (const project of demoProjects) {
                    try {
                        const deleteResult = await railway.deleteProject(project.node.id);
                        if (deleteResult.success) {
                            console.log(`✅ Deleted: ${project.node.name}`);
                        } else {
                            console.error(`❌ Failed to delete ${project.node.name}`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to delete ${project.node.name}: ${error.message}`);
                    }
                }
            } else {
                console.log('✅ No demo Railway projects found');
            }
        }
    } catch (error) {
        console.error('❌ Failed to list Railway projects:', error.message);
    }
    
    console.log('\n✅ Cleanup complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    cleanup().catch(console.error);
}