/**
 * Console Hook - Intercepts all console method calls
 */

const util = require('util');

function install(client, config) {
  const originalConsole = {};
  const methods = ['log', 'error', 'warn', 'info', 'debug', 'trace'];
  
  methods.forEach(method => {
    originalConsole[method] = console[method];
    
    console[method] = function(...args) {
      // Call original method
      originalConsole[method].apply(console, args);
      
      // Send to monitor
      try {
        const message = {
          type: 'console',
          method,
          args: args.map(arg => {
            if (typeof arg === 'object') {
              return util.inspect(arg, { 
                depth: 3, 
                colors: false,
                maxArrayLength: 100,
                breakLength: Infinity
              });
            }
            return String(arg);
          }),
          timestamp: Date.now()
        };
        
        // Include stack trace for errors
        if (method === 'error' || method === 'trace') {
          const stack = new Error().stack;
          message.stack = stack.split('\n').slice(3).join('\n');
        }
        
        client.send(message);
      } catch (err) {
        // Silently fail to avoid infinite loop
        originalConsole.error('[Sidewinder] Failed to send console message:', err);
      }
    };
  });
  
  // Handle console.table specially
  const originalTable = console.table;
  console.table = function(data, columns) {
    originalTable.call(console, data, columns);
    
    try {
      client.send({
        type: 'console',
        method: 'table',
        data: JSON.stringify(data),
        columns,
        timestamp: Date.now()
      });
    } catch (err) {
      originalConsole.error('[Sidewinder] Failed to send console.table:', err);
    }
  };
  
  // Handle console.time/timeEnd
  const timers = new Map();
  const originalTime = console.time;
  const originalTimeEnd = console.timeEnd;
  
  console.time = function(label = 'default') {
    originalTime.call(console, label);
    timers.set(label, Date.now());
  };
  
  console.timeEnd = function(label = 'default') {
    originalTimeEnd.call(console, label);
    
    const start = timers.get(label);
    if (start) {
      const duration = Date.now() - start;
      timers.delete(label);
      
      client.send({
        type: 'console',
        method: 'timeEnd',
        label,
        duration,
        timestamp: Date.now()
      });
    }
  };
  
  // Handle console.count
  const counters = new Map();
  const originalCount = console.count;
  
  console.count = function(label = 'default') {
    originalCount.call(console, label);
    
    const count = (counters.get(label) || 0) + 1;
    counters.set(label, count);
    
    client.send({
      type: 'console',
      method: 'count',
      label,
      count,
      timestamp: Date.now()
    });
  };
  
  // Handle console.group/groupEnd
  let groupDepth = 0;
  const originalGroup = console.group;
  const originalGroupEnd = console.groupEnd;
  
  console.group = function(...args) {
    originalGroup.apply(console, args);
    groupDepth++;
    
    client.send({
      type: 'console',
      method: 'group',
      label: args.join(' '),
      depth: groupDepth,
      timestamp: Date.now()
    });
  };
  
  console.groupEnd = function() {
    originalGroupEnd.call(console);
    
    if (groupDepth > 0) {
      client.send({
        type: 'console',
        method: 'groupEnd',
        depth: groupDepth,
        timestamp: Date.now()
      });
      groupDepth--;
    }
  };
  
  // Listen for hook updates
  global.__sidewinder.on('updateHooks', (hooks) => {
    if (!hooks.console) {
      // Restore original console methods
      methods.forEach(method => {
        console[method] = originalConsole[method];
      });
      console.table = originalTable;
      console.time = originalTime;
      console.timeEnd = originalTimeEnd;
      console.count = originalCount;
      console.group = originalGroup;
      console.groupEnd = originalGroupEnd;
    }
  });
}

module.exports = { install };