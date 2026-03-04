---
name: agents-md
description: Create or update AGENTS.md files for project repositories following the open agents.md format. Use when a user asks to create an AGENTS.md file, generate agent instructions for a repo, document a project for coding agents, or improve an existing AGENTS.md. Also use when setting up a new project and the user wants agent-friendly documentation.
---

# AGENTS.md Creator

Create comprehensive `AGENTS.md` files that give coding agents the context they need to work effectively on a project, following the open format at https://agents.md/.

## Workflow

1. Analyze the project structure and context
2. Determine if monorepo (may need multiple AGENTS.md files)
3. Generate AGENTS.md content
4. Create or update the file(s)

## Step 1: Analyze the Project

Examine the repository to understand its context. Look for:

- **Project identity**: README files, package.json, pyproject.toml, Cargo.toml, go.mod, etc.
- **Architecture**: Directory structure, monorepo setup, distinct project roots
- **Tech stack**: Languages, frameworks, libraries, build tools
- **Development workflow**: Scripts, CI/CD workflows (.github/workflows/), Makefiles, task runners
- **Coding standards**: Linter configs (.eslintrc, .prettierrc, ruff.toml), editor configs, existing style guides
- **Security**: Auth patterns, secrets management, dependency policies
- **Testing**: Test frameworks, test scripts, coverage configuration
- **Contribution guidelines**: CONTRIBUTING.md, PR templates, commit conventions

## Step 2: Determine File Placement

- Always create at least one `AGENTS.md` at the repository root.
- For monorepos or projects with distinct subdirectory roots (e.g., separate frontend/backend), create additional `AGENTS.md` files in each relevant subdirectory.
- The closest `AGENTS.md` takes precedence for any given location.

## Step 3: Generate Content

Use this template, omitting sections that are not relevant:

```markdown
# [project_name]
[Project summary]

## Overview
- [Brief description of what the project does, its purpose and audience]
- [Architecture overview if complex]
- [Project structure if relevant]

## Key Technologies and Frameworks
- [List of main technologies, frameworks, and libraries used]

## Constraints and Requirements
- [Specific constraints or considerations]

## Challenges and Mitigation Strategies
- [Potential challenges and how to address them]

## Development Workflow
- [Key scripts and commands for dev, test, build, deploy]

## Coding Guidelines
- [Coding standards, style guides, best practices]

## Security Considerations
- [Security practices relevant to the project]

## Pull Request Guidelines
- [Title format, required checks, review process, commit conventions]

## Debugging and Troubleshooting
- [Common issues, logging patterns, debug config, performance tips]
```

## Guidelines

- **Be specific and concise**: include exact commands and real information from the project, never invent details.
- **Only use discovered information**: do not assume or fabricate project details.
- **Use standard Markdown** with code blocks for commands.
- **Add custom sections** when they provide important context not covered by the template.
- **Prioritize actionability**: give agents enough context to contribute without additional human guidance.
- **Keep it focused**: document what agents need to know, not general project marketing.
