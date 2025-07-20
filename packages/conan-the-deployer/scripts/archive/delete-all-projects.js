#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🗑️  DELETING ALL RAILWAY PROJECTS\n');

async function deleteAllProjects() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const railwayProvider = new RailwayProvider(resourceManager);
  
  // Get all projects
  console.log('📊 Finding all projects...\n');
  const listResult = await railwayProvider.listProjects();
  
  if (listResult.success && listResult.projects.length > 0) {
    console.log(`Found ${listResult.projects.length} projects to delete:\n`);
    
    for (const project of listResult.projects) {
      console.log(`Deleting: ${project.name} (${project.id})`);
      const deleteResult = await railwayProvider.deleteProject(project.id);
      console.log(deleteResult.success ? '✅ Deleted' : `❌ Failed: ${deleteResult.error}`);
      console.log();
    }
  } else {
    console.log('No projects found in personal account.');
  }
  
  // Also check specific known IDs
  const knownIds = [
    '52d2f5b7-38f0-42e8-9488-6b991d18cb03'  // The last one we created
  ];
  
  console.log('\nChecking known project IDs...\n');
  
  for (const id of knownIds) {
    const query = `
      query {
        project(id: "${id}") {
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
      console.log(`Found: ${data.data.project.name} (${id})`);
      const deleteResult = await railwayProvider.deleteProject(id);
      console.log(deleteResult.success ? '✅ Deleted' : `❌ Failed: ${deleteResult.error}`);
    } else {
      console.log(`Project ${id} not found or already deleted`);
    }
  }
  
  console.log('\n━'.repeat(50));
  console.log('✅ All projects deleted');
}

deleteAllProjects();