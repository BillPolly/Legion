#!/usr/bin/env node

import { ResourceManager } from '@legion/tools-registry';

async function main() {
  console.log('Checking environment variables...\n');
  
  const resourceManager = await ResourceManager.getResourceManager();
  
  const vars = [
    'GITHUB_PAT',
    'GITHUB_USER', 
    'GITHUB_AGENT_ORG',
    'RAILWAY_API_TOKEN',
    'ANTHROPIC_API_KEY'
  ];
  
  for (const varName of vars) {
    const value = resourceManager.get(`env.${varName}`);
    console.log(`${varName}: ${value ? '✅ Found' : '❌ Missing'}`);
  }
}

main().catch(console.error);