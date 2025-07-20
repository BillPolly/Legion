#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import { execSync } from 'child_process';

console.log('🏥 Checking Deployment Health\n');

async function checkDeploymentHealth() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    const deployments = [
      {
        projectId: '2818aaab-210f-48eb-8654-8061eddee05a',
        projectName: 'my-live-website',
        serviceId: 'cf60d995-6af2-479c-b567-f1c655044c2c',
        url: 'https://web-production-77d64.up.railway.app'
      },
      {
        projectId: '40575eaf-f727-4955-9f5f-7ff4108e0123',
        projectName: 'my-public-website',
        serviceId: '119c4c5c-f560-43f9-8ff3-5c7a94dec6e9',
        url: 'https://my-public-website-production-54d3.up.railway.app'
      }
    ];
    
    for (const deployment of deployments) {
      console.log(`\n📦 ${deployment.projectName}`);
      console.log('─'.repeat(50));
      
      // 1. Check deployment status
      console.log('\n1️⃣ Checking deployment status...');
      
      const query = `
        query {
          project(id: "${deployment.projectId}") {
            name
            services {
              edges {
                node {
                  id
                  name
                  deployments(first: 3) {
                    edges {
                      node {
                        id
                        status
                        error
                        createdAt
                        finishedAt
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
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      
      if (data.data?.project) {
        const project = data.data.project;
        const service = project.services.edges.find(s => s.node.id === deployment.serviceId)?.node;
        
        if (service) {
          console.log(`Service: ${service.name}`);
          
          if (service.deployments.edges.length > 0) {
            console.log('\nRecent deployments:');
            service.deployments.edges.forEach((d, i) => {
              const dep = d.node;
              console.log(`  ${i + 1}. Status: ${dep.status}`);
              if (dep.error) {
                console.log(`     Error: ${dep.error}`);
              }
              console.log(`     Created: ${dep.createdAt}`);
              if (dep.finishedAt) {
                console.log(`     Finished: ${dep.finishedAt}`);
              }
            });
          }
        }
      }
      
      // 2. Get deployment logs
      console.log('\n2️⃣ Checking deployment logs...');
      
      const logsQuery = `
        query {
          project(id: "${deployment.projectId}") {
            deploymentLogs(
              filter: { 
                serviceId: "${deployment.serviceId}"
                limit: 20
              }
            ) {
              message
              timestamp
              severity
            }
          }
        }
      `;
      
      const logsResponse = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: logsQuery })
      });
      
      const logsData = await logsResponse.json();
      
      if (logsData.data?.project?.deploymentLogs?.length > 0) {
        console.log('\nRecent logs:');
        logsData.data.project.deploymentLogs.slice(0, 10).forEach(log => {
          console.log(`  [${log.severity}] ${log.message}`);
        });
      } else {
        console.log('No logs available');
      }
      
      // 3. CURL the URL
      console.log(`\n3️⃣ Testing URL: ${deployment.url}`);
      
      try {
        // First try a simple curl
        console.log('\nTrying curl...');
        const curlResult = execSync(`curl -sS -I -X GET "${deployment.url}" --max-time 10`, { encoding: 'utf8' });
        console.log('Response headers:');
        console.log(curlResult);
      } catch (error) {
        console.log('Curl failed:', error.message);
      }
      
      // Also try with fetch
      console.log('\nTrying fetch...');
      try {
        const response = await fetch(deployment.url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(10000)
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
          const text = await response.text();
          console.log(`Body preview: ${text.substring(0, 200)}...`);
        }
      } catch (error) {
        console.log('Fetch error:', error.message);
      }
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n💡 Diagnosis Summary:');
    console.log('- Bad Gateway (502) usually means the app is not running or not listening on the correct port');
    console.log('- Railway expects apps to listen on the PORT environment variable');
    console.log('- For Caddy, it should automatically use port 80/443');
    console.log('- Check if the Docker image is starting correctly');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

checkDeploymentHealth();