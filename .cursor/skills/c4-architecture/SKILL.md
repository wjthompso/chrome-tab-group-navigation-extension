---
name: c4-architecture
description: Creates diagram-first C4 architecture atlases with C1 System Context, C2 Container, selective C3 Component, Dynamic, Deployment, and System Landscape views. Use only when explicitly invoked with /c4-architecture; when architecture work is requested without explicit invocation, first ask whether the user wants to use /c4-architecture.
disable-model-invocation: true
metadata:
  authors: "microsoft/hve-core; adapted for Cursor"
  license: "CC-BY-4.0 AND MIT"
  source: "https://github.com/microsoft/hve-core/tree/e648f6d96380e32219a716ca40530131a3e631fa/.github/skills/hve-core/c4-architecture"
  spec-version: "1.0"
  last-updated: "2026-10-13"
---

# C4 Architecture

## Goal

Create or update a progressively detailed, diagram-first architecture atlas for verified implementation, proposed architecture, or an explicitly marked mixture of both.

## Required references

Read these files before modeling or editing:

- [C4 modeling instructions](references/c4-modelling-instructions.md)
- [Mermaid renderer](references/renderer-mermaid.md)
- [Architecture atlas guidance](references/architecture-atlas.md)

Use [the atlas template](templates/architecture-atlas.md) when the project has no established architecture-documentation format. Execute [the validator](scripts/validate_c4.py) against generated Markdown before reporting source validation.

## Diagram selection

Use the smallest coherent diagram set that answers the architectural questions:

| Diagram | Default | Purpose |
|---|---:|---|
| C1 System Context | Yes | People, the system in focus, and external dependencies |
| C2 Container | Yes | Separately runnable or deployable units and owned data stores |
| C3 Component | Selective | Major internal building blocks only where additional detail resolves a real question |
| C4 Code | Explicit request only | Code structures inside one approved C3 component |
| System Landscape | When multiple systems or ownership boundaries need orientation | Enterprise or ecosystem scope |
| Dynamic | When sequence, handoff, failure, or runtime behavior matters | One named scenario at an identified primary C4 level |
| Deployment | When evidenced topology helps | One named environment and its execution nodes |

For new atlases, produce C1 and C2. Select C3 targets from evidence and architectural significance; ask when multiple materially different targets qualify. Never generate C4 Code unless the user explicitly requests it.

## Workflow

1. **Resolve project conventions**
   - Inspect existing architecture documents, diagram conventions, and `docs/architecture/glossary.md`.
   - If that exact glossary path is absent, report its absence and request explicit approval before creating it. Never create it silently.
   - Follow active global terminology rules. Never silently add, redefine, or rename canonical terms.

2. **Establish scope and evidence**
   - Identify the system boundary, owners, model state, intended audience, and source evidence.
   - Classify the atlas or each diagram as `Verified Implementation`, `Proposed Architecture`, or `Mixed`.
   - Stop for consequential ambiguity using the uncertainty gate in the modeling reference.

3. **Build one consistent model**
   - Maintain an element registry containing stable identifier, approved name, concise definition, type, owner, parent boundary, model state, and evidence.
   - Reuse registry values in every diagram and supporting section.
   - Preserve explicit ownership boundaries. Shared hosting never implies shared ownership.

4. **Create diagrams first**
   - Lead with the diagram set; add only concise explanations that improve interpretation.
   - Prefer Mermaid sequence diagrams for ordered Dynamic scenarios. Use a C4 flowchart when topology is the primary question.
   - Include Deployment or System Landscape views only when useful and supported.

5. **Add progressive detail**
   - Document important data contracts, architectural decisions, evidence limitations, and unresolved questions after the relevant diagrams.
   - Use project conventions when they exist; otherwise use the atlas template.

6. **Validate and correct**
   - Run static validation:
     `python3 .cursor/skills/c4-architecture/scripts/validate_c4.py <atlas.md>`
   - If `mmdc` is on `PATH`, render every Mermaid block to a temporary SVG.
   - If `mmdc` is absent, ask before installing it. A user-approved temporary `npx` invocation is preferred over a global installation.
   - Inspect rendered layout, ownership grouping, label readability, and relationship direction. Extend the complete checks to Dynamic diagrams.
   - Correct failures and rerun all applicable checks.

## Update behavior

Read the complete target document before editing. Apply only the requested model delta. Preserve unaffected nodes, relationships, comments, layout controls, identifiers, approved terminology, and ownership boundaries. Ask before removing content whose relevance is uncertain.

## Stop rules

Stop and ask when evidence conflicts or unresolved uncertainty materially affects boundaries, ownership, model state, component interactions, relationship technology, Dynamic participant levels, Deployment placement, canonical terminology, or diagram scope. State the evidence and plausible options.

Do not fabricate elements, owners, technologies, interaction order, or deployment topology. Do not substitute an unsupported renderer.

## Completion report

Report:

- diagrams created or updated and their model state
- source-validation result: `Passed` or `Failed`
- Mermaid render validation: `Passed`, `Failed`, or `Not run`, with a reason
- glossary-alignment result
- architectural consistency, ownership, and relationship-direction results
- assumptions, evidence limitations, unresolved decisions, and checks that could not run

Never claim successful installation, discovery, syntax validation, or convention validation without performing the corresponding check.

## Attribution and licensing

This skill adapts Microsoft HVE Core's C4 Architecture skill. C4 concepts are based on the C4 Model by Simon Brown, licensed under CC BY 4.0. Mermaid syntax conventions derive from Mermaid documentation, licensed under MIT. See [LICENSE.md](LICENSE.md) for the source revision, attribution, and license notices.
