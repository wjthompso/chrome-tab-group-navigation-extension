#!/usr/bin/env python3
"""Static checks for Mermaid diagrams in a C4 architecture atlas."""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

STATE_PATTERN = re.compile(r"(Verified Implementation|Proposed Architecture|Mixed)", re.I)
DYNAMIC_LEVEL_PATTERN = re.compile(r"Dynamic \((C[23]|Mixed C2/C3)\)", re.I)
NODE_PREFIX_TO_CLASS = {
    "person_": "person",
    "sys_": "system",
    "ctr_": "container",
    "cmp_": "component",
    "ext_": "external",
    "infra_": "infrastructure",
}
TYPE_MARKERS = (
    "[Person]",
    "[Software System]",
    "[Container]",
    "[Component]",
    "[External System]",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate static C4 and Mermaid conventions in Markdown."
    )
    parser.add_argument("atlas", type=Path, help="Markdown architecture atlas")
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Project root used to check docs/architecture/glossary.md",
    )
    return parser.parse_args()


def extract_mermaid_blocks(markdown: str) -> list[str]:
    return re.findall(r"```mermaid\s*\n(.*?)```", markdown, flags=re.DOTALL)


def split_frontmatter(block: str) -> tuple[str | None, str]:
    if not block.startswith("---\n"):
        return None, block
    closing = block.find("\n---\n", 4)
    if closing < 0:
        return None, block
    frontmatter = block[4:closing]
    title_match = re.search(r"^title:\s*[\"']?(.*?)[\"']?\s*$", frontmatter, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else None
    return title, block[closing + 5 :]


def declaration_data(
    body: str,
) -> tuple[set[str], set[str], dict[str, str], dict[str, str]]:
    nodes: set[str] = set()
    subgraphs: set[str] = set()
    names: dict[str, str] = {}
    shapes: dict[str, str] = {}
    node_pattern = re.compile(
        r"(?ms)^\s*((?:person|sys|ctr|cmp|ext|infra)_[a-z0-9_]+)"
        r"(?!\s*(?:--|~~))\s*(\(\[|\[\(|\(|\[).*?\*\*([^*\n]+)\*\*"
    )
    for match in node_pattern.finditer(body):
        identifier, shape, name = match.groups()
        nodes.add(identifier)
        shapes[identifier] = shape
        names[identifier] = re.sub(r"\s+\[Proposed\]\s*$", "", name).strip()

    for match in re.finditer(
        r"(?m)^\s*subgraph\s+((?:layout|deploy|bnd|sys|ctr)_[a-z0-9_]+)\b", body
    ):
        subgraphs.add(match.group(1))
    return nodes, subgraphs, names, shapes


def expected_element_class(identifier: str, shape: str | None) -> str | None:
    """Owned data stores keep the ctr_ prefix and use the green dataStore class."""
    if identifier.startswith("ctr_") and shape == "[(":
        return "dataStore"
    for prefix, class_name in NODE_PREFIX_TO_CLASS.items():
        if identifier.startswith(prefix):
            return class_name
    return None


def class_assignments(body: str) -> dict[str, set[str]]:
    assignments: dict[str, set[str]] = defaultdict(set)
    for match in re.finditer(
        r"(?m)^\s*class\s+([a-z0-9_,]+)\s+([a-zA-Z0-9_-]+)\s*$", body
    ):
        identifiers, class_name = match.groups()
        for identifier in identifiers.split(","):
            assignments[identifier].add(class_name)
    return assignments


def validate_flowchart(
    index: int,
    title: str,
    block: str,
    body: str,
    errors: list[str],
    warnings: list[str],
    global_ids: dict[str, str],
    global_names: dict[str, str],
) -> None:
    label = f"diagram {index} ({title})"
    direction = re.search(r"(?m)^\s*flowchart\s+(TB|LR)\s*$", body)
    if not direction:
        errors.append(f"{label}: missing flowchart TB declaration")
    elif direction.group(1) == "LR" and "legend" not in title.lower():
        errors.append(f"{label}: only a legend may use flowchart LR")

    if "subgraph " in body:
        if "subGraphTitleMargin:" not in block or not re.search(
            r"bottom:\s*30\b", block
        ):
            errors.append(f"{label}: subgraph flowchart lacks the required title margin")
        if re.search(r"(?m)^\s*direction\s+", body):
            errors.append(f"{label}: nested direction declarations are forbidden")

    nodes, subgraphs, names, shapes = declaration_data(body)
    assignments = class_assignments(body)
    styles = set(
        re.findall(r"(?m)^\s*style\s+([a-z][a-z0-9_]*)\s+", body)
    )

    for identifier in sorted(nodes):
        expected = expected_element_class(identifier, shapes.get(identifier))
        if expected and expected not in assignments.get(identifier, set()):
            errors.append(f"{label}: {identifier} lacks class {expected}")

    for identifier in sorted(assignments):
        if identifier not in nodes:
            errors.append(f"{label}: class targets undeclared node {identifier}")

    for identifier in sorted(subgraphs):
        if identifier not in styles:
            errors.append(f"{label}: subgraph {identifier} lacks a style statement")
    for identifier in sorted(styles):
        if identifier not in subgraphs:
            errors.append(f"{label}: style targets undeclared subgraph {identifier}")

    for identifier, name in names.items():
        canonical_identifier = re.sub(r"_i(?:_[a-z0-9_]+)?$", "", identifier)
        prior_name = global_ids.get(canonical_identifier)
        if prior_name and prior_name != name:
            errors.append(
                f"{label}: stable identifier {canonical_identifier} uses both "
                f"'{prior_name}' and '{name}'"
            )
        global_ids[canonical_identifier] = name

        prior_identifier = global_names.get(name)
        if prior_identifier and prior_identifier != canonical_identifier:
            errors.append(
                f"{label}: approved name '{name}' uses both {prior_identifier} "
                f"and {canonical_identifier}"
            )
        global_names[name] = canonical_identifier

    if "layout_top" in subgraphs and "layout_center" not in subgraphs:
        errors.append(f"{label}: layout_top requires layout_center")
    if "layout_bottom" in subgraphs and "layout_center" not in subgraphs:
        errors.append(f"{label}: layout_bottom requires layout_center")

    warnings.append(
        f"{label}: relationship evidence, semantic direction, ownership, and rendered "
        "band stacking require manual validation"
    )


def validate_sequence(
    index: int,
    title: str,
    block: str,
    body: str,
    errors: list[str],
    warnings: list[str],
) -> None:
    label = f"diagram {index} ({title})"
    level_match = DYNAMIC_LEVEL_PATTERN.search(title)
    if not level_match:
        errors.append(f"{label}: Dynamic title lacks C2, C3, or Mixed C2/C3 level")
        return

    if not re.search(r"(?m)^\s*sequenceDiagram\s*$", body):
        errors.append(f"{label}: missing sequenceDiagram declaration")
    if not re.search(r"(?m)^\s*autonumber\s*$", body):
        errors.append(f"{label}: ordered Dynamic diagram lacks autonumber")
    if not re.search(r"mirrorActors:\s*true\b", block):
        errors.append(f"{label}: repeated participant headers require mirrorActors: true")

    participants = re.findall(
        r"(?m)^\s*(?:actor|participant)\s+[A-Za-z0-9_]+(?:\s+as\s+(.+))?$", body
    )
    visible_labels = [participant.strip() for participant in participants if participant]
    is_mixed = level_match.group(1).lower().startswith("mixed")
    for participant in visible_labels:
        if not any(marker in participant for marker in TYPE_MARKERS):
            errors.append(
                f"{label}: participant lacks an explicit element type: {participant}"
            )
    if is_mixed:
        box_depth = 0
        for line in body.splitlines():
            stripped = line.strip()
            if stripped.startswith("box "):
                box_depth += 1
            elif stripped == "end" and box_depth:
                box_depth -= 1
            elif "[Component]" in stripped and box_depth == 0:
                errors.append(
                    f"{label}: component participant is outside a parent-container box"
                )

    warnings.append(
        f"{label}: scenario evidence, message order, direction, ownership, and "
        "static-view consistency require manual validation"
    )


def main() -> int:
    args = parse_args()
    try:
        markdown = args.atlas.read_text(encoding="utf-8")
    except OSError as error:
        print(f"FAILED: cannot read {args.atlas}: {error}", file=sys.stderr)
        return 2

    blocks = extract_mermaid_blocks(markdown)
    errors: list[str] = []
    warnings: list[str] = []
    global_ids: dict[str, str] = {}
    global_names: dict[str, str] = {}

    if not blocks:
        errors.append("atlas contains no Mermaid diagrams")

    for index, block in enumerate(blocks, start=1):
        title, body = split_frontmatter(block)
        if not title:
            errors.append(f"diagram {index}: missing Mermaid frontmatter title")
            continue
        if not STATE_PATTERN.search(title):
            errors.append(f"diagram {index} ({title}): title lacks model state")

        if re.search(r"(?m)^\s*sequenceDiagram\s*$", body):
            validate_sequence(index, title, block, body, errors, warnings)
        elif re.search(r"(?m)^\s*flowchart\s+", body):
            validate_flowchart(
                index,
                title,
                block,
                body,
                errors,
                warnings,
                global_ids,
                global_names,
            )
        elif re.search(r"(?m)^\s*classDiagram\s*$", body):
            if "code" not in title.lower() and "component" not in title.lower():
                errors.append(
                    f"diagram {index} ({title}): classDiagram title must identify "
                    "the C4 Code focus component"
                )
            warnings.append(
                f"diagram {index} ({title}): C4 Code scope and code evidence require "
                "manual validation"
            )
        else:
            errors.append(f"diagram {index} ({title}): unsupported Mermaid diagram type")

    if args.project_root:
        glossary = args.project_root / "docs" / "architecture" / "glossary.md"
        if glossary.is_file():
            warnings.append(
                f"glossary found at {glossary}; semantic alignment requires manual review"
            )
        else:
            errors.append(
                f"docs/architecture/glossary.md is missing under {args.project_root}"
            )
    else:
        warnings.append(
            "glossary path check not run; pass --project-root to check for "
            "docs/architecture/glossary.md"
        )

    if errors:
        print("FAILED: static C4 convention validation")
        for error in errors:
            print(f"ERROR: {error}")
    else:
        print(f"PASSED: {len(blocks)} Mermaid diagram(s) passed static checks")

    for warning in warnings:
        print(f"MANUAL: {warning}")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
