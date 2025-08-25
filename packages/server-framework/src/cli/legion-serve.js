#!/usr/bin/env node

/**
 * legion-serve CLI
 * Command-line tool for running Legion actor servers from configuration
 */

import { program } from 'commander';
import path from 'path';
import { pathToFileURL } from 'url';
import fs from 'fs/promises';
import { createConfigurableServer } from '../ConfigurableActorServer.js';

// Default config file names to search for
const DEFAULT_CONFIG_NAMES = [
  'actor-server.config.js',
  'legion.config.js',
  'server.config.js'
];

/**
 * Find configuration file
 */
async function findConfigFile(configPath) {
  if (configPath) {
    // Explicit config file provided
    const resolvedPath = path.resolve(process.cwd(), configPath);
    try {
      await fs.access(resolvedPath);
      return resolvedPath;
    } catch {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
  }
  
  // Search for default config files
  for (const configName of DEFAULT_CONFIG_NAMES) {
    const configPath = path.resolve(process.cwd(), configName);
    try {
      await fs.access(configPath);
      console.log(`Found configuration: ${configName}`);
      return configPath;
    } catch {
      // Continue searching
    }
  }
  
  throw new Error(`No configuration file found. Searched for: ${DEFAULT_CONFIG_NAMES.join(', ')}`);
}

/**
 * Load configuration from file
 */
async function loadConfig(configPath) {
  try {
    const fileUrl = pathToFileURL(configPath).href;
    const configModule = await import(fileUrl);
    const config = configModule.default || configModule;
    
    // Add config directory for relative path resolution
    config.__dirname = path.dirname(configPath);
    
    return config;
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Main CLI function
 */
async function main() {
  program
    .name('legion-serve')
    .description('Run a Legion actor server from configuration')
    .version('1.0.0')
    .argument('[config]', 'Path to configuration file')
    .option('-p, --port <port>', 'Override port from configuration', parseInt)
    .option('-w, --watch', 'Watch for file changes and restart')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (configPath, options) => {
      try {
        // Find and load configuration
        const configFile = await findConfigFile(configPath);
        console.log(`\n🔧 Loading configuration from: ${path.basename(configFile)}`);
        
        const config = await loadConfig(configFile);
        
        // Apply CLI overrides
        if (options.port) {
          config.port = options.port;
          console.log(`📌 Overriding port to: ${options.port}`);
        }
        
        if (options.verbose) {
          process.env.LOG_LEVEL = 'debug';
          console.log('📢 Verbose logging enabled');
        }
        
        // Create and start server
        console.log('\n🚀 Starting Legion Actor Server...');
        const server = await createConfigurableServer(config);
        await server.start();
        
        // Watch mode (simple implementation - just logs)
        if (options.watch) {
          console.log('\n👁️  Watch mode enabled (not yet implemented)');
          // TODO: Implement file watching and auto-restart
        }
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\n📛 Shutting down...');
          await server.stop();
          process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
          console.log('\n📛 Shutting down...');
          await server.stop();
          process.exit(0);
        });
        
      } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
  
  program.parse();
}

// Run CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});