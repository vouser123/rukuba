import { useEffect, useMemo, useState } from 'react';
import NativeSelect from './NativeSelect';
import styles from './ExerciseForm.module.css';

const CATEGORY_METADATA = [
  { key: 'region', label: 'Regions' },
  { key: 'capacity', label: 'Capacities' },
  { key: 'focus', label: 'Focus Areas' },
  { key: 'contribution', label: 'Contributions' },
  { key: 'pt_category', label: 'PT Categories' },
  { key: 'pattern', label: 'Patterns' },
];

function formatCodeInput(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export default function ProgramVocabEditor({
  vocabularies,
  onAddTerm,
  onUpdateTerm,
  onDeleteTerm,
  saving = false,
}) {
  const categoryOptions = useMemo(
    () => CATEGORY_METADATA
      .filter(({ key }) => Array.isArray(vocabularies?.[key]))
      .map(({ key, label }) => ({ value: key, label })),
    [vocabularies]
  );
  const [selectedCategory, setSelectedCategory] = useState(categoryOptions[0]?.value ?? 'region');
  const [newCode, setNewCode] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [editCode, setEditCode] = useState(null);
  const [editDefinition, setEditDefinition] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!categoryOptions.some((option) => option.value === selectedCategory)) {
      setSelectedCategory(categoryOptions[0]?.value ?? 'region');
    }
  }, [categoryOptions, selectedCategory]);

  const selectedTerms = vocabularies?.[selectedCategory] ?? [];

  async function handleAddTerm() {
    setError(null);
    const code = formatCodeInput(newCode);
    const definition = newDefinition.trim();

    if (!selectedCategory || !code || !definition) {
      setError('Category, code, and definition are required.');
      return;
    }

    try {
      await onAddTerm({
        table: selectedCategory,
        code,
        definition,
      });
      setNewCode('');
      setNewDefinition('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveEdit() {
    setError(null);
    const definition = editDefinition.trim();
    if (!selectedCategory || !editCode || !definition) {
      setError('Definition is required.');
      return;
    }

    try {
      await onUpdateTerm({
        table: selectedCategory,
        code: editCode,
        definition,
      });
      setEditCode(null);
      setEditDefinition('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteTerm(code) {
    setError(null);
    try {
      await onDeleteTerm({
        table: selectedCategory,
        code,
      });
      if (editCode === code) {
        setEditCode(null);
        setEditDefinition('');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={styles.sectionContent}>
      <div className={styles.formGroup}>
        <label className={styles.fieldLabel}>Vocabulary Category</label>
        <NativeSelect
          className={styles.select}
          value={selectedCategory}
          onChange={setSelectedCategory}
          options={categoryOptions}
        />
      </div>

      {error && <p className={styles.roleError}>{error}</p>}

      <div className={styles.vocabManager}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Code</label>
            <input
              className={styles.input}
              value={newCode}
              onChange={(event) => setNewCode(event.target.value)}
              onBlur={(event) => setNewCode(formatCodeInput(event.target.value))}
              placeholder="lowercase_code"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Definition</label>
            <input
              className={styles.input}
              value={newDefinition}
              onChange={(event) => setNewDefinition(event.target.value)}
              placeholder="Human-readable meaning"
            />
          </div>
        </div>
        <div className={styles.inlineActions}>
          <span className={styles.hint}>Codes are stored as lowercase values. Definitions provide the readable label.</span>
          <button
            type="button"
            className={styles.btnSecondary}
            onPointerUp={handleAddTerm}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Add Vocabulary Term'}
          </button>
        </div>
      </div>

      {selectedTerms.length > 0 ? (
        <div className={styles.vocabList}>
          {selectedTerms.map((term) => {
            const isEditing = editCode === term.code;

            return (
              <div key={term.code} className={styles.vocabTermRow}>
                <div className={styles.vocabTermMeta}>
                  <p className={styles.vocabCode}>{term.code}</p>
                  {isEditing ? (
                    <input
                      className={styles.input}
                      value={editDefinition}
                      onChange={(event) => setEditDefinition(event.target.value)}
                    />
                  ) : (
                    <p className={styles.vocabDefinition}>{term.definition || '—'}</p>
                  )}
                </div>
                <div className={styles.inlineActions}>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onPointerUp={handleSaveEdit}
                        disabled={saving}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onPointerUp={() => {
                          setEditCode(null);
                          setEditDefinition('');
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onPointerUp={() => {
                        setEditCode(term.code);
                        setEditDefinition(term.definition || '');
                      }}
                      disabled={saving}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.roleRemoveBtn}
                    onPointerUp={() => handleDeleteTerm(term.code)}
                    disabled={saving}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyNote}>No active terms in this category yet.</p>
      )}
    </div>
  );
}
