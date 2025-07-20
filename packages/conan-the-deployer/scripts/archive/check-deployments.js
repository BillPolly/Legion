#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 Checking All Railway Deployments (Personal & Team)\n');

async function checkDeployments() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    // Check personal projects
    console.log('📊 Checking personal projects...');
    
    let query = `
      query {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              services {
                edges {
                  node {
                    id
                    name
                    deployments(first: 1) {
                      edges {
                        node {
                          id
                          status
                          url
                          staticUrl
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
    
    let response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    let data = await response.json();
    
    if (data.data?.projects?.edges?.length > 0) {
      console.log(`Found ${data.data.projects.edges.length} personal project(s)`);
      data.data.projects.edges.forEach(edge => {
        const project = edge.node;
        console.log(`\n📁 ${project.name} (${project.id})`);
        project.services.edges.forEach(serviceEdge => {
          const service = serviceEdge.node;
          console.log(`  └─ ${service.name} (${service.id})`);
          const deployment = service.deployments.edges[0]?.node;
          if (deployment) {
            console.log(`     Status: ${deployment.status}`);
            if (deployment.url || deployment.staticUrl) {
              console.log(`     URL: ${deployment.url || deployment.staticUrl}`);
            }
          }
        });
      });
    } else {
      console.log('No personal projects found');
    }
    
    // Check team projects
    console.log('\n\n📊 Checking team projects...');
    
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
                    description
                    createdAt
                    services {
                      edges {
                        node {
                          id
                          name
                          deployments(first: 1) {
                            edges {
                              node {
                                id
                                status
                                url
                                staticUrl
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
    
    if (data.data?.teams?.edges?.length > 0) {
      data.data.teams.edges.forEach(teamEdge => {
        const team = teamEdge.node;
        console.log(`\nTeam: ${team.name} (${team.id})`);
        
        if (team.projects.edges.length > 0) {
          console.log(`Found ${team.projects.edges.length} team project(s)`);
          team.projects.edges.forEach(edge => {
            const project = edge.node;
            console.log(`\n📁 ${project.name} (${project.id})`);
            project.services.edges.forEach(serviceEdge => {
              const service = serviceEdge.node;
              console.log(`  └─ ${service.name} (${service.id})`);
              const deployment = service.deployments.edges[0]?.node;
              if (deployment) {
                console.log(`     Status: ${deployment.status}`);
                if (deployment.url || deployment.staticUrl) {
                  console.log(`     URL: ${deployment.url || deployment.staticUrl}`);
                }
              }
            });
          });
        } else {
          console.log('No projects in this team');
        }
      });
    } else {
      console.log('No teams found');
    }
    
    // Check for domains
    console.log('\n\n🌐 Checking for generated domains...');
    
    query = `
      query {
        me {
          projects {
            edges {
              node {
                id
                name
                environments {
                  edges {
                    node {
                      id
                      name
                      serviceInstances {
                        edges {
                          node {
                            id
                            domains {
                              serviceDomains {
                                domain
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
    
    if (data.data?.me?.projects?.edges?.length > 0) {
      console.log('\nDomains found:');
      data.data.me.projects.edges.forEach(projectEdge => {
        const project = projectEdge.node;
        project.environments.edges.forEach(envEdge => {
          const env = envEdge.node;
          env.serviceInstances.edges.forEach(siEdge => {
            const si = siEdge.node;
            if (si.domains?.serviceDomains?.length > 0) {
              console.log(`\n📁 ${project.name} (${env.name})`);
              si.domains.serviceDomains.forEach(domain => {
                console.log(`  🌐 https://${domain.domain}`);
              });
            }
          });
        });
      });
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

checkDeployments();