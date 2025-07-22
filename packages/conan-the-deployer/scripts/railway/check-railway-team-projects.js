#!/usr/bin/env node

import { ResourceManager } from '@legion/module-loader';

console.log('🚂 RAILWAY TEAM PROJECTS DETAILED CHECK\n');

async function makeGraphQLRequest(apiKey, query, variables = {}) {
  try {
    const response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });
    
    const responseText = await response.text();
    
    try {
      const data = JSON.parse(responseText);
      
      if (data.errors) {
        console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
        return { error: data.errors[0]?.message || 'GraphQL error', data: null };
      }
      
      return { error: null, data: data.data };
    } catch (e) {
      console.error('Failed to parse response:', responseText);
      return { error: 'Invalid response', data: null };
    }
  } catch (error) {
    return { error: error.message, data: null };
  }
}

async function checkTeamProjects() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY_API_TOKEN') || 
                 resourceManager.get('env.RAILWAY');
  
  if (!apiKey) {
    console.error('❌ No Railway API key found!');
    process.exit(1);
  }
  
  console.log('✅ Railway API key found\n');
  
  // 1. Get teams with projects
  console.log('📋 FETCHING TEAM PROJECTS\n');
  
  const teamsQuery = `
    query {
      me {
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
                          createdAt
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
  
  const { error: teamsError, data: teamsData } = await makeGraphQLRequest(apiKey, teamsQuery);
  
  if (teamsError) {
    console.error('❌ Failed to get teams:', teamsError);
    return;
  }
  
  console.log(`👤 User: ${teamsData.me.email}\n`);
  
  const teams = teamsData.me.teams.edges.map(edge => edge.node);
  
  for (const team of teams) {
    console.log(`\n🏢 Team: ${team.name}`);
    console.log(`   ID: ${team.id}`);
    
    const projects = team.projects.edges.map(edge => edge.node);
    console.log(`   Projects: ${projects.length}\n`);
    
    for (const project of projects) {
      console.log(`\n   📦 Project: ${project.name}`);
      console.log(`      ID: ${project.id}`);
      console.log(`      Created: ${new Date(project.createdAt).toLocaleString()}`);
      
      const services = project.services.edges.map(edge => edge.node);
      console.log(`      Services: ${services.length}`);
      
      if (services.length > 0) {
        for (const service of services) {
          console.log(`\n      🔧 Service: ${service.name}`);
          console.log(`         ID: ${service.id}`);
          console.log(`         Created: ${new Date(service.createdAt).toLocaleString()}`);
          
          // Try to get more service details
          console.log('\n         Fetching service details...');
          
          const serviceQuery = `
            query($serviceId: String!) {
              service(id: $serviceId) {
                id
                name
                source {
                  repo
                  image
                }
                deployments(first: 10) {
                  edges {
                    node {
                      id
                      status
                      createdAt
                      url
                      staticUrl
                    }
                  }
                }
              }
            }
          `;
          
          const { error: serviceError, data: serviceData } = await makeGraphQLRequest(
            apiKey,
            serviceQuery,
            { serviceId: service.id }
          );
          
          if (serviceError) {
            console.log(`         ❌ Failed to get service details: ${serviceError}`);
            
            // Try alternative query
            const altQuery = `
              query {
                deployments(serviceId: "${service.id}") {
                  edges {
                    node {
                      id
                      status
                      createdAt
                    }
                  }
                }
              }
            `;
            
            const { error: altError, data: altData } = await makeGraphQLRequest(apiKey, altQuery);
            
            if (!altError && altData?.deployments) {
              const deployments = altData.deployments.edges.map(e => e.node);
              console.log(`         Deployments found: ${deployments.length}`);
              if (deployments.length > 0) {
                console.log(`         Latest: ${deployments[0].status} - ${new Date(deployments[0].createdAt).toLocaleString()}`);
              }
            }
          } else if (serviceData?.service) {
            const svc = serviceData.service;
            
            if (svc.source) {
              if (svc.source.repo) {
                console.log(`         Source: GitHub - ${svc.source.repo}`);
              } else if (svc.source.image) {
                console.log(`         Source: Docker - ${svc.source.image}`);
              }
            }
            
            const deployments = svc.deployments.edges.map(e => e.node);
            console.log(`         Deployments: ${deployments.length}`);
            
            if (deployments.length > 0) {
              const latest = deployments[0];
              console.log(`\n         Latest Deployment:`);
              console.log(`           Status: ${latest.status}`);
              console.log(`           Created: ${new Date(latest.createdAt).toLocaleString()}`);
              if (latest.url || latest.staticUrl) {
                console.log(`           URL: ${latest.url || latest.staticUrl}`);
              }
            }
          }
          
          // Try to get domains
          console.log('\n         Checking for domains...');
          
          // First get project environments
          const envQuery = `
            query {
              project(id: "${project.id}") {
                environments {
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
          
          const { error: envError, data: envData } = await makeGraphQLRequest(apiKey, envQuery);
          
          if (!envError && envData?.project?.environments?.edges?.length > 0) {
            const environmentId = envData.project.environments.edges[0].node.id;
            
            const domainsQuery = `
              query($serviceId: String!, $environmentId: String!) {
                domains(serviceId: $serviceId, environmentId: $environmentId) {
                  serviceDomains {
                    domain
                  }
                  customDomains {
                    domain
                    status
                  }
                }
              }
            `;
            
            const { error: domainError, data: domainData } = await makeGraphQLRequest(
              apiKey,
              domainsQuery,
              { serviceId: service.id, environmentId }
            );
            
            if (!domainError && domainData?.domains) {
              const serviceDomains = domainData.domains.serviceDomains || [];
              const customDomains = domainData.domains.customDomains || [];
              
              if (serviceDomains.length > 0) {
                console.log('         Railway Domains:');
                serviceDomains.forEach(d => {
                  console.log(`           - https://${d.domain}`);
                });
              }
              
              if (customDomains.length > 0) {
                console.log('         Custom Domains:');
                customDomains.forEach(d => {
                  console.log(`           - ${d.domain} (${d.status})`);
                });
              }
              
              if (serviceDomains.length === 0 && customDomains.length === 0) {
                console.log('         No domains configured');
              }
            } else {
              console.log('         Could not fetch domain information');
            }
          }
        }
      } else {
        console.log('      No services in this project');
      }
    }
  }
  
  console.log('\n\n✨ Team projects check complete!');
}

// Run the check
checkTeamProjects().catch(console.error);