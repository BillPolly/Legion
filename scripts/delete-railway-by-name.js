#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from '../packages/railway/src/providers/RailwayProvider.js';

async function deleteByName(projectName) {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    const railwayToken = resourceManager.get('env.RAILWAY_API_TOKEN');
    const railway = new RailwayProvider(railwayToken);
    
    console.log(`🚂 Looking for project: ${projectName}\n`);
    
    // First, let's try a more comprehensive query
    const query = `
        query {
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
    `;
    
    try {
        const result = await railway.makeGraphQLRequest(query);
        console.log('Raw result:', JSON.stringify(result, null, 2));
        
        if (result.success && result.data?.projects?.edges) {
            const projects = result.data.projects.edges;
            const project = projects.find(p => p.node.name === projectName);
            
            if (project) {
                console.log(`Found project: ${project.node.name} (${project.node.id})`);
                console.log('Deleting...');
                
                const deleteResult = await railway.deleteProject(project.node.id);
                if (deleteResult.success) {
                    console.log('✅ Project deleted successfully');
                } else {
                    console.error('❌ Failed to delete project:', deleteResult);
                }
            } else {
                console.log('❌ Project not found');
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

deleteByName('express-provider-test').catch(console.error);