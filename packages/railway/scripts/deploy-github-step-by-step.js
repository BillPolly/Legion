#!/usr/bin/env node

import { RailwayProvider } from '../src/index.js';
import { execSync } from 'child_process';

console.log('🚂 Railway GitHub Deployment - Step by Step\n');
console.log('Following the plan in RAILWAY_DEPLOYMENT_PLAN.md\n');

async function deployStepByStep() {
  let projectId, serviceId, environmentId, domain, url;
  
  try {
    const apiKey = process.env.RAILWAY_API_KEY || process.env.RAILWAY;
    if (!apiKey) {
      throw new Error('RAILWAY_API_KEY or RAILWAY environment variable is required');
    }
    const railwayProvider = new RailwayProvider(apiKey);
    
    // STEP 1: Create Railway Project
    console.log('━'.repeat(60));
    console.log('STEP 1: Create Railway Project');
    console.log('━'.repeat(60));
    
    const createProjectMutation = `
      mutation {
        projectCreate(input: {
          name: "test-express-app"
          description: "Testing GitHub deployment via API"
        }) {
          id
          name
        }
      }
    `;
    
    let response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: createProjectMutation })
    });
    
    let data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.data?.projectCreate?.id) {
      projectId = data.data.projectCreate.id;
      console.log(`✅ SUCCESS: Project created with ID: ${projectId}\n`);
    } else {
      console.log('❌ FAILED: No project ID returned');
      console.log('STOPPING as per plan.');
      return;
    }
    
    // STEP 2: Create Service with GitHub Source
    console.log('━'.repeat(60));
    console.log('STEP 2: Create Service with GitHub Source');
    console.log('━'.repeat(60));
    
    // Use the RailwayProvider to create the service properly
    console.log('Using RailwayProvider.createService method...');
    const serviceConfig = {
      name: 'web',
      source: 'github',
      repo: 'railwayapp-templates/express-starter',
      branch: 'main'
    };
    
    const serviceResult = await railwayProvider.createService(projectId, serviceConfig);
    
    if (serviceResult.success && serviceResult.service?.id) {
      serviceId = serviceResult.service.id;
      console.log(`✅ SUCCESS: Service created with ID: ${serviceId}\n`);
    } else {
      console.log('❌ FAILED: No service ID returned');
      console.log('Error:', serviceResult.error);
      console.log('STOPPING as per plan.');
      return;
    }
    
    // STEP 3: Get Environment ID
    console.log('━'.repeat(60));
    console.log('STEP 3: Get Environment ID');
    console.log('━'.repeat(60));
    
    const getEnvironmentQuery = `
      query {
        project(id: "${projectId}") {
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
    
    response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: getEnvironmentQuery })
    });
    
    data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.data?.project?.environments?.edges?.[0]?.node?.id) {
      environmentId = data.data.project.environments.edges[0].node.id;
      console.log(`✅ SUCCESS: Environment ID: ${environmentId}\n`);
    } else {
      console.log('❌ FAILED: No environment found');
      console.log('STOPPING as per plan.');
      return;
    }
    
    // STEP 4: Generate Public Domain
    console.log('━'.repeat(60));
    console.log('STEP 4: Generate Public Domain');
    console.log('━'.repeat(60));
    
    const generateDomainMutation = `
      mutation {
        serviceDomainCreate(input: {
          serviceId: "${serviceId}"
          environmentId: "${environmentId}"
        }) {
          domain
        }
      }
    `;
    
    response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: generateDomainMutation })
    });
    
    data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.data?.serviceDomainCreate?.domain) {
      domain = data.data.serviceDomainCreate.domain;
      url = `https://${domain}`;
      console.log(`✅ SUCCESS: Domain generated: ${url}\n`);
    } else {
      console.log('❌ FAILED: No domain returned');
      console.log('STOPPING as per plan.');
      return;
    }
    
    // STEP 5: Wait for Deployment
    console.log('━'.repeat(60));
    console.log('STEP 5: Wait for Deployment');
    console.log('━'.repeat(60));
    console.log('Waiting 60 seconds for Railway to:');
    console.log('- Clone the GitHub repo');
    console.log('- Run Nixpacks build');
    console.log('- Start the container\n');
    
    for (let i = 60; i > 0; i -= 10) {
      console.log(`${i} seconds remaining...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // STEP 6: Check Deployment Status
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 6: Check Deployment Status');
    console.log('━'.repeat(60));
    
    const checkDeploymentQuery = `
      query {
        service(id: "${serviceId}") {
          deployments(first: 1) {
            edges {
              node {
                id
                status
                error
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
      body: JSON.stringify({ query: checkDeploymentQuery })
    });
    
    data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    const deployment = data.data?.service?.deployments?.edges?.[0]?.node;
    if (deployment) {
      console.log(`Deployment Status: ${deployment.status}`);
      if (deployment.error) {
        console.log(`Deployment Error: ${deployment.error}`);
      }
      
      if (deployment.status === 'SUCCESS') {
        console.log('✅ Deployment successful!\n');
      } else if (deployment.status === 'FAILED' || deployment.error) {
        console.log('❌ FAILED: Deployment failed');
        console.log('STOPPING as per plan.');
        return;
      } else {
        console.log('⚠️  Deployment still in progress, continuing to test...\n');
      }
    }
    
    // STEP 7: Test the URL
    console.log('━'.repeat(60));
    console.log('STEP 7: Test the URL');
    console.log('━'.repeat(60));
    console.log(`Testing URL: ${url}\n`);
    
    try {
      console.log('Testing with curl -I...');
      const curlResult = execSync(`curl -I "${url}" --max-time 10`, { encoding: 'utf8' });
      console.log(curlResult);
      
      // Check if we got a 200 response
      if (curlResult.includes('HTTP/2 200') || curlResult.includes('HTTP/1.1 200')) {
        console.log('✅ SUCCESS: Got HTTP 200 response!');
        console.log(`\n🎉 DEPLOYMENT SUCCESSFUL!`);
        console.log(`Your app is live at: ${url}`);
      } else if (curlResult.includes('502')) {
        console.log('❌ FAILED: Got 502 Bad Gateway');
        console.log('App is not ready or failed to start.');
        console.log('STOPPING as per plan.');
      } else {
        console.log('⚠️  Got unexpected response. Check the output above.');
      }
    } catch (error) {
      console.log('❌ FAILED: curl command failed');
      console.log('Error:', error.message);
      console.log('STOPPING as per plan.');
    }
    
    // Final summary
    console.log('\n' + '━'.repeat(60));
    console.log('DEPLOYMENT SUMMARY');
    console.log('━'.repeat(60));
    console.log(`Project ID: ${projectId}`);
    console.log(`Service ID: ${serviceId}`);
    console.log(`Environment ID: ${environmentId}`);
    console.log(`URL: ${url}`);
    console.log('━'.repeat(60));
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error.message);
    console.log('STOPPING due to error.');
  }
}

deployStepByStep();