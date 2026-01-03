You are working in a PWA repository for a physical therapy (PT) exercise tracker. Your task is to fix email-based and copy/paste export/import so that large payloads survive iOS Mail copy/paste and cross-device transfer, with correct and robust integrity verification (byte size and checksum).

This flow is used cross-platform, including Windows Surface devices used by the PT (Edge/Chrome). The solution must be browser-native, platform-agnostic, and work offline as a PWA.

Copy/paste this entire prompt into Codex and follow it exactly.

⸻

IMPORTANT POLICY (this is the starting point of the system)
• Implement V2 as the only supported external export/import format.
• Do NOT keep or support V1 in any compatibility or fallback mode.
• The importer must reject non-V2 payloads with a clear, explicit error message.

====================
PROJECT CONTEXT

Relevant files (under /pt/ unless noted):
• pt_tracker.html — Export UI (patient report) + Import UI (PT modifications)
• pt_report.html — Export UI (PT modifications) + Import UI (patient report)
• exercise_editor.html — Export UI (library / PT data)
• rehab_coverage.html — Legacy or parallel export/import UI (must be examined)
• sw-pt.js — Service worker (touch only if required)
• Inline/shared JavaScript inside these HTML files

Two payload types (both MUST use V2):
	1.	PT_MODIFICATIONS
	2.	PT_DATA (patient tracker report; large payload)

You MUST examine rehab_coverage.html:
• Identify whether its export/import functionality is a true duplicate of pt_tracker.html and/or pt_report.html.
• If it is a strict duplicate with no unique semantics, remove it from menus and remove associated code.
• If it is not a duplicate, explicitly document what is unique about it and bring it fully into V2 compliance.
• Do NOT remove anything unless you are certain it is unused or redundant.

====================
PROBLEMS TO FIX

Observed failures:
• Import reports “Expected N bytes, received M bytes” even when the user did not modify the payload.
• Failures occur even without email (export → copy → paste across devices).
• iOS copy/paste and iOS Mail may truncate large selections, wrap lines, normalize line endings, or inject signatures and quoted text.
• Current implementation likely:
– Measures size using string.length instead of UTF-8 byte length
– Hashes non-canonical (whitespace-sensitive) text
• rehab_coverage.html currently exports and expects raw JSON, which is not resilient.

====================
HARD REQUIREMENTS
	1.	Marker-based extraction (mandatory)

• Importers MUST ignore all text outside payload markers (email prose, notes, signatures, quoted replies).
• Extract the FIRST valid block matching a V2 marker pair.
• Marker lines may have leading/trailing whitespace.
• Prefer the block matching the current import context:
– PT editor import screen → PT_MODIFICATIONS
– PT tracker import screen → PT_DATA
• Marker lines themselves are NEVER included in size or checksum calculations.
	2.	Canonicalization (REQUIRED, single source of truth)

All verification MUST use a single canonical representation:

• JSON.parse(decodedPayload)
• canonical = JSON.stringify(obj)
• SIZE = UTF-8 byte length of canonical
• CHECKSUM = SHA-256 hex digest of canonical UTF-8 bytes

This makes verification resilient to whitespace changes, line wrapping, and line-ending normalization.
	3.	V2 format (ONLY supported format)

Encoding pipeline:
• canonical JSON string → UTF-8 bytes
• gzip (or deflate; choose one and be consistent)
• base64 encode
• Wrap base64 to ≤ 76 characters per line (email-safe)

V2 blocks MUST contain header lines before the payload:
• FORMAT: V2
• ENCODING: gzip+base64 (or deflate+base64, consistently)
• TYPE: PT_MODIFICATIONS or PT_DATA
• SIZE: 
• CHECKSUM: 

Exact marker pairs:

PT_MODIFICATIONS:
–START_PT_MODIFICATIONS_V2–
…headers…
…base64 payload…
–END_PT_MODIFICATIONS_V2–

PT_DATA:
–START_PT_DATA_V2–
…headers…
…base64 payload…
–END_PT_DATA_V2–

Notes:
• Headers are line-based key/value pairs (e.g., “SIZE: 123”).
• Importers MUST require FORMAT, ENCODING, TYPE, SIZE, and CHECKSUM.
• Importers MUST tolerate and ignore additional unrecognized header lines.
	4.	Import behavior (V2)

• Locate markers and extract ONLY the delimited block.
• Split into lines.
• Parse header lines until the first non-header line.
• Header line regex: ^([A-Z_]+)\s*:\s*(.+)$
• Remaining lines are base64 payload lines.
• Concatenate payload lines and remove ALL whitespace.
• base64 decode → gunzip/inflate → bytes → UTF-8 decode → JSON.parse.
• Canonicalize via JSON.stringify.
• Compute SIZE and CHECKSUM from canonical JSON.
• Verify against header metadata.

If verification fails, the UI MUST report:
• Whether valid V2 markers were found
• Detected TYPE and ENCODING
• Expected vs computed SIZE (bytes)
• Expected vs computed CHECKSUM (first 12 hex characters are sufficient for display)
• Clear guidance: “Your paste was likely truncated (common on iOS for long text). Re-export and use ‘Copy payload only’.”

If no V2 markers are found:
• Error: “No V2 payload markers found. Make sure you copied the block starting with –START_PT_…_V2–”
	5.	Export UX (must preserve existing workflow)

Export screens (exercise_editor.html and pt_report.html) MUST keep:
• Email address input (optional)
• Note input (optional)

Then provide exactly TWO actions:

A) Copy payload only
• Copies ONLY the marker-delimited V2 block to the clipboard.
• No greetings, no instructions, no signature, no extra text.

B) Send email
• Opens the default email client using a mailto: link.
• Pre-fills:
– To: email address (if provided)
– Subject: appropriate to payload type
– Body: optional note + a short instruction + the V2 payload block
• The V2 payload block MUST be byte-for-byte identical to “Copy payload only” output.
	6.	Checksum clarity

• Remove any short or truncated checksum previews from export headers.
• Only the full SHA-256 checksum of canonical JSON is displayed and verified.
	7.	Shared utilities (single source of truth)

Create a shared JS utility module (preferred name: pt_payload_utils.js) and include it everywhere.
It MUST provide:

• utf8Bytes(str)
• utf8ByteLength(str)
• sha256Hex(bytes)
• canonicalizeObj(obj) => JSON.stringify(obj)
• gzipToBase64(bytes)
• base64ToGunzipBytes(str)
• wrapBase64(str, lineLen = 76)
• buildV2Block({ type, obj }) => string
• parseV2FromText(pastedText, preferredType)
=> { type, obj, meta, computed, errors }
	8.	Compression implementation

• Prefer CompressionStream / DecompressionStream where supported.
• If iOS Safari support is insufficient, vendor pako locally (NO CDN usage).
• Must function offline in PWA mode.
	9.	Tests (REQUIRED)

Add a minimal test harness (standalone HTML or Node script) that prints PASS / FAIL.

Required tests:
• PT_MODIFICATIONS round-trip: export → surround with extra text → import verifies.
• PT_DATA round-trip (large payload): wrapped base64 → import verifies.
• CRLF vs LF line endings: import verifies.
• Deliberate truncation: import fails with explicit “likely truncated” guidance.

====================
ACCEPTANCE CRITERIA

• V2-only export/import works reliably across iOS Mail copy/paste and Windows Surface (Edge/Chrome).
• Extra email text, notes, or signatures do not affect import.
• SIZE and CHECKSUM are stable and computed from canonical JSON bytes.
• Export UI provides both “Copy payload only” and “Send email” using existing email + note inputs.

====================
DELIVERABLES
	1.	Code changes in:
• pt_tracker.html
• exercise_editor.html
• pt_report.html
• rehab_coverage.html (updated or removed, with justification)
• shared utility file (if created)
	2.	Test harness + instructions to run
	3.	Brief code comments explaining canonicalization and hashing

====================
NOW DO THE WORK

Implement everything above.
Run the tests you created.
At the end, output a concise summary of:
• Files changed
• New export/import behavior
• Test results