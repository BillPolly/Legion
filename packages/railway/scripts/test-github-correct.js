#!/usr/bin/env node

// No imports needed for this script as it uses direct API calls

console.log('🧪 Testing GitHub Deployment with Correct Format\n');

async function testGitHubCorrect() {
  try {
    const apiKey = process.env.RAILWAY_API_KEY || process.env.RAILWAY;
    if (!apiKey) {
      throw new Error('RAILWAY_API_KEY or RAILWAY environment variable is required');
    }
    
    // Clean up previous attempts
    console.log('🧹 Cleaning up...');
    const deleteQuery = `
      mutation {
        projectDelete(id: "93b5f6ba-22c3-4222-a5fd-4daa090d8078")
      }
    `;
    
    await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: deleteQuery })
    });
    
    console.log('Cleaned\n');
    
    // Create project
    console.log('📦 Creating project...');
    const createProjectMutation = `
      mutation {
        projectCreate(input: {
          name: "github-test"
          description: "Testing GitHub deployment"
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
    console.log(`Project created: ${projectId}\n`);
    
    // Create service with the format shown in docs
    console.log('📦 Creating service with GitHub source...');
    const createServiceMutation = `
      mutation {
        serviceCreate(
          input: {
            projectId: "${projectId}"
            source: {
              repo: "railwayapp-templates/django"
            }
          }
        ) {
          id
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
    console.log('Service response:', JSON.stringify(data, null, 2));
    
    if (data.data?.serviceCreate?.id) {
      const serviceId = data.data.serviceCreate.id;
      console.log('✅ Service created!');
      
      // Get environment and generate domain
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
      
      // Generate domain
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
      
      if (data.data?.serviceDomainCreate?.domain) {
        const url = `https://${data.data.serviceDomainCreate.domain}`;
        console.log(`\n✅ Domain generated: ${url}`);
        console.log('\n🎉 GitHub deployment successful!');
      }
    } else {
      console.log('❌ Service creation failed');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testGitHubCorrect();