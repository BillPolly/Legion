#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🚂 COMPLETE RAILWAY INFRASTRUCTURE CHECK\n');

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
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return { error: data.errors[0]?.message || 'GraphQL error', data: null };
    }
    
    return { error: null, data: data.data };
  } catch (error) {
    return { error: error.message, data: null };
  }
}

async function checkCompleteRailwayInfrastructure() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY_API_TOKEN') || 
                 resourceManager.get('env.RAILWAY');
  
  if (!apiKey) {
    console.error('❌ No Railway API key found! Set RAILWAY_API_TOKEN or RAILWAY environment variable.');
    process.exit(1);
  }
  
  console.log('✅ Railway API key found\n');
  
  // 1. Get user info and teams
  console.log('1️⃣ USER INFORMATION AND TEAMS\n');
  
  const userQuery = `
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
              createdAt
            }
          }
        }
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
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const { error: userError, data: userData } = await makeGraphQLRequest(apiKey, userQuery);
  
  if (userError) {
    console.error('❌ Failed to get user info:', userError);
    return;
  }
  
  const user = userData.me;
  console.log(`👤 User: ${user.name || 'N/A'} (${user.email})`);
  console.log(`   User ID: ${user.id}`);
  
  const personalProjects = user.projects.edges.map(edge => edge.node);
  console.log(`\n📁 Personal Projects: ${personalProjects.length}`);
  if (personalProjects.length > 0) {
    personalProjects.forEach(project => {
      console.log(`   - ${project.name} (${project.id})`);
      console.log(`     Services: ${project.services.edges.length}`);
    });
  }
  
  const teams = user.teams.edges.map(edge => edge.node);
  console.log(`\n🏢 Teams: ${teams.length}`);
  teams.forEach(team => {
    console.log(`   - ${team.name} (${team.id})`);
    console.log(`     Created: ${new Date(team.createdAt).toLocaleString()}`);
  });
  
  // 2. Get all team projects
  console.log('\n\n2️⃣ TEAM PROJECTS DETAILS\n');
  
  const allProjects = [...personalProjects]; // Start with personal projects
  
  for (const team of teams) {
    console.log(`\n📂 Team: ${team.name}`);
    console.log(`─────────────────────────────────────`);
    
    const teamQuery = `
      query($teamId: String!) {
        team(id: $teamId) {
          id
          name
          projects {
            edges {
              node {
                id
                name
                description
                createdAt
                updatedAt
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
                      createdAt
                      updatedAt
                      deployments(first: 10) {
                        edges {
                          node {
                            id
                            status
                            createdAt
                            completedAt
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
    `;
    
    const { error: teamError, data: teamData } = await makeGraphQLRequest(
      apiKey, 
      teamQuery, 
      { teamId: team.id }
    );
    
    if (teamError) {
      console.error(`❌ Failed to get team projects: ${teamError}`);
      continue;
    }
    
    if (teamData?.team?.projects?.edges) {
      const teamProjects = teamData.team.projects.edges.map(edge => edge.node);
      console.log(`Found ${teamProjects.length} projects in team ${team.name}:\n`);
      
      // Add team projects to allProjects array
      teamProjects.forEach(project => {
        allProjects.push({ ...project, teamName: team.name });
      });
      
      // Display team projects
      for (const project of teamProjects) {
        console.log(`📦 Project: ${project.name}`);
        console.log(`   ID: ${project.id}`);
        console.log(`   Description: ${project.description || 'None'}`);
        console.log(`   Created: ${new Date(project.createdAt).toLocaleString()}`);
        console.log(`   Environments: ${project.environments.edges.length}`);
        project.environments.edges.forEach(envEdge => {
          console.log(`     - ${envEdge.node.name} (${envEdge.node.id})`);
        });
        
        const services = project.services.edges.map(edge => edge.node);
        console.log(`   Services: ${services.length}`);
        
        if (services.length > 0) {
          for (const service of services) {
            console.log(`\n   🔧 Service: ${service.name}`);
            console.log(`      ID: ${service.id}`);
            console.log(`      Created: ${new Date(service.createdAt).toLocaleString()}`);
            
            const deployments = service.deployments.edges.map(edge => edge.node);
            console.log(`      Total Deployments: ${deployments.length}`);
            
            if (deployments.length > 0) {
              // Show latest deployment
              const latest = deployments[0];
              console.log(`\n      📍 Latest Deployment:`);
              console.log(`         ID: ${latest.id}`);
              console.log(`         Status: ${latest.status}`);
              console.log(`         Created: ${new Date(latest.createdAt).toLocaleString()}`);
              if (latest.completedAt) {
                console.log(`         Completed: ${new Date(latest.completedAt).toLocaleString()}`);
              }
              if (latest.url || latest.staticUrl) {
                console.log(`         URL: ${latest.url || latest.staticUrl}`);
              }
              
              // Show deployment history
              if (deployments.length > 1) {
                console.log(`\n      📊 Deployment History:`);
                deployments.slice(1, 5).forEach((dep, idx) => {
                  console.log(`         ${idx + 2}. ${dep.status} - ${new Date(dep.createdAt).toLocaleString()}`);
                });
                if (deployments.length > 5) {
                  console.log(`         ... and ${deployments.length - 5} more deployments`);
                }
              }
            }
            
            // Check for domains
            const environmentId = project.environments.edges[0]?.node.id;
            if (environmentId) {
              const domainsQuery = `
                query($serviceId: String!, $environmentId: String!) {
                  domains(serviceId: $serviceId, environmentId: $environmentId) {
                    serviceDomains {
                      domain
                    }
                    customDomains {
                      id
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
                
                if (serviceDomains.length > 0 || customDomains.length > 0) {
                  console.log(`\n      🌐 Domains:`);
                  serviceDomains.forEach(d => {
                    console.log(`         Railway: https://${d.domain}`);
                  });
                  customDomains.forEach(d => {
                    console.log(`         Custom: ${d.domain} (${d.status})`);
                  });
                }
              }
            }
          }
        }
        console.log('\n   ─────────────────────────────────────');
      }
    }
  }
  
  // 3. Summary statistics
  console.log('\n\n3️⃣ SUMMARY STATISTICS\n');
  
  let totalServices = 0;
  let totalDeployments = 0;
  let deploymentsByStatus = {};
  let activeServices = [];
  
  allProjects.forEach(project => {
    project.services.edges.forEach(serviceEdge => {
      const service = serviceEdge.node;
      totalServices++;
      
      let hasActiveDeployment = false;
      service.deployments.edges.forEach(deploymentEdge => {
        const deployment = deploymentEdge.node;
        totalDeployments++;
        deploymentsByStatus[deployment.status] = (deploymentsByStatus[deployment.status] || 0) + 1;
        
        if (deployment.status === 'SUCCESS' && (deployment.url || deployment.staticUrl)) {
          hasActiveDeployment = true;
          activeServices.push({
            projectName: project.name,
            serviceName: service.name,
            url: deployment.url || deployment.staticUrl,
            teamName: project.teamName || 'Personal'
          });
        }
      });
    });
  });
  
  console.log(`📊 Infrastructure Overview:`);
  console.log(`   Total Teams: ${teams.length}`);
  console.log(`   Total Projects: ${allProjects.length}`);
  console.log(`     - Personal: ${personalProjects.length}`);
  console.log(`     - Team: ${allProjects.length - personalProjects.length}`);
  console.log(`   Total Services: ${totalServices}`);
  console.log(`   Total Deployments: ${totalDeployments}`);
  console.log(`   Active Services: ${activeServices.length}`);
  
  if (Object.keys(deploymentsByStatus).length > 0) {
    console.log(`\n📈 Deployments by Status:`);
    Object.entries(deploymentsByStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        const percentage = ((count / totalDeployments) * 100).toFixed(1);
        console.log(`   ${status}: ${count} (${percentage}%)`);
      });
  }
  
  // 4. List all active services with URLs
  if (activeServices.length > 0) {
    console.log('\n\n4️⃣ ACTIVE SERVICES WITH LIVE URLS\n');
    
    activeServices.forEach((service, idx) => {
      console.log(`${idx + 1}. ${service.projectName} / ${service.serviceName}`);
      console.log(`   Location: ${service.teamName}`);
      console.log(`   URL: ${service.url}`);
      console.log('');
    });
  } else {
    console.log('\n\n4️⃣ No active services with live URLs found.');
  }
  
  // 5. Check for any issues
  console.log('\n5️⃣ HEALTH CHECK\n');
  
  let failedDeployments = 0;
  let crashedDeployments = 0;
  
  Object.entries(deploymentsByStatus).forEach(([status, count]) => {
    if (status === 'FAILED') failedDeployments = count;
    if (status === 'CRASHED') crashedDeployments = count;
  });
  
  if (failedDeployments > 0 || crashedDeployments > 0) {
    console.log('⚠️  Issues detected:');
    if (failedDeployments > 0) console.log(`   - ${failedDeployments} failed deployments`);
    if (crashedDeployments > 0) console.log(`   - ${crashedDeployments} crashed deployments`);
  } else {
    console.log('✅ No deployment issues detected');
  }
  
  console.log('\n✨ Railway infrastructure check complete!');
}

// Run the check
checkCompleteRailwayInfrastructure().catch(console.error);