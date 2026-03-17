// lib/text-format.js — pure string formatting helpers for normalizing user-entered values

/**
 * Converts a string to all lowercase.
 * Use for: resistance band values, band location, other clinical shorthand fields.
 * @param {string} str
 * @returns {string}
 */
export function toLower(str) {
    if (!str) return '';
    return String(str).trim().toLowerCase();
}

/**
 * Converts a string to sentence case (first letter capitalized, rest lowercase).
 * Use for: notes, free-text descriptions.
 * @param {string} str
 * @returns {string}
 */
export function toSentenceCase(str) {
    if (!str) return '';
    const trimmed = String(str).trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Converts a string to title case (first letter of each word capitalized).
 * Use for: names, labels.
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str) {
    if (!str) return '';
    return String(str).trim().replace(/\w\S*/g, (word) =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
}

/**
 * Converts a string to all uppercase.
 * Use for: abbreviations, codes.
 * @param {string} str
 * @returns {string}
 */
export function toUpperCase(str) {
    if (!str) return '';
    return String(str).trim().toUpperCase();
}
