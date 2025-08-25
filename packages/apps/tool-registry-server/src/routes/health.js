/**
 * Health Routes
 * Health check and monitoring endpoints
 */

import { Router } from 'express';
import toolRegistry from '@legion/tools-registry';

export const healthRoutes = Router();

// Basic health check
healthRoutes.get('/', async (req, res) => {
  res.json({
    status: 'healthy',
    service: 'tool-registry-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Detailed health check
healthRoutes.get('/detailed', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      service: 'tool-registry-server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {}
    };
    
    // Check registry status
    try {
      // toolRegistry is already the initialized singleton instance
      health.checks.registry = {
        status: 'healthy',
        initialized: true
      };
      
      // Check database connection
      const provider = toolRegistry.provider;
      if (provider && provider.db) {
        await provider.db.admin().ping();
        health.checks.database = {
          status: 'healthy',
          connected: true
        };
      } else {
        health.checks.database = {
          status: 'unhealthy',
          error: 'No database connection'
        };
      }
      
      // Check loader status
      const loader = await toolRegistry.getLoader();
      const pipelineState = loader.getPipelineState();
      health.checks.loader = {
        status: 'healthy',
        pipeline: pipelineState
      };
    } catch (error) {
      health.checks.registry = {
        status: 'unhealthy',
        error: error.message
      };
      health.checks.database = {
        status: 'unhealthy',
        error: 'Registry unavailable'
      };
      health.checks.loader = {
        status: 'unhealthy',
        error: 'Registry unavailable'
      };
    }
    
    // Determine overall health
    const allHealthy = Object.values(health.checks).every(
      check => check.status === 'healthy'
    );
    
    health.status = allHealthy ? 'healthy' : 'degraded';
    
    res.status(allHealthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Readiness check
healthRoutes.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are ready
    // toolRegistry is already the initialized singleton instance
    const isReady = toolRegistry.provider !== null;
    
    if (isReady) {
      res.json({ ready: true });
    } else {
      res.status(503).json({ ready: false });
    }
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      error: error.message 
    });
  }
});

// Liveness check
healthRoutes.get('/live', (req, res) => {
  res.json({ alive: true });
});