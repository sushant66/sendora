# Security Policy

Sendora handles sensitive data on a user's behalf: OAuth refresh tokens, an encryption
key for provider secrets at rest, and the ability to send email from a connected account.
We take security reports seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report privately through one of:

- [GitHub private vulnerability reporting](https://github.com/sushant66/sendora/security/advisories/new)
  (Security tab → "Report a vulnerability") — preferred.
- Email the maintainer at the address on their [GitHub profile](https://github.com/sushant66).

Please include:

- A description of the issue and the impact you think it has.
- Steps to reproduce (a proof of concept if you have one).
- Affected version, commit, or deployment.

You can expect an initial acknowledgement within a few days. We will keep you updated as
we investigate, and we will credit you in the fix unless you prefer to stay anonymous.

## Scope

This is a personal open-source project without a formal bug-bounty program, but reports on
the following are especially valuable:

- Authentication or session handling (Auth.js / Google OAuth).
- Handling of the `gmail.send` grant and stored refresh tokens.
- Encryption of provider secrets at rest (`TOKEN_ENCRYPTION_KEY`).
- Per-user data scoping — any way one user can read or act on another user's contacts,
  templates, resumes, or send history.
- Injection or sanitization gaps in the rich-text template pipeline.
- Secrets exposed in logs, error responses, or client bundles.

## Handling of secrets

Sendora never commits real secrets. All configuration is supplied through environment
variables (see `.env.example`) and validated at startup. If you believe a secret has been
committed to this repository's history, please report it privately using the channels above.
