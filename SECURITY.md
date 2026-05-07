# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Alia Action, please report it
privately by emailing **security@usealia.com** or by using GitHub's
"Report a vulnerability" button under the Security tab of this repository.

Please include:

- A description of the vulnerability
- Steps to reproduce
- The version or commit SHA affected
- Any proof-of-concept code, if applicable

We will acknowledge your report within 3 business days and work with you on a
coordinated disclosure timeline.

## Scope

This policy covers the `Prosieve-Inc/alia-action` repository only. The Alia
backend service is out of scope for this repository's security policy.

## Out of Scope

- Vulnerabilities in third-party dependencies — please report upstream
- Issues that require the attacker to control the GitHub App installation or
  the repository secrets used to configure the action
- Theoretical vulnerabilities without a working proof of concept

## Hardening Notes for Consumers

When integrating this action into your workflows:

- **Use `pull_request`, never `pull_request_target`.** The agent processes
  attacker-controlled PR content (title, body, comments) with filesystem and
  git read access on the runner. `pull_request_target` would expose your
  repository secrets to fork PRs.
- Pin third-party actions by commit SHA (see the README example).
- Grant the workflow the minimum permissions documented in the README:
  `id-token: write`, `contents: read`, `pull-requests: read`.
