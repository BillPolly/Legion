#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from '../packages/railway/src/providers/RailwayProvider.js';

async function listRailwayProjects() {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayToken = resourceManager.get('env.RAILWAY_API_TOKEN');
    if (!railwayToken) {
        console.error('❌ RAILWAY_API_TOKEN not found in environment');
        return;
    }
    
    console.log('🚂 Listing all Railway projects using RailwayProvider...\n');
    
    try {
        const provider = new RailwayProvider(railwayToken);
        const result = await provider.listProjects();
        
        if (result.success) {
            const projects = result.projects || [];
            console.log(`Found ${projects.length} projects across all teams:\n`);
            
            // Group projects by team
            const projectsByTeam = {};
            projects.forEach(project => {
                const teamName = project.teamName || 'Personal Projects';
                if (!projectsByTeam[teamName]) {
                    projectsByTeam[teamName] = [];
                }
                projectsByTeam[teamName].push(project);
            });
            
            // Display projects grouped by team
            Object.entries(projectsByTeam).forEach(([teamName, teamProjects]) => {
                console.log(`📁 ${teamName} (${teamProjects.length} projects)`);
                console.log('─'.repeat(50));
                
                teamProjects.forEach(project => {
                    console.log(`\n  📦 ${project.name}`);
                    if (project.description) {
                        console.log(`     ${project.description}`);
                    }
                    console.log(`     ID: ${project.id}`);
                    console.log(`     Created: ${new Date(project.createdAt).toLocaleDateString()}`);
                    
                    if (project.services && project.services.length > 0) {
                        console.log(`     Services:`);
                        project.services.forEach(service => {
                            console.log(`       - ${service.name} (${service.id})`);
                        });
                    }
                });
                console.log('');
            });
            
            // Summary
            console.log('─'.repeat(50));
            console.log(`📊 Summary:`);
            console.log(`   Total projects: ${projects.length}`);
            console.log(`   Teams: ${Object.keys(projectsByTeam).length}`);
            
            // List all teams
            console.log(`\n   Teams:`);
            Object.entries(projectsByTeam).forEach(([teamName, teamProjects]) => {
                console.log(`     - ${teamName}: ${teamProjects.length} project${teamProjects.length !== 1 ? 's' : ''}`);
            });
        } else {
            console.error('❌ Failed to list projects:', result.error || 'Unknown error');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

listRailwayProjects().catch(console.error);