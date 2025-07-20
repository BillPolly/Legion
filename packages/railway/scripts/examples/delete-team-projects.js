#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🗑️  DELETING ALL TEAM PROJECTS\n');

async function deleteTeamProjects() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const railwayProvider = new RailwayProvider(resourceManager);
  
  // The 3 projects found under team "bill234's Projects"
  const teamProjects = [
    { name: 'working-express-app', id: '2b4601d7-5813-4828-9f7a-77633a896c30' },
    { name: 'express-live-app', id: 'c6ab2e11-dc25-4d90-ae2b-73691f4e970c' },
    { name: 'conan-web-app', id: 'c0e63547-1f8c-4da1-9a27-6957487e3fc1' }
  ];
  
  console.log(`Found ${teamProjects.length} projects to delete:\n`);
  
  for (const project of teamProjects) {
    console.log(`🗑️  Deleting: ${project.name} (${project.id})`);
    const deleteResult = await railwayProvider.deleteProject(project.id);
    
    if (deleteResult.success) {
      console.log(`✅ Successfully deleted ${project.name}\n`);
    } else {
      console.log(`❌ Failed to delete ${project.name}: ${deleteResult.error}\n`);
    }
  }
  
  console.log('━'.repeat(50));
  console.log('✅ Deletion complete');
}

deleteTeamProjects();