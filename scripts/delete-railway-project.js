#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from '../packages/railway/src/providers/RailwayProvider.js';

async function deleteRailwayProject() {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayToken = resourceManager.get('env.RAILWAY_API_TOKEN');
    if (!railwayToken) {
        console.error('❌ RAILWAY_API_TOKEN not found in environment');
        return;
    }
    
    const projectId = 'ede6522b-1df3-44a4-928c-38627689ce9c'; // express-provider-test
    const projectName = 'express-provider-test';
    
    console.log(`🗑️  Deleting Railway project: ${projectName}\n`);
    
    try {
        const provider = new RailwayProvider(railwayToken);
        
        // Delete the project
        const deleteResult = await provider.deleteProject(projectId);
        
        if (deleteResult.success) {
            console.log('✅ Project deleted successfully!');
            console.log(deleteResult.message);
            
            // Wait a moment for the deletion to process
            console.log('\n⏳ Waiting for deletion to process...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // List projects again to verify
            console.log('\n📋 Verifying deletion - listing all projects:\n');
            const listResult = await provider.listProjects();
            
            if (listResult.success) {
                const projects = listResult.projects || [];
                if (projects.length === 0) {
                    console.log('✅ No projects found - deletion confirmed!');
                } else {
                    console.log(`Found ${projects.length} remaining project(s):`);
                    projects.forEach(project => {
                        console.log(`  - ${project.name} (${project.id})`);
                    });
                }
            }
        } else {
            console.error('❌ Failed to delete project:', deleteResult.error || 'Unknown error');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

deleteRailwayProject().catch(console.error);