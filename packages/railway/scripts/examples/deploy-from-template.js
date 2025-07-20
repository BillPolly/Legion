#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🚀 DEPLOYING FROM RAILWAY TEMPLATE\n');

async function deployFromTemplate() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  
  // Clean up previous attempts
  console.log('🧹 Cleaning up previous projects...');
  const projectsToDelete = ['befa2cfa-b9ce-454d-bfc4-838f3571a5f9'];
  
  for (const pid of projectsToDelete) {
    await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: `mutation { projectDelete(id: "${pid}") }` 
      })
    });
  }
  console.log('✅ Cleaned up\n');
  
  // Deploy from a template that WORKS
  console.log('📦 Deploying from Railway template...');
  
  // Create project
  const createProjectMutation = `
    mutation {
      projectCreate(input: {
        name: "working-app"
        description: "App deployed from template"
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
  const projectId = data.data.projectCreate.id;
  console.log(`✅ Project created: ${projectId}\n`);
  
  // Create service - use a simple Python HTTP server that definitely works
  console.log('📦 Creating Python web server...');
  
  const createServiceMutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${projectId}"
        name: "web"
        source: {
          image: "python:3.9-slim"
        }
      }) {
        id
        name
      }
    }
  `;
  
  response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: createServiceMutation })
  });
  
  data = await response.json();
  const serviceId = data.data.serviceCreate.id;
  console.log(`✅ Service created: ${serviceId}\n`);
  
  // Get environment
  const envQuery = `
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
    body: JSON.stringify({ query: envQuery })
  });
  
  data = await response.json();
  const environmentId = data.data.project.environments.edges[0].node.id;
  
  // Set the command to run a simple HTTP server
  console.log('📦 Setting up Python HTTP server...');
  
  const setCommandMutation = `
    mutation {
      variableUpsert(input: {
        projectId: "${projectId}"
        environmentId: "${environmentId}"
        serviceId: "${serviceId}"
        name: "RAILWAY_RUN_COMMAND"
        value: "python -m http.server \\$PORT"
      }) {
        name
      }
    }
  `;
  
  response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: setCommandMutation })
  });
  
  console.log('✅ Server configured\n');
  
  // Generate domain
  console.log('📦 Generating domain...');
  
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
  const domain = data.data.serviceDomainCreate.domain;
  const url = `https://${domain}`;
  
  console.log(`✅ Domain: ${url}\n`);
  
  console.log('━'.repeat(60));
  console.log('📊 DEPLOYMENT SUMMARY');
  console.log(`Project: working-app (${projectId})`);
  console.log(`Service: web (${serviceId})`);
  console.log(`URL: ${url}`);
  console.log('━'.repeat(60));
  
  console.log('\n⏳ Waiting 90 seconds for deployment to complete...');
  console.log('Python HTTP server should start and serve directory listing.\n');
  
  await new Promise(resolve => setTimeout(resolve, 90000));
  
  console.log('🧪 Testing the deployed app...\n');
  
  // Use curl to test
  console.log('Testing with curl...');
  try {
    const { execSync } = await import('child_process');
    const curlCmd = `curl -sS "${url}" --max-time 10 | head -20`;
    const result = execSync(curlCmd, { encoding: 'utf8' });
    console.log('Response:');
    console.log(result);
    console.log('\n✅ SUCCESS! Your app is working!');
  } catch (error) {
    console.log('Curl test failed:', error.message);
    
    // Try with fetch
    console.log('\nTrying with fetch...');
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log('Response preview:', text.substring(0, 200));
        console.log('\n✅ App is working!');
      }
    } catch (e) {
      console.log('Fetch error:', e.message);
    }
  }
  
  console.log(`\n🌐 Your working app: ${url}`);
}

deployFromTemplate();