# WORKFLOW: REFACTOR
# Use for: technical debt, code cleanup, improving internal structure
# Golden rule: external behavior does not change.

---

## WHEN TO USE THIS WORKFLOW

✅ Eliminate duplicate code
✅ Improve names of variables/functions/modules
✅ Extract logic into reusable functions
✅ Improve test coverage
✅ Update dependencies with API changes
✅ Simplify unnecessary abstractions
✅ Improve performance without changing behavior

❌ DO NOT use if new functionality is added (use feature_workflow.md)
❌ DO NOT refactor without tests protecting current behavior

---

## CORE PRINCIPLE

```
A refactor that changes behavior is not a refactor.
It is a bug disguised as an improvement.

Before refactoring: tests must pass.
After refactoring: the same tests must continue to pass.
```

---

## FLOW DIAGRAM

```
Technical debt identified
          ↓
[Entropy Auditor] Validates that it is necessary
          ↓
[Chief Architect] Refactor plan
          ↓
    Is it safe to refactor?
    (Are there tests protecting it?)
   ↙                    ↘
  No                     Yes
  ↓                       ↓
First                [Principal Engineer]
add tests            Refactors
(mini-cycle)              ↓
                    [QA Engineer]
                    Verifies that nothing broke
                          ↓
                    [Entropy Auditor]
                    Confirms simplification
                          ↓
                    [CTO] Approval
                          ↓
                    Deploy (if applicable)
```

---

## STEP 1 — VALIDATION OF NEED

**Active role: Entropy Auditor**

```
Before any refactor, the Entropy Auditor answers:

What is the current cost of this debt?
- Does it slow down development?
- Does it cause recurring bugs?
- Does it hinder onboarding?
- Does it increase debugging time?

What is the benefit of the refactor?
- Lines deleted: X
- Duplication eliminated: yes/no
- Cyclomatic complexity reduced: yes/no

If the cost does not justify the benefit → do not refactor now.
```

---

## STEP 2 — MINIMUM COVERAGE

**Active role: QA Engineer + Principal Engineer**

```
Before refactoring, verify:

Do tests covering the current behavior exist?

If NO:
1. Principal Engineer writes characterization tests
   (tests that document the current behavior, not the ideal one)
2. QA verifies that the tests capture the behavior
3. Only then proceed to refactor

If YES:
→ Proceed directly to the refactor
```

---

## STEP 3 — REFACTOR PLAN

**Active role: Chief Architect**

```
A refactor plan is lighter than a feature plan.
It must answer:

1. What will be changed?
2. What will NOT be changed?
3. In what order will the changes be made?
   (large refactors are done in small, independent steps)
4. How to verify that nothing was broken at each step?

Document in: PR comment or simplified plan.md
```

---

## STEP 4 — IMPLEMENTATION IN SMALL STEPS

**Active role: Principal Engineer**

```
Refactor rules:
✅ One change at a time (rename, extract, move, inline, etc.)
✅ Tests pass after EACH step
✅ Atomic commits for each refactor step
❌ Do not mix refactor with new features
❌ Do not mix multiple types of refactor in one commit

Permitted techniques:
- Rename (variable, function, class, module)
- Extract function / Extract class
- Inline function
- Move function / Move file
- Replace magic number with constant
- Introduce parameter object
- Remove dead code
- Simplify conditional
```

---

## STEP 5 — VERIFICATION

**Active role: QA Engineer**

```
Refactor verification:

[ ] All pre-existing tests still pass
[ ] No functional regressions
[ ] Coverage did not decrease
[ ] Performance did not degrade (if applicable)

If something failed → the refactor introduced a bug → revert and analyze
```

---

## STEP 6 — SIMPLIFICATION CONFIRMATION

**Active role: Entropy Auditor**

```
Entropy Auditor confirms:

[ ] The code is simpler now than before
[ ] Metrics improved (lines, complexity, duplication)
[ ] No new accidental complexity was introduced

If the refactor did not simplify anything → question whether it was worth it
```

---

## STEP 7 — APPROVAL AND DEPLOY

**Active role: CTO**

```
Refactors without behavior change:
→ Can be grouped into a single "refactor sprint" deploy
→ Do not require a full release_report.md if there are no migrations

Commit format:
refactor(scope): description of what was simplified

Closes #[technical-debt-issue]
```

---

## REFACTOR ANTI-PATTERNS

```
❌ "Refactor" that adds new functionality
❌ Refactoring code that has no tests
❌ Refactoring code that nobody touches (cost > benefit)
❌ Renaming everything for aesthetic preference without functional improvement
❌ Changing architecture without a plan (that is a feature, not a refactor)
❌ "Big bang" refactoring (everything at once without atomic steps)
```
