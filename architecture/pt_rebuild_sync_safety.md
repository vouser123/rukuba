# PT Tracker Rebuild — Sync, Safety, and Authority

This document defines **safety-critical requirements** for offline-first behavior, sync correctness, and authority boundaries. The server database is authoritative; client state is advisory.

---

## 1. Authority Boundaries
- **Server authoritative**: The SQL database is the sole source of truth for sessions, notes, assignments, and role mappings.
- **Client advisory**: Local caches, IndexedDB, and service-worker caches are non-authoritative and must revalidate against server state.
- **Conflict policy**: If the client version does not match the server version, the client must show a conflict resolution UI (no silent overwrite).

---

## 2. Offline Queue Semantics
### 2.1 Required Mutation Envelope
Every queued mutation must include:
- `mutation_id` (UUID, stable and idempotent)
- `device_id` (UUID from a registered device record)
- `user_id`
- `entity_type` (session, set, note, assignment, role, vocab)
- `entity_id` (if known)
- `client_timestamp` (ISO8601)
- `payload` (schema-validated)
- `base_version` (server version / ETag, required for updates; omit for creates)

### 2.2 Ordering Rules
- Queue is **append-only**.
- Mutations are processed in **strict order** per device.
- If a mutation fails due to validation or conflict, the queue **halts** and surfaces to the user until resolved.

### 2.3 Idempotency & Retry
- The server must reject duplicate `mutation_id` with a safe “already applied” response.
- Retries must preserve mutation ordering and must not generate new IDs.
- The server must persist mutation receipts (see `mutation_receipts` table) so idempotency survives restarts and remains auditable.

---

## 3. Background Sync (iOS PWA)
### 3.1 Expectations
- Background sync is **best-effort** and **not guaranteed** on iOS PWA.
- The system must never assume background execution for correctness.

### 3.2 Mandatory Fallbacks
- Foreground sync on app open and resume.
- Manual “Sync Now” button in settings and error banners.
- Persistent “Unsynced” indicator until the server confirms all queued mutations.

---

## 4. Failure Handling & User Disclosure
### 4.1 Must Block
- Authentication failure.
- Schema validation failure (missing required fields, invalid enum).
- Version conflict on server.

### 4.2 May Retry (Non-Blocking)
- Network timeouts.
- 5xx server errors.
- Temporary offline state.

### 4.3 User Feedback Requirements
- Any failure to store session data must display an error banner and show “Unsynced” status.
- Users must be able to inspect queued items and manually retry.

---

## 5. Auditability & Traceability
- All writes to sessions, assignments, roles, and notes must emit an **audit_log** record (see schema).
- The audit log must include `actor_id`, `device_id`, `before_state`, `after_state`, and timestamps.
- Audit logs must be immutable and retained per retention policy.

---

## 6. Backup & Recovery
- **Server backups**: daily backups with defined retention period.
- **Restore drills**: scheduled restore verification is required.
- **Client recovery**: offline queues and last-known state must persist across app restarts and device reboots.
- **Uninstall/eviction reality**: iOS can evict local storage and uninstall wipes all client data. The UI must:
  - keep a persistent “Unsynced” indicator while queued mutations exist,
  - block or warn on sign-out/reset when unsynced data exists,
  - provide a manual “Sync Now” and export/backup option before any destructive flow.

---

## 7. Data Integrity Invariants (Sync-Level)
- A session with sets must not exist without a valid `patient_id`.
- If `exercise_id` is missing, `exercise_name` is required to preserve meaning.
- A session delete must be a soft delete and logged in the audit log.
- Notes cannot be edited without preserving original text in audit history.
