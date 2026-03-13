#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    articles_dir = repo_root / "zz-export" / "articles"
    runtime_path = repo_root / "zz-export" / "runtime.json"
    error_log = script_dir / "error.log"

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

    articles_runtime: dict[str, dict] = {}
    audio_count = 0

    for article_file in article_files:
        article_id = article_file.stem
        try:
            html_text = article_file.read_text(encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            return fail(f"ERROR: failed reading {article_file}: {exc}")

        if "rw-audio-player" in html_text:
            articles_runtime[article_id] = {
                "needsHydrate": True,
                "hooks": ["webwriterAudio"]
            }
            audio_count += 1

    runtime = {
        "default": {
            "needsHydrate": False,
            "hooks": []
        },
        "articles": articles_runtime
    }

    runtime_path.write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"articles={len(article_files)} audio_hook_articles={audio_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
