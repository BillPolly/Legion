# Legion Import Map System

## Overview

Legion uses an **import map** system to enable using `@legion/...` imports in browser code while properly serving the packages from the server.

## How It Works

### 1. Client Code Uses `@legion/...` Imports

Browser/client code uses standard package imports:

```javascript
import { ActorSpace } from '@legion/actors';
import { Window } from '@legion/components';
```

### 2. Import Map Maps to Server Routes

The HTML template includes an import map that maps `@legion/...` to `/legion/...` server routes:

```html
<script type="importmap">
{
  "imports": {
    "@legion/actors": "/legion/actors/src/index.js",
    "@legion/actors/": "/legion/actors/src/",
    "@legion/components": "/legion/components/src/index.js",
    "@legion/components/": "/legion/components/src/"
  }
}
</script>
```

### 3. Server Serves Packages on `/legion/` Routes

The BaseServer automatically serves Legion packages on `/legion/` routes:

- `/legion/actors/src/index.js` → Serves from `packages/shared/actors/src/index.js`
- `/legion/components/src/Window.js` → Serves from `packages/frontend/components/src/Window.js`

## Benefits

1. **Unified Import Syntax**: Same `@legion/...` imports work in both Node.js and browser
2. **Clean Client Code**: No hard-coded `/legion/` paths in client code
3. **Proper Module Resolution**: Import map handles the mapping
4. **Works with both Server and Client**: Server code uses npm workspace imports, client uses import map

## Server Package Discovery

The server discovers Legion packages in these locations:

```
packages/
├── shared/actors         → @legion/actors
├── shared/data/          → @legion/...
├── frontend/components   → @legion/components
├── modules/showme        → @legion/showme
└── storage/              → @legion/...
```

## Adding New Packages to Import Map

When adding a new Legion package that needs browser access:

1. Add to import map in `htmlTemplate.js`:
```javascript
"@legion/new-package": "/legion/new-package/src/index.js",
"@legion/new-package/": "/legion/new-package/src/"
```

2. Ensure package has `src/index.js` that exports its API

3. Server will automatically discover and serve it

## Example: Full Flow

**Client code:**
```javascript
import { ActorSpace } from '@legion/actors';
const space = new ActorSpace('client');
```

**Browser resolves via import map:**
```
@legion/actors → /legion/actors/src/index.js
```

**Server serves:**
```
GET /legion/actors/src/index.js
→ Reads from packages/shared/actors/src/index.js
→ Returns JavaScript module
```

## Testing

Import map is tested in:
- `htmlTemplate.test.js` - Verifies import map is present
- `LegionComponentServing.test.js` - Tests actual package serving

## Troubleshooting

**Import not working in browser?**
1. Check import map includes the package
2. Check package exists at `/legion/[package]/src/index.js`
3. Check server logs for package discovery errors

**Wrong file served?**
1. Check package discovery in BaseServer logs
2. Verify file exists in package's `src/` directory
3. Check import map path mapping
