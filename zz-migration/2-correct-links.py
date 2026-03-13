#!/usr/bin/env python3
from __future__ import annotations

import html as html_lib
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlparse


ATTR_RE = re.compile(r"""(?P<attr>\b(?:src|href|poster)\b)\s*=\s*(?P<q>["'])(?P<val>.*?)(?P=q)""", re.IGNORECASE)
DATA_TRACKS_RE = re.compile(r"""(?P<attr>\bdata-tracks\b)\s*=\s*(?P<q>["'])(?P<val>.*?)(?P=q)""", re.IGNORECASE)
LOCAL_SKIP_RE = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|#)", re.IGNORECASE)
PAIR_RE = re.compile(r"^- ([^ ]+) <-> .*\((https?://[^)]+)\)", re.MULTILINE)
ANCHOR_TAG_RE = re.compile(r"<a\b[^>]*>", re.IGNORECASE)
HREF_IN_TAG_RE = re.compile(r"""\bhref\s*=\s*(["'])(?P<val>.*?)\1""", re.IGNORECASE)
INTERNAL_NAV_REF_RE = re.compile(r"""\binternal-nav-ref\s*=\s*(["'])(?P<val>.*?)\1""", re.IGNORECASE)
INTERNAL_RESOLVED_ID_RE = re.compile(r"resolved:(?P<id>[A-Za-z0-9._-]+)")
TARGET_IN_TAG_RE = re.compile(r"""\btarget\s*=\s*(["'])(?P<val>.*?)\1""", re.IGNORECASE)


def rewrite_attr_value(value: str) -> tuple[str, bool]:
    if value.startswith("../aa-images/"):
        return "/zz-export/aa-images/" + value[len("../aa-images/"):], True
    if value.startswith("../aa-tables/"):
        return "/zz-export/aa-tables/" + value[len("../aa-tables/"):], True
    marker = "zz-media-files"
    idx = value.find(marker)
    if idx == -1:
        return value, False
    suffix = value[idx + len(marker):]
    if suffix.startswith("/"):
        return "/zz-media-files" + suffix, True
    return "/zz-media-files/" + suffix, True


def split_suffix(value: str) -> tuple[str, str]:
    idx = len(value)
    for sep in ("?", "#"):
        pos = value.find(sep)
        if pos != -1:
            idx = min(idx, pos)
    return value[:idx], value[idx:]


def is_local_asset_candidate(value: str) -> bool:
    if not value or LOCAL_SKIP_RE.match(value):
        return False
    if value.startswith("../aa-images/") or value.startswith("/zz-export/aa-images/"):
        return False
    if value.startswith("../aa-tables/") or value.startswith("/zz-export/aa-tables/"):
        return False
    if value.startswith("/zz-media-files/"):
        return False
    base, _ = split_suffix(value)
    if not base:
        return False
    low = base.lower()
    if low.endswith(".html") or low.endswith(".htm"):
        return False
    return True


def to_local_path_if_localhost(value: str) -> str | None:
    parsed = urlparse(value)
    if parsed.scheme in ("http", "https") and parsed.hostname in ("127.0.0.1", "localhost"):
        return parsed.path or "/"
    return None


def resolve_local_source_path(source_articles_root: Path, article_id: str, value: str) -> Path | None:
    base, _ = split_suffix(value)
    normalized = unquote(base).replace("\\", "/")
    candidates: list[Path] = []
    if normalized.startswith("/articles/"):
        candidates.append(source_articles_root / normalized[len("/articles/"):].lstrip("/"))
    elif normalized.startswith("articles/"):
        candidates.append(source_articles_root / normalized[len("articles/"):].lstrip("/"))
    elif normalized.startswith("/"):
        candidates.append(source_articles_root / article_id / normalized.lstrip("/"))
    else:
        candidates.append(source_articles_root / article_id / normalized)
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def create_target_name(article_id: str, source_path: Path, used_names: set[str]) -> str:
    stem = f"{article_id}--{source_path.name}"
    if stem not in used_names:
        used_names.add(stem)
        return stem
    base = source_path.stem
    ext = source_path.suffix
    counter = 2
    while True:
        candidate = f"{article_id}--{base}-{counter}{ext}"
        if candidate not in used_names:
            used_names.add(candidate)
            return candidate
        counter += 1


def rewrite_html(
    html: str,
    article_id: str,
    source_articles_root: Path,
    target_images_dir: Path,
    used_names: set[str],
    not_found: list[str],
) -> tuple[str, int]:
    replacements = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal replacements
        attr = match.group("attr")
        quote = match.group("q")
        value = match.group("val")
        media_rewrite, has_media_marker = rewrite_attr_value(value)
        new_value = value
        local_value = value
        if has_media_marker:
            new_value = media_rewrite
        else:
            localhost_path = to_local_path_if_localhost(value)
            if localhost_path is not None:
                _, suffix = split_suffix(value)
                local_value = localhost_path + suffix

        if (not has_media_marker) and is_local_asset_candidate(local_value):
            source_path = resolve_local_source_path(source_articles_root, article_id, local_value)
            if source_path is None:
                not_found.append(f"{article_id}\t{value}")
            else:
                target_name = create_target_name(article_id, source_path, used_names)
                target_path = target_images_dir / target_name
                if not target_path.exists():
                    target_path.write_bytes(source_path.read_bytes())
                _, suffix = split_suffix(local_value)
                new_value = "/zz-export/aa-images/" + target_name + suffix
        if new_value != value:
            replacements += 1
        return f"{attr}={quote}{new_value}{quote}"

    return ATTR_RE.sub(repl, html), replacements


def rewrite_data_tracks_attributes(html: str) -> tuple[str, int]:
    replacements = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal replacements
        attr = match.group("attr")
        quote = match.group("q")
        raw_value = match.group("val")
        decoded_json = html_lib.unescape(raw_value)

        try:
            payload = json.loads(decoded_json)
        except Exception:  # noqa: BLE001
            return match.group(0)

        changed = False
        if isinstance(payload, list):
            for item in payload:
                if not isinstance(item, dict):
                    continue
                src = item.get("src")
                if not isinstance(src, str):
                    continue
                new_src, did_change = rewrite_attr_value(src)
                if did_change and new_src != src:
                    item["src"] = new_src
                    changed = True

        if not changed:
            return match.group(0)

        replacements += 1
        compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        escaped = html_lib.escape(compact, quote=True)
        return f"{attr}={quote}{escaped}{quote}"

    return DATA_TRACKS_RE.sub(repl, html), replacements


def normalize_table_links(html: str) -> tuple[str, int]:
    before = html
    html = html.replace('href="../aa-tables/', 'href="/zz-export/aa-tables/')
    html = html.replace('href="/aa-tables/', 'href="/zz-export/aa-tables/')
    return html, 0 if html == before else 1


def extract_pairs(text: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for match in PAIR_RE.finditer(text):
        article_id = match.group(1).strip()
        article_url = match.group(2).strip()
        if article_id and article_url and article_id not in seen:
            seen.add(article_id)
            pairs.append((article_id, article_url))
    return pairs


def normalize_localhost_path(url_value: str) -> str | None:
    parsed = urlparse(url_value)
    if parsed.scheme in ("http", "https") and parsed.hostname in ("127.0.0.1", "localhost"):
        return (parsed.path or "/").rstrip("/") or "/"
    return None


def build_localhost_article_maps(pairs: list[tuple[str, str]]) -> tuple[dict[str, str], dict[str, str]]:
    by_url: dict[str, str] = {}
    by_path: dict[str, str] = {}
    for article_id, article_url in pairs:
        by_url[article_url] = article_id
        normalized_path = normalize_localhost_path(article_url)
        if normalized_path:
            by_path[normalized_path] = article_id
    return by_url, by_path


def set_or_add_attr(tag: str, attr: str, value: str) -> tuple[str, bool]:
    escaped = html_lib.escape(value, quote=True)
    attr_re = re.compile(rf"""\b{re.escape(attr)}\s*=\s*(["']).*?\1""", re.IGNORECASE)
    replacement = f'{attr}="{escaped}"'
    if attr_re.search(tag):
        updated = attr_re.sub(replacement, tag, count=1)
        return updated, updated != tag

    insert_at = tag.rfind("/>") if tag.endswith("/>") else tag.rfind(">")
    if insert_at == -1:
        return tag, False
    updated = tag[:insert_at] + " " + replacement + tag[insert_at:]
    return updated, True


def resolve_article_id_from_href(href: str, by_url: dict[str, str], by_path: dict[str, str]) -> str | None:
    href = href.strip()
    if not href:
        return None
    if href in by_url:
        return by_url[href]
    normalized_path = normalize_localhost_path(href)
    if normalized_path and normalized_path in by_path:
        return by_path[normalized_path]
    return None


def resolve_article_id_from_canonical_href(href: str) -> str | None:
    base, _ = split_suffix(href.strip())
    match = re.match(r"^/zz-export/articles/([A-Za-z0-9._-]+)\.htm$", base, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def is_article_path_candidate(path: str) -> bool:
    base = split_suffix(path.strip())[0]
    if not base:
        return False
    if base == "/":
        return True
    low = base.lower()
    if low.startswith("/zz-export/aa-tables/") or low.startswith("/zz-export/aa-images/"):
        return False
    if low.startswith("/zz-export/articles/"):
        return True
    if low.startswith("/articles/") or low.startswith("articles/"):
        return True
    return low.endswith(".htm") or low.endswith(".html")


def is_internal_navigation_candidate(href: str, has_internal_nav_ref: bool) -> bool:
    if has_internal_nav_ref:
        return True
    value = href.strip()
    if not value:
        return False
    if value.startswith("#"):
        return False
    parsed = urlparse(value)
    if parsed.scheme in ("http", "https"):
        if parsed.hostname not in ("127.0.0.1", "localhost"):
            return False
        return is_article_path_candidate(parsed.path or "/")
    if parsed.scheme:
        return False
    return is_article_path_candidate(value)


def rewrite_navigation_links(
    html: str,
    source_article_id: str,
    by_url: dict[str, str],
    by_path: dict[str, str],
    known_article_ids: set[str],
    link_records: list[dict[str, str]],
    broken_link_lines: list[str],
) -> tuple[str, int]:
    replacements = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal replacements
        tag = match.group(0)
        article_id: str | None = None
        reason = "resolved"

        href_match = HREF_IN_TAG_RE.search(tag)
        href_value = href_match.group("val") if href_match else ""

        ref_match = INTERNAL_NAV_REF_RE.search(tag)
        has_internal_nav_ref = ref_match is not None
        if ref_match:
            resolved = INTERNAL_RESOLVED_ID_RE.search(ref_match.group("val"))
            if resolved:
                article_id = resolved.group("id")
                reason = "internal-nav-ref"

        if not article_id:
            article_id = resolve_article_id_from_href(href_value, by_url, by_path)
            if article_id:
                reason = "href-match"

        if not article_id and href_value:
            article_id = resolve_article_id_from_canonical_href(href_value)
            if article_id:
                reason = "canonical-href"

        is_internal_candidate = is_internal_navigation_candidate(href_value, has_internal_nav_ref)
        if not article_id or article_id not in known_article_ids:
            if is_internal_candidate:
                broken_reason = "unresolved-internal-link"
                if article_id and article_id not in known_article_ids:
                    broken_reason = "missing-target-article"
                broken_link_lines.append(f"{source_article_id}\t{href_value}\t{article_id or '-'}\t{broken_reason}")
                link_records.append({
                    "sourceArticleId": source_article_id,
                    "hrefOriginal": href_value,
                    "hrefNormalized": href_value,
                    "targetArticleId": article_id or "",
                    "status": "broken",
                    "reason": broken_reason,
                })
            return tag

        changed = False
        updated = tag
        canonical_href = f"/zz-export/articles/{article_id}.htm"
        updated, did_change = set_or_add_attr(updated, "href", canonical_href)
        changed = changed or did_change
        updated, did_change = set_or_add_attr(updated, "data-article-id", article_id)
        changed = changed or did_change

        target_match = TARGET_IN_TAG_RE.search(updated)
        if target_match and target_match.group("val").strip().lower() == "_blank":
            updated, did_change = set_or_add_attr(updated, "target", "_self")
            changed = changed or did_change

        if changed:
            replacements += 1
        link_records.append({
            "sourceArticleId": source_article_id,
            "hrefOriginal": href_value,
            "hrefNormalized": canonical_href,
            "targetArticleId": article_id,
            "status": "resolved",
            "reason": reason,
        })
        return updated

    return ANCHOR_TAG_RE.sub(repl, html), replacements


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    articles_dir = repo_root / "zz-export" / "articles"
    target_images_dir = repo_root / "zz-export" / "aa-images"
    source_articles_root = repo_root.parent / "webwriter" / "articles"
    matching_path = script_dir / "matching2.txt"
    error_log = script_dir / "error.log"
    not_found_log = script_dir / "2-not-found.txt"
    broken_links_log = script_dir / "2-broken-links.txt"
    website_path = repo_root / "zz-export" / "website.json"
    internal_links_json = repo_root / "zz-export" / "internal-links.json"

    def fail(reason: str) -> int:
        error_log.write_text(reason.strip() + "\n", encoding="utf-8")
        return 1

    if error_log.exists():
        error_log.unlink()

    if not articles_dir.is_dir():
        return fail(f"ERROR: missing articles directory: {articles_dir}")

    article_files = sorted(articles_dir.glob("*.htm"))
    if not article_files:
        return fail(f"ERROR: no .htm files found in {articles_dir}")
    if not source_articles_root.is_dir():
        return fail(f"ERROR: missing source articles root: {source_articles_root}")
    if not matching_path.is_file():
        return fail(f"ERROR: missing matching file: {matching_path}")

    pairs = extract_pairs(matching_path.read_text(encoding="utf-8"))
    by_url, by_path = build_localhost_article_maps(pairs)
    known_article_ids = {article_id for article_id, _ in pairs}

    target_images_dir.mkdir(parents=True, exist_ok=True)

    touched_files = 0
    total_replacements = 0
    not_found: list[str] = []
    broken_link_lines: list[str] = []
    link_records: list[dict[str, str]] = []
    used_names: set[str] = set()

    for article_file in article_files:
        try:
            article_id = article_file.stem
            original = article_file.read_text(encoding="utf-8")
            updated, replacements = rewrite_html(
                original,
                article_id,
                source_articles_root,
                target_images_dir,
                used_names,
                not_found,
            )
            updated, tracks_replacements = rewrite_data_tracks_attributes(updated)
            replacements += tracks_replacements
            updated, table_replacements = normalize_table_links(updated)
            replacements += table_replacements
            updated, nav_replacements = rewrite_navigation_links(
                updated,
                article_id,
                by_url,
                by_path,
                known_article_ids,
                link_records,
                broken_link_lines,
            )
            replacements += nav_replacements
            if replacements > 0:
                article_file.write_text(updated, encoding="utf-8")
                touched_files += 1
                total_replacements += replacements
        except Exception as exc:  # noqa: BLE001
            return fail(f"ERROR: processing failed for {article_file}: {exc}")

    not_found_log.write_text(
        "\n".join(not_found) + ("\n" if not_found else ""),
        encoding="utf-8",
    )
    broken_links_log.write_text(
        "\n".join(broken_link_lines) + ("\n" if broken_link_lines else ""),
        encoding="utf-8",
    )

    landing_article_id = ""
    if website_path.is_file():
        try:
            website = json.loads(website_path.read_text(encoding="utf-8"))
            meta = website.get("meta") if isinstance(website, dict) else {}
            if isinstance(meta, dict):
                value = meta.get("landingArticleId")
                if isinstance(value, str):
                    landing_article_id = value
        except Exception:  # noqa: BLE001
            landing_article_id = ""

    resolved_links = [record for record in link_records if record.get("status") == "resolved"]
    outbound_map: dict[str, list[str]] = {}
    inbound_map: dict[str, list[str]] = {}
    for record in resolved_links:
        source_id = record.get("sourceArticleId") or ""
        target_id = record.get("targetArticleId") or ""
        if not source_id or not target_id:
            continue
        outbound_map.setdefault(source_id, [])
        if target_id not in outbound_map[source_id]:
            outbound_map[source_id].append(target_id)
        inbound_map.setdefault(target_id, [])
        if source_id not in inbound_map[target_id]:
            inbound_map[target_id].append(source_id)

    for values in outbound_map.values():
        values.sort()
    for values in inbound_map.values():
        values.sort()

    artifact = {
        "meta": {
            "generatedBy": "2-correct-links.py",
            "matchingFile": str(matching_path),
            "landingArticleId": landing_article_id,
            "articleCount": len(article_files),
            "linkCount": len(link_records),
            "resolvedCount": len(resolved_links),
            "brokenCount": len(broken_link_lines),
        },
        "articles": [file.stem for file in article_files],
        "links": link_records,
        "brokenLinks": [record for record in link_records if record.get("status") == "broken"],
        "outbound": dict(sorted(outbound_map.items(), key=lambda item: item[0])),
        "inbound": dict(sorted(inbound_map.items(), key=lambda item: item[0])),
    }
    internal_links_json.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if error_log.exists():
        error_log.unlink()

    print(
        f"Processed {len(article_files)} files; updated {touched_files}; replacements {total_replacements}; "
        f"aa-images files {len(list(target_images_dir.glob('*')))}; not found {len(not_found)}; "
        f"broken links {len(broken_link_lines)}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
