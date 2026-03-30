#!/usr/bin/env python3
"""
OpenAI image generation and editing CLI tool.
Compatible with gpt-image-1, gpt-image-1-mini, gpt-image-1.5 and later models.
Also works with Azure OpenAI (v1 endpoint) and other OpenAI-compatible providers.
No external dependencies required (Python 3.8+ standard library only).

Environment variables (also loaded from .env file if present):
  OPENAI_API_KEY      - API key (required)
  OPENAI_BASE_URL     - Base URL override (default: https://api.openai.com/v1)
  OPENAI_IMAGE_MODEL  - Default model (default: gpt-image-1.5)
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import sys
import textwrap
import urllib.error
import urllib.request
import uuid
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-image-1.5"


def _die(msg: str) -> None:
    print(f"Error: {msg}", file=sys.stderr)
    sys.exit(1)


def _load_dotenv() -> None:
    """Load variables from a .env file in CWD or parent directories."""
    path = Path.cwd()
    while True:
        env_file = path / ".env"
        if env_file.is_file():
            with env_file.open() as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip()
                    # Strip surrounding quotes
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                        value = value[1:-1]
                    # Only set if not already in environment
                    if key not in os.environ:
                        os.environ[key] = value
            return
        parent = path.parent
        if parent == path:
            return
        path = parent


def _resolve_api_key(args: argparse.Namespace) -> str:
    key = args.api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        _die("No API key found. Pass --api-key or set OPENAI_API_KEY env var.")
    return key


def _resolve_base_url(args: argparse.Namespace) -> str:
    url = args.base_url or os.environ.get("OPENAI_BASE_URL", "") or DEFAULT_BASE_URL
    return url.rstrip("/")


def _resolve_model(args: argparse.Namespace) -> str:
    return args.model or os.environ.get("OPENAI_IMAGE_MODEL", "") or DEFAULT_MODEL


def _json_request(url: str, headers: dict, body: dict) -> dict:
    """Send a JSON POST request and return the parsed response."""
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode() if exc.fp else ""
        _die(f"HTTP {exc.code}: {err_body}")


def _multipart_request(url: str, headers: dict, fields: list[tuple]) -> dict:
    """Send a multipart/form-data POST request.

    *fields* is a list of (field_name, value) where value is either:
      - str  -> sent as a text field
      - bytes -> sent as application/octet-stream with a generated filename
      - tuple (filename, bytes, content_type)
    """
    boundary = uuid.uuid4().hex
    body_parts: list[bytes] = []

    for name, value in fields:
        if isinstance(value, str):
            body_parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n".encode()
            )
        elif isinstance(value, bytes):
            body_parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"; '
                f'filename="file"\r\n'
                f"Content-Type: application/octet-stream\r\n\r\n".encode()
                + value
                + b"\r\n"
            )
        elif isinstance(value, tuple):
            fname, fbytes, ctype = value
            body_parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"; '
                f'filename="{fname}"\r\n'
                f"Content-Type: {ctype}\r\n\r\n".encode()
                + fbytes
                + b"\r\n"
            )

    body_parts.append(f"--{boundary}--\r\n".encode())
    payload = b"".join(body_parts)

    hdrs = {**headers, "Content-Type": f"multipart/form-data; boundary={boundary}"}
    req = urllib.request.Request(url, data=payload, headers=hdrs, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode() if exc.fp else ""
        _die(f"HTTP {exc.code}: {err_body}")


def _read_image_bytes(path: str) -> tuple[str, bytes, str]:
    """Return (filename, bytes, content_type) for a local image file."""
    p = Path(path)
    if not p.is_file():
        _die(f"File not found: {path}")
    ctype = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    return p.name, p.read_bytes(), ctype


def _unique_path(p: Path) -> Path:
    """Return *p* if it doesn't exist, otherwise append a numeric suffix."""
    if not p.exists():
        return p
    stem, suffix = p.stem, p.suffix
    parent = p.parent
    n = 2
    while True:
        candidate = parent / f"{stem}_{n}{suffix}"
        if not candidate.exists():
            return candidate
        n += 1


def _save_images(data: list[dict], output: str, fmt: str) -> list[str]:
    """Decode b64 images from API response and save to disk.

    *output* can be a file path or a directory:
      - File path (has extension): images saved as that name; when multiple
        images are returned the stem gets a ``_N`` suffix.
      - Directory (no extension or ends with /): images saved as
        ``image_1.{ext}``, ``image_2.{ext}``, etc.

    Existing files are never overwritten; a numeric suffix is appended instead.

    Returns list of saved file paths.
    """
    out = Path(output)
    multiple = len(data) > 1

    # Determine mode: file vs directory
    is_file_mode = bool(out.suffix) and not output.endswith("/")

    if is_file_mode:
        out.parent.mkdir(parents=True, exist_ok=True)
    else:
        out.mkdir(parents=True, exist_ok=True)

    paths: list[str] = []
    for i, item in enumerate(data):
        b64 = item.get("b64_json")
        url = item.get("url")
        image_bytes: bytes | None = None
        if b64:
            image_bytes = base64.b64decode(b64)
        elif url:
            with urllib.request.urlopen(url) as resp:
                image_bytes = resp.read()

        if image_bytes is None:
            continue

        if is_file_mode:
            if multiple:
                fpath = _unique_path(out.with_stem(f"{out.stem}_{i + 1}"))
            else:
                fpath = _unique_path(out)
        else:
            ext = fmt if fmt else "png"
            fpath = _unique_path(out / f"image_{i + 1}.{ext}")

        fpath.write_bytes(image_bytes)
        paths.append(str(fpath))

        # Print revised prompt if present
        rp = item.get("revised_prompt")
        if rp:
            print(f"[Image {i + 1}] Revised prompt: {rp}", file=sys.stderr)

    return paths


# ---------------------------------------------------------------------------
# URL builders
# ---------------------------------------------------------------------------

def _gen_url(base: str) -> str:
    return f"{base}/images/generations"


def _edit_url(base: str) -> str:
    return f"{base}/images/edits"


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_generate(args: argparse.Namespace) -> None:
    api_key = _resolve_api_key(args)
    base_url = _resolve_base_url(args)

    body: dict = {"prompt": args.prompt}
    body["model"] = _resolve_model(args)
    if args.n and args.n != 1:
        body["n"] = args.n
    if args.size:
        body["size"] = args.size
    if args.quality:
        body["quality"] = args.quality
    if args.background:
        body["background"] = args.background
    if args.output_format:
        body["output_format"] = args.output_format
    if args.output_compression is not None:
        body["output_compression"] = args.output_compression
    if args.moderation:
        body["moderation"] = args.moderation

    url = _gen_url(base_url)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    result = _json_request(url, headers, body)

    images = result.get("data", [])
    if not images:
        _die("No images returned by API.")

    fmt = args.output_format or "png"
    saved = _save_images(images, args.output, fmt)
    for p in saved:
        print(p)


def cmd_edit(args: argparse.Namespace) -> None:
    api_key = _resolve_api_key(args)
    base_url = _resolve_base_url(args)

    # Build multipart fields
    fields: list[tuple] = []
    fields.append(("prompt", args.prompt))
    fields.append(("model", _resolve_model(args)))
    if args.n and args.n != 1:
        fields.append(("n", str(args.n)))
    if args.size:
        fields.append(("size", args.size))
    if args.quality:
        fields.append(("quality", args.quality))
    if args.background:
        fields.append(("background", args.background))
    if args.output_format:
        fields.append(("output_format", args.output_format))
    if args.output_compression is not None:
        fields.append(("output_compression", str(args.output_compression)))

    # Add input images
    for img_path in args.image:
        fname, fbytes, ctype = _read_image_bytes(img_path)
        fields.append(("image[]", (fname, fbytes, ctype)))

    # Add mask if specified
    if args.mask:
        fname, fbytes, ctype = _read_image_bytes(args.mask)
        fields.append(("mask", (fname, fbytes, ctype)))

    url = _edit_url(base_url)
    headers = {"Authorization": f"Bearer {api_key}"}

    result = _multipart_request(url, headers, fields)

    images = result.get("data", [])
    if not images:
        _die("No images returned by API.")

    fmt = args.output_format or "png"
    saved = _save_images(images, args.output, fmt)
    for p in saved:
        print(p)


# ---------------------------------------------------------------------------
# CLI definition
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="image_gen",
        description="Generate or edit images via OpenAI-compatible REST API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            examples:
              # Generate an image
              python image_gen.py generate "A cat wearing a top hat" -o ./out

              # Generate with specific options
              python image_gen.py generate "A logo for a coffee shop" \\
                --model gpt-image-1 --size 1024x1536 --quality high \\
                --background transparent --output-format png

              # Edit an image
              python image_gen.py edit "Add sunglasses" -i photo.png -o ./out

              # Edit with multiple input images
              python image_gen.py edit "Combine into a collage" \\
                -i img1.png -i img2.png -o ./out

              # Custom endpoint (Azure OpenAI, etc.)
              OPENAI_BASE_URL=https://myresource.openai.azure.com/openai/deployments/gpt-image-1 \\
                python image_gen.py generate "A sunset"
        """),
    )

    # Common flags
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--api-key", help="API key (or set OPENAI_API_KEY env var).")
    common.add_argument("--base-url", help="Base URL override (or set OPENAI_BASE_URL env var). Default: https://api.openai.com/v1")
    common.add_argument("--model", "-m", help="Model name (default: gpt-image-1.5, or set OPENAI_IMAGE_MODEL env var).")
    common.add_argument("--n", type=int, default=1, help="Number of images to generate (default: 1).")
    common.add_argument("--size", "-s", choices=["auto", "1024x1024", "1536x1024", "1024x1536"], help="Image size (default: auto).")
    common.add_argument("--quality", "-q", choices=["auto", "low", "medium", "high"], help="Image quality (default: auto).")
    common.add_argument("--background", choices=["auto", "transparent", "opaque"], help="Background mode (default: auto).")
    common.add_argument("--output-format", "-f", choices=["png", "jpeg", "webp"], help="Output image format (default: png).")
    common.add_argument("--output-compression", type=int, metavar="0-100", help="Compression level for jpeg/webp (0-100).")
    common.add_argument("--output", "-o", default=".", help="Output file path or directory (default: current dir). When a file path is given, intermediate directories are created automatically. With --n >1 a _N suffix is appended to the filename.")

    sub = parser.add_subparsers(dest="command", required=True)

    # --- generate ---
    gen = sub.add_parser(
        "generate", aliases=["gen"],
        parents=[common],
        help="Generate image(s) from a text prompt.",
    )
    gen.add_argument("prompt", help="Text prompt describing the desired image.")
    gen.add_argument("--moderation", choices=["auto", "low"], help="Content moderation level (default: auto).")
    gen.set_defaults(func=cmd_generate)

    # --- edit ---
    edit = sub.add_parser(
        "edit",
        parents=[common],
        help="Edit image(s) given source image(s) and a text prompt.",
    )
    edit.add_argument("prompt", help="Text description of the desired edit.")
    edit.add_argument("--image", "-i", action="append", required=True, help="Input image path (can specify multiple times, up to 16).")
    edit.add_argument("--mask", help="Optional mask image path for inpainting.")
    edit.set_defaults(func=cmd_edit)

    return parser


def main() -> None:
    _load_dotenv()
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
