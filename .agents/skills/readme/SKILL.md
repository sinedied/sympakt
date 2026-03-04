---
name: readme
description: Create or update a root README.md file for any project repository. Use when a user asks to create a README, generate a README for a project, write project documentation, update an existing README, or improve a README. Also use when setting up a new project and the user wants a polished README file.
---

# README Creator

Create comprehensive, well-structured, and appealing README.md files for projects.

## Workflow

1. Analyze the project thoroughly
2. Determine project type and appropriate README structure
3. Generate or update the README.md
4. Validate the result

## Step 1: Analyze the Project

Examine the entire repository to understand its context. Look for:

- **Project identity**: package.json, pyproject.toml, Cargo.toml, go.mod, pom.xml, etc.
- **Purpose**: Existing README, docs folder, description fields, comments
- **Tech stack**: Languages, frameworks, libraries, build tools
- **Project type**: Application sample, CLI tool, library, monorepo, API, etc.
- **Entry points**: How users install, configure, and run the project
- **Key features**: What sets this project apart
- **Architecture**: Directory structure, diagrams, component relationships
- **Development setup**: Prerequisites, environment setup, dev containers, codespaces
- **Deployment**: Cloud deployment, CI/CD, Docker, infrastructure-as-code
- **Assets**: Logo, icons, screenshots, demo GIFs in docs/images or similar folders

## Step 2: Determine Structure

Choose sections based on the project type. Not all sections apply to every project.

### Common sections (most projects)

- Title with logo/icon (if available)
- Badges (build status, version, license, language)
- Short description / tagline
- Navigation links to major sections
- Screenshot or demo GIF (if available)
- Overview (for larger projects)
- Features
- Getting started / Installation
- Usage / Running
- Resources / Links (if relevant)
- Troubleshooting / FAQ (if relevant)

### Additional sections by project type

**Application samples**: Prerequisites, deployment instructions, architecture diagram, cost estimation
**CLI tools**: Installation (npm/brew/etc.), command line options, examples
**Libraries**: Installation, API reference or link to docs, examples
**Monorepos**: Project structure table, links to sub-project READMEs

## Step 3: Write the README

### Formatting rules

- Use GFM (GitHub Flavored Markdown)
- Use GitHub admonition syntax for callouts:
  ```markdown
  > [!NOTE]
  > Informational note.

  > [!TIP]
  > Helpful tip.

  > [!IMPORTANT]
  > Critical information.

  > [!WARNING]
  > Warning about potential issues.

  > [!CAUTION]
  > Dangerous action warning.
  ```
- Use `<details>` for collapsible sections when offering alternative setup methods
- Use centered `<div align="center">` for the header block (logo, title, badges, nav links)
- Use flat-square badge style consistently
- Use bold text for feature names in feature lists

### Style guidelines

- Be concise and to the point — avoid filler text
- Do not overuse emojis (a few are fine, especially in feature lists)
- Write in a clear, professional tone
- Use code blocks with language identifiers for all code/command examples
- Prefer actionable instructions ("Run this command") over passive descriptions
- Include a star call-to-action if appropriate ("⭐ If you like this project, star it on GitHub")

### Sections to exclude

Do NOT include these sections — they have dedicated files:
- LICENSE
- CONTRIBUTING
- CHANGELOG
- CODE_OF_CONDUCT
- SECURITY

### Reference examples

See [references/examples.md](references/examples.md) for structural patterns extracted from high-quality READMEs.

## Step 4: Validate

After writing or updating the README:

- Verify all links point to existing files/URLs
- Ensure commands and code examples are accurate
- Check that badge URLs are correct
- Confirm the structure matches the project type
- If updating an existing README, ensure no important existing content was lost
