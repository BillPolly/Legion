/**
 * API Routes
 * REST API endpoints for tool registry operations
 */

import { Router } from 'express';
import toolRegistry from '@legion/tools-registry';

export const apiRoutes = Router();

// Get registry statistics
apiRoutes.get('/stats', async (req, res, next) => {
  try {
    const stats = await toolRegistry.getStatistics();
    
    // Get counts from database
    const provider = toolRegistry.provider;
    let counts = {};
    
    if (provider && provider.db) {
      const [moduleCount, toolCount] = await Promise.all([
        provider.db.collection('modules').countDocuments(),
        provider.db.collection('tools').countDocuments()
      ]);
      
      counts = {
        modules: moduleCount,
        tools: toolCount
      };
    }
    
    res.json({
      ...stats,
      counts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// List tools
apiRoutes.get('/tools', async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, module } = req.query;
    
    const options = {
      limit: parseInt(limit),
      skip: parseInt(offset)
    };
    
    if (module) {
      options.module = module;
    }
    
    const tools = await toolRegistry.listTools(options);
    
    // Get total count if provider is available
    let totalCount = tools.length;
    try {
      if (toolRegistry.provider && toolRegistry.provider.db) {
        totalCount = await toolRegistry.provider.db.collection('tools').countDocuments();
      }
    } catch (error) {
      console.warn('Could not get total count from database:', error.message);
    }
    
    res.json({
      tools,
      count: tools.length,
      total: totalCount
    });
  } catch (error) {
    next(error);
  }
});

// Get specific tool
apiRoutes.get('/tools/:name', async (req, res, next) => {
  try {
    const tool = await toolRegistry.getTool(req.params.name);
    
    if (!tool) {
      return res.status(404).json({
        error: `Tool not found: ${req.params.name}`
      });
    }
    
    res.json({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    });
  } catch (error) {
    next(error);
  }
});

// Execute tool
apiRoutes.post('/tools/:name/execute', async (req, res, next) => {
  try {
    const tool = await toolRegistry.getTool(req.params.name);
    
    if (!tool) {
      return res.status(404).json({
        error: `Tool not found: ${req.params.name}`
      });
    }
    
    const result = await tool.execute(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Search tools
apiRoutes.get('/search', async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        error: 'Query parameter "q" is required'
      });
    }
    
    const results = await toolRegistry.searchTools(q, {
      limit: parseInt(limit)
    });
    
    res.json({
      query: q,
      results,
      count: results.length
    });
  } catch (error) {
    next(error);
  }
});

// List modules
apiRoutes.get('/modules', async (req, res, next) => {
  try {
    const provider = toolRegistry.provider;
    
    if (!provider || !provider.db) {
      return res.status(503).json({
        error: 'Database not available'
      });
    }
    
    const modules = await provider.db.collection('modules')
      .find({})
      .limit(100)
      .toArray();
    
    res.json({
      modules,
      count: modules.length
    });
  } catch (error) {
    next(error);
  }
});

// Load modules from filesystem
apiRoutes.post('/modules/load', async (req, res, next) => {
  try {
    const result = await toolRegistry.loadAllModules();
    
    res.json({
      loaded: result.loaded || 0,
      failed: result.failed || 0,
      total: result.total || 0,
      modules: result.modules || []
    });
  } catch (error) {
    next(error);
  }
});

// Clear database
apiRoutes.delete('/database/clear', async (req, res, next) => {
  try {
    // Only allow in development or with proper authorization
    if (process.env.NODE_ENV === 'production' && !req.headers.authorization) {
      return res.status(403).json({
        error: 'Authorization required for this operation'
      });
    }
    
    await toolRegistry.clearAll();
    
    res.json({
      message: 'Database cleared successfully'
    });
  } catch (error) {
    next(error);
  }
});