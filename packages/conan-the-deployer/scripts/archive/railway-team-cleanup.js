#!/usr/bin/env node

import { ResourceManager } from '../../../module-loader/src/index.js';

const resourceManager = new ResourceManager();
await resourceManager.initialize();
const RAILWAY_API_TOKEN = resourceManager.get('env.RAILWAY_API_TOKEN');

async function cleanupTeamProjects() {
  console.log('🔍 Checking Railway account INCLUDING TEAMS...\n');
  
  // Query for teams and their projects
  const query = `
    query {
      me {
        id
        email
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
                    createdAt
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
        }
      }
    }
  `;

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
    console.error('Error querying teams:', result.errors);
    return;
  }
  
  console.log('Account:', result.data.me.email);
  
  // Find all projects across all teams
  const projectsToDelete = [];
  
  if (result.data.me.teams?.edges) {
    for (const teamEdge of result.data.me.teams.edges) {
      const team = teamEdge.node;
      console.log(`\nTeam: ${team.name} (ID: ${team.id})`);
      
      if (team.projects?.edges?.length > 0) {
        console.log(`Found ${team.projects.edges.length} projects:`);
        
        for (const projectEdge of team.projects.edges) {
          const project = projectEdge.node;
          console.log(`  - ${project.name} (ID: ${project.id})`);
          
          if (project.services?.edges?.length > 0) {
            console.log(`    Services: ${project.services.edges.map(s => s.node.name).join(', ')}`);
          }
          
          projectsToDelete.push({
            id: project.id,
            name: project.name,
            teamName: team.name
          });
        }
      } else {
        console.log('  No projects in this team');
      }
    }
  }
  
  if (projectsToDelete.length === 0) {
    console.log('\n✅ No projects found to delete');
    return;
  }
  
  // Delete all projects
  console.log(`\n🗑️  Deleting ${projectsToDelete.length} projects...\n`);
  
  for (const project of projectsToDelete) {
    console.log(`Deleting "${project.name}" from team "${project.teamName}"...`);
    
    const deleteMutation = `
      mutation ProjectDelete($id: String!) {
        projectDelete(id: $id)
      }
    `;
    
    const deleteResponse = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: deleteMutation,
        variables: { id: project.id }
      })
    });
    
    const deleteResult = await deleteResponse.json();
    
    if (deleteResult.errors) {
      console.error(`  ❌ Failed: ${deleteResult.errors[0].message}`);
    } else {
      console.log(`  ✅ Deleted successfully`);
    }
  }
  
  // Verify deletion
  console.log('\n🔍 Verifying deletion...\n');
  
  const verifyResponse = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  
  const verifyResult = await verifyResponse.json();
  
  let remainingProjects = 0;
  if (verifyResult.data?.me?.teams?.edges) {
    for (const teamEdge of verifyResult.data.me.teams.edges) {
      const team = teamEdge.node;
      if (team.projects?.edges?.length > 0) {
        remainingProjects += team.projects.edges.length;
        console.log(`Team "${team.name}" still has ${team.projects.edges.length} projects`);
      }
    }
  }
  
  if (remainingProjects === 0) {
    console.log('\n✅ All projects successfully deleted!');
  } else {
    console.log(`\n⚠️  ${remainingProjects} projects still remain`);
  }
}

cleanupTeamProjects().catch(console.error);