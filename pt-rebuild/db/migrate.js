/**
 * PT Tracker Migration Script
 * Firebase JSON → Supabase PostgreSQL
 *
 * Input files:
 * - pt_all_data-20260118.json
 * - pt_exercise_library-20260118.json
 * - pt_exercise_history-20260118.json
 * - exercise_roles.json (from /pt directory)
 *
 * Output:
 * - Fully normalized Postgres tables
 * - Migration verification report
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Supabase connection (server-only admin key required)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zvgoaxdpkgfxklotqwpz.supabase.co';
const SUPABASE_ADMIN_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_ADMIN_KEY) {
  console.error('ERROR: SUPABASE_SECRET_KEY (or legacy service-role env var) environment variable required');
  console.error('Usage: SUPABASE_SECRET_KEY=your-key node migrate.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY);

// Patient ID (from users table)
const PATIENT_ID = '35c3ec8d-7e60-44b3-8ac8-969d559aae83';
const THERAPIST_ID = '8b0406c1-92e6-4fa6-9919-0d0e9bc8e429';

// Verification tracking
const verification = {
  exercises: { expected: 0, inserted: 0, errors: [] },
  roles: { expected: 0, inserted: 0, errors: [] },
  programs: { expected: 0, inserted: 0, errors: [] },
  activityLogs: { expected: 0, inserted: 0, errors: [] },
  activitySets: { expected: 0, inserted: 0, errors: [] }
};

/**
 * Load JSON backup files
 */
function loadBackupFiles() {
  const backupDir = 'C:\\Users\\cindi\\OneDrive\\Documents\\PT_Backup';
  const ptDir = 'C:\\Users\\cindi\\OneDrive\\Documents\\GitHub\\rukuba\\pt';

  console.log('[Loading] Backup files...');

  const allData = JSON.parse(fs.readFileSync(path.join(backupDir, 'pt_all_data-20260118.json'), 'utf8'));
  const libraryData = JSON.parse(fs.readFileSync(path.join(backupDir, 'pt_exercise_library-20260118.json'), 'utf8'));
  const historyData = JSON.parse(fs.readFileSync(path.join(backupDir, 'pt_exercise_history-20260118.json'), 'utf8'));
  const rolesData = JSON.parse(fs.readFileSync(path.join(ptDir, 'exercise_roles.json'), 'utf8'));

  console.log('[Loaded] All backup files successfully');

  return { allData, libraryData, historyData, rolesData };
}

/**
 * Migrate exercise library
 */
async function migrateExercises(exercises) {
  console.log('\n[Phase 1] Migrating exercise library...');
  verification.exercises.expected = exercises.length;

  for (const ex of exercises) {
    try {
      // Insert base exercise
      const { data: exercise, error } = await supabase
        .from('exercises')
        .insert({
          id: ex.id,
          canonical_name: ex.canonical_name || ex.name,
          description: ex.description,
          pt_category: ex.pt_category,
          pattern: ex.pattern,
          archived: ex.archived || false,
          lifecycle_status: ex.lifecycle?.status,
          lifecycle_effective_start_date: ex.lifecycle?.effective_start_date,
          lifecycle_effective_end_date: ex.lifecycle?.effective_end_date,
          supersedes_exercise_id: ex.supersedes?.[0] || null,
          superseded_by_exercise_id: ex.superseded_by || null,
          superseded_date: ex.superseded_date || null,
          added_date: ex.added_date || null,
          updated_date: ex.updated_date || null
        })
        .select()
        .single();

      if (error) throw error;

      // Insert equipment (required)
      if (ex.equipment?.required && ex.equipment.required.length > 0) {
        const equipmentRows = ex.equipment.required.map(e => ({
          exercise_id: ex.id,
          equipment_name: e,
          is_required: true
        }));
        await supabase.from('exercise_equipment').insert(equipmentRows);
      }

      // Insert equipment (optional)
      if (ex.equipment?.optional && ex.equipment.optional.length > 0) {
        const equipmentRows = ex.equipment.optional.map(e => ({
          exercise_id: ex.id,
          equipment_name: e,
          is_required: false
        }));
        await supabase.from('exercise_equipment').insert(equipmentRows);
      }

      // Handle legacy format (array instead of object)
      if (Array.isArray(ex.equipment)) {
        const equipmentRows = ex.equipment.map(e => ({
          exercise_id: ex.id,
          equipment_name: e,
          is_required: true
        }));
        await supabase.from('exercise_equipment').insert(equipmentRows);
      }

      // Insert muscles (primary)
      if (ex.primary_muscles && ex.primary_muscles.length > 0) {
        const muscleRows = ex.primary_muscles.map(m => ({
          exercise_id: ex.id,
          muscle_name: m,
          is_primary: true
        }));
        await supabase.from('exercise_muscles').insert(muscleRows);
      }

      // Insert muscles (secondary)
      if (ex.secondary_muscles && ex.secondary_muscles.length > 0) {
        const muscleRows = ex.secondary_muscles.map(m => ({
          exercise_id: ex.id,
          muscle_name: m,
          is_primary: false
        }));
        await supabase.from('exercise_muscles').insert(muscleRows);
      }

      // Insert pattern modifiers
      if (ex.pattern_modifiers && ex.pattern_modifiers.length > 0) {
        const modifierRows = ex.pattern_modifiers.map(m => ({
          exercise_id: ex.id,
          modifier: m
        }));
        await supabase.from('exercise_pattern_modifiers').insert(modifierRows);
      }

      // Insert form parameters
      if (ex.form_parameters_required && ex.form_parameters_required.length > 0) {
        const paramRows = ex.form_parameters_required.map(p => ({
          exercise_id: ex.id,
          parameter_name: p
        }));
        await supabase.from('exercise_form_parameters').insert(paramRows);
      }

      // Insert guidance
      if (ex.guidance) {
        const guidanceRows = [];

        if (ex.guidance.motor_cues) {
          ex.guidance.motor_cues.forEach((cue, i) => {
            guidanceRows.push({
              exercise_id: ex.id,
              section: 'motor_cues',
              content: cue,
              sort_order: i
            });
          });
        }

        if (ex.guidance.compensation_warnings) {
          ex.guidance.compensation_warnings.forEach((warning, i) => {
            guidanceRows.push({
              exercise_id: ex.id,
              section: 'compensation_warnings',
              content: warning,
              sort_order: i
            });
          });
        }

        if (ex.guidance.safety_flags) {
          ex.guidance.safety_flags.forEach((flag, i) => {
            guidanceRows.push({
              exercise_id: ex.id,
              section: 'safety_flags',
              content: flag,
              sort_order: i
            });
          });
        }

        if (ex.guidance.external_cues) {
          ex.guidance.external_cues.forEach((cue, i) => {
            guidanceRows.push({
              exercise_id: ex.id,
              section: 'external_cues',
              content: cue,
              sort_order: i
            });
          });
        }

        if (guidanceRows.length > 0) {
          await supabase.from('exercise_guidance').insert(guidanceRows);
        }
      }

      verification.exercises.inserted++;
      if (verification.exercises.inserted % 10 === 0) {
        console.log(`  Migrated ${verification.exercises.inserted}/${verification.exercises.expected} exercises...`);
      }

    } catch (error) {
      verification.exercises.errors.push({
        id: ex.id,
        name: ex.canonical_name || ex.name,
        error: error.message
      });
      console.error(`  ERROR migrating exercise ${ex.id}:`, error.message);
    }
  }

  console.log(`[Phase 1 Complete] ${verification.exercises.inserted}/${verification.exercises.expected} exercises migrated`);
}

/**
 * Migrate exercise roles
 */
async function migrateRoles(rolesData) {
  console.log('\n[Phase 2] Migrating exercise roles...');

  const exerciseRoles = rolesData.exercise_roles;

  for (const [exerciseId, roleData] of Object.entries(exerciseRoles)) {
    if (!roleData.roles) continue;

    verification.roles.expected += roleData.roles.length;

    for (const role of roleData.roles) {
      try {
        const { error } = await supabase
          .from('exercise_roles')
          .insert({
            exercise_id: exerciseId,
            region: role.region,
            capacity: role.capacity,
            focus: role.focus || null,
            contribution: role.contribution
          });

        if (error) throw error;
        verification.roles.inserted++;

      } catch (error) {
        verification.roles.errors.push({
          exerciseId,
          role,
          error: error.message
        });
        console.error(`  ERROR migrating role for ${exerciseId}:`, error.message);
      }
    }
  }

  console.log(`[Phase 2 Complete] ${verification.roles.inserted}/${verification.roles.expected} roles migrated`);
}

/**
 * Migrate patient programs (dosage assignments - the "current" field)
 */
async function migratePrograms(exercises) {
  console.log('\n[Phase 3] Migrating patient programs (dosage assignments)...');

  for (const ex of exercises) {
    if (!ex.current) continue;

    verification.programs.expected++;

    try {
      const { error } = await supabase
        .from('patient_programs')
        .insert({
          patient_id: PATIENT_ID,
          exercise_id: ex.id,
          dosage_type: ex.current.type,
          sets: ex.current.sets || null,
          reps_per_set: ex.current.repsPerSet || null,
          seconds_per_rep: ex.current.secondsPerRep || null,
          seconds_per_set: ex.current.secondsPerSet || null,
          distance_feet: ex.current.distance || null,
          assigned_by_therapist_id: THERAPIST_ID
        });

      if (error) throw error;
      verification.programs.inserted++;

    } catch (error) {
      verification.programs.errors.push({
        exerciseId: ex.id,
        error: error.message
      });
      console.error(`  ERROR migrating program for ${ex.id}:`, error.message);
    }
  }

  console.log(`[Phase 3 Complete] ${verification.programs.inserted}/${verification.programs.expected} programs migrated`);
}

/**
 * Migrate activity logs (session history)
 */
async function migrateActivityLogs(sessions) {
  console.log('\n[Phase 4] Migrating activity logs...');
  verification.activityLogs.expected = sessions.length;

  for (const session of sessions) {
    try {
      // Determine activity type from exerciseType or exerciseSpec
      let activityType = session.exerciseType || session.exerciseSpec?.type || 'reps';

      // Insert activity log with proper UUID (f*** Firebase sessions)
      const { data: log, error: logError } = await supabase
        .from('patient_activity_logs')
        .insert({
          patient_id: PATIENT_ID,
          exercise_id: session.exerciseId || null,
          exercise_name: session.exerciseName,
          client_mutation_id: randomUUID(), // Generate proper UUID, ignore Firebase's broken session grouping
          activity_type: activityType,
          notes: session.notes || null,
          performed_at: session.date,
          client_created_at: session.timestamp || session.date
        })
        .select()
        .single();

      if (logError) throw logError;

      // Insert sets
      if (session.sets && session.sets.length > 0) {
        for (const set of session.sets) {
          try {
            const { error: setError } = await supabase
              .from('patient_activity_sets')
              .insert({
                activity_log_id: log.id,
                set_number: set.set,
                reps: set.reps || null,
                seconds: set.seconds || null,
                distance_feet: set.distance || null,
                side: set.side || null,
                manual_log: set.manualLog || false,
                partial_rep: set.partialRep || false,
                performed_at: set.timestamp || session.date
              });

            if (setError) throw setError;
            verification.activitySets.inserted++;

          } catch (error) {
            verification.activitySets.errors.push({
              sessionId: session.sessionId,
              setNumber: set.set,
              error: error.message
            });
          }
        }
      }

      verification.activityLogs.inserted++;
      if (verification.activityLogs.inserted % 50 === 0) {
        console.log(`  Migrated ${verification.activityLogs.inserted}/${verification.activityLogs.expected} logs...`);
      }

    } catch (error) {
      verification.activityLogs.errors.push({
        sessionId: session.sessionId,
        exerciseName: session.exerciseName,
        error: error.message
      });
      console.error(`  ERROR migrating activity log ${session.sessionId}:`, error.message);
    }
  }

  console.log(`[Phase 4 Complete] ${verification.activityLogs.inserted}/${verification.activityLogs.expected} activity logs migrated`);
  console.log(`  ${verification.activitySets.inserted} sets migrated`);
}

/**
 * Verify migration integrity
 */
async function verifyMigration() {
  console.log('\n[Verification] Checking migration integrity...');

  // Count exercises
  const { count: exercisesCount } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true });

  console.log(`  Exercises: Expected ${verification.exercises.expected}, Inserted ${verification.exercises.inserted}, DB Count ${exercisesCount}`);

  // Count roles
  const { count: rolesCount } = await supabase
    .from('exercise_roles')
    .select('*', { count: 'exact', head: true });

  console.log(`  Roles: Expected ${verification.roles.expected}, Inserted ${verification.roles.inserted}, DB Count ${rolesCount}`);

  // Count programs
  const { count: programsCount } = await supabase
    .from('patient_programs')
    .select('*', { count: 'exact', head: true });

  console.log(`  Programs: Expected ${verification.programs.expected}, Inserted ${verification.programs.inserted}, DB Count ${programsCount}`);

  // Count activity logs
  const { count: logsCount } = await supabase
    .from('patient_activity_logs')
    .select('*', { count: 'exact', head: true });

  console.log(`  Activity Logs: Expected ${verification.activityLogs.expected}, Inserted ${verification.activityLogs.inserted}, DB Count ${logsCount}`);

  // Count activity sets
  const { count: setsCount } = await supabase
    .from('patient_activity_sets')
    .select('*', { count: 'exact', head: true });

  console.log(`  Activity Sets: Inserted ${verification.activitySets.inserted}, DB Count ${setsCount}`);

  // Check for foreign key violations
  const { data: orphanedSets } = await supabase
    .from('patient_activity_sets')
    .select('id')
    .is('activity_log_id', null);

  console.log(`  Orphaned sets: ${orphanedSets?.length || 0}`);

  // Write verification report
  fs.writeFileSync(
    'migration_verification.json',
    JSON.stringify(verification, null, 2)
  );

  console.log('\n[Verification Complete] Report written to migration_verification.json');

  // Summary
  const totalErrors =
    verification.exercises.errors.length +
    verification.roles.errors.length +
    verification.programs.errors.length +
    verification.activityLogs.errors.length +
    verification.activitySets.errors.length;

  if (totalErrors > 0) {
    console.error(`\n⚠️  Migration completed with ${totalErrors} errors. Review migration_verification.json for details.`);
  } else {
    console.log('\n✅ Migration completed successfully with no errors!');
  }

  return totalErrors === 0;
}

/**
 * Main migration runner
 */
async function runMigration() {
  console.log('========================================');
  console.log('PT Tracker Migration: Firebase → Supabase');
  console.log('========================================\n');

  try {
    // Load backup files
    const { allData, libraryData, historyData, rolesData } = loadBackupFiles();

    // Use exercise library from pt_exercise_library.json (more complete)
    const exercises = libraryData.exercises || allData.pt_exercise_library;
    console.log(`Loaded ${exercises.length} exercises from library`);

    // Use session history from allData (has the actual logged sessions)
    const sessions = allData.pt_tracker_data || historyData;
    console.log(`Loaded ${sessions.length} activity logs from history`);

    // Migrate in phases
    await migrateExercises(exercises);
    await migrateRoles(rolesData);
    await migratePrograms(allData.pt_exercise_library); // Use allData for "current" field
    await migrateActivityLogs(sessions);

    // Verify
    const success = await verifyMigration();

    if (success) {
      console.log('\n✅ Migration complete! All data migrated successfully.');
    } else {
      console.log('\n⚠️  Migration complete with errors. Check migration_verification.json');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
