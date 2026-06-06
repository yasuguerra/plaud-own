# WORKFLOW: HOTFIX
# Use for: critical bugs in production requiring immediate fix
# Estimated time: minimal, maximum urgency
# ⚠️ This workflow is accelerated but does NOT bypass security.

---

## WHEN TO USE THIS WORKFLOW

✅ Critical bug in production causing downtime
✅ Actively exploited security vulnerability
✅ In-progress data loss
✅ Failure affecting all users

❌ DO NOT use for new features (use feature_workflow.md)
❌ DO NOT use for non-critical bugs (plan in the next sprint)
❌ DO NOT use for "we want to move it fast" — that is not a hotfix

---

## FLOW DIAGRAM

```
Incident reported
        ↓
[CTO] Classifies severity
        ↓
   Is it a hotfix?
  ↙          ↘
 No            Yes
 ↓              ↓
Feature     [Chief Architect]
workflow    Minimum plan (15 min)
                ↓
        [Security Architect]
        Quick security check
                ↓
        [Principal Engineer]
        Minimum and surgical fix
                ↓
        [QA Engineer]
        Tests of the affected area
                ↓
        [Release Governor]
        Quick deploy check
                ↓
        [CTO] Approval
                ↓
        Immediate deploy
                ↓
        Post-mortem within 48h
```

---

## STEP 1 — INCIDENT CLASSIFICATION

**Active role: CTO**

```
CTO evaluates:
- Is it affecting users in production right now?
- How many users are affected?
- Is there data loss?
- Is there an active security risk?

Severities:
P0 → Total downtime or data loss → IMMEDIATE Hotfix
P1 → Critical functionality broken → Hotfix in < 2 hours
P2 → Important functionality degraded → Fix in next planned deploy
P3 → Minor bug → Backlog

Only P0 and P1 use this workflow.
```

---

## STEP 2 — MINIMUM PLAN

**Active role: Chief Architect**

```
A hotfix plan does NOT require a full plan.md.
It requires answering in < 15 minutes:

1. What is the root cause of the bug?
2. What is the smallest possible fix?
3. What can break with this fix?
4. What is the rollback plan if the fix fails?

Document in a PR comment, not in a full plan.md.
```

---

## STEP 3 — QUICK SECURITY CHECK

**Active role: Security Architect**

```
Security Architect performs a reduced checklist (5 minutes):

[ ] Does the fix introduce unvalidated inputs?
[ ] Does the fix expose sensitive data?
[ ] Does the fix modify authentication or authorization?
[ ] Does the fix introduce hardcoded secrets?

If any is YES → escalate before proceeding.
If all are NO → approve for implementation.

⚠️ Security is not bypassed. It is only accelerated.
```

---

## STEP 4 — SURGICAL IMPLEMENTATION

**Active role: Principal Engineer**

```
Hotfix rules:
✅ Minimum fix — only what is necessary to resolve the bug
✅ No opportunistic refactors
✅ No "while I am at it" features
✅ Tests for the specific bug (at least one reproducing the bug)
❌ Do not introduce new technical debt
❌ Do not modify more than necessary

The Principal Engineer must be able to explain every changed line.
```

---

## STEP 5 — REDUCED QA

**Active role: QA Engineer**

```
QA in hotfix focuses on:
1. Is the original bug fixed?
2. Do tests in the affected area pass?
3. Are there obvious regressions in related functionality?

Full coverage is not required, but:
- Test reproducing the bug → now passes
- Suite of the affected module → passes
```

---

## STEP 6 — QUICK RELEASE CHECK

**Active role: Release Governor**

```
Minimum check for hotfix:
[ ] Does build compile?
[ ] Do critical tests pass?
[ ] Is there a documented rollback plan?
[ ] Are migrations (if any) safe?
[ ] Are secrets configured?

If everything is in order → ready for deploy.
```

---

## STEP 7 — APPROVAL AND DEPLOY

**Active role: CTO**

```
CTO approves hotfix with:
- Description of the bug
- Description of the fix
- Known risks
- Rollback plan

Immediate deploy without waiting for user "push" (P0).
For P1, wait for user confirmation.

Commit format:
fix(scope): description of the corrected bug

Hotfix: #[issue-number]
```

---

## POST-MORTEM (mandatory within 48 hours)

```
Every hotfix requires a documented post-mortem:

1. What happened?
2. When was it detected?
3. How long did the impact last?
4. What was the root cause?
5. How was it resolved?
6. What process changes prevent this in the future?
```

Guardar en: .harness/audits/postmortem-[fecha]-[descripción].md
```

---

## ⚠️ REGLA DE ORO DEL HOTFIX

Un hotfix que introduce un bug nuevo es peor que el bug original.
Velocidad no significa descuido. Significa enfoque.
