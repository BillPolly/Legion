#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🔍 VERIFYING ALL PROJECTS ARE DELETED\n');

async function verifyEmpty() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const railwayProvider = new RailwayProvider(resourceManager);
  
  // Check personal projects
  console.log('1️⃣ Checking personal projects...');
  const listResult = await railwayProvider.listProjects();
  
  if (listResult.success) {
    console.log(`   Found ${listResult.projects.length} projects`);
    if (listResult.projects.length > 0) {
      listResult.projects.forEach(p => console.log(`   - ${p.name} (${p.id})`));
    }
  }
  
  // Check team projects  
  console.log('\n2️⃣ Checking team projects...');
  const query = `
    query {
      teams {
        edges {
          node {
            id
            name
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
  
  if (data.data?.teams?.edges) {
    let totalTeamProjects = 0;
    data.data.teams.edges.forEach(teamEdge => {
      const team = teamEdge.node;
      const projectCount = team.projects.edges.length;
      totalTeamProjects += projectCount;
      if (projectCount > 0) {
        console.log(`   Team "${team.name}" has ${projectCount} projects:`);
        team.projects.edges.forEach(p => console.log(`   - ${p.node.name} (${p.node.id})`));
      }
    });
    if (totalTeamProjects === 0) {
      console.log('   No team projects found');
    }
  }
  
  console.log('\n━'.repeat(50));
  console.log('✅ Verification complete!');
}

verifyEmpty();