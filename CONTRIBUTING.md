# Contributing to StudyForge

Thank you for helping build a teaching agent whose decisions can be inspected. Keep changes focused: one behavioral claim, defect, documentation correction, or learning-asset addition per pull request whenever practical.

Before opening a pull request:

- run the tests relevant to the changed surface, then run `bun run check`;
- run `bun run test:e2e` for lifecycle, server, projection, or UI changes;
- do not commit API keys, OAuth material, local Pi sessions, logs, or machine-specific paths;
- do not commit real student records, identifiable classroom transcripts, or derived learner profiles;
- preserve student confirmation gates and the Plan-local Lesson evidence boundary;
- explain behavior changes and include a regression test when the behavior is executable.

Every contributed textbook excerpt, problem, image, card, method graph, or other learning asset must include a provenance record and a license that permits redistribution. “Found online,” classroom access, or private ownership is not sufficient. Synthetic or rewritten assets still need a note describing how they were produced and reviewed. Maintainers may remove an asset whose provenance cannot be verified.

Contributions are submitted under the repository's Apache-2.0 license unless the contribution clearly declares another accepted license. Learning assets with a different license must remain in an explicitly bounded directory and must not silently inherit the project license.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues belong in the private channel described in [SECURITY.md](SECURITY.md), not a public issue.
