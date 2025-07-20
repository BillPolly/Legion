#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 FINDING ALL PROJECTS INCLUDING TEAM PROJECTS\n');

async function findAllProjectsCorrectly() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  
  // 1. Get user info and personal projects
  console.log('1️⃣ Getting user info and personal projects...\n');
  
  let query = `
    query {
      me {
        id
        name
        email
        teams {
          edges {
            node {
              id
              name
            }
          }
        }
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
  
  let response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });
  
  let data = await response.json();
  
  if (data.data?.me) {
    console.log(`User: ${data.data.me.email}`);
    console.log(`Personal projects: ${data.data.me.projects.edges.length}`);
    
    if (data.data.me.projects.edges.length > 0) {
      console.log('\nPersonal Projects:');
      data.data.me.projects.edges.forEach(edge => {
        console.log(`  - ${edge.node.name} (${edge.node.id})`);
      });
    }
    
    // Check teams
    if (data.data.me.teams?.edges?.length > 0) {
      console.log(`\nTeams found: ${data.data.me.teams.edges.length}`);
      
      for (const teamEdge of data.data.me.teams.edges) {
        const team = teamEdge.node;
        console.log(`\n2️⃣ Checking team: ${team.name} (${team.id})`);
        
        // Get team projects
        const teamQuery = `
          query {
            team(id: "${team.id}") {
              id
              name
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
        
        const teamResponse = await fetch('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: teamQuery })
        });
        
        const teamData = await teamResponse.json();
        
        if (teamData.data?.team?.projects?.edges) {
          const teamProjects = teamData.data.team.projects.edges;
          console.log(`   Found ${teamProjects.length} projects in team ${team.name}:`);
          
          teamProjects.forEach(edge => {
            console.log(`   - ${edge.node.name} (${edge.node.id})`);
          });
        }
      }
    } else {
      console.log('\nNo teams found');
    }
  }
  
  // Also try a direct approach - just list all accessible projects
  console.log('\n\n3️⃣ Trying direct project listing...\n');
  
  query = `
    query {
      projects {
        edges {
          node {
            id
            name
            team {
              id
              name
            }
          }
        }
      }
    }
  `;
  
  response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });
  
  data = await response.json();
  
  if (data.data?.projects?.edges) {
    console.log(`Found ${data.data.projects.edges.length} projects total:`);
    data.data.projects.edges.forEach(edge => {
      const project = edge.node;
      const location = project.team ? `Team: ${project.team.name}` : 'Personal';
      console.log(`  - ${project.name} (${project.id}) - ${location}`);
    });
  } else if (data.errors) {
    console.log('Direct project query failed:', data.errors[0]?.message);
  }
}

findAllProjectsCorrectly();