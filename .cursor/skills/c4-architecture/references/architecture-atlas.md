---
title: Architecture atlas guidance
description: Diagram-first architecture-document structure and progressive-detail rules
---

# Architecture atlas guidance

An architecture atlas is a navigable set of mutually consistent diagrams plus the minimum supporting text needed to understand evidence, contracts, decisions, and uncertainty.

## Use project conventions first

Inspect existing architecture documentation before selecting files, headings, diagram placement, decision formats, or link style. Update an established atlas in place. When no convention exists, propose `docs/architecture/architecture-atlas.md` and use the provided template after the user confirms any consequential location choice.

## Diagram-first reading order

Place orientation and diagrams before detailed prose:

1. scope, model state, evidence cutoff, and system owner
2. optional notation legend
3. System Landscape when ecosystem orientation is needed
4. C1 System Context
5. C2 Container
6. selective C3 Component views
7. scenario-specific Dynamic views
8. environment-specific Deployment views
9. element registry
10. important data contracts
11. architectural decisions
12. evidence and validation
13. unresolved questions

Readers should be able to stop after any section and retain a coherent model.

## Concise diagram introductions

Introduce each diagram with at most:

- the question it answers
- its scope and model state
- one evidence or limitation note when necessary

Avoid prose that restates every node and relationship.

## Element registry as consistency control

Keep one table with:

`Stable ID | Approved name | Definition | Type | Owner | Parent | State | Evidence`

Every diagram element maps to exactly one registry row. When one physical platform contains separately owned workloads or schemas, use separate registry rows and ownership boundaries.

## Data contracts

Document only architecture-significant contracts:

`Contract | Producer | Consumer | Transport | Compatibility | Owner | State | Evidence`

Link contract participants by approved names. Keep schema details in dedicated specifications and link them.

## Architectural decisions

Use the project's decision-record convention. If none exists, record:

`Decision | Status | Rationale | Consequences | Affected elements | Evidence`

Do not convert an unresolved question into a decision.

## Unresolved questions

Each question states:

- the missing or conflicting evidence
- the architectural consequence
- the decision owner when known
- plausible options when they are genuinely bounded

Keep uncertainty visible beside the diagrams it affects and summarize it in the final section.

## Proposed and verified content

Prefer separate verified and proposed diagrams when their topologies substantially differ. Use a Mixed diagram only when comparison or transition understanding is the primary purpose. Mixed diagrams must visibly mark proposed elements and relationships and retain evidence per registry row.

## Atlas splitting

Keep one index when the atlas grows beyond one readable file. Split by architectural level, bounded system, scenario, or environment while preserving:

- one canonical element registry or generated registry source
- stable identifiers
- approved terminology
- explicit cross-links
- one validation summary

Avoid duplicate, independently maintained definitions.

## Review checklist

- Diagrams are the primary content and follow progressive detail.
- The diagram set is sufficient without indiscriminate C3 or C4 expansion.
- Supporting prose adds decisions, contracts, evidence, or uncertainty.
- Every repeated element matches the registry and glossary.
- Owners and parent boundaries are explicit.
- Proposed architecture and verified implementation are distinguishable.
- Unresolved questions remain visible.
