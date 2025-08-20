# Incremental N‑ary Relational Kernel — MVP Design (Integrated Spec)

> **Scope**: A batch‑driven engine that accepts **arbitrary additions/removals** on named **n‑ary relations**, maintains a DAG of **relational operators**, and emits **change‑sets** for named outputs. Queries/paths/attributes are compiled **outside** into this algebra. This document is an implementation‑level design for a senior developer. It includes precise algorithms, data structures, and interfaces. No NFRs, deployment, or planning roadmap.

---

## 1) Engine Boundary & Mental Model

### 1.1 What the engine natively cares about

* **Relations** `R[x₁,…,x_k]` with **set semantics** (no duplicates, no order).
* **Deltas** `ΔR = {adds ⊆ R, removes ⊆ R}` supplied in **batches** (no transactions or seqnos in the engine).
* A **DAG of operators** (nodes) that consume/produce relations.
* **Outputs**: named relations whose per‑batch change‑sets are returned by the engine.

### 1.2 What is outside (host responsibility)

* Storage/durability/logging, domain modeling (attributes/objects), query parsing & planning, variable‑order selection, and predicate implementations. The engine consumes/produces **relations** and **deltas** only.

### 1.3 Core interaction

* `pushBatch({ relName → ΔR }) → { outputName → ΔOut }`.
* Graph (structure) updates occur **between** batches.

---

## 2) Value Model, Tuples, and Ordering

### 2.1 Atom types

* **Atom** ∈ `ID | Integer | Float | String | Boolean | Symbol` (extensible by host). All atoms are immutable.

### 2.2 Equality & total order

* **Equality**: type+value equality (e.g., `Integer(1) ≠ String("1")`).
* **Total order** (required by iterators & join):

  1. Type precedence: `Boolean < Integer < Float < String < Symbol < ID` (host may fix a different global order, but it must be total and consistent).
  2. Within type: natural order (booleans: `false < true`; integers/floats: numeric; strings/symbols: lexicographic UTF‑8; IDs: lexicographic by canonical byte encoding).

### 2.3 Canonical tuple encoding

* **Tuple** is an ordered vector of Atoms. For hashing and map keys, use the canonical byte encoding: `[arity:uint8][type-tag+value bytes]*`. The engine requires a deterministic encoder to key witness tables and counters.

---

## 3) Relations, Schemas, and Validation

### 3.1 Schema

* **Schema**: `R[x₁:τ₁,…,x_k:τ_k]` where `τ_i` is a type predicate over Atoms (host may choose `any`). Variable names are unique per relation.

### 3.2 Relation registry

* The engine tracks `name → schema`. A relation name is unique.

### 3.3 Input validation (MVP)

* On `pushBatch`, for each tuple `t` in `ΔR`, the engine validates **arity**. Type checking is host‑optional; if enabled, each `t[i]` must satisfy `τ_i`.
* Deltas are **set‑normalized** per relation before propagation (see §6.1).

---

## 4) Graph Model (Operators & Wiring)

### 4.1 Nodes (operator set)

Each node maintains internal **support/witness state** to compute correct removals and is **purely set‑based**.

* **Scan(R)** — exposes an input relation `R`.

  * *State:* optional current set `S_R` (not required if host guarantees exact Δ across batches).
  * *onBatch:* emit `ΔR` as received (after dedup) and (optionally) update `S_R`.

* **Join(⋈)** — n‑ary natural/equi‑join over shared variables.

  * *State:* per‑output **witness table** `W[outTuple] → count` (u32). No need to cache entire cross‑product.
  * *Interfaces:* requires **iterators** per input atom in a provided **variable order (VO)**. See §5.

* **Union(∪)** — disjunction of two (or more) inputs with same schema.

  * *State:* `U[outTuple] → count` (# of inputs that currently contribute).

* **Diff(R ▷ S)** — anti/semi‑join (negation‑as‑failure) on key `K` (subset of variables in `R` and `S`).

  * *State:* `L[leftTuple] → present∈{0,1}` and `Rsup[key] → u32` (right‑support count).

* **Project(π attrs)** — projection to a subset of attributes.

  * *State:* `P[projTuple] → u32` (# of upstream tuples mapping to this projection).

* **Rename(ρ)** — variable renaming (stateless; applied to Δ in‑flight). Often compiled away.

* **Compute(P)** — **computed predicate** node; two modes (both emit Δ like relations):

  1. **Enumerable** (materializable): provider supplies `ΔP` per batch (see §8.1); the node behaves like a scan over `P`.
  2. **Pointwise** (non‑enumerable filter): placed after all vars for `P` are **bound** (enforced by GraphSpec). Maintains `watchSet` and `truth` map; emits Δ on truth flips (see §8.2).

> MVP graphs are **acyclic** or **stratified** if Diff is used (no cycles through negation).

### 4.2 Edges & topological order

* The engine stores a topologically sorted list of nodes. All parents of a node precede it. Pointwise compute nodes must appear only after nodes that bind their variables.

### 4.3 Outputs

* Any node output may be designated as a **named output relation**. At the end of `pushBatch`, the engine returns coalesced `{adds, removes}` for each named output.

---

## 5) Join Node in Detail (LFTJ / LFTJ⁺)

### 5.1 Variable Order (VO) and iterator groups

* The **planner** (outside the engine) supplies VO: `[v₁,…,v_n]`.
* For each atom `A_j`, columns are **reordered** to match VO projection over its variables. The Join builds **level groups**: for each `v_i`, the list of iterators from atoms containing `v_i`.

### 5.2 Iterators (hard spec)

* **Construction:** `makeIter(A, level i, boundPrefix)` returns a LevelIterator over keys of `v_i` under the fixed `boundPrefix` for earlier VO vars in `A`.
* **API:**

  * `seekGE(key)` — position to smallest key ≥ `key` under current prefix. If atEnd before call, remains atEnd.
  * `key()` — returns current key (Atom) for this level. Undefined if `atEnd()`.
  * `next()` — advance to next key; if past last, `atEnd()` becomes true.
  * `atEnd()` — true iff no more keys under current prefix.
* **Ordering:** keys are produced in strict ascending order per §2.2.
* **Reuse:** iterators are scoped to one Join descent (enumeration or probe). The engine may pool/recycle, but semantics assume fresh instances per call.
* **Errors:** if the provider cannot honor the bound prefix (no rows) it returns an iterator that is immediately `atEnd()`.

### 5.3 Initial enumeration (LFTJ)

**Idea:** At level `i`, **intersect** keys of all iterators in that level by advancing the smallest to the largest until all equal, then **descend**.

**Conceptual pseudocode (outline):**

```
leapfrog(level i):
  if i > n: emit current binding; return
  let G = iterator group for v_i (len ≥ 1)
  for each it in G: it.seekGE(-∞)
  loop:
    let maxKey = max(it.key() for it in G)
    for it in G:
      it.seekGE(maxKey)
      if it.atEnd(): return
    // all equal
    bind v_i = maxKey
    leapfrog(i+1)
    // advance one iterator to find next candidate at this level
    G[0].next()
    if G[0].atEnd(): return
```

(Real implementation rotates which iterator advances to balance work.)

### 5.4 Delta probes (LFTJ⁺)

**Goal:** Given a single input delta tuple `t` from atom `A_k`, enumerate **only** output bindings affected by adding/removing `t`.

**Procedure:**

1. **Bind prefix:** Using VO, fix variables of `A_k` present in `t`. This yields a **bound prefix** `π` of length `p`.
2. **Create constrained iterators:** For every atom `A_j`, create level iterators consistent with `π` (i.e., with bound earlier vars).
3. **Probe remainder:** Run the leapfrog descent starting at level `p+1` to enumerate completions consistent with `π`.
4. **Projection & witness:** For each completed binding, apply downstream `Project` (if any) to compute `outTuple`; then adjust `W[outTuple]` (increment for Δ⁺, decrement for Δ⁻). Emit add on 0→1, remove on 1→0.

**Processing order:** For cache locality, the Join sorts/proceses Δ tuples **by VO prefix**. This is an optimization; correctness does not depend on it.

**Notes:** The MVP does not implement sensitivity ranges; each probe is independent and correct.

---

## 6) Batch Semantics & Normalization

### 6.1 Input normalization rules

For each input relation `R`:

1. **Deduplicate** within `adds` and within `removes` (set semantics).
2. **Cancel opposites** inside the same batch: `adds := adds − removes`, `removes := removes − adds` (evaluate on original sets; implement as symmetric difference).
3. The engine processes **removes before adds** in all nodes.

### 6.2 Node‑local ordering

* Every node must emit **removes then adds** for its output within the batch. This prevents flicker under scalar/replace semantics.

### 6.3 Determinism

* For identical input batches and identical graph state, outputs are deterministic.

---

## 7) Node Semantics on Deltas (Precise Rules)

### 7.1 Scan

* Emit `ΔR` as received post‑normalization. If maintaining `S_R`, apply `S_R := (S_R − removes) ∪ adds`.

### 7.2 Union

* Maintain `U[outTuple] → u32`.
* For `t ∈ adds(input i)`: `U[t]++`; emit add if `U[t]` 0→1.
* For `t ∈ removes(input i)`: `U[t]--`; emit remove if `U[t]` 1→0.

### 7.3 Project(π attrs)

* Maintain `P[projTuple] → u32`.
* For `t ∈ adds`: `p = π(t)`; `P[p]++`; emit add if 0→1.
* For `t ∈ removes`: `p = π(t)`; `P[p]--`; emit remove if 1→0.

### 7.4 Diff (Left ▷ Right) on key `K`

* Maintain `L[leftTuple] ∈ {0,1}`, `Rsup[key] → u32`.
* **Left Δ:**

  * Add `l`: set `L[l]=1`; if `Rsup[key(l)]==0` emit **add l**.
  * Remove `l`: if `Rsup[key(l)]==0` emit **remove l**; set `L[l]=0`.
* **Right Δ:**

  * Add `r`: `Rsup[key(r)]++`; if 0→1 emit **removes** for all `l` with `key(l)=key(r)` and `L[l]=1`.
  * Remove `r`: `Rsup[key(r)]--`; if 1→0 emit **adds** for all `l` with `key(l)=key(r)` and `L[l]=1`.
* **Indexing need:** Diff must be able to enumerate `Left` tuples by `key`. Keep `IndexLeftByKey: key → Set<leftTuple>` updated alongside `L`.

### 7.5 Join

* For each input atom's Δ tuple `t`, run **delta probe** (LFTJ⁺) as in §5.4; adjust witness `W` and emit adds/removes on 0↔1 crossings.

### 7.6 Compute — Enumerable

* Provider returns `ΔP`; the node behaves like Scan(P) and emits the same.

### 7.7 Compute — Pointwise (filter)

* *State:* `watchSet`, `truth: Map<Tuple,bool>`.
* *Upstream adds:* add candidates to `watchSet`. Evaluate truth for **new candidates** via `evalMany`; set `truth[t]=true` and emit `add t` for ones that were false.
* *Upstream removes:* if `t` in `watchSet`, remove from `watchSet`; if `truth[t]==true`, set false and emit `remove t`.
* *Flips:* if provider supports `flipsSince`, apply `false` set → emits removes (for those currently true); apply `true` set → emits adds (for those currently false). Keep `truth` consistent.
* **Placement rule:** This node must appear only after all variables in its tuple are bound by its parent path.

---

## 8) Computed Predicate Providers (External Contracts)

### 8.1 Enumerable providers

* **Interfaces:**

  * `enumerate() -> Set<Tuple>` (optional cold start)
  * `deltaSince(stateHandle) -> {adds:Set<Tuple>, removes:Set<Tuple>}`
* **Idempotency:** Providers must not emit duplicate tuples within a batch; the engine still dedups.
* **Timing:** Called once per batch by the engine before propagation.

### 8.2 Pointwise providers

* **Interfaces:**

  * `evalMany(candidates:Set<Tuple>) -> Set<Tuple>` returning those **true now**.
  * Optional `flipsSince(stateHandle, watched:Set<Tuple>) -> {true:Set<Tuple>, false:Set<Tuple>}`
* **Idempotency:** A tuple may appear in both upstream adds and `true` flips in the same batch; the engine normalizes in node order (removes before adds).
* **Responsibility:** Providers deliver **current truth**; the engine maintains `watchSet`/`truth` and converts changes into Δ.

---

## 9) Iterators & Tries (for Join)

### 9.1 Relation representation (enumerable atoms)

* For each relation `R[x₁,…,x_k]`, maintain a **Trie/PFX index** in the plan's VO order. MVP in‑memory layout:

  * `Map<Prefix(0..i-1), SortedSet<x_i>>` for each level `i`.
  * Implement as a hash‑map from encoded prefix → sorted vector of encoded keys for `x_i`.

### 9.2 Iterator factories

* `makeIter(A, level i, boundPrefix)` produces a LevelIterator over `x_i` values with that prefix.
* Adhere strictly to the iterator API (§5.2) and ordering (§2.2).

---

## 10) Batch Propagation Algorithm (Engine Runtime)

1. **Normalize input** per §6.1.
2. **Seed leaf nodes:**

   * For each `Scan(R)`: push `ΔR` downstream.
   * For each `Compute(P)` enumerable: fetch `ΔP` and push like Scan.
3. **Topological push:**

   * For each node `N` in topo order:

     * Merge incoming Δ from parents (coalesce).
     * Apply node semantics (Sections 7.2–7.7).
     * Emit `ΔN` to children.
   * For **Pointwise Compute** nodes: at their turn, gather candidate tuples from their parent Δ, query provider(s), compute Δ, forward.
4. **Outputs:** collect and coalesce `{adds, removes}` for each declared output; return to caller.

All nodes obey **remove‑then‑add** emission within the batch.

---

## 11) Graph Control Plane (Structure)

### 11.1 GraphSpec (formal)

A graph is a JSON‑like object with nodes, edges, and outputs; VO is specified per Join.

```json
{
  "relations": [
    {"name": "A", "schema": ["a","b"]},
    {"name": "B", "schema": ["b","c"]},
    {"name": "P", "schema": ["b"]},
    {"name": "Q", "schema": ["a","c"]}
  ],
  "nodes": [
    {"id": "scanA", "op": "Scan", "rel": "A"},
    {"id": "scanB", "op": "Scan", "rel": "B"},
    {"id": "scanP", "op": "Scan", "rel": "P"},
    {"id": "join1", "op": "Join", "inputs": ["scanA","scanP","scanB"],
     "vo": ["a","b","c"],
     "atoms": [
       {"rel": "A", "vars": ["a","b"]},
       {"rel": "P", "vars": ["b"]},
       {"rel": "B", "vars": ["b","c"]}
     ]
    },
    {"id": "qFilter", "op": "Compute", "mode": "Pointwise", "rel": "Q", "inputs": ["join1"],
     "tupleVars": ["a","c"]},
    {"id": "proj", "op": "Project", "inputs": ["qFilter"], "attrs": ["a","c"]}
  ],
  "outputs": [{"name": "Res", "from": "proj"}]
}
```

### 11.2 Activation

* `defineGraph(graphId, graphSpec)` validates acyclicity/stratification and variable binding rules for pointwise computes.
* `activateGraph(graphId)` builds the DAG and internal states. Cold start is either via host‑sent **bootstrap batch** or via providers' `enumerate()` followed by a synthetic batch.

---

## 12) Correctness Constraints & Assumptions

* **Set semantics** end‑to‑end; inputs and outputs are sets.
* **Acyclic / stratified** graphs for MVP (no recursive negation cycles).
* **Total order** on Atoms per §2.2 used consistently by all iterators.
* **VO** is supplied by the planner; the engine **does not** choose or change VO.
* **Pointwise computes** appear only after all their variables are bound on their input path.
* **Remove‑then‑add** emission per node per batch.

---

## 13) Complexity Overview

* **Scan/Enumerable Compute:** O(|Δ|) time; optional O(|R|) memory if caching state.
* **Project/Union/Diff:** O(|Δ|) per batch plus hash‑map overhead for counters; memory proportional to #distinct projected/unioned/left tuples seen.
* **Join (enumeration):** classical LFTJ bound (worst‑case optimal) under chosen VO.
* **Join (delta probes):** per Δ‑tuple work proportional to completions under its bound prefix; sort probes by VO prefix for locality.
* **Pointwise Compute:** O(|candidates| + |flips|) provider calls; engine updates O(|candidates|) for truth map maintenance.

---

## 14) Worked Mini‑Example

**Goal:** Output `Res[a,c]` for a path with a unary predicate on `b` and a pointwise check on `(a,c)`.

* Inputs:

  * `A[a,b]` (attribute forward)
  * `B[b,c]` (attribute forward)
  * `P[b]` (enumerable predicate)
  * `Q[a,c]` (pointwise predicate)

* Graph: as in §11.1.

* Batch arrives: `ΔA={+(a1,b2)}`, `ΔB={+(b2,c3)}`, `ΔP={+(b2)}`.

  1. Scans emit their Δ.
  2. `Join1` receives seeds from three inputs; each Δ tuple triggers an LFTJ⁺ probe; the combined effect yields `(a1,b2,c3)`.
  3. `qFilter` receives candidate `(a1,c3)`; provider returns true; `qFilter` emits `+(a1,c3)`.
  4. `proj` emits `+(a1,c3)` to output `Res`.

---

## 15) Implementation Notes (clarifying, not a plan)

* **Witness tables:** Use canonical tuple encoding (§2.3) as map keys. GC entries when count hits 0.
* **Diff indexing:** Maintain `key → Set<leftTuple>` in addition to `L[leftTuple]` for efficient right‑side updates.
* **Iterator pooling:** Allowed for perf; must not violate single‑descent semantics.
* **Determinism:** Ensure per‑node remove‑then‑add ordering and stable set operations inside each batch.

---

*This integrated spec defines exact data types, operator semantics, iterator contracts, computed predicate handling, batch normalization, and a formal GraphSpec. It is intended to be directly implementable by a senior developer without further disambiguation.*