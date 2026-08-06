# Security Policy

## Supported versions

Only the latest `0.1.x` line receives security fixes. Earlier snapshots, historical plugins, and private experiment branches are not supported release surfaces.

## Reporting a vulnerability

Use GitHub private vulnerability reporting or a private GitHub security advisory for this repository. Do not disclose a suspected vulnerability in a public issue. Include the affected commit, reproduction steps, impact, and any safe mitigation you have already verified. Never include real student data or credentials in the report.

Maintainers target acknowledgement within seven days and a status update within fourteen days. These are response targets, not a guarantee of resolution time.

## M0 threat model

StudyForge M0 is a loopback-only, single-user local application. The HTTP server binds to `127.0.0.1`, and browser mutation and WebSocket channels enforce an explicit loopback Origin policy. Model credentials are managed by Pi; StudyForge does not display, copy, or rewrite those credentials.

M0 makes no cloud-hosting, remote-access, sandboxing, tenant-isolation, or multi-user security claim. Do not expose the local server to another machine, a public interface, a reverse proxy, or an untrusted user. Learning Sets and Pi session files may contain sensitive educational records and must be protected by the host operating system and the user's storage practices.
