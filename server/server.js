import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3600;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve src directory for module imports
app.use('/src', express.static(path.join(__dirname, '..', 'src')));

// Serve the bundled CodeMirror for all module requests
const codemirrorPaths = [
  '/lib/codemirror/view',
  '/lib/codemirror/state',
  '/lib/codemirror/commands',
  '/lib/codemirror/language',
  '/lib/codemirror/search',
  '/lib/codemirror/autocomplete',
  '/lib/codemirror/lang-javascript',
  '/lib/codemirror/theme-one-dark'
];

// Serve the same bundle for all CodeMirror paths
codemirrorPaths.forEach(modulePath => {
  app.get(modulePath, (req, res) => {
    res.type('application/javascript');
    res.sendFile('codemirror-bundle.esm.js', { root: path.join(__dirname, '..', 'public', 'lib') });
  });
});

// Serve the yaml module
app.get('/lib/yaml', (req, res) => {
  res.type('application/javascript');
  res.sendFile('yaml.esm.js', { root: path.join(__dirname, '..', 'public', 'lib') });
});

// Serve markdown-it module
app.get('/lib/markdown-it', (req, res) => {
  res.type('application/javascript');
  res.sendFile('markdown-it.esm.js', { root: path.join(__dirname, '..', 'public', 'lib') });
});

// Serve highlight.js module
app.get('/lib/highlight.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile('highlight.esm.js', { root: path.join(__dirname, '..', 'public', 'lib') });
});

// Default route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});