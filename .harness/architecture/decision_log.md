# DECISION LOG
# Chronological record of important architectural and technical decisions.
# Each entry must be readable independently.

---

## Entry Format

```
### [DATE] — [Decision title]
**Context:** Why this decision was needed.
**Options considered:** What alternatives were evaluated.
**Decision:** What was decided.
**Rationale:** Why this option was chosen over the others.
**Consequences:** What this decision implies for the future.
**Decided by:** [Role that took the decision]
```

---

## Entries

<!-- Entries are added here in chronological order -->
<!-- The most recent goes at the TOP of the file -->

### [YYYY-MM-DD] — Project Initialization
**Context:** Project started with engineering harness v3.0.
**Decision:** Adopt multi-role harness with separate files per responsibility.
**Rationale:** Preserve context window and maintain a clear separation of concerns.
**Consequences:** Each session must load the active role + project_context.md + conflict_resolution.md.
**Decided by:** CTO

