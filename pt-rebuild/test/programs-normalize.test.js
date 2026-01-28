import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

async function loadNormalizer() {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';
  const module = await import('../lib/handlers/programs.js');
  return module.normalizeProgramPatternModifiers;
}

describe('normalizeProgramPatternModifiers', () => {
  it('maps nested modifier rows onto exercises.pattern_modifiers', async () => {
    const normalizeProgramPatternModifiers = await loadNormalizer();
    const input = [
      {
        id: 'program-1',
        exercises: {
          id: 'exercise-1',
          exercise_pattern_modifiers: [
            { modifier: 'hold_seconds' },
            { modifier: 'distance_feet' }
          ]
        }
      }
    ];

    const [output] = normalizeProgramPatternModifiers(input);

    assert.deepEqual(output.exercises.pattern_modifiers, ['hold_seconds', 'distance_feet']);
  });

  it('handles missing exercises or modifiers safely', async () => {
    const normalizeProgramPatternModifiers = await loadNormalizer();
    const input = [
      { id: 'program-2', exercises: null },
      { id: 'program-3', exercises: { id: 'exercise-2' } }
    ];

    const output = normalizeProgramPatternModifiers(input);

    assert.equal(output[0].exercises, null);
    assert.deepEqual(output[1].exercises.pattern_modifiers, []);
  });
});
