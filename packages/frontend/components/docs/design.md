# Umbilical Component Protocol: A Unified Message-Passing Model

A minimal protocol for JavaScript component loading — and a general computational model — based on a single constraint: **all interaction happens through explicit message-passing over granted capabilities**.

## Core Concept

Every component exposes exactly one function:

```js
Component.create(umbilical)
```

**The `umbilical` is the component's entire world — not just a resource injector, but a runtime message router. It defines both the data access and control flow boundaries of the component.** It is a message conduit and capability boundary: every resource, event, API, or collaborator must be granted through it. This unifies components, actors, behavior trees, and other models under one principle:

> **All computation is communication.**

A component is a message handler. The `create()` function registers behavior and establishes its links to the world — which it cannot observe or influence outside the umbilical.

## Message-Passing as Foundation

Every interaction is fundamentally a message exchange — in contrast to traditional OO or React-style components, which often blur message boundaries through implicit state sharing, global context, or tightly coupled function calls:

* A synchronous function call = request + response message
* An event = one-way message
* A stream = sequence of messages
* A behavior tree tick = scheduled message

The umbilical protocol treats **all external effects as explicit messages**. Capabilities passed via the umbilical define **which messages the component can send or receive**.

> Even synchronous calls can be modeled as paired messages. All flows—sync or async, pub/sub or direct—reduce to message exchanges over channels.

This interpretation allows us to view components not just as functions, but as message-driven processes with explicit interfaces.

## Key Principles

### 1. Single Point of Contact

* One function: `create(umbilical)`
* No implicit global state
* No side effects outside granted capabilities
* No return value required

### 2. Environmental Adaptation

Components adapt to the umbilical they receive:

```js
Component.create({
  dom: HTMLElement,
  data: AsyncIterable,
  events: EventBus
})

Component.create({
  describe: docAPI,
  validate: validatorAPI
})
```

A component can introspect, render, process data, or coordinate — depending on the capabilities passed in. There is no fixed interface: **the host shapes the component's world**.

### 3. Capability-Based Architecture

The umbilical acts as a capability map:

* Security: components only access what they're granted
* Testing: mock the umbilical for full isolation
* Debugging: trace messages or wrap capabilities
* Swapping: replace components that honor the same interface

Umbilicals make dependencies explicit, empowering architectural control and traceability.

## A Unified Computational Model

The Umbilical Component Protocol is not just a loading pattern. It is a **general model of computation by message-passing**. Every well-known architectural paradigm becomes a special case:

| Model             | Specialization of Umbilical Pattern                                 |
| ----------------- | ------------------------------------------------------------------- |
| **Actor**         | Asynchronous inbox + self-contained state via capabilities          |
| **Component**     | Structured capabilities for rendering, reacting, managing lifecycle |
| **Behavior Tree** | Scheduled request/response over a hierarchical dispatcher           |

These specializations (Actor, Component, Behavior Tree) differ only in scheduling and topology — reinforcing their equivalence under this model.

> These are not fundamentally different paradigms, but scheduling and message-topology variations over a unified substrate.

## Beyond Hierarchy: The Umbilical as Spanning Tree

Components are often **created in a tree**, but this is merely a scaffolding: this structure supports ordered creation and lifecycle coordination, but does not constrain communication. In fact, the umbilical topology acts as a **spanning tree** over a broader message graph. Messages can route freely across components, regardless of hierarchy.

* Each component gets an umbilical from its creator
* That umbilical may include **links to any other part of the system**
* Messages can flow across the system freely, not just up/down the tree

> The umbilical hierarchy is a **spanning tree over a richer message graph**

Behavior trees are a perfect example: while scheduling flows top-down, components can publish events, access shared state, or delegate work **across** the tree via explicitly granted channels.

> **Message topology is unconstrained** — it is shaped solely by capability wiring, not instantiation order.

This clarifies that even rigid scheduling models can permit rich, dynamic communication patterns when message routing is treated as a first-class abstraction.

## Recommended Pattern: Introspection + Instantiation

Use the same `create()` for both discovery and instancing:

```js
// Introspect requirements
Component.create({
  describe: (req) => req.add('data', 'AsyncIterable'),
  validate: (u) => Boolean(u.data)
})

// Instantiate
Component.create({
  data: source,
  dom: node
})
```

Benefits:

* Consistent interface
* Easy mocking and validation
* Component-type metadata and reuse

Over time, shared conventions (schemas, tags, signatures) may emerge naturally — enabling registry tools and dynamic composition.

## Examples

### Audio Visualizer

```js
AudioViz.create({
  canvas,
  audioContext,
  scheduler,
  onDestroy
})
```

### Data Grid

```js
DataGrid.create({
  container,
  dataSource,
  formatter,
  selection
})
```

### Progressive Enhancement

```js
Component.create({ dom, data })
Component.create({ dom, data, analytics, realtime })
```

## Benefits

### Isolation

No side effects outside granted capabilities.

### Composability

Every component declares and uses only what it receives.

### Introspection

Components describe themselves at runtime, enabling schema discovery, live editing, validation, and tooling.

### Hot Swapping

Any component that uses the same umbilical contract can be swapped at runtime.

### Paradigm Unification

Whether you use trees, graphs, events, or queues — it's all messages. All components are message processors bound to their interfaces.

> This makes the protocol a minimal but expressive substrate for system design — adaptable to any topology or discipline.

## Implementation Notes

### Schema Discovery

The protocol doesn't prescribe how to describe requirements — this emerges naturally:

* Describe via callbacks
* Emit JSON schema
* Use progressive introspection

Standardization may arise here (e.g., shared schemas or interface contracts), encouraging ecosystem coherence without enforcing it.

### Error Handling

Components can degrade or report when missing capabilities.

### Lifecycle

Use the umbilical to pass lifecycle hooks:

```js
Component.create({
  lifecycle: {
    onMount() {},
    onDestroy() {}
  }
})
```

## Philosophy: One Function, One Boundary, Infinite Possibility

The protocol is minimal, but its power is in what it **forbids**: any access outside the umbilical. This enforces a style of architecture that is:

* **Explicit** in its dependencies
* **Modular** in its structure
* **Unified** in its semantics

> The umbilical is not just a data structure — it is a **worldview**. It models systems where components act only through explicitly granted powers, sending and receiving messages across well-defined channels.

This is the **assembly language of composable systems** — low-level, pure, and general enough to build any paradigm on top.

## Summary

**All interaction is messaging. All power is granted. All components live inside their umbilicals.**

From this, everything else follows.

**Umbilical Component Protocol = Pure Message Interface + Explicit Capability Boundary.**

Nothing more is needed.