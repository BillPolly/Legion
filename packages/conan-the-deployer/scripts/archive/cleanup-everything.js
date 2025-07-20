#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🧹 CLEANING UP EVERYTHING\n');

async function cleanupEverything() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const railwayProvider = new RailwayProvider(resourceManager);
  
  // First, list all projects
  console.log('📊 Finding all projects to delete...\n');
  const listResult = await railwayProvider.listProjects();
  
  if (!listResult.success) {
    console.error('Failed to list projects:', listResult.error);
    return;
  }
  
  const projects = listResult.projects || [];
  console.log(`Found ${projects.length} projects to delete\n`);
  
  // Delete each project
  for (const project of projects) {
    console.log(`🗑️  Deleting project: ${project.name} (${project.id})`);
    const deleteResult = await railwayProvider.deleteProject(project.id);
    
    if (deleteResult.success) {
      console.log(`✅ Deleted successfully\n`);
    } else {
      console.log(`❌ Failed to delete: ${deleteResult.error}\n`);
    }
  }
  
  // Also check for any specific known projects
  const knownProjectIds = [
    '2818aaab-210f-48eb-8654-8061eddee05a',
    '40575eaf-f727-4955-9f5f-7ff4108e0123',
    '68970e34-0bfc-44ce-bd80-444f47b5d6b5'
  ];
  
  console.log('\n🔍 Checking known project IDs...\n');
  
  for (const projectId of knownProjectIds) {
    const query = `
      query {
        project(id: "${projectId}") {
          id
          name
        }
      }
    `;
    
    const response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${railwayProvider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    
    if (data.data?.project) {
      console.log(`Found project: ${data.data.project.name} (${projectId})`);
      console.log('Deleting...');
      const deleteResult = await railwayProvider.deleteProject(projectId);
      console.log(deleteResult.success ? '✅ Deleted' : `❌ Failed: ${deleteResult.error}`);
    }
  }
  
  console.log('\n━'.repeat(50));
  console.log('✅ Cleanup complete!');
}

cleanupEverything();