# Verification Checklist

Before declaring a frontend task complete:

## 1. Visual
- inspect the rendered result;
- compare against brief/reference;
- remove generic or accidental styling;
- check typography, spacing, alignment, density.

## 2. Responsive
Verify relevant widths, including:
- narrow mobile;
- common mobile;
- tablet;
- laptop;
- large desktop.

## 3. Interaction
Check:
- hover;
- focus-visible;
- active;
- disabled;
- busy;
- pointer stability;
- keyboard navigation.

## 4. States
Check:
- loading;
- empty;
- no-results;
- error;
- retry;
- long content;
- overflow.

## 5. Accessibility
Check:
- semantic controls;
- accessible names;
- labels;
- contrast;
- focus visibility;
- keyboard;
- reduced motion;
- screen-reader status;
- touch targets.

## 6. Anti-pattern scan
Read `anti-patterns.md` and inspect changed code.

## 7. Product consistency
Confirm:
- canonical primitives reused;
- no new local duplicate;
- workflow matches sibling behavior;
- durable token changes are mapped.

## 8. Tests
Run available:
- unit tests;
- typecheck;
- lint;
- build;
- integration/E2E;
- accessibility checks.

Do not claim verification steps that were not actually run.
