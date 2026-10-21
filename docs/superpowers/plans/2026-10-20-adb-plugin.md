# ADB Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Manage ADB devices, QR pairing, and manual connections from Paseo, with five saved IPs.

**Architecture:** A native screen calls validated plugin RPCs. Server modules separate command execution, ADB parsing, persistent history, and bounded pairing sessions. ADB performs the actual pairing handshake.

**Tech Stack:** TypeScript, Paseo 0.12 plugin SDK, React Native, TanStack Query, Zod, local QR generation, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-adb-plugin-design.md`

## Global Constraints

- Single IP:port field; history holds five distinct IPs from successful connections.
- Clicking history fills IP plus colon and focuses the cursor after it; no persisted ports.
- Pairing sessions expire after two minutes and must not update replacement sessions.
- Device refresh every five seconds while mounted; offline and unauthorized transports remain visible.
- React Native primitives and Paseo theme colors; no DOM globals in the screen.
- Commands use argument arrays, timeouts, output limits, and cleanup.

## Review Focus

- ADB returns an error in stdout with exit code zero: report failure, preserve history.
- A canceled pair finishes late: do not connect it or overwrite a newer session.
- Corrupted history: report persistence failure without losing recoverable stored data.
- Multiple devices advertise services: only pair the QR session's matching instance.
- Selecting history after editing: replace the whole field and move the cursor to the end.

## Task 1: Validated endpoints, ADB output, and persistent history

**Files:** package/TypeScript/test configuration; `shared/contracts.ts`; `shared/endpoint.ts`; `server/parsers.ts`; `server/history.ts`; corresponding test files.

**Interfaces:** `parseEndpoint(value): { host, port, address }`; `historyPrefix(host): string`; `parseDevices(output): Device[]`; `parseServices(output): Service[]`; `HistoryStore.list/add/remove` serialized async methods. RPCs expose devices, connection, disconnection, history, and pairing.

- [ ] Write failing cases for whitespace, invalid ports/IPs, IPv6, device states, mDNS service matching, deduplication, five-entry eviction, concurrent updates, persistence across instances, and corrupt JSON.
- [ ] Run `npm test -- shared server/parsers.test.ts server/history.test.ts`; confirm failures describe missing behavior.
- [ ] Implement parsing, validated RPC contracts, and atomic serialized history writes with private file permissions.
- [ ] Run tests and TypeScript checks; expected tests pass.

## Task 2: ADB commands and QR pairing lifecycle

**Files:** `server/adb.ts`; `server/pairing.ts`; `index.server.ts`; tests for ADB and pairing.

**Interfaces:** `AdbClient.devices/connect/disconnect/services/pair`; injected command runner for deterministic tests. `PairingManager.start/status/cancel/dispose` owns one session, its secret, and its abort signal. Server handlers return contract-validated results.

- [ ] Write failing tests for textual ADB failures, missing binary, metadata partial failure, QR-only service matching, success, connection-port discovery, timeout, cancellation, stale completion, and cleanup.
- [ ] Run targeted tests and observe the missing behavior.
- [ ] Implement bounded execFile operations, SDK/PATH discovery, device metadata, session polling, and handlers. Produce a local QR image; never store or log its secret.
- [ ] Run the full test suite and TypeScript checks; expected pass.

## Task 3: Native ADB screen

**Files:** `index.client.tsx`; `client/screen.tsx`; focused UI components under `client/`; interaction tests.

**Interfaces:** Screen uses shared RPCs with TanStack Query. Endpoint form takes history and onConnect/onRemove callbacks. Selecting history sets the entire value and native input selection to `historyPrefix(host).length`.

- [ ] Write failing interaction tests for paste-and-connect, five saved IPs, history selection/focus/cursor, validation feedback, pairing actions, device status, and missing metadata.
- [ ] Run interaction tests and confirm expected failures.
- [ ] Implement screen sections, form, device cards, QR/status display, sidebar registration, and Command Center action.
- [ ] Run all tests and typechecks; audit DOM usage and verify compact rendering.

## Task 4: Packaging, documentation, and host verification

**Files:** `README.md`; `OVERVIEW.md`; `paseo-plugin.json`; package files and optional icon asset.

- [ ] Document install/use, ADB prerequisites, network discovery, connection versus pairing ports, history behavior, and troubleshooting.
- [ ] Run `npm test`, `npm run typecheck`, the client platform audit, and `npm pack --dry-run`.
- [ ] Inspect the target daemon's plugin switch before installing. Do not enable a disabled global switch without permission.
- [ ] Install/reload when enabled and verify running status and plugin logs. Check real device listing when host access permits.
- [ ] Obtain an independent whole-change review, fix important findings with regression tests, and report physical QR scanning as unverified if unavailable.

## Execution ledger

- User approved the written design with “go”; implementation proceeds inline in the supplied new project directory.
- The directory began without a Git repository or existing code. Work occurs in this dedicated project directory; no separate worktree or existing branch is modified.
- Pre-flight: Task 1 endpoint, device, service, and history interfaces match the consumers in Tasks 2–3. Task 2 shared RPC definitions match Task 3 hook usage. No conflicting interfaces found.
- Task 1: complete — parsing/history tests failed before implementation; 15 tests then passed. TypeScript checks pass.
- Task 2: complete — ADB/pairing tests failed before implementation; full suite now 25/25 passing, all three TypeScript configurations pass.
- Task 3: complete — native screen, endpoint form, device cards, and QR controls implemented. Form and device tests failed before implementation. Compact-screen integration tests verify connection refresh, QR display/cancel, and unavailable-ADB feedback.
- Task 4: complete — README and OVERVIEW added; package dry run contains 17 production/documentation files and excludes tests. Plugin installed and reloaded successfully on the already-enabled local daemon.
- Final review: independent read-only review found no Critical or Important defects. Addressed all three minor findings: native keyboard tap handling, caret synchronization, and canonical IPv6 history deduplication. IPv6 regression reproduced RED and passed GREEN; existing form interactions remain green. No deferred minor findings.
- Final verification: 38/38 tests pass across nine files; client/server/test TypeScript checks pass; client bundle compilation passes; package dry run passes. Client audit only matched TypeScript generics, with no DOM API usage in production components.
- Host verification: actual plugin discovery code returned three ADB transports, identified Google Pixel 10 Pro XL and Samsung SM-S931B, and read Android 17 on both physical devices. Duplicate transports for one physical device remain visible because the screen lists ADB transports.
- Verification limits: browser automation could not register a preview tab and no alternative browser was available. Compact layout was exercised by integration tests but not visually inspected. Real phone QR scanning, native iOS/Android rendering, and Windows execution were not tested. Ordinary concurrency through the single history store is covered; concurrent separate daemon processes sharing one home and large device fleets are outside the established deployment. Cancellation aborts plugin-owned work but does not revoke trust already committed by the underlying ADB server. Device disappearance between list and disconnect is reported as an actionable error. No deployment behavior was changed to address unverified scenarios.
