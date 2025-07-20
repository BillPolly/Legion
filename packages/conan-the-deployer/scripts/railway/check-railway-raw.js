#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🚂 RAW RAILWAY API CHECK\n');

async function checkRailwayRaw() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY_API_TOKEN') || 
                 resourceManager.get('env.RAILWAY');
  
  if (!apiKey) {
    console.error('❌ No Railway API key found!');
    process.exit(1);
  }
  
  console.log('✅ Railway API key found\n');
  
  // Test different queries to see what works
  const queries = [
    {
      name: "User and Direct Projects",
      query: `
        query {
          me {
            id
            email
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
        }
      `
    },
    {
      name: "All Projects Query",
      query: `
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
      `
    },
    {
      name: "User Teams",
      query: `
        query {
          me {
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
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `
    }
  ];
  
  for (const { name, query } of queries) {
    console.log(`\n🔍 Testing: ${name}`);
    console.log('─'.repeat(50));
    
    try {
      const response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });
      
      const responseText = await response.text();
      console.log(`Status: ${response.status}`);
      
      try {
        const data = JSON.parse(responseText);
        console.log('Response:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Raw response:', responseText);
      }
      
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

checkRailwayRaw().catch(console.error);