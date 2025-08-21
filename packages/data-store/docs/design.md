# Integrating the Incremental N‑ary Kernel with the Attribute Store — Full Design

> **Goal:** Specify how to embed the implemented **Incremental N‑ary Relational Kernel (batch mode)** into the original **Attribute Store** model (binary relationships, attributes with set semantics, path+predicate queries, live change notifications). This is a complete conceptual and algorithmic design for an MVP integration. No NFRs.

---

## 0) High‑Level Architecture

```
Client ⟷ Query API ─┬─► Query Compiler (Path+Pred → GraphSpec)
                   │
                   ├─► Subscription Manager (outputs ↔ clients)
                   │
Writes ─► Store I/O ─► Dispatcher (batch Δ builder) ─► Kernel.pushBatch(Δ)
                   │                                     │
                   └─► Predicate Providers (Enumerable / Pointwise) ─────┘
```

**Roles**

* **Attribute Store Runtime (host):** maintains domain data (binary relationships) and indexes; surfaces writes as **batches of deltas**; provides **iterator adapters** for enumerable relations.
* **Kernel:** already implemented; maintains operator graphs and produces **output deltas** per batch.
* **Query Compiler:** translates the store's **path+predicate** queries into **GraphSpec** for the kernel (joins, projections, disjunction/negation, computes).
* **Predicate Providers:** implement enumerable or pointwise computed predicates; yield **relation deltas** or **truth flips**.
* **Subscription Manager:** binds GraphSpec outputs to subscribers; relays kernel change‑sets to clients.

---

## 1) Store Model → Kernel Relations

### 1.1 Store data (recap)

* **Only primitive:** binary relationship instance `(type, src, dst)`, **set semantics**.
* **Attributes:** every relationship type `R` has **two attribute names**:

  * forward on `src` (e.g., `worksAt`),
  * backward on `dst` (e.g., `workedBy`).
* **Objects:** independent objects are just edges from `STORE` (e.g., `(InstanceOf, STORE, :Supplier)` gives an object id); further edges encode attributes.
* **Atoms:** IDs, literals, symbols (as per kernel's value model).

### 1.2 Kernel relations per attribute

For each attribute name `A` (the forward name of `R`):

* **Forward relation:** `A[src, dst]`.
* **Backward relation (optional but recommended):** `A_inv[dst, src]` mapped to the inverse name. Keeping both as **distinct kernel relations** simplifies inverse steps and predicate joins. The dispatcher keeps them consistent.

> **Why both?** Kernel join iterators are in VO order; inverse steps become joins over `A_inv` rather than swapped columns, which keeps iterator factories simple and avoids special‑casing.

### 1.3 Special relations

* **Type membership:** `InstanceOf[obj, typeSymbol]` (optional if your model uses a dedicated "isA" rel).
* **Literals as nodes:** literal‑valued attributes produce normal binary relations, e.g., `name[obj, "Acme"]`.

---

## 2) Dispatcher: From Store Writes to Kernel Batches

### 2.1 Write ingestion

* Supported base mutations: `AddEdge(R, src, dst)` and `RemEdge(R, src, dst)`.
* Dispatcher groups incoming writes into a **single batch** with two symmetric Δ entries for each logical write:

  * `Δ[A].adds += (src, dst)` for forward attr,
  * `Δ[A_inv].adds += (dst, src)` for backward attr (if materialized).
    (Removals analogously populate `removes`.)

### 2.2 Batch normalization

Before calling `Kernel.pushBatch(Δ)` the dispatcher MUST:

* **Deduplicate** per relation within `adds` and within `removes`.
* **Cancel** opposing ops within the same batch (symmetric difference).
* **Optionally layer** computes first: if your policy is to evaluate enumerable predicate deltas prior to base joins, include their Δ in the same batch but ensure the GraphSpec's topo order naturally applies filters after joins (kernel performs remove‑then‑add per node regardless).

### 2.3 Iterator provision (enumeration & probes)

* The Join node in the kernel needs **iterator factories** for each **enumerable** relation used by a plan.
* The store runtime provides, per relation name, a factory over its **Out/In tries** aligned to the plan's **variable order (VO)**.

  * Forward `A[src,dst]`: `Out[A] : src → sorted dst`.
  * Backward `A_inv[dst,src]`: `In[A]  : dst → sorted src` (or an independent index).
* The bindings (prefix values) the kernel passes are exactly the **VO prefix** at each join level.

> **Note:** The kernel is storage‑agnostic. Whether you back relations by maps of sorted vectors or on‑disk indexes is outside the engine; only iterator semantics matter.

---

## 3) Query Language → GraphSpec

### 3.1 Path steps

* **Path** from root variable `v₀` through attributes `A₁,…,A_n`:

  * Step `A_i` (forward): atom `A_i(v_{i-1}, v_i)`.
  * Step `^A_i` (inverse): atom `A_i_inv(v_{i-1}, v_i)`.
* **Projection:** default result is the **last variable** `v_n`; expose options to project `{v_k}` or a tuple.

### 3.2 Predicates

* **Enumerable predicates** (queries over the store): compiled to subgraphs that produce relations `P[varlist]`. These join like regular atoms.
* **Pointwise predicates** (non‑enumerable/computed): compiled to **Compute (Pointwise)** nodes placed **after** all their variables are bound. They output Δ for a virtual predicate relation `P`, used as a unary/n‑ary filter.

### 3.3 Disjunction & negation

* `OR` across path alternatives → `Union` of branches.
* `NOT exists subpath` or set exclusion → `Diff` with key on the relevant variables. Enforce **stratified negation**.

### 3.4 Variable order (VO)

* For simple paths, VO is the path order `[v₀, v₁, …, v_n]`.
* Interleave highly selective predicate variables early **only** if the enumerable predicate atom's schema supports it. The kernel does not choose VO; the compiler does.

### 3.5 Example: path with predicate

**Query:** suppliers with `name == "Acme"` located in the UK; result the supplier object `s`.

Atoms:

* `hasName[s, name]`, `equalsName[name, "Acme"]` (if you model equality as relation, else push literal directly in hasName atom by fixing the second column),
* `locatedIn[s, country]`, `equalsCountry[country, "UK"]` (same note),
* optionally `InstanceOf[s, :Supplier]`.

**GraphSpec (sketch):**

* Scans over `hasName[s,name]` and `locatedIn[s,country]` (+ optional `InstanceOf`).
* If `equals*` are enumerable: scans + join; if pointwise (rare), a compute filter after binding `name` or `country`.
* Project `{s}` as output relation `SuppliersByNameAndCountry`.

---

## 4) Subscriptions & Notification Flow

### 4.1 Submitting a query

* Client submits a **path+predicate** spec and a **projection**.
* Query Compiler normalizes/validates, builds a **GraphSpec**, and calls `defineGraph/activateGraph` on the kernel.
* The compiler declares a **named output** (unique per subscription) in the GraphSpec.

### 4.2 Initial results

* Choose one of two bootstraps:

  1. **Bootstrap batch:** dispatcher sends current contents for all base and predicate relations used by this graph as a one‑shot batch; kernel emits all current results as `adds`.
  2. **Provider enumeration:** for enumerable relations/predicates, call `enumerate()` and emit a synthetic batch.

### 4.3 Live updates

* On each store write batch, dispatcher builds Δ (including predicate Δ) and invokes `Kernel.pushBatch(Δ)`.
* Kernel returns `{ outputName → {adds, removes} }` per subscribed graph; Subscription Manager relays these to clients.

### 4.4 Result payloads

* **Leaf ID** (single variable) or **tuple** (multiple vars). The GraphSpec's final `Project` defines this.
* **Set semantics**: clients receive only deltas; a tuple remains part of the result until a `remove` is delivered.

---

## 5) Predicates in the Store World

### 5.1 Enumerable (finite) predicates

Common cases you should predeclare and share:

* **Type sets:** `IsSupplier[s]` = projection of `InstanceOf[s,:Supplier]`.
* **Membership/tagging:** `HasTag[obj, tag]` with tags coming from a controlled vocabulary.
* **Local subpaths:** short subqueries like `ActiveFriend[u]` if you model activity via attributes; compiled to join subgraphs and cached as named relations.

**Integration:** Each such predicate is a **graph** of its own that emits a named **materialized relation** `P[...]`. Other queries simply \*\*Scan(P)\` and join.

### 5.2 Pointwise (non‑enumerable) predicates

Examples: time windows, external approvals, geometry tests, expensive ML classifiers.

**Declaration:** As **Compute(Pointwise)** nodes with:

* `tupleVars`: variables they depend on (must be bound in VO before this node).
* Provider implements `evalMany()`; optionally `flipsSince()` for delta efficiency.

**Truth maintenance:** The node keeps `(watchSet, truth)`; kernel converts flips into Δ on `P` and pushes downstream.

**Parametrization:** For `WithinDistance(poi, center, R)`, treat `(center,R)` as fixed params attached to the node instance (distinct relation name like `WithinDistance_[center,R]`).

---

## 6) Mapping Original "Instance‑Centric" Intuition to the Kernel

The earlier brainstorming used **per‑instance waiter maps** and **frontier nodes**. The kernel generalizes that:

* An instance waiting on attr `A` corresponds to a **join prefix** where earlier variables are **bound**; LFTJ⁺ delta probes upon `ΔA` replicate the "notify and extend" behavior.
* Instead of ad‑hoc placeholders, the **plan graph** captures waiting structure; **witness tables** ensure correct add/remove semantics across multiple derivations.
* **Predicate reactivity** is unified: enumerable via joins; pointwise via compute filters.

Net effect: same semantics, fewer moving parts, and strictly defined correctness via relational algebra.

---

## 7) Kernel Graph Patterns for Store Queries

### 7.1 Simple forward path

Path: `root / A / B / C → {v3}`

Graph:

* `Scan(A[v0,v1]) ⋈ Scan(B[v1,v2]) ⋈ Scan(C[v2,v3]) → Project(v3)` with VO `[v0,v1,v2,v3]`.

### 7.2 Path with inverse step

Path: `root / A / ^B / C → {v3}`

Graph:

* Use `Scan(A[v0,v1]) ⋈ Scan(B_inv[v1,v2]) ⋈ Scan(C[v2,v3])` (or swap columns if you didn't materialize `B_inv`).

### 7.3 Disjunction and exclusion

`( /A/B  OR  /D ) AND NOT (/E)` → `Union( Join(A,B), Scan(D) ) ▷ Join(E)` on matching projection keys.

### 7.4 Predicates as subqueries

`/A/ (exists subpath Q(x))` → compile `Q` to a named **predicate relation** `P[x]`, then join `P` at the appropriate level.

### 7.5 Pointwise filters

`/A/B where MLScore(a,b) > τ` → Compute(Pointwise) node after both `a,b` are bound; provider evaluates; node emits Δ on truth flips.

---

## 8) Iterator Adapters from the Store

### 8.1 Out/In tries

* Maintain two adjacency indexes per relationship type `R`:

  * `Out[A]: src → sorted dsts` (forward attr name `A`).
  * `In[A]:  dst → sorted srcs` (used by `A_inv`).

### 8.2 Factory contracts

For each enumerable relation name `Rel` the compiler might reference, register a factory:

* `makeIter(Rel, level i, boundPrefix)` → LevelIterator with `seekGE/next/key/atEnd` in the compiler's VO.
* **Binding:** for binary relations, if `Rel = A[src,dst]` and VO is `[src,dst]`, then:

  * level 1 iterators enumerate `src` keys (usually all keys → use `seekGE(-∞)` pattern).
  * level 2 iterators are created with bound `src` to enumerate `dst`.

> You can simplify by only exposing **level ≥2** iterators (post‑binding), and let the Join seed level‑1 via upstream atoms; either approach is fine if consistent with the LFTJ runner you implemented.

---

## 9) Handling Scalar Attributes & Replacements

* Scalars are enforced at the **store**; the dispatcher translates a replacement as `{remove old, add new}` in the same batch for the relevant relation(s).
* Kernel's **remove‑then‑add** rule per node ensures subscribers see a stable transition without transient false negatives/positives.

---

## 10) Multi‑Root Predicates & Global Views

* **Global sets** (e.g., blacklist, org policy) are best modeled as **enumerable predicate graphs** that produce named relations. All queries join them as needed.
* **Multi‑root predicates** that depend on STORE or constants (e.g., time windows) either:

  * emit whole‑set deltas (`ΔP`) per batch (enumerable), or
  * appear as pointwise `Compute` filters that flip truth for the watched tuples.

---

## 11) Activation & Bootstrap of Queries

Two supported methods:

1. **Bootstrap batch**: dispatcher reads current store state for all referenced relations/predicates and sends them as `adds`. Kernel emits initial results.
2. **Provider enumeration**: predicates/relations that can `enumerate()` do so; the host constructs a synthetic batch from these enumerations and any base relation snapshots.

The system must use **exactly one** method per graph activation to avoid double counting.

---

## 12) Examples (End‑to‑End)

### 12.1 "Suppliers in UK named Acme" (as earlier)

* Relations: `hasName[s,name]`, `locatedIn[s,country]`, `InstanceOf[s,type]`.
* Graph: `Scan(hasName) ⋈ Scan(locatedIn) ⋈ Scan(InstanceOf)` with VO `[s,name,country,type]` (or simpler VO if treating literals as constants); Project `{s}` to `SuppliersUKAcme`.
* Dispatcher Δ on `(hasName s "Acme")`, `(locatedIn s "UK")`, `(InstanceOf s :Supplier)` trigger LFTJ⁺ probes and result Δ.

### 12.2 "Projects with a member approved externally"

* Base: `memberOf[user,project]`.
* Pointwise compute: `ExternalApproved[user,project]`.
* Graph: `Scan(memberOf) → Compute(Pointwise ExternalApproved on (user,project)) → Project {project}`.
* Provider flips truth when external system updates; dispatcher includes those flips as **no‑op** (only for external signal), or the provider is invoked during the compute node's turn to produce Δ.

### 12.3 Disjunction and NOT

* Query: "items that are (tagged Red OR Blue) AND NOT Archived".
* Relations: `HasTag[item,tag]`, `Archived[item]` (unary as `Archived[item, ⊤]` or dedicated schema).
* Graph: `Union( Scan(HasTag where tag=Red), Scan(HasTag where tag=Blue) ) ▷ Scan(Archived)`; Project `{item}`.

---

## 13) Edge Cases & Safety Notes (MVP)

* **Cycles in base graph:** allowed; algebra handles them. Only **operator cycles** are restricted (no recursive negation in MVP).
* **Large fan‑out:** compiler should choose VO to limit probe explosion (e.g., put selective atoms early). Engine correctness is unaffected.
* **Non‑enumerable predicates with partial binding:** **disallow**; compiler must place Compute(Pointwise) only after all variables are bound.
* **Id collisions & typing:** ensure the host uses a **canonical atom encoding** consistent with the kernel's ordering (the engine relies on it for joins).

---

## 14) What to Reuse & Share

* **GraphSpec cache:** canonicalize queries (normalize attr names, VO, predicate parameterization) and reuse graphs across identical subscriptions.
* **Predicate graphs:** centralize common enumerable predicates (e.g., `IsSupplier`, `IsActive`) as shared named relations.
* **Iterator adapters:** shared per relation; used by all graphs that reference that relation.

---

## 15) Interfaces (Host ↔ Kernel ↔ Clients)

### 15.1 Host → Kernel

* `defineRelation(name, schema)` once per relation name used by graphs.
* `defineGraph(graphId, graphSpec)`; `activateGraph(graphId)`.
* `pushBatch({ relName → Δ }) → { outputName → Δ }` per batch.

### 15.2 Kernel → Host (callbacks/providers)

* **Iterator factories** for enumerable relations referenced by Join nodes.
* **Compute providers** for predicate nodes: enumerable (`deltaSince`) and/or pointwise (`evalMany/flipSince`).

### 15.3 Query API (Client → Host)

* `submitPathQuery(spec, projection) → subscriptionId` (host compiles to GraphSpec and activates it).
* `unsubscribe(subscriptionId)` (host removes output binding and may GC graph if unused).
* `onChange(subscriptionId) → stream of {adds, removes}` (values are tuples per projection).

---

## 16) Glossary (Integration‑specific)

* **Attribute**: named forward/backward view of a relationship type.
* **Kernel relation**: an n‑ary relation exposed to the kernel (e.g., `hasName[src,dst]`).
* **GraphSpec**: JSON‑like spec describing a kernel DAG (nodes, edges, VO, outputs).
* **Enumerator/probe**: LFTJ enumeration/delta probe inside kernel Join.
* **LiveSet/Predicate**: a relation produced by a predicate graph (enumerable) or by a pointwise compute node (non‑enumerable).
* **Dispatcher**: host component that builds per‑batch Δ from store writes and predicate changes.

---

### Final Note

This design faithfully maps the attribute store semantics (binary relationships, path queries, predicates, and live notifications) onto the already‑implemented kernel. The host compiles domain concepts into **relations and graphs**, supplies **deltas and iterators**, and the kernel guarantees **correct incremental change‑sets** for subscribers.