#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 Finding ALL Railway projects\n');

async function findAllProjects() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    // Query 1: Personal projects
    console.log('1️⃣ Checking personal projects...');
    let query = `
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
    
    let response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    let data = await response.json();
    console.log('Personal projects response:', JSON.stringify(data, null, 2));
    
    // Query 2: Team projects
    console.log('\n2️⃣ Checking team projects...');
    query = `
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
    console.log('Team projects response:', JSON.stringify(data, null, 2));
    
    // If we found team projects, let's generate domains for them
    if (data.data?.teams?.edges?.length > 0) {
      for (const teamEdge of data.data.teams.edges) {
        const team = teamEdge.node;
        console.log(`\n📂 Team: ${team.name}`);
        
        for (const projectEdge of team.projects.edges) {
          const project = projectEdge.node;
          console.log(`\n📁 Project: ${project.name} (${project.id})`);
          
          if (project.services?.edges?.length > 0 && project.environments?.edges?.length > 0) {
            const service = project.services.edges[0].node;
            const environment = project.environments.edges[0].node;
            
            console.log(`   Service: ${service.name} (${service.id})`);
            console.log(`   Environment: ${environment.name} (${environment.id})`);
            
            // Try to generate domain
            console.log(`   Generating domain...`);
            
            const mutation = `
              mutation {
                serviceDomainCreate(input: {
                  serviceId: "${service.id}"
                  environmentId: "${environment.id}"
                }) {
                  domain
                }
              }
            `;
            
            const domainResponse = await fetch('https://backboard.railway.app/graphql/v2', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ query: mutation })
            });
            
            const domainData = await domainResponse.json();
            
            if (domainData.data?.serviceDomainCreate?.domain) {
              console.log(`   ✅ Domain generated: https://${domainData.data.serviceDomainCreate.domain}`);
            } else if (domainData.errors) {
              console.log(`   ⚠️  Domain generation response:`, JSON.stringify(domainData, null, 2));
            }
          }
        }
      }
    }
    
    // Query 3: Try a different approach - get project by ID if we know it
    console.log('\n3️⃣ Checking known project IDs...');
    const knownProjectIds = [
      '2818aaab-210f-48eb-8654-8061eddee05a',
      '40575eaf-f727-4955-9f5f-7ff4108e0123'
    ];
    
    for (const projectId of knownProjectIds) {
      query = `
        query {
          project(id: "${projectId}") {
            id
            name
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
      
      if (data.data?.project) {
        const project = data.data.project;
        console.log(`\n✅ Found project: ${project.name} (${project.id})`);
        
        if (project.services?.edges?.length > 0 && project.environments?.edges?.length > 0) {
          const service = project.services.edges[0].node;
          const environment = project.environments.edges[0].node;
          
          console.log(`   Service: ${service.name} (${service.id})`);
          console.log(`   Environment: ${environment.name} (${environment.id})`);
          console.log(`   🌐 Your app should be at: https://${project.name}-production.up.railway.app`);
        }
      } else {
        console.log(`\n❌ Project ${projectId} not found or not accessible`);
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

findAllProjects();