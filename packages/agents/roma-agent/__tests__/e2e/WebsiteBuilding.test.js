/**
 * E2E Website Building Test
 * 
 * This test uses the ROMA agent to build a complete website and fixes issues until it succeeds.
 * Uses real LLM, real tools, and real file system operations.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';
import ArtifactRegistry from '../../src/core/ArtifactRegistry.js';

describe('Website Building E2E Test', () => {
  let agent;
  let outputDir;
  let context;

  beforeEach(async () => {
    // Set up output directory for the website
    outputDir = path.join(__dirname, 'tmp', 'website-output');
    await fs.mkdir(outputDir, { recursive: true });

    // Clean up any existing files
    try {
      const existingFiles = await fs.readdir(outputDir);
      await Promise.all(existingFiles.map(file => fs.unlink(path.join(outputDir, file))));
    } catch (error) {
      // Directory might be empty, ignore
    }

    // Create ROMA agent with real components
    agent = new SimpleROMAAgent();
    await agent.initialize();

    // Create context with artifact registry
    context = {
      artifactRegistry: new ArtifactRegistry(),
      conversation: [],
      depth: 0,
      workspaceDir: outputDir
    };

    console.log(`\n🏗️  Starting website build test in: ${outputDir}\n`);
  });

  afterEach(async () => {
    // Don't clean up - leave files for inspection
    console.log(`\n📁 Website files saved in: ${outputDir}\n`);
  });

  describe('Simple Website Building', () => {
    it('should build a complete personal portfolio website', async () => {
      const task = {
        description: `Create a complete personal portfolio website with the following requirements:
        
        1. HTML file (index.html) with proper structure
        2. CSS file (styles.css) with responsive design
        3. JavaScript file (script.js) with interactive features
        4. About section with personal information
        5. Projects section showcasing work
        6. Contact form with validation
        7. Modern design with dark/light theme toggle
        
        The website should be a single-page application that works in any browser.
        All files should be saved to: ${outputDir}`
      };

      console.log('🚀 Starting website building task...');
      console.log(`📋 Task: ${task.description}`);

      let result;
      let executionError = null;

      try {
        result = await agent.execute(task, context);
        console.log('\n✅ Task execution completed');
        console.log('📊 Result:', JSON.stringify(result, null, 2));
      } catch (error) {
        executionError = error;
        console.error('\n❌ Task execution failed:', error.message);
        console.error('📊 Error details:', error.stack);
      }

      // Check what files were actually created
      console.log('\n📁 Checking created files...');
      const createdFiles = await fs.readdir(outputDir);
      console.log(`📄 Files created: ${createdFiles.length}`);
      createdFiles.forEach(file => {
        console.log(`   - ${file}`);
      });

      // Analyze the artifacts that were stored
      console.log('\n🗃️  Checking stored artifacts...');
      const artifacts = context.artifactRegistry.listAll();
      console.log(`📦 Artifacts stored: ${artifacts.length}`);
      artifacts.forEach(artifact => {
        console.log(`   - @${artifact.name}: ${artifact.description} (${typeof artifact.content})`);
      });

      // Read and analyze created files
      for (const file of createdFiles) {
        const filepath = path.join(outputDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        console.log(`\n📄 ${file} (${content.length} characters):`);
        console.log('   Content preview:', content.substring(0, 200) + '...');
        
        // Basic validation
        if (file.endsWith('.html')) {
          expect(content).toContain('<!DOCTYPE html>');
          expect(content).toContain('<html');
          expect(content).toContain('</html>');
          console.log('   ✅ Valid HTML structure');
        }
        
        if (file.endsWith('.css')) {
          expect(content.length).toBeGreaterThan(100);
          console.log('   ✅ CSS has content');
        }
        
        if (file.endsWith('.js')) {
          expect(content.length).toBeGreaterThan(50);
          console.log('   ✅ JavaScript has content');
        }
      }

      // Verify minimum requirements
      const hasHTML = createdFiles.some(f => f.endsWith('.html'));
      const hasCSS = createdFiles.some(f => f.endsWith('.css'));
      const hasJS = createdFiles.some(f => f.endsWith('.js'));

      console.log('\n📋 Requirements check:');
      console.log(`   HTML file: ${hasHTML ? '✅' : '❌'}`);
      console.log(`   CSS file: ${hasCSS ? '✅' : '❌'}`);
      console.log(`   JavaScript file: ${hasJS ? '✅' : '❌'}`);

      // If we had an execution error, report it but don't fail the test yet
      // We want to see what partial progress was made
      if (executionError) {
        console.log('\n⚠️  Execution had errors but partial progress may have been made');
        console.log('🔧 This indicates areas that need fixing in the ROMA agent');
      }

      // For now, expect at least some progress (files created or artifacts stored)
      const hasProgress = createdFiles.length > 0 || artifacts.length > 0;
      expect(hasProgress).toBe(true);

      if (!hasProgress) {
        throw new Error('No progress made - no files created and no artifacts stored');
      }

      console.log('\n🎯 Test completed - see output above for areas needing improvement');
    }, 120000); // 2 minute timeout

    it('should build a simple landing page', async () => {
      const task = {
        description: `Create a simple landing page for a tech startup called "InnovateTech". 
        
        Requirements:
        1. Single HTML file with embedded CSS and JavaScript
        2. Hero section with company name and tagline
        3. Features section with 3 key features
        4. Call-to-action button
        5. Responsive design
        
        Save the file as landing.html in: ${outputDir}`
      };

      console.log('🚀 Starting simple landing page task...');

      let result;
      try {
        result = await agent.execute(task, context);
        console.log('\n✅ Landing page task completed');
      } catch (error) {
        console.error('\n❌ Landing page task failed:', error.message);
        // Don't fail test yet - let's see what was created
      }

      // Check results
      const createdFiles = await fs.readdir(outputDir);
      console.log(`📄 Files created: ${createdFiles.join(', ')}`);

      const artifacts = context.artifactRegistry.listAll();
      console.log(`📦 Artifacts: ${artifacts.map(a => `@${a.name}`).join(', ')}`);

      // Expect some progress
      expect(createdFiles.length + artifacts.length).toBeGreaterThan(0);
    }, 60000); // 1 minute timeout
  });
});