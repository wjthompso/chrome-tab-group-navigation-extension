---
title: C4 modeling instructions
description: Evidence, consistency, ownership, terminology, and diagram-selection rules
author: Microsoft; adapted for Cursor
---

# C4 modeling instructions

Apply these rules to every architecture atlas and diagram.

## Mandatory uncertainty gate

Before producing diagrams, identify consequential decisions about:

- system scope, boundaries, and ownership
- internal containers versus external systems
- data-store and schema ownership
- verified implementation versus proposed architecture
- component membership, interactions, and relationship technologies
- Dynamic scenario order and participant abstraction levels
- Deployment environments and execution placement
- canonical terminology and diagram scope

Stop and ask when documentation and implementation disagree, ownership is not evidenced, two classifications are plausible, verified and proposed elements coexist without clear state markers, or the selected boundary materially changes the model. State the evidence and plausible options. Do not produce or modify diagrams until the user resolves the decision.

## Canonical terminology gate

1. Read `docs/architecture/glossary.md` when it exists.
2. Align element names and definitions with it before drawing.
3. If the file is absent, report: `docs/architecture/glossary.md is missing` and request explicit approval to create it at that exact path.
4. Never create the glossary, add a canonical term, or redefine or rename an existing term without approval.
5. Follow active global user terminology rules rather than duplicating their naming process here.
6. After an approved terminology change, offer to synchronize diagrams, documentation, interfaces, and code.

Established code and documentation names may be reused as evidence while glossary creation is unresolved, but do not present a new or conflicting name as canonical.

## Model-state rules

Classify each atlas and diagram:

- **Verified Implementation**: supported by current code, configuration, runtime evidence, or deployment manifests.
- **Proposed Architecture**: supported by approved requirements or design decisions but not verified in implementation.
- **Mixed**: contains both states.

Include the state in each diagram title. In a Mixed diagram, mark every proposed element and proposed relationship with visible `[Proposed]` text; never rely on color alone. Record the evidence and state in the element registry. A planned integration is excluded unless requirements or approved design documentation explicitly specify it.

## Stable element registry

Maintain one registry for the atlas with:

- stable identifier
- approved name
- concise definition
- C4 element type
- owner
- parent boundary
- model state
- evidence source

Use the same identifier, name, definition, type, owner, and parent wherever an element reappears. Preserve identifiers during edits and renames unless identity truly changes. Record an approved rename as a registry migration rather than silently replacing the identifier.

## Element introduction and level discipline

- Introduce people and software systems at C1.
- Introduce containers at C2.
- Introduce components inside exactly one parent container at C3.
- Introduce code structures at C4 only after explicit user request and only inside one approved C3 component.
- A lower-level diagram may repeat a higher-level element only after it appears at its owning level.
- Update the owning higher-level view first when a lower-level view needs a missing element.
- Keep C3 selective: include components only when their responsibilities and interactions are evidenced and the view resolves an architectural question.

System Landscape diagrams may introduce multiple software systems for ecosystem orientation, but each system reused in C1 must retain its registry identity.

## Boundary and ownership rules

Ownership and operational control determine container versus external system:

- Model a service or data store as an internal container only when the modeled owner deploys or operates its code or schema inside the agreed boundary.
- Model a capability the owner merely calls as an external system, including externally operated software as a service.
- A managed cloud service containing team-owned schema, functions, or code may be an internal container when the team provisions and operates that workload.
- Do not infer ownership from hosting, credentials, network location, or data subject matter.
- Determine who defines, migrates, seeds, and operates each schema. Separately owned schemas remain separate elements even on one database platform.
- Preserve ownership boundaries in Dynamic and Deployment diagrams. Deployment nesting communicates execution placement, not ownership.

## Relationship rules

Create a relationship only when code, configuration, runtime evidence, or approved documentation identifies it.

- Draw every arrow from the initiator or dependent to the dependency.
- Use active-voice labels such as `calls`, `publishes to`, or `reads from`.
- Treat passive labels as a direction warning and re-check the initiator.
- Include a technology only when evidence identifies it.
- Keep an element's initiator/dependency role consistent across C1 and C2.
- Component proximity, similar responsibilities, or shared container membership do not prove interaction.

## Dynamic diagrams

Every Dynamic title names the scenario and primary level:

- `Checkout — Dynamic (C2) — Verified Implementation`
- `Order validation — Dynamic (C3) — Proposed Architecture`
- `Order placement — Dynamic (Mixed C2/C3) — Mixed`

For a single-level Dynamic diagram, omit repeated element-type labels from participant headers. The title already establishes the level.

For a mixed-level Dynamic diagram:

- visibly identify each participant as Person, Software System, Container, Component, or External System
- group components inside a box named for their parent container when useful
- preserve parent ownership boundaries
- keep participant names and aliases stable throughout the scenario
- show repeated participant headers using Mermaid's mirrored actor headers

Prefer `sequenceDiagram` for ordered requests, responses, retries, loops, alternatives, and failures. Use a numbered C4 flowchart when topology and dependency paths matter more than strict timing. Number interactions consistently when sequence order is architectural evidence.

Do not infer temporal order from static dependencies. A Dynamic relationship must have scenario evidence. Validate participant level, ownership, direction, order, state, technology, and consistency with static views.

## Deployment diagrams

Offer a Deployment diagram when infrastructure-as-code, manifests, orchestration configuration, deployment workflows, or scripts provide useful topology evidence. If the user already requested it, proceed without asking again.

- Use one named environment per diagram.
- Model only evidenced nodes, regions, instance counts, network boundaries, and placements.
- Place each container instance inside its evidenced execution node.
- Trace every container instance to one C2 container identifier.
- Keep external systems outside owned deployment nodes unless evidence proves co-hosting; retain their external type and owner if nested.
- Stop when deployment sources disagree.

## Data contracts and decisions

After the diagrams, document only contracts and decisions that affect architectural understanding:

- producer, consumer, payload or schema name, transport, compatibility expectations, and owner
- decision, status, rationale, consequences, and linked diagram elements

Do not bury missing evidence in prose. Put unresolved questions in an explicit section.

## Attribution

Adapted from Microsoft HVE Core's C4 modeling instructions at source revision `e648f6d96380e32219a716ca40530131a3e631fa`. C4 concepts are based on the [C4 Model](https://c4model.com/) by Simon Brown, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
