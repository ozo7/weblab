#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


TAG_RE = re.compile(r"<[^>]+>")
SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
TOKEN_RE = re.compile(r"[A-Za-z0-9ÄÖÜäöüß]{3,}")

STOPWORDS = {
    "aber", "alle", "allem", "allen", "aller", "alles", "als", "also", "am", "an", "ander", "andere",
    "anderem", "anderen", "anderer", "anderes", "anderm", "andern", "anderr", "anders", "auch", "auf",
    "aus", "bei", "bin", "bis", "bist", "da", "damit", "dann", "das", "dass", "daß", "dein", "deine",
    "dem", "den", "der", "des", "dessen", "deshalb", "die", "dies", "diese", "diesem", "diesen", "dieser",
    "dieses", "doch", "dort", "du", "durch", "ein", "eine", "einem", "einen", "einer", "eines", "er",
    "es", "euer", "eure", "für", "hatte", "hatten", "hattest", "hattet", "hier", "hinter", "ich", "ihr",
    "ihre", "im", "in", "ist", "ja", "jede", "jedem", "jeden", "jeder", "jedes", "jener", "jenes", "jetzt",
    "kann", "kannst", "können", "könnt", "machen", "mein", "meine", "mit", "muss", "musst", "müssen",
    "müsst", "nach", "nachdem", "nein", "nicht", "nun", "oder", "seid", "sein", "seine", "sich", "sie",
    "sind", "soll", "sollen", "sollst", "sollt", "sonst", "soweit", "sowie", "und", "unser", "unsere",
    "unter", "vom", "von", "vor", "wann", "warum", "was", "weiter", "weitere", "wenn", "wer", "werde",
    "werden", "werdet", "weshalb", "wie", "wieder", "wieso", "wir", "wird", "wirst", "wo", "woher", "wohin",
    "zu", "zum", "zur", "über", "the", "and", "for", "with", "from", "this", "that", "these", "those",
    "your", "you", "are", "was", "were", "have", "has", "had", "not", "can", "will", "shall", "our",
    "www", "http", "https", "localhost", "weiterlesen", "video", "download", "seite", "seiten", "home",
}


def ascii_norm(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for raw in TOKEN_RE.findall(text):
        term = ascii_norm(raw).lower().replace("ß", "ss")
        term = term.strip("-_")
        if len(term) < 3:
            continue
        if term.isdigit():
            continue
        if term in STOPWORDS:
            continue
        tokens.append(term)
    return tokens


def strip_html_to_text(html_text: str) -> str:
    without_code = SCRIPT_STYLE_RE.sub(" ", html_text)
    without_tags = TAG_RE.sub(" ", without_code)
    unescaped = html.unescape(without_tags)
    return re.sub(r"\s+", " ", unescaped).strip()


def walk_entries(entries: list[dict], title_map: dict[str, str], ids: list[str]) -> None:
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        article_id = entry.get("articleId")
        if isinstance(article_id, str):
            if article_id not in ids:
                ids.append(article_id)
            title = entry.get("title")
            if isinstance(title, str) and title.strip():
                title_map[article_id] = title.strip()
        children = entry.get("children")
        if isinstance(children, list):
            walk_entries(children, title_map, ids)


def max_tags_for_word_count(word_count: int) -> int:
    if word_count < 20:
        return 0
    if word_count < 90:
        return 1
    if word_count < 260:
        return 2
    return 3


def target_unique_count(article_count: int, avg_words: float) -> int:
    if article_count <= 0:
        return 0
    if avg_words < 60:
        ratio = 0.7
    elif avg_words < 140:
        ratio = 0.9
    elif avg_words < 260:
        ratio = 1.0
    elif avg_words < 420:
        ratio = 1.15
    else:
        ratio = 1.3
    return max(3, int(round(article_count * ratio)))


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    website_path = repo_root / "zz-export" / "website.json"
    articles_dir = repo_root / "zz-export" / "articles"
    tags_path = repo_root / "zz-export" / "tags.json"
    error_log = script_dir / "error.log"

    def fail(reason: str) -> int:
        error_log.write_text(reason.strip() + "\n", encoding="utf-8")
        return 1

    if error_log.exists():
        error_log.unlink()

    if not website_path.is_file():
        return fail(f"ERROR: missing website.json: {website_path}")
    if not articles_dir.is_dir():
        return fail(f"ERROR: missing articles dir: {articles_dir}")

    try:
        website = json.loads(website_path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return fail(f"ERROR: invalid website.json: {exc}")

    top_level = website.get("topLevel")
    if not isinstance(top_level, list):
        return fail("ERROR: website.json topLevel missing or invalid")

    title_map: dict[str, str] = {}
    article_ids: list[str] = []
    walk_entries(top_level, title_map, article_ids)
    if not article_ids:
        return fail("ERROR: no article IDs found in website.json")

    token_counts: dict[str, Counter[str]] = {}
    title_token_sets: dict[str, set[str]] = {}
    word_counts: dict[str, int] = {}

    for article_id in article_ids:
        article_path = articles_dir / f"{article_id}.htm"
        if not article_path.is_file():
            return fail(f"ERROR: missing article file: {article_path}")
        raw = article_path.read_text(encoding="utf-8")
        text = strip_html_to_text(raw)
        tokens = tokenize(text)
        token_counts[article_id] = Counter(tokens)
        word_counts[article_id] = len(tokens)
        title_tokens = tokenize(title_map.get(article_id, article_id.replace("-", " ")))
        title_token_sets[article_id] = set(title_tokens)
        for t in title_tokens:
            token_counts[article_id][t] += 3

    article_count = len(article_ids)
    avg_words = sum(word_counts.values()) / article_count if article_count else 0.0

    doc_freq: Counter[str] = Counter()
    for article_id in article_ids:
        for term in token_counts[article_id].keys():
            doc_freq[term] += 1

    ranked: dict[str, list[tuple[str, float]]] = {}
    for article_id in article_ids:
        candidates: list[tuple[str, float]] = []
        counts = token_counts[article_id]
        for term, tf in counts.items():
            df = doc_freq[term]
            if df <= 0:
                continue
            if df / article_count > 0.8:
                continue
            idf = math.log((article_count + 1) / (df + 1)) + 0.15
            score = (1.0 + math.log(1.0 + tf)) * idf
            if term in title_token_sets[article_id]:
                score += 0.8
            if score >= 0.2:
                candidates.append((term, score))
        candidates.sort(key=lambda item: item[1], reverse=True)
        ranked[article_id] = candidates[:24]

    unique_target = target_unique_count(article_count, avg_words)
    max_tags = {article_id: max_tags_for_word_count(word_counts[article_id]) for article_id in article_ids}

    selected: dict[str, list[str]] = {article_id: [] for article_id in article_ids}
    used_tags: set[str] = set()

    for _round in range(3):
        for article_id in article_ids:
            if len(selected[article_id]) >= max_tags[article_id]:
                continue
            options = [(term, score) for term, score in ranked[article_id] if term not in selected[article_id]]
            if not options:
                continue
            if len(used_tags) >= unique_target:
                options = [(term, score) for term, score in options if term in used_tags]
                if not options:
                    continue
            best_term = None
            best_score = -1e9
            for term, score in options:
                adjusted = score
                if term in used_tags:
                    adjusted += 0.35
                elif len(used_tags) >= unique_target:
                    adjusted -= 0.65
                if adjusted > best_score:
                    best_term = term
                    best_score = adjusted
            if best_term and best_score > 0.25:
                selected[article_id].append(best_term)
                used_tags.add(best_term)

    tags_map: dict[str, list[str]] = defaultdict(list)
    for article_id in article_ids:
        for tag in selected[article_id]:
            tags_map[tag].append(article_id)

    normalized_map = {tag: sorted(ids) for tag, ids in sorted(tags_map.items(), key=lambda item: item[0])}
    tags_path.write_text(json.dumps(normalized_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"articles={article_count} unique_tags={len(normalized_map)} "
        f"avg_words={avg_words:.1f} target_unique={unique_target}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
