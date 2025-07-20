# Simple Express App for Railway

This is a minimal Express.js application designed to be deployed to Railway via GitHub.

## Files

- `package.json` - Defines dependencies and start script
- `server.js` - Express server that serves HTML and JSON endpoints

## Features

- Uses `process.env.PORT` (required by Railway)
- Serves an HTML page showing deployment status
- Includes JSON API endpoints for health checks
- No Docker required - Railway's Nixpacks handles everything

## Local Testing

```bash
npm install
npm start
# Visit http://localhost:3000
```

## Deployment

This app is designed to be deployed via Railway's GitHub integration. Push to GitHub and use Railway's API or dashboard to deploy.