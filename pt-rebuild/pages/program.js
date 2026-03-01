// edit.js — exercise editor page (/edit route), Phase 3a: exercise management (add/edit/delete)

import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import AuthForm from '../components/AuthForm';
import NavMenu from '../components/NavMenu';
import ExerciseForm from '../components/ExerciseForm';
import { fetchExercises, fetchVocabularies, fetchReferenceData } from '../lib/pt-editor';
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

export default function EditPage() {
  const { session, loading: authLoading, signIn } = useAuth();

  const [exercises, setExercises] = useState([]);
  const [referenceData, setReferenceData] = useState({ equipment: [], muscles: [], formParameters: [] });
  const [vocabularies, setVocabularies] = useState({});
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  // null = no form shown; 'new' = new exercise form; exercise object = edit form
  const [activeExercise, setActiveExercise] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  /** Load all exercises, vocabularies, and reference data. */
  const loadData = useCallback(async (accessToken) => {
    try {
      const [exList, vocab, refData] = await Promise.all([
        fetchExercises(accessToken),
        fetchVocabularies(accessToken),
        fetchReferenceData(accessToken),
      ]);
      setExercises(exList);
      setVocabularies(vocab);
      setReferenceData(refData);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    if (session) loadData(session.access_token);
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
    if (session) await loadData(session.access_token);
  }

  function handleCancel() {
    setActiveExercise(null);
  }

  function handleSelectExercise(e) {
    const ex = exercises.find(x => x.id === e.target.value);
    setActiveExercise(ex ?? null);
  }

  const filtered = session ? applyFilters(exercises, search, showArchived) : [];
  // Pass null to ExerciseForm for new exercise; pass exercise object for edit
  const formExercise = activeExercise === 'new' ? null : activeExercise;

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
        </div>

        {activeExercise !== null && (
          <ExerciseForm
            exercise={formExercise}
            referenceData={referenceData}
            vocabularies={vocabularies}
            accessToken={session?.access_token}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        )}
      </main>
    </>
  );
}
