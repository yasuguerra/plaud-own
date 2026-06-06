# WORKFLOW: NEW FEATURE
# Use for: any new functionality or significant change
# Estimated time: variable depending on complexity

---

## FLOW DIAGRAM

```
User sends request
        ↓
[CTO] Translates business objective
        ↓
[Chief Architect] Impact analysis
        ↓
[Security Architect] Preliminary threat analysis
        ↓
[Chief Architect] Creates plan.md
        ↓
[CTO] Presents plan to user
        ↓
    Approved?
   ↙          ↘
  No           Yes
  ↓             ↓
Iterate   [Principal Engineer]
          Implements
               ↓
    [Chief Architect] Review
               ↓
         Approved?
        ↙          ↘
       No            Yes
       ↓              ↓
   Iterate     [QA Engineer]
               Runs tests
                    ↓
           [Security Architect]
               Security audit
                    ↓
           [Entropy Auditor]
               Entropy audit
                    ↓
           [Release Governor]
               Release review
                    ↓
           [CTO] Final review
                    ↓
              All green?
             ↙          ↘
            No            Yes
            ↓              ↓
         Iterate     cto_approval.md
                          ↓
                    User validates
                          ↓
                  "push/commit/deploy"?
                    ↓
                  Git commit + push
```

---

## STEP 1 — RECEPTION AND ANALYSIS

**Active role: CTO**
**Load: `roles/cto.md` + `project_context.md`**

```
1. CTO receives user request
2. CTO translates business objective into technical mandates
3. CTO asks the following internal questions:
   - What user problem does this solve?
   - Is it aligned with the product strategy?
   - Does it have measurable success criteria?
4. CTO convenes Chief Architect and Security Architect for analysis
```

**Required output:** Technical objective clarified for the team.

---

## STEP 2 — PLANNING

**Active role: Chief Architect + Security Architect**
**Load: `roles/chief_architect.md` + `roles/security_architect.md` + `project_context.md`**

```
1. Chief Architect performs impact analysis:
   - Affected modules
   - Dependencies
   - Architectural risks

2. Security Architect performs threat analysis:
   - New attack surface
   - Sensitive data involved
   - Authentication/authorization requirements

3. Chief Architect creates plan.md with all the information
```

**Required output:** Full `.harness/plan.md`.

---

## STEP 3 — PLAN APPROVAL

**Active role: CTO**
**Load: `roles/cto.md`**

```
1. CTO presents plan.md to user
2. CTO explains:
   - What will be built
   - How it will be built
   - Identified risks
   - Acceptance criteria
3. ⛔ STOP — WAIT FOR EXPLICIT USER APPROVAL
4. If the user requests changes → return to Step 2
5. If the user approves → proceed to Step 4
```

**❌ Do not write code before this approval.**

---

## STEP 4 — IMPLEMENTATION

**Active role: Principal Engineer**
**Load: `roles/principal_engineer.md` + `project_context.md`**

```
1. Principal Engineer reads full plan.md
2. Implements following:
   - Project coding standards
   - Types across all new code
   - Documentation in all functions
   - Tests (happy path + edge cases + failure cases)
3. Verifies own checklist before marking as ready
4. Marks implementation as complete
```

**Required output:** Implemented code with tests.

---

## STEP 5 — ARCHITECTURE REVIEW

**Active role: Chief Architect**
**Load: `roles/chief_architect.md` + `project_context.md`**

```
1. Chief Architect reviews implementation against plan.md
2. Verifies rejection criteria
3. If there are violations → rejects, Principal Engineer iterates
4. If everything is correct → approves, proceed to Step 6
```

---

## STEP 6 — QA

**Active role: QA Engineer**
**Load: `roles/qa_engineer.md` + `project_context.md`**

```
1. QA runs the complete test suite
2. Validates against acceptance criteria in plan.md
3. Generates qa_report.md
4. If there are failures → blocks, Principal Engineer iterates
5. If everything passes → proceed to Step 7
```

**Required output:** `.harness/qa_report.md`

---

## STEP 7 — SECURITY AUDIT

**Active role: Security Architect**
**Load: `roles/security_architect.md` + `project_context.md`**

```
1. Security Architect reviews final implementation
2. Runs full security checklist
3. Generates security_report.md
4. If CRITICAL or HIGH exists → blocks, Principal Engineer iterates
5. If everything is in order → proceed to Step 8
```

**Required output:** `.harness/audits/security_report.md`

---

## STEP 8 — ENTROPY AUDIT

**Active role: Entropy Auditor**
**Load: `roles/entropy_auditor.md` + `project_context.md`**

```
1. Entropy Auditor reviews added complexity
2. Runs mandatory questions
3. Generates entropy_report.md
4. If CRITICAL findings exist → rejects, Principal Engineer iterates
5. If acceptable → proceed to Step 9
```

**Required output:** `.harness/audits/entropy_report.md`

---

## STEP 9 — RELEASE REVIEW

**Active role: Release Governor**
**Load: `roles/release_governor.md` + `project_context.md`**

```
1. Release Governor verifies deployment readiness
2. Runs full checklist
3. Generates release_report.md
4. If BLOCKERS exist → blocks until resolution
5. If ready → proceed to Step 10
```

**Required output:** `.harness/audits/release_report.md`

---

## STEP 10 — FINAL APPROVAL

**Active role: CTO**
**Load: `roles/cto.md`**

```
1. CTO reviews all reports:
   - qa_report.md ✅
   - security_report.md ✅
   - entropy_report.md ✅
   - release_report.md ✅
2. If all are green → generates cto_approval.md
3. Deletes plan.md (fulfilled its purpose)
4. Presents final summary to the user
5. ⛔ STOP — WAIT FOR EXPLICIT USER CONFIRMATION
```

---

## STEP 11 — DEPLOY

```
Only when the user explicitly says:
"push" / "commit" / "deploy" / "ready" / "go ahead"

→ git add [relevant files]
→ git commit -m "[type](scope): description"
→ git push

Commit format (Conventional Commits):
feat(scope): description
fix(scope): description
refactor(scope): description
test(scope): description
docs(scope): description
chore(scope): description
```

