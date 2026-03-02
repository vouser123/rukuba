// program.js — exercise editor page (/program route), Phase 3b: roles editing + patient dosage

import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import AuthForm from '../components/AuthForm';
import NavMenu from '../components/NavMenu';
import ExerciseForm from '../components/ExerciseForm';
import DosageModal from '../components/DosageModal';
import {
  fetchExercises, fetchVocabularies, fetchReferenceData,
  fetchPrograms, createProgram, updateProgram,
} from '../lib/pt-editor';
import styles from './program.module.css';

/**
 * Filter exercises by name search and archived visibility.
 * Deprecated exercises are always hidden (they are soft-removed, not archived).
 */
function applyFilters(exercises, search, showArchived) {
  return exercises.filter(ex => {
    if (ex.lifecycle?.status === 'deprecated') return false;
    if (!showArchived && ex.archived) return false;
    if (search && !ex.canonical_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

/**
 * Format a program record into a compact dosage summary string.
 * Examples: "3 × 10", "3 × 30s", "3 × 20 ft"
 */
function formatDosageSummary(program) {
  if (!program) return null;
  const { sets, reps_per_set, seconds_per_rep, distance_feet } = program;
  if (!sets) return null;
  if (distance_feet) return `${sets} × ${distance_feet} ft`;
  if (seconds_per_rep) return `${sets} × ${seconds_per_rep}s`;
  if (reps_per_set) return `${sets} × ${reps_per_set}`;
  return `${sets} set${sets !== 1 ? 's' : ''}`;
}

export default function ProgramPage() {
  const { session, loading: authLoading, signIn } = useAuth();

  const [exercises, setExercises] = useState([]);
  const [referenceData, setReferenceData] = useState({ equipment: [], muscles: [], formParameters: [] });
  const [vocabularies, setVocabularies] = useState({});
  // programs keyed by exercise_id for O(1) lookup
  const [programs, setPrograms] = useState({});
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  // null = no form shown; 'new' = new exercise form; exercise object = edit form
  const [activeExercise, setActiveExercise] = useState(null);
  // null = modal closed; { exercise, program } = modal open
  const [dosageTarget, setDosageTarget] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  /** Load all exercises, vocabularies, reference data, and patient programs. */
  const loadData = useCallback(async (accessToken, userId) => {
    try {
      const [exList, vocab, refData, progMap] = await Promise.all([
        fetchExercises(accessToken),
        fetchVocabularies(accessToken),
        fetchReferenceData(accessToken),
        fetchPrograms(accessToken, userId),
      ]);
      setExercises(exList);
      setVocabularies(vocab);
      setReferenceData(refData);
      setPrograms(progMap);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    if (session) loadData(session.access_token, session.user.id);
  }, [session, loadData]);

  // Service worker registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  /** Called by ExerciseForm after a successful create or update. Re-fetches exercises. */
  async function handleSaved(wasNew) {
    showToast(wasNew ? 'Exercise created.' : 'Exercise saved.');
    setActiveExercise(null);
    // Re-fetch to get full normalized data (POST/PUT returns only raw DB row)
    if (session) await loadData(session.access_token, session.user.id);
  }

  function handleCancel() {
    setActiveExercise(null);
  }

  function handleSelectExercise(e) {
    const ex = exercises.find(x => x.id === e.target.value);
    setActiveExercise(ex ?? null);
  }

  /**
   * Save dosage from DosageModal. Creates or updates the program record,
   * then updates programs state and closes the modal.
   */
  async function handleDosageSave(formData) {
    const { exercise, program } = dosageTarget;
    try {
      let updated;
      if (program?.id) {
        updated = await updateProgram(session.access_token, program.id, formData);
      } else {
        updated = await createProgram(session.access_token, {
          ...formData,
          exercise_id: exercise.id,
          patient_id: session.user.id,
        });
      }
      setPrograms(prev => ({ ...prev, [exercise.id]: updated.program }));
      setDosageTarget(null);
      showToast('Dosage saved.');
    } catch (err) {
      // Propagate to DosageModal's error display
      throw err;
    }
  }

  const filtered = session ? applyFilters(exercises, search, showArchived) : [];
  // Pass null to ExerciseForm for new exercise; pass exercise object for edit
  const formExercise = activeExercise === 'new' ? null : activeExercise;
  // Show dosage button when a real exercise is selected (not 'new')
  const selectedExercise = activeExercise !== 'new' ? activeExercise : null;
  const selectedProgram = selectedExercise ? (programs[selectedExercise.id] ?? null) : null;
  const dosageSummary = formatDosageSummary(selectedProgram);

  if (!session && !authLoading) {
    return (
      <>
        <Head>
          <title>Exercise Editor — PT Tracker</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <link rel="manifest" href="/manifest.json" />
        </Head>
        <AuthForm onSignIn={signIn} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Exercise Editor — PT Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      {session && (
        <NavMenu
          user={session.user}
          isAdmin={true}
          onSignOut={() => supabase.auth.signOut()}
          currentPage="pt_editor"
          actions={[]}
          onAction={() => {}}
        />
      )}

      <main className={styles.main}>
        {loadError && <p className={styles.errorBanner}>{loadError}</p>}
        {toast && (
          <div className={`${styles.toast} ${styles[toast.type]}`}>
            {toast.message}
          </div>
        )}

        <div className={styles.header}>
          <h1 className={styles.title}>Exercise Editor</h1>
          <button
            className={styles.btnPrimary}
            onPointerUp={() => setActiveExercise('new')}
          >
            + New
          </button>
        </div>

        <div className={styles.selectorPanel}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search exercises…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <label className={styles.archiveToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <select
            className={styles.exerciseSelect}
            value={activeExercise?.id ?? ''}
            onChange={handleSelectExercise}
          >
            <option value="" disabled>Select an exercise to edit…</option>
            {filtered.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.archived ? '[archived] ' : ''}{ex.canonical_name}
              </option>
            ))}
          </select>

          {/* Dosage button — visible when a saved exercise is selected */}
          {selectedExercise && (
            <button
              className={styles.btnDosage}
              onPointerUp={() => setDosageTarget({ exercise: selectedExercise, program: selectedProgram })}
            >
              {dosageSummary ? `Dosage: ${dosageSummary}` : 'Set Dosage'}
            </button>
          )}
        </div>

        {activeExercise !== null && (
          <ExerciseForm
            exercise={formExercise}
            exercises={exercises}
            referenceData={referenceData}
            vocabularies={vocabularies}
            accessToken={session?.access_token}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        )}

        {/* DosageModal — rendered outside ExerciseForm to keep it reusable */}
        {dosageTarget && (
          <DosageModal
            exercise={dosageTarget.exercise}
            program={dosageTarget.program}
            onSave={handleDosageSave}
            onClose={() => setDosageTarget(null)}
          />
        )}
      </main>
    </>
  );
}
