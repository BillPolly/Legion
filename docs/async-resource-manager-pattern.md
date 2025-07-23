# Async Resource Manager Pattern in TypeScript

This document describes a scalable and testable pattern for managing asynchronous object creation and dependency injection in TypeScript/JavaScript using a centralized `ResourceManager`.

## Overview

In environments like Node.js and browsers, object construction often involves asynchronous operations such as:

* Connecting to databases
* Loading remote configuration
* Initializing APIs

Using asynchronous constructors is not allowed in JavaScript, and ad-hoc patterns can quickly lead to tightly-coupled, untestable code.

Instead, we use a **`ResourceManager` pattern**, where:

* All services are constructed using `static async create(rm: ResourceManager)` methods
* All dependencies are fetched from a central `ResourceManager`
* Nothing uses `new` outside the `ResourceManager`
* All services are testable by mocking the `ResourceManager`

---

## Interface

```ts
export interface ResourceManager {
  get<T>(key: string): T;
  set<T>(key: string, value: T): void;
}
```

---

## Example Implementation

### `DefaultResourceManager.ts`

```ts
export class DefaultResourceManager implements ResourceManager {
  private services = new Map<string, any>();

  get<T>(key: string): T {
    const value = this.services.get(key);
    if (!value) throw new Error(`Missing resource: ${key}`);
    return value;
  }

  set<T>(key: string, value: T) {
    this.services.set(key, value);
  }
}
```

---

## Service Example: `Config.ts`

```ts
export class Config {
  constructor(public values: Record<string, any>) {}

  static async create(rm: ResourceManager): Promise<Config> {
    return new Config({ env: 'dev', debug: true });
  }
}
```

---

## Service Example: `Database.ts`

```ts
import { ResourceManager } from './ResourceManager';
import { Config } from './Config';

export class Database {
  private constructor(private uri: string) {}

  static async create(rm: ResourceManager): Promise<Database> {
    const config = rm.get<Config>('Config');
    await new Promise((r) => setTimeout(r, 50));
    return new Database(`mongodb://${config.values.env}-db`);
  }
}
```

---

## Service Example: `MyService.ts`

```ts
import { ResourceManager } from './ResourceManager';
import { Database } from './Database';
import { Config } from './Config';

export class MyService {
  private constructor(
    private db: Database,
    private config: Config
  ) {}

  static async create(rm: ResourceManager): Promise<MyService> {
    const db = rm.get<Database>('Database');
    const config = rm.get<Config>('Config');
    return new MyService(db, config);
  }

  log() {
    console.log('Service running with config:', this.config);
  }
}
```

---

## Bootstrapping: `bootstrap.ts`

```ts
import { DefaultResourceManager } from './DefaultResourceManager';
import { Config } from './Config';
import { Database } from './Database';
import { MyService } from './MyService';

const rm = new DefaultResourceManager();

async function main() {
  rm.set('Config', await Config.create(rm));
  rm.set('Database', await Database.create(rm));
  rm.set('MyService', await MyService.create(rm));

  const svc = rm.get<MyService>('MyService');
  svc.log();
}

main();
```

---

## Advantages

| Feature              | Benefit                                                 |
| -------------------- | ------------------------------------------------------- |
| ✅ Async-safe         | No async code in constructors                           |
| ✅ Fully testable     | Just swap out `ResourceManager` entries                 |
| ✅ Centralized config | All lifecycle and dependency setup happens in one place |
| ✅ Explicit wiring    | Every dependency is visible and overridable             |

---

## Testing

Use a simple mock manager:

```ts
class MockResourceManager implements ResourceManager {
  constructor(private overrides: Record<string, any>) {}

  get<T>(key: string): T {
    const value = this.overrides[key];
    if (!value) throw new Error(`Mock missing: ${key}`);
    return value;
  }

  set<T>(key: string, value: T): void {
    this.overrides[key] = value;
  }
}
```

```ts
const mockRm = new MockResourceManager({
  Config: new Config({}),
  Database: new MockDatabase(),
});

const svc = await MyService.create(mockRm);
svc.log();
```

---

## Conclusion

This pattern provides a robust, testable, and scalable way to manage asynchronous service construction and configuration in TypeScript/JavaScript projects. It avoids magic and embraces explicitness, making your code easier to debug and reason about.

You can extend the `ResourceManager` to support:

* Dependency graphs
* Lazy resolution
* Auto-wiring
* Scopes (singleton, request, etc.)

But the core idea remains: **all dependencies come from the resource manager.**