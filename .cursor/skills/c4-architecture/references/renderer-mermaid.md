---
title: Mermaid C4 renderer
description: Mermaid flowchart, sequence, class, styling, layout, and validation conventions
author: Microsoft; adapted for Cursor
---

# Mermaid C4 renderer

Use Mermaid `flowchart` syntax with C4 conventions for System Landscape, C1, C2, C3, flowchart-based Dynamic, and Deployment diagrams. Use `sequenceDiagram` for ordered Dynamic scenarios and `classDiagram` only for explicitly requested C4 Code views. Do not use Mermaid's dedicated `C4Context` or `C4Container` diagram types.

## Titles and model state

Every diagram requires a Mermaid frontmatter `title`:

```text
---
title: Storefront — C2 Container — Verified Implementation
---
```

Dynamic titles include their primary level: `Dynamic (C2)`, `Dynamic (C3)`, or `Dynamic (Mixed C2/C3)`. Deployment titles include the environment. Mixed-state diagrams visibly mark proposed elements and relationships with `[Proposed]`.

## Flowchart rules

- Use `flowchart TB`, except the optional shared legend uses `flowchart LR`.
- Apply the three-band layout to System Landscape, C1, C2, C3, flowchart-based Dynamic, and Deployment diagrams.
- Generate every node and subgraph identifier with the identifier scheme.
- Use Mermaid Markdown strings for visible node, subgraph, and relationship labels: wrap label text in backticks and double quotes.
- Separate visible label lines with literal newlines.
- Bold the element name, italicize its stereotype line, and keep its concise description at normal weight.
- Put evidence-backed technology after the stereotype's colon.
- Omit technology when unknown.
- Use one short-clause description; longer definitions belong in the element registry.
- Never use `direction` inside a subgraph. Use rank control instead.

### Flowchart configuration

Any flowchart with a subgraph begins with:

```text
---
title: Diagram title — C2 Container — Verified Implementation
config:
  flowchart:
    subGraphTitleMargin:
      bottom: 30
---
```

### Identifier scheme

| Element or helper | Prefix | Example |
|---|---|---|
| Person or actor | `person_` | `person_customer` |
| Software system in focus | `sys_` | `sys_storefront` |
| Container or owned data store | `ctr_` | `ctr_order_db` |
| Component | `cmp_` | `cmp_pricing` |
| External system or data store | `ext_` | `ext_payment_gateway` |
| Infrastructure node | `infra_` | `infra_gateway` |
| Deployment node | `deploy_` | `deploy_azure` |
| Generic boundary | `bnd_` | `bnd_shared_services` |
| Layout-only subgraph | `layout_` | `layout_top` |

Create the suffix by lowercasing the approved name, replacing each run of non-alphanumeric characters with one underscore, and trimming edge underscores. Keep the prefixed identifier stable across diagrams. Resolve collisions with a short meaningful qualifier.

Container instances reuse the C2 container identifier plus `_i`; add an execution-node qualifier for multiple instances, such as `ctr_api_i_zone_1`.

### Shapes and classes

| C4 element | Mermaid syntax | Class |
|---|---|---|
| Person | `person_id(["`…`"])` | `person` |
| Software system | `sys_id["`…`"]` | `system` |
| Container | `ctr_id("`…`")` | `container` |
| Component | `cmp_id["`…`"]` | `component` |
| External system | `ext_id["`…`"]` | `external` |
| Internal data store | `ctr_id[("`…`")]` | `dataStore` |
| External data store | `ext_id[("`…`")]` | `external` |
| Infrastructure node | `infra_id["`…`"]` | `infrastructure` |
| Boundary | dashed `subgraph` | `style` by identifier |
| Deployment node | solid `subgraph` | `style` by identifier |

Use these class definitions whenever the corresponding type appears:

```text
classDef person fill:#C05621,stroke:#8A3E14,color:#ffffff
classDef system fill:#071E36,stroke:#041422,color:#ffffff
classDef container fill:#1F6FB2,stroke:#154E7D,color:#ffffff
classDef component fill:#C5E4F8,stroke:#6FA3CC,color:#071E36
classDef dataStore fill:#1F7A4D,stroke:#145C38,color:#ffffff
classDef external fill:#999999,stroke:#6b6b6b,color:#ffffff
classDef infrastructure fill:#b0c4de,stroke:#7b899b,color:#000000
classDef proposed stroke-width:3px,stroke-dasharray:8 4
```

Orange is a person, because a person is a C4 element and another blue is too close to the software. Our software uses three separated blues: a software system is deep navy `#071E36`, a container is medium blue `#1F6FB2`, and a component is pale blue `#C5E4F8` with navy text. A green cylinder is a data store we own. An external system, including an external data store, stays gray. A dashed outline is a boundary. Repeat this color key in the atlas. Include `classDef dataStore` only on diagrams that draw an owned data store. Do not leave a component on Mermaid's default grey actor color.

Assign every node to exactly one element-type class. An owned data store keeps the `ctr_` prefix, because C4 still treats it as a container, and it uses the `dataStore` class rather than `container`. Add the `proposed` class as a second class assignment for proposed nodes in Mixed diagrams, while retaining visible `[Proposed]` text.

Style boundaries:

```text
style deploy_node fill:none,stroke:#154E7D,color:#154E7D
style bnd_boundary fill:none,stroke:#888888,stroke-dasharray:5 5,color:#888888
style layout_top fill:none,stroke:none
style layout_center fill:none,stroke:none
style layout_bottom fill:none,stroke:none
```

### Visible labels

Use these patterns:

```text
person_customer(["`**Retail Customer**
*[Person]*
Places orders`"])

ctr_order_api("`**Order API**
*[Container: .NET]*
Processes orders`")

cmp_validator["`**Order Validator** [Proposed]
*[Component]*
Checks order rules`"]
```

For nested boundaries, use one line when the boundary contains visible subgraphs:

```text
subgraph deploy_cloud["`**Cloud Platform** *[Deployment Node]*`"]
```

Use two lines for an innermost visible boundary:

```text
subgraph sys_storefront["`**Storefront**
*[Software System]*`"]
```

Relationships use active voice and put evidenced technology on a second line:

```text
ctr_web -->|"`calls
*[JSON/HTTPS]*`"| ctr_api
```

### Three-band layout

- Put initiating people, clients, systems, or containers in `layout_top`.
- Put the system or container under scrutiny in `layout_center`.
- Put invoked dependencies and external systems in `layout_bottom`.
- Nest visible system, container, and deployment boundaries inside the appropriate layout band.
- Omit `layout_bottom` when no depicted dependency exists.
- Hide all layout-only subgraph borders.

Mermaid places a target below a source. Lengthen meaningful real edges first to separate ranks:

| Link | 1 rank | 2 ranks | 3 ranks | 4 ranks |
|---|---|---|---|---|
| Invisible | `~~~` | `~~~~` | `~~~~~` | `~~~~~~` |
| Arrow | `-->` | `--->` | `---->` | `----->` |

Use the shortest invisible dependency only when real edges cannot establish the intended order.

### Band-stacking validation

When rendered output is available, inspect visible descendants. The lowest visible point in `layout_top` must be above the highest visible point in `layout_center`; the same inequality applies from center to bottom.

Without rendering, perform static rank analysis:

1. Assign each visible node to a band.
2. Treat directed and invisible links as minimum-rank constraints.
3. Calculate earliest possible ranks.
4. Require every top rank to precede every center rank and every center rank to precede every bottom rank.
5. Treat cycles, reverse constraints, disconnected adjacent bands, or unproven inequalities as failure.

Correct rank control and repeat validation.

## Static C4 views

### System Landscape

Show only people and software systems needed for ecosystem orientation. Preserve ownership boundaries and stable system identifiers. The primary title is `System Landscape`; it has no C-level number.

### C1 System Context

Show the system in focus, its users, and directly interacting external systems. Do not show containers or components.

### C2 Container

Put all in-scope containers and owned data stores inside the system boundary. Keep external systems outside it. Every C2 relationship refines, rather than contradicts, C1.

### Selective C3 Component

Create one diagram per selected parent container. Put all shown components inside that container boundary. Repeat only the C2 containers and external systems needed to explain evidenced component interactions.

### C4 Code

Generate only by explicit request. Use Mermaid `classDiagram`, title the focused C3 component, and include only code constructs and dependencies attributed to that component. Flowchart classes, layout bands, and the shared legend do not apply.

## Dynamic sequence diagrams

Prefer sequence diagrams for ordered scenarios.

### Configuration

Use `mirrorActors: true` to repeat participant headers at the bottom:

```text
---
title: Order placement — Dynamic (Mixed C2/C3) — Verified Implementation
config:
  sequence:
    mirrorActors: true
---
sequenceDiagram
    autonumber
```

Use `autonumber` unless an existing document convention intentionally omits it.

Keep the sequence diagram. Color the actor boxes, including the repeated boxes at the bottom, with frontmatter rather than an init directive. Set `theme: base`, `actorBkg` to the element color, and `themeCSS` on `rect.actor` so the fill wins over a host theme. A component uses pale blue `#C5E4F8` with navy text `#071E36`. A container uses `#1F6FB2` with white text. A person uses `#C05621`. An external system uses `#999999`. Do not redraw the scenario as a flowchart to apply that color.

### Participant labels

Every participant header states its element type:

```text
actor Customer as Retail Customer<br/>[Person]
participant Web as Web Application<br/>[Container]
box rgb(197, 228, 248) Order API [Container]
    participant Controller as Order Controller<br/>[Component]
    participant Validator as Order Validator<br/>[Component]
end
participant Payments as Payment Gateway<br/>[External System]
```

Use `box` to group components inside their parent container when that grouping improves ownership or level comprehension. A box is a visual boundary, not a participant. Keep external systems outside owned container boxes.

Use stable, concise aliases for messages while the visible labels reuse approved registry names. Mark proposed mixed-state participants with `<br/>[Proposed]` in addition to their type.

### Messages and control flow

- Draw messages from initiator to recipient.
- Use active-voice labels.
- Use solid arrows for calls and dashed arrows for responses when the distinction is meaningful.
- Use `alt`, `opt`, `loop`, `par`, and `critical` only when scenario evidence supports them.
- Do not imply synchronous behavior merely because a flowchart relationship exists.
- Put technology in a note or concise message label only when evidenced.
- Keep one scenario per diagram; split diagrams when a sequence becomes unreadable.

For a flowchart-based Dynamic view, apply all flowchart rules, number relationship labels (`1.`, `2.`, …), and include the primary level in the title.

## Deployment diagrams

Use one environment per diagram. Every container instance must trace to C2 and sit inside an evidenced deployment node. A managed service gets its own deployment node when that boundary clarifies placement. Infrastructure nodes represent routing, gateways, queues, or similar runtime infrastructure that is not a container instance.

External systems stay outside deployment boundaries unless evidence proves co-hosting. Co-hosting never changes external ownership.

## Optional shared legend

An atlas may provide one legend near its start rather than repeat keys beside every diagram. The legend must use the same shapes, labels, and classes as the views. It may use `flowchart LR`; every architecture view remains `flowchart TB`.

## Validation

Source validation passes only when every applicable check passes:

1. Every diagram has an accurate title, level, and model state.
2. Each static or flowchart Dynamic view uses `flowchart TB`; only a legend may use `LR`.
3. Every subgraph flowchart contains the required config and no nested `direction`.
4. Identifiers follow the type-prefix scheme and remain stable.
5. Every node has the required shape, stereotype, type class, and exactly one registry identity.
6. Every boundary has exactly one correct style; every class or style target is declared.
7. Labels and technologies follow evidence rules.
8. Relationships follow evidence, active voice, and correct direction.
9. Band stacking passes rendered or static analysis.
10. C1, C2, selective C3, Dynamic, and Deployment views remain mutually consistent.
11. Component ownership and Deployment placement match parent boundaries.
12. Dynamic titles identify level; mixed-level participants identify type; component boxes identify parent containers; mirrored headers are enabled; messages preserve direction, evidence, and order.
13. Proposed and verified content is visibly distinguishable.
14. Diagram terminology aligns with the glossary.

Run:

```text
python3 ~/.cursor/skills/c4-architecture/scripts/validate_c4.py path/to/atlas.md
```

Then render each Mermaid block with Mermaid CLI when available. Rendering proves parser acceptance, not architectural correctness; visually inspect layout and grouping afterward.

Report separately:

- Source validation: `Passed` or `Failed`
- Mermaid CLI render validation: `Passed`, `Failed`, or `Not run`
- Manual architectural consistency validation: `Passed` or `Failed`
- Glossary alignment: `Passed`, `Failed`, or `Blocked`

Identify every unrun check and reason.

## Known Mermaid limitations

- Mermaid has no native C4 legend; a legend is a separate diagram.
- Nested subgraph direction is inconsistent across renderers, so this renderer omits it.
- Subgraph title spacing can collide in deeply nested layouts.
- Sequence `box` groups communicate visual parentage but do not create enforceable C4 ownership.
- `mirrorActors` repeats headers only at the bottom; split very long scenarios when readers need additional repeated headers.

## Attribution

Adapted from Microsoft HVE Core's Mermaid renderer at source revision `e648f6d96380e32219a716ca40530131a3e631fa`. C4 concepts are based on the [C4 Model](https://c4model.com/) by Simon Brown under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Mermaid syntax conventions derive from the [Mermaid documentation](https://mermaid.js.org/), licensed under [MIT](https://github.com/mermaid-js/mermaid/blob/develop/LICENSE).
