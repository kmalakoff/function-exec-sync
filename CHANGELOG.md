# Changelog

## [2.3.0] - 2026-10-09

### Fixed

Preserve outer and nested Error messages, stacks, diagnostic fields, and own cause/errors fields across the child-process boundary. AggregateError values reconstruct as native aggregates where available and as local Error values retaining aggregate data on older Node versions. Absent fields remain distinct from fields explicitly set to undefined.
