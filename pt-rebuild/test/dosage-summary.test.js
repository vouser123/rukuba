import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDosageSummary } from '../lib/dosage-summary.js';

describe('formatDosageSummary', () => {
  it('formats standard reps dosage', () => {
    assert.equal(
      formatDosageSummary({ sets: 2, reps_per_set: 10 }),
      '2 x 10 reps',
    );
  });

  it('formats sided reps dosage as per side', () => {
    assert.equal(
      formatDosageSummary({ sets: 2, reps_per_set: 10, pattern: 'side' }),
      '2 x 10 reps per side',
    );
  });

  it('formats hold dosage with the approved x sec hold wording', () => {
    assert.equal(
      formatDosageSummary({ sets: 3, reps_per_set: 10, seconds_per_rep: 5, dosage_type: 'hold' }),
      '3 x 10 reps x 5 sec hold',
    );
  });

  it('formats duration dosage as reps-replacing seconds', () => {
    assert.equal(
      formatDosageSummary({ sets: 3, seconds_per_set: 30, dosage_type: 'duration' }),
      '3 x 30 sec',
    );
  });

  it('formats distance dosage as reps-replacing feet with sided wording', () => {
    assert.equal(
      formatDosageSummary({
        sets: 4,
        distance_feet: 20,
        dosage_type: 'distance',
        pattern: 'side',
      }),
      '4 x 20 ft per side',
    );
  });

  it('uses exercise metadata when the program row lacks pattern or modifiers', () => {
    assert.equal(
      formatDosageSummary(
        { sets: 3, seconds_per_set: 30, dosage_type: 'duration' },
        { exercise: { pattern: 'side', pattern_modifiers: ['duration_seconds'] } },
      ),
      '3 x 30 sec per side',
    );
  });

  it('returns the provided empty label when no dosage is set', () => {
    assert.equal(
      formatDosageSummary(null, { emptyLabel: 'No dosage set' }),
      'No dosage set',
    );
  });
});
