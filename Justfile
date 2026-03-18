# Show available commands
_default:
    @just --list

# Install dependencies and set up pre-commit hooks
[group('dev')]
install:
    bun install
    bunx lefthook install

# Run tests
[group('check')]
test *args:
    bun test {{args}}

# Run TypeScript type checking
[group('check')]
typecheck:
    bun run typecheck

# Format code with prettier
[group('dev')]
format:
    bun run format

# Check code formatting without modifying files
[group('check')]
format-check:
    bun run format:check

# Run all checks (typecheck + format check + tests)
[group('check')]
check: typecheck format-check test

# Create GitHub App on an org
[group('dev')]
create-app org app_name="Alia":
    ./scripts/create-app.sh {{app_name}} {{org}}
