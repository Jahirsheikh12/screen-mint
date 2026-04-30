# Security Policy

## Supported Versions

Public beta builds receive security fixes on the latest released beta version. Older beta builds may
be asked to upgrade before an issue can be reproduced or patched.

## Reporting A Vulnerability

Please report security issues privately instead of opening a public issue.

- Email: security@screenmint.live
- Include the affected version, operating system, reproduction steps, expected impact, and any
  relevant logs or sample files.

If that email is unavailable, contact the maintainer through the GitHub profile listed in the
repository and avoid sharing exploit details publicly.

## Scope

High-priority areas include:

- IPC methods that read, write, delete, reveal, or open files.
- Export paths and temporary output handling.
- Project file loading and `.screenmint` parsing.
- Native helper invocation and argument handling.
- Update checks and installer metadata.
- External URL handling.

Please do not test against other users, third-party services, or systems you do not own.
