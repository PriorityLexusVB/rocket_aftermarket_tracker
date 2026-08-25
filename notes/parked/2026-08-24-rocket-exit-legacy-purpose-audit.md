# Rocket Exit — Legacy Purpose Audit

**Date:** 2026-08-24
**Status:** CLOSED AS MERGE SOURCE · parked references only

## Decision

The downloaded Rocket.new `Rocket Aftermarket Tracker` project is a historical snapshot, not a second current application and not a source to merge back into production.

Canonical system remains this repository + Vercel + production Supabase project `ogjtmtndgiqqdtwatsue`.

## What the old Rocket project was originally for

The broad original concept was an all-in-one aftermarket operations platform: sales/deal intake, vehicles, vendor work, calendar/scheduling, loaners, claims, photos/documentation, administration, and business intelligence.

That broad page inventory made the app look like many products at once. Importantly, by the recovered Rocket snapshot itself the actual router had already **consolidated** the product into a smaller set of core workflows and redirected/retired many old pages. Current development continued that consolidation rather than accidentally losing the original purpose.

## What current production covers better

- deal intake + lifecycle;
- board/list/calendar scheduling loop;
- Needs Schedule / Overdue exception surfaces;
- active appointments;
- loaners;
- guest + staff claims flow;
- advanced analytics;
- admin/capability/personnel controls;
- security/RLS/auth boundaries;
- verified Vercel deployment, CI/E2E and release gates.

Many legacy Rocket pages were already mock-heavy or redundant, including old executive analytics, vehicle hub/workstation, vendor dashboards, and transaction-interface variants. Do not restore them merely because files existed.

## One dormant capability worth remembering: job photo documentation

The recovered Rocket snapshot contains a real `photo-documentation-center` implementation and this current repo still retains `src/services/photoDocumentationService.js` plus the `job_photos` schema/migrations. However:

- the old Rocket snapshot's own main router did not make the photo center a core routed workflow;
- current `Routes.jsx` explicitly redirects the legacy photo route into Deals;
- current search shows no caller of `uploadJobPhoto()` outside the retained service itself;
- read-only production audit on 2026-08-24 found `jobs=0`, `job_photos=0`, and no photo-documentation/note rows, so there is no evidence this is a currently used missing production workflow.

**Decision:** do not rebuild a standalone Photo Documentation Center now.

If coordinators later prove a real need for photo proof / before-after / claim evidence, implement the smallest version **inside the canonical Deal or Claim detail workflow**, reusing/hardening the existing service/schema. Do not resurrect the legacy page suite.

## Security/archive note

The Rocket export contained a `.env` file. It is not to be pushed or treated as a code artifact. A sanitized offline archive was created with env values removed.

## Final rule

The old Rocket workspace is evidence of historical intent only. Future work starts from current product purpose and current live workflows, then uses old code only when it reveals a specific missing use case that still matters to users.
