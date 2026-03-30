---
name: image-gen
description: Create and edit images using OpenAI image generation API with GPT image models (gpt-image-1, gpt-image-1-mini, gpt-image-1.5 and later). Use when the user asks to generate an image from a text prompt, edit or modify an existing image, create illustrations, logos, icons, concept art, or any visual content using AI image generation. Also use when combining multiple source images into a new composition.
---

# Image Generation & Editing

Generate and edit images via OpenAI-compatible REST APIs using the bundled Python CLI script. No external dependencies required (Python 3.8+ standard library only). Compatible with OpenAI, Azure OpenAI (v1 endpoint), and other OpenAI-compatible providers.

## Quick Reference

### Supported Models

| Model | Generation | Editing | Notes |
|---|---|---|---|
| `gpt-image-1` | ✓ | ✓ | Base GPT image model |
| `gpt-image-1-mini` | ✓ | ✓ | Smaller, faster variant |
| `gpt-image-1.5` | ✓ | ✓ | Latest, most capable |

### Key Parameters

| Parameter | Values | Default | Notes |
|---|---|---|---|
| `size` | `auto`, `1024x1024`, `1536x1024` (landscape), `1024x1536` (portrait) | `auto` | |
| `quality` | `auto`, `low`, `medium`, `high` | `auto` | |
| `background` | `auto`, `transparent`, `opaque` | `auto` | Transparent requires `png` or `webp` output |
| `output_format` | `png`, `jpeg`, `webp` | `png` | |
| `output_compression` | `0`–`100` | `100` | Only for `jpeg`/`webp` |
| `n` | `1`–`10` | `1` | Number of images |
| `moderation` | `auto`, `low` | `auto` | Generation only |

## Usage

The script at `scripts/image_gen.py` is a zero-dependency Python CLI.

### Authentication

Variables can be defined in a `.env` file in the working directory or any parent directory.

| Variable | Description | Default |
|---|---|---|
| `OPENAI_API_KEY` | API key (required) | — |
| `OPENAI_BASE_URL` | Base URL for custom endpoints (Azure OpenAI, etc.) | `https://api.openai.com/v1` |
| `OPENAI_IMAGE_MODEL` | Default model | `gpt-image-1.5` |

All variables can also be passed as CLI flags (`--api-key`, `--base-url`, `--model`).

### Generate an Image

```bash
python scripts/image_gen.py generate "A cat wearing a top hat" -o ./output
```

With full options:

```bash
python scripts/image_gen.py generate "A minimalist coffee shop logo" \
  --size 1024x1024 \
  --quality high \
  --background transparent \
  --output-format png \
  -o ./output
```

### Edit an Image

```bash
python scripts/image_gen.py edit "Add sunglasses to the person" \
  -i photo.png -o ./output
```

Multiple input images (up to 16):

```bash
python scripts/image_gen.py edit "Create a gift basket with these items" \
  -i item1.png -i item2.png -i item3.png -o ./output
```

With mask for inpainting:

```bash
python scripts/image_gen.py edit "Replace the background with a beach" \
  -i photo.png --mask mask.png -o ./output
```

**Important:** Do not pass `--model` unless the user explicitly asks for a specific model. The default model is resolved from `OPENAI_IMAGE_MODEL` env var or falls back to `gpt-image-1.5`.

## Prompt Guidelines

For best results with GPT image models:

- Be specific and descriptive: include subject, style, mood, colors, composition.
- Specify the art style: "photorealistic", "watercolor", "flat illustration", "3D render", etc.
- For logos/icons: request "transparent background" and set `--background transparent --output-format png`.
- For edits: clearly describe what should change and what should remain.
- The maximum prompt length for GPT image models is 32,000 characters.

## Output

`-o` accepts a file path or a directory:
- **File path** (e.g. `-o logo.png`): saves directly to that path. With `--n >1`, appends `_1`, `_2`, etc. before the extension. Intermediate directories are created automatically.
- **Directory** (e.g. `-o ./out`): saves as `image_1.{ext}`, `image_2.{ext}`, etc.

Existing files are never overwritten — a numeric suffix is appended automatically if the target already exists.

The script prints saved file path(s) to stdout (one per line) and any revised prompts to stderr.

## Recipes

Before generating an images, always first generate a prompt using these copy/paste instructions for prompt recipes: [references/sample-prompts.md](references/sample-prompts.md).

An image genaration/editing workflow consists of 2 steps:
1. Generate a prompt for the image generation/editing based on the user query using the sample prompts.
2. Pass the generated prompt to the image generation/editing command to generate/edit the image.

