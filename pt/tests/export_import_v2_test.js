const path = require('path');
const utils = require(path.join(__dirname, '..', 'pt_payload_utils.js'));

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`PASS: ${name}`);
        return true;
    } catch (err) {
        console.log(`FAIL: ${name}`);
        console.log(`  ${err.message}`);
        return false;
    }
}

function buildModificationsSample() {
    return {
        exportDate: new Date().toISOString(),
        modificationType: 'PT_MODIFICATIONS',
        modifications: {
            newExercises: [{ id: 'ex-1', name: 'Squat' }],
            editedExercises: {},
            archivedExercises: [],
            newRoles: {},
            deletedRoles: {},
            editedRoles: {},
            dosageChanges: {},
            updatedVocab: {}
        }
    };
}

function buildLargePtDataSample() {
    const sessionHistory = [];
    for (let i = 0; i < 200; i += 1) {
        sessionHistory.push({
            sessionId: `s-${i}`,
            exerciseId: `ex-${i % 10}`,
            reps: Array.from({ length: 20 }, (_, idx) => idx + i),
            notes: 'Completed without issues.'
        });
    }
    return {
        exportDate: new Date().toISOString(),
        noteForPT: 'Large payload test',
        sessionHistory,
        exerciseLibrary: Array.from({ length: 50 }, (_, i) => ({ id: `lib-${i}`, name: `Exercise ${i}` })),
        rolesData: { exercise_roles: {} },
        schema: { version: 1 },
        vocabulary: { terms: [] }
    };
}

async function testRoundTripModifications() {
    const obj = buildModificationsSample();
    const block = await utils.buildV2Block({ type: 'PT_MODIFICATIONS', obj });
    const wrapped = `Intro text\n\n${block}\n\nThanks!`;
    const parsed = await utils.parseV2FromText(wrapped, 'PT_MODIFICATIONS');
    assert(parsed.errors.length === 0, parsed.errors.join('\n'));
    assert(parsed.type === 'PT_MODIFICATIONS', 'Type mismatch');
    assert(utils.canonicalizeObj(parsed.obj) === utils.canonicalizeObj(obj), 'Round-trip mismatch');
}

async function testRoundTripLargeData() {
    const obj = buildLargePtDataSample();
    const block = await utils.buildV2Block({ type: 'PT_DATA', obj });
    const parsed = await utils.parseV2FromText(block, 'PT_DATA');
    assert(parsed.errors.length === 0, parsed.errors.join('\n'));
    assert(parsed.type === 'PT_DATA', 'Type mismatch');
    assert(utils.canonicalizeObj(parsed.obj) === utils.canonicalizeObj(obj), 'Round-trip mismatch');
}

async function testCrLfHandling() {
    const obj = buildModificationsSample();
    const block = await utils.buildV2Block({ type: 'PT_MODIFICATIONS', obj });
    const crlf = block.replace(/\n/g, '\r\n');
    const parsed = await utils.parseV2FromText(`Header\r\n${crlf}\r\nFooter`, 'PT_MODIFICATIONS');
    assert(parsed.errors.length === 0, parsed.errors.join('\n'));
}

async function testTruncationFailure() {
    const obj = buildLargePtDataSample();
    const block = await utils.buildV2Block({ type: 'PT_DATA', obj });
    const lines = block.split('\n');
    const endMarkerIndex = lines.findIndex((line) => line.includes('END_PT_DATA_V2'));
    if (endMarkerIndex > 0) {
        const payloadEndIndex = endMarkerIndex - 1;
        lines[payloadEndIndex] = lines[payloadEndIndex].slice(0, Math.max(10, Math.floor(lines[payloadEndIndex].length * 0.7)));
    }
    const truncated = lines.join('\n');
    const parsed = await utils.parseV2FromText(truncated, 'PT_DATA');
    assert(parsed.errors.length > 0, 'Expected errors for truncation');
    const message = parsed.errors.join(' ');
    assert(message.includes('likely truncated'), 'Missing truncation guidance');
}

async function run() {
    const results = [];
    results.push(await runTest('PT_MODIFICATIONS round-trip', testRoundTripModifications));
    results.push(await runTest('PT_DATA round-trip (large payload)', testRoundTripLargeData));
    results.push(await runTest('CRLF vs LF handling', testCrLfHandling));
    results.push(await runTest('Truncation detection', testTruncationFailure));

    const failed = results.filter((ok) => !ok).length;
    if (failed > 0) {
        process.exitCode = 1;
    }
}

run();
