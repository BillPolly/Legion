#!/usr/bin/env node
process.argv.push('--server', '--port', '4000');
import('./src/index.js');
