# README Examples

Reference structures extracted from high-quality open source READMEs for inspiration.

## Example 1: Application Sample (Azure Samples style)

```markdown
<!-- prettier-ignore -->
<div align="center">

<img src="./docs/images/icon.png" alt="" align="center" height="64" />

# Project Title

[![Open in GitHub Codespaces](https://img.shields.io/badge/Codespaces-Open-blue?style=flat-square&logo=github)](...)
[![Build Status](https://img.shields.io/github/actions/workflow/status/...)](...)
![Node version](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

⭐ If you like this project, star it on GitHub — it helps a lot!

[Overview](#overview) • [Features](#features) • [Get started](#getting-started) • [Run the sample](#run-the-sample) • [Resources](#resources) • [FAQ](#faq) • [Troubleshooting](#troubleshooting)

![Animation showing the app in action](./docs/images/demo.gif)

</div>

Short description of what the project does and its purpose.

> [!TIP]
> Useful tip for users.

## Overview

Longer description with architecture diagram and component breakdown.

## Features

- **Feature 1**: Description
- **Feature 2**: Description

## Getting started

Multiple ways to get started (Codespaces, Dev Containers, local).

### Use GitHub Codespaces
...

### Use your local environment

Prerequisites list, then fork/clone steps.

## Run the sample

### Deploy to Azure
...

### Run locally
...

## Resources

- [Link 1](url) - Description
- [Link 2](url) - Description

## FAQ

Link to FAQ document.

## Troubleshooting

Link to troubleshooting guide.
```

## Example 2: CLI Tool / Library (NPM package style)

```markdown
<div align="center">
  <img src="icon.png" width="96" alt="project logo">

  # tool-name
  *Short tagline describing the tool*

  [![Build Status](https://img.shields.io/github/actions/workflow/status/...)](...)
  [![npm version](https://img.shields.io/npm/v/package?style=flat-square)](...)
  [![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

  ⭐ If you like this project, star it on GitHub!

  [Features](#features) • [Installation](#installation) • [Usage](#usage) • [Examples](#examples)

</div>

Short description of what the tool does and when to use it.

## Features

- 🎯 **Feature 1** - Description
- ⚡ **Feature 2** - Description
- 🔧 **Feature 3** - Description

## Installation

\`\`\`bash
npm install -g tool-name
\`\`\`

Or use without installing:

\`\`\`bash
npx tool-name [options]
\`\`\`

## Usage

### Basic Examples

\`\`\`bash
tool-name -o "option" command
\`\`\`

### Command Line Options

\`\`\`
tool-name [OPTIONS] <command> [args...]

OPTIONS:
  -o, --option <value>    Description
  -h, --help              Show help
\`\`\`

## Examples

**Use Case 1**
\`\`\`bash
tool-name ...
\`\`\`

**Use Case 2**
\`\`\`bash
tool-name ...
\`\`\`
```

## Example 3: File-based Mock Server (feature-rich CLI)

```markdown
# :dash: tool-name

[![NPM version](https://img.shields.io/npm/v/package.svg)](...)
[![Build Status](https://github.com/user/repo/workflows/build/badge.svg)](...)

> Concise tagline

![demo gif](...)

Short intro paragraph explaining core value proposition.

### Quick Example

1. Step one
2. Step two
3. Step three

### Features

Bulleted list of all capabilities.

## Installation

\`\`\`bash
npm install -g tool-name
\`\`\`

## Usage

CLI options block, then detailed sections for each feature area.

### Feature Area 1
...

### Feature Area 2
...

## Migration guide

Notes for users upgrading from previous versions.

## Alternatives

Links to similar tools for comparison.
```

## Key Patterns Observed

1. **Centered header block** with logo, title, badges, and navigation links
2. **Badges** use flat-square style consistently
3. **Star call-to-action** ("⭐ If you like this project, star it on GitHub")
4. **Navigation links** between major sections
5. **GitHub admonitions** (`> [!TIP]`, `> [!NOTE]`, `> [!IMPORTANT]`) for callouts
6. **Bold feature names** in feature lists
7. **Collapsible sections** (`<details>`) for alternative setup methods
8. **Architecture diagrams** or demo GIFs near the top
9. **Resources section** with related links
10. **No LICENSE/CONTRIBUTING/CHANGELOG sections** — those have dedicated files
