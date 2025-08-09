#!/usr/bin/env node

/**
 * Install ONNX Dependencies Script
 * 
 * This script properly installs ONNX runtime and transformers library
 * for the Legion semantic search functionality.
 * 
 * The issue is that npm workspaces are interfering with normal installation,
 * so we need to install dependencies in a specific way.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

console.log('🔧 Installing ONNX Dependencies for Legion Semantic Search...\n');

// Check if we're in the correct directory
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  console.error('❌ Error: Please run this script from the Legion root directory');
  process.exit(1);
}

try {
  console.log('📦 Step 1: Installing ONNX Runtime...');
  
  // ONNX Runtime is already installed via symlink, check if it works
  try {
    execSync('NODE_OPTIONS="--experimental-vm-modules" node -e "const ort = await import(\'onnxruntime-node\'); console.log(\'✅ ONNX version:\', ort.env.versions.node);"', {
      stdio: 'inherit',
      cwd: rootDir
    });
    console.log('✅ ONNX Runtime is working correctly\n');
  } catch (error) {
    console.log('⚠️ ONNX Runtime needs proper installation');
    console.log('Installing fresh ONNX Runtime...');
    
    // Remove existing symlink and install properly
    const onnxPath = path.join(rootDir, 'node_modules', 'onnxruntime-node');
    if (fs.existsSync(onnxPath)) {
      fs.unlinkSync(onnxPath);
    }
    
    // Install ONNX runtime in semantic-search package
    execSync('npm install onnxruntime-node@^1.18.0', {
      stdio: 'inherit',
      cwd: path.join(rootDir, 'packages', 'semantic-search')
    });
    console.log('✅ ONNX Runtime installed\n');
  }

  console.log('📦 Step 2: Installing Transformers Library...');
  
  // Install transformers in semantic-search package to avoid workspace issues
  const semanticSearchDir = path.join(rootDir, 'packages', 'semantic-search');
  
  try {
    execSync('npm install @xenova/transformers@^2.17.1', {
      stdio: 'inherit',
      cwd: semanticSearchDir
    });
    console.log('✅ Transformers library installed\n');
  } catch (error) {
    console.log('⚠️ Transformers installation failed with npm, trying alternative approach...');
    
    // Create a temporary isolated install
    const tempDir = path.join(rootDir, 'scratch', 'temp-install');
    
    // Ensure scratch directory exists and is in .gitignore
    const scratchDir = path.join(rootDir, 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
      
      // Add to .gitignore if not already there
      const gitignorePath = path.join(rootDir, '.gitignore');
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      }
      
      if (!gitignoreContent.includes('scratch/')) {
        fs.appendFileSync(gitignorePath, '\n# Temporary files\nscratch/\n');
        console.log('📝 Added scratch/ to .gitignore');
      }
    }
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create minimal package.json in temp directory
    const tempPackageJson = {
      "name": "temp-onnx-install",
      "version": "1.0.0",
      "type": "module"
    };
    
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify(tempPackageJson, null, 2)
    );
    
    // Install in temp directory
    execSync('npm install @xenova/transformers@^2.17.1', {
      stdio: 'inherit',
      cwd: tempDir
    });
    
    // Create symlink in semantic-search node_modules
    const semanticSearchNodeModules = path.join(semanticSearchDir, 'node_modules');
    if (!fs.existsSync(semanticSearchNodeModules)) {
      fs.mkdirSync(semanticSearchNodeModules, { recursive: true });
    }
    
    const transformersSymlink = path.join(semanticSearchNodeModules, '@xenova');
    if (!fs.existsSync(transformersSymlink)) {
      const transformersSource = path.join(tempDir, 'node_modules', '@xenova');
      if (fs.existsSync(transformersSource)) {
        fs.symlinkSync(transformersSource, transformersSymlink, 'dir');
        console.log('✅ Created symlink for transformers library\n');
      }
    }
  }

  console.log('🧪 Step 3: Testing ONNX Integration...');
  
  // Test that both libraries can be imported together
  const testScript = `
    try {
      const ort = await import('onnxruntime-node');
      console.log('✅ ONNX Runtime imported successfully');
      console.log('   Version:', ort.env.versions.node);
      
      const transformers = await import('@xenova/transformers');
      console.log('✅ Transformers imported successfully');
      console.log('   Pipeline available:', typeof transformers.pipeline === 'function');
      
      console.log('\\n🎉 Both libraries are ready for semantic search!');
    } catch (error) {
      console.error('❌ Import test failed:', error.message);
      process.exit(1);
    }
  `;
  
  execSync(`NODE_OPTIONS="--experimental-vm-modules" node -e "${testScript}"`, {
    stdio: 'inherit',
    cwd: rootDir
  });

  console.log('\n✅ ONNX dependencies installation completed successfully!');
  console.log('\n📋 What was installed:');
  console.log('   • onnxruntime-node: ONNX Runtime for Node.js with M4 acceleration');
  console.log('   • @xenova/transformers: Tokenization and model loading library');
  console.log('\n🔧 Usage:');
  console.log('   The LocalEmbeddingService will now work with proper ONNX support.');
  console.log('   You can test it by running the semantic search integration tests.');

} catch (error) {
  console.error('\n❌ Installation failed:', error.message);
  console.error('\nPlease check the error above and try again.');
  console.error('If you continue having issues, try running:');
  console.error('  npm install --no-workspaces onnxruntime-node @xenova/transformers');
  process.exit(1);
}