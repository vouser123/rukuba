import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

async function loadProgramHelpers() {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';
  const module = await import('../lib/handlers/programs.js');
  return {
    dosageTypeRequiresReps: module.dosageTypeRequiresReps,
    resolveProgramDosageType: module.resolveProgramDosageType,
  };
}

describe('program dosage helpers', () => {
  it('treats distance and duration dosage types as no-reps dosage shapes', async () => {
    const { dosageTypeRequiresReps } = await loadProgramHelpers();

    assert.equal(dosageTypeRequiresReps('distance'), false);
    assert.equal(dosageTypeRequiresReps('duration'), false);
    assert.equal(dosageTypeRequiresReps('hold'), true);
    assert.equal(dosageTypeRequiresReps('reps'), true);
  });

  it('infers distance dosage from distance payloads before falling back to reps', async () => {
    const { resolveProgramDosageType } = await loadProgramHelpers();

    assert.equal(resolveProgramDosageType({ distance_feet: 10 }), 'distance');
    assert.equal(resolveProgramDosageType({ seconds_per_set: 30 }), 'duration');
    assert.equal(resolveProgramDosageType({ seconds_per_rep: 10 }), 'hold');
    assert.equal(resolveProgramDosageType({}), 'reps');
    assert.equal(resolveProgramDosageType({ fallback: 'distance' }), 'distance');
  });
});
