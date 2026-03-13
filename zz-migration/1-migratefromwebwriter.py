#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path


PAIR_RE = re.compile(r"^- ([^ ]+) <-> .*\((https?://[^)]+)\)", re.MULTILINE)
MAIN_RE = re.compile(r"<main\b[^>]*>.*?</main>", re.IGNORECASE | re.DOTALL)


def extract_pairs(text: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for match in PAIR_RE.finditer(text):
        article_id = match.group(1).strip()
        article_url = match.group(2).strip()
        if article_id and article_id not in seen:
            seen.add(article_id)
            pairs.append((article_id, article_url))
    return pairs


def collect_navigation_urls(nodes: list[dict]) -> set[str]:
    urls: set[str] = set()

    def visit(node_list: list[dict]) -> None:
        for node in node_list:
            if not isinstance(node, dict):
                continue
            url = node.get("url")
            if isinstance(url, str) and url:
                urls.add(url)
            children = node.get("children")
            if isinstance(children, list):
                visit(children)

    visit(nodes)
    return urls


def build_website_tree(nodes: list[dict], id_by_url: dict[str, str]) -> list[dict]:
    def convert(node: dict) -> dict | None:
        title = node.get("title")
        url = node.get("url")
        children = node.get("children")
        if not isinstance(title, str) or not isinstance(url, str):
            return None
        article_id = id_by_url.get(url)
        if not article_id:
            return None

        if isinstance(children, list) and children:
            out_children: list[dict] = []
            for child in children:
                if not isinstance(child, dict):
                    continue
                converted_child = convert(child)
                if converted_child:
                    out_children.append(converted_child)
            return {
                "type": "menu",
                "label": title,
                "articleId": article_id,
                "title": title,
                "children": out_children
            }

        return {"type": "article", "articleId": article_id, "title": title}

    converted: list[dict] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        item = convert(node)
        if item:
            converted.append(item)
    return converted


def extract_main_fragment(html: str) -> str | None:
    match = MAIN_RE.search(html)
    if not match:
        return None
    return match.group(0).strip()


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    matching_path = script_dir / "matching2.txt"
    navigation_path = script_dir / "navigation-info-localhost-8081.json"
    source_root = repo_root.parent / "webwriter" / "zz-exports"
    output_path = script_dir / "output.txt"
    error_log_path = script_dir / "error.log"
    website_output_path = repo_root / "zz-export" / "website.json"
    target_articles_dir = repo_root / "zz-export" / "articles"
    target_export_root = repo_root / "zz-export"

    def fail(reason: str) -> int:
        error_log_path.write_text(reason.strip() + "\n", encoding="utf-8")
        return 1

    if not matching_path.is_file():
        return fail(f"ERROR: missing input file: {matching_path}")

    if not navigation_path.is_file():
        return fail(f"ERROR: missing navigation file: {navigation_path}")

    pairs = extract_pairs(matching_path.read_text(encoding="utf-8"))
    if not pairs:
        return fail("ERROR: no matching pairs found in matching2.txt")
    article_ids = [article_id for article_id, _ in pairs]
    id_by_url = {url: article_id for article_id, url in pairs}

    nav_data = json.loads(navigation_path.read_text(encoding="utf-8"))
    nav_tree = nav_data.get("tree")
    nav_urls = collect_navigation_urls(nav_tree if isinstance(nav_tree, list) else [])

    folder_found: list[str] = []
    folder_missing: list[str] = []
    nav_found: list[str] = []
    nav_missing: list[str] = []
    status_lines: list[str] = []

    for article_id, article_url in pairs:
        has_folder = source_root.is_dir() and (source_root / article_id).is_dir()
        in_navigation = article_url in nav_urls
        if has_folder:
            folder_found.append(article_id)
        else:
            folder_missing.append(article_id)
        if in_navigation:
            nav_found.append(article_id)
            status_lines.append(f"OK {article_id}")
        else:
            nav_missing.append(article_id)
            status_lines.append(f"NO {article_id}")

    lines: list[str] = []
    lines.append("Matching2 Article Folder Check")
    lines.append(f"Input: {matching_path}")
    lines.append(f"Source root: {source_root}")
    lines.append(f"Navigation source: {navigation_path}")
    lines.append("")
    if not source_root.is_dir():
        return fail(f"ERROR: source root does not exist: {source_root}")
    lines.append(f"Total IDs: {len(article_ids)}")
    lines.append(f"Folder Found: {len(folder_found)}")
    lines.append(f"Folder Missing: {len(folder_missing)}")
    lines.append(f"Navigation OK: {len(nav_found)}")
    lines.append(f"Navigation NO: {len(nav_missing)}")
    lines.append("")
    lines.append("Navigation Status:")
    if status_lines:
        lines.extend(status_lines)
    else:
        lines.append("(none)")
    lines.append("")
    lines.append("Folder Found IDs:")
    if folder_found:
        lines.extend(f"- {article_id}" for article_id in folder_found)
    else:
        lines.append("(none)")
    lines.append("")
    lines.append("Folder Missing IDs:")
    if folder_missing:
        lines.extend(f"- {article_id}" for article_id in folder_missing)
    else:
        lines.append("(none)")
    lines.append("")

    if len(nav_missing) != 0:
        return fail(
            "ERROR: navigation status has NO entries: "
            + ", ".join(nav_missing)
        )

    website = {
        "meta": {
            "title": "Generated from navigation-info-localhost-8081.json",
            "landingArticleId": article_ids[0] if article_ids else None,
        },
        "topLevel": build_website_tree(nav_tree if isinstance(nav_tree, list) else [], id_by_url),
    }
    website_output_path.write_text(json.dumps(website, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines.append(f"website.json: generated at {website_output_path}")

    target_articles_dir.mkdir(parents=True, exist_ok=True)
    for child in list(target_articles_dir.iterdir()):
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()

    first_article_id = article_ids[0]
    first_article_folder = source_root / first_article_id
    source_export_js = first_article_folder / "export.js"
    source_export_css = first_article_folder / "export.css"
    if not source_export_js.is_file():
        return fail(f"ERROR: missing export.js in first source folder: {source_export_js}")
    if not source_export_css.is_file():
        return fail(f"ERROR: missing export.css in first source folder: {source_export_css}")
    shutil.copy2(source_export_js, target_export_root / "export.js")
    shutil.copy2(source_export_css, target_export_root / "export.css")

    source_aa_tables_dir = source_root / "aa-tables"
    target_aa_tables_dir = target_export_root / "aa-tables"
    if target_aa_tables_dir.exists():
        if target_aa_tables_dir.is_dir():
            shutil.rmtree(target_aa_tables_dir)
        else:
            target_aa_tables_dir.unlink()
    if source_aa_tables_dir.is_dir():
        shutil.copytree(source_aa_tables_dir, target_aa_tables_dir)
        aa_tables_status = f"copied: {source_aa_tables_dir} -> {target_aa_tables_dir}"
    else:
        aa_tables_status = f"missing (skipped): {source_aa_tables_dir}"

    generated_count = 0
    for article_id in article_ids:
        source_index_path = source_root / article_id / "index.html"
        if not source_index_path.is_file():
            return fail(f"ERROR: missing source file for {article_id}: {source_index_path}")

        source_html = source_index_path.read_text(encoding="utf-8")
        main_fragment = extract_main_fragment(source_html)
        if not main_fragment:
            return fail(f"ERROR: <main> tag not found in {source_index_path}")

        target_file = target_articles_dir / f"{article_id}.htm"
        target_file.write_text(main_fragment + "\n", encoding="utf-8")
        generated_count += 1

    lines.append(f"article fragments generated: {generated_count}")
    lines.append(f"target articles dir: {target_articles_dir}")
    lines.append(f"copied: {source_export_js} -> {target_export_root / 'export.js'}")
    lines.append(f"copied: {source_export_css} -> {target_export_root / 'export.css'}")
    lines.append(aa_tables_status)
    lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    if error_log_path.exists():
        error_log_path.unlink()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
