#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

async function listRailwayProjects() {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    const RAILWAY_API_TOKEN = resourceManager.get('env.RAILWAY_API_TOKEN');
    
    console.log('🚂 Listing all Railway projects...\n');
    
    const query = `
        query {
            me {
                projects {
                    edges {
                        node {
                            id
                            name
                            createdAt
                            environments {
                                edges {
                                    node {
                                        id
                                        name
                                    }
                                }
                            }
                            services {
                                edges {
                                    node {
                                        id
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    `;
    
    try {
        const response = await fetch('https://backboard.railway.app/graphql/v2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });
        
        const result = await response.json();
        
        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            return;
        }
        
        const projects = result.data?.me?.projects?.edges || [];
        console.log(`Found ${projects.length} projects:\n`);
        
        for (const project of projects) {
            const p = project.node;
            console.log(`📁 ${p.name}`);
            console.log(`   ID: ${p.id}`);
            console.log(`   Created: ${new Date(p.createdAt).toLocaleString()}`);
            
            const services = p.services?.edges || [];
            if (services.length > 0) {
                console.log(`   Services: ${services.map(s => s.node.name).join(', ')}`);
            }
            console.log('');
        }
        
        // Also try alternate query structure
        console.log('\n🔍 Trying alternate query...\n');
        
        const altQuery = `
            query {
                viewer {
                    projects {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        `;
        
        const altResponse = await fetch('https://backboard.railway.app/graphql/v2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: altQuery })
        });
        
        const altResult = await altResponse.json();
        if (altResult.data?.viewer?.projects?.edges) {
            console.log('Alternate query found projects:', altResult.data.viewer.projects.edges.length);
        }
        
    } catch (error) {
        console.error('Error listing projects:', error);
    }
}

listRailwayProjects().catch(console.error);