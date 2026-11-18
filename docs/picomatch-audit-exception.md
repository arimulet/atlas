# Temporary picomatch audit exception

GitHub's [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
reports a high severity ReDoS in picomatch through 4.0.7 and lists no patched version as of
2026-11-17. The CI audit temporarily accepts that advisory and dependency findings whose high or
critical causes are limited to it. As with the previous audit level, moderate and lower findings
do not fail CI. Other high or critical advisories, errors and malformed audit reports fail CI.

Picomatch is used by development tooling, including Vitest, tinyglobby and the Sass watcher.
The production-only npm audit also includes the optional watcher through Sass's peer relationship
with Next.js. We have not established that application requests can supply glob patterns to these
paths. Untrusted glob patterns processed during development, builds or runtime could block the
Node.js event loop, so avoid passing untrusted patterns to this tooling. This exception does not
fix the vulnerability and its production reachability remains unconfirmed.

Recheck the advisory and npm releases regularly. Once a compatible official fix exists, update the
affected dependencies and lockfile, verify `npm audit --audit-level=high`, and replace the exception
script in CI with the standard npm audit command. Remove this document, the audit scripts and their
policy tests at that time.
