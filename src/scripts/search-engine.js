/**
 * CTRL+F Pro Search Engine
 * Uses the KMP (Knuth-Morris-Pratt) algorithm for text matching.
 *
 * Why KMP works well for multi tab search:
 *   The LPS (failure table) depends ONLY on the pattern, not the text.
 *   We build it once with prepare(), then reuse it to scan every text node
 *   across every tab with scan(). No redundant preprocessing.
 *
 *   Time: O(m) preprocessing + O(n) per text chunk, where m = pattern length
 *   and n = text chunk length. Across T text nodes the total is O(m + N)
 *   where N is the combined length of all text nodes.
 *
 * How it works (in plain English):
 * 1. BUILD the failure table for the pattern (prepare).
 *    For each position j in the pattern, lps[j] tells us the length of the
 *    longest proper prefix of pattern[0..j] that is also a suffix.
 *    This lets us skip characters we already know match after a mismatch.
 *
 * 2. SCAN each text chunk with two pointers (i for text, j for pattern).
 *    If characters match, advance both i and j.
 *    If j reaches pattern length, we found a match; record it and use
 *    lps to continue searching for overlapping matches.
 *    On mismatch, use lps[j-1] to jump j back (skip re-comparing known
 *    prefix), and only advance i if j is already at 0.
 */

const SearchEngine = {

  /**
   * Build the KMP failure table (LPS array).
   *
   * lps[i] = length of the longest proper prefix of pattern[0..i]
   *          that is also a suffix of pattern[0..i].
   *
   * Example: pattern = "ABAB"
   *   lps = [0, 0, 1, 2]
   *   "A"    → no proper prefix that equals suffix → 0
   *   "AB"   → "A" != "B" → 0
   *   "ABA"  → "A" == "A" → 1
   *   "ABAB" → "AB" == "AB" → 2
   *
   * @param {string} pattern  The search pattern
   * @returns {number[]}  The LPS (failure) table
   */
  buildLPS(pattern) {
    const m = pattern.length;
    const lps = new Array(m).fill(0);

    let len = 0; // length of the previous longest prefix suffix
    let i = 1;

    while (i < m) {
      if (pattern[i] === pattern[len]) {
        len++;
        lps[i] = len;
        i++;
      } else {
        if (len !== 0) {
          // Fall back, don't increment i, try shorter prefix
          len = lps[len - 1];
        } else {
          lps[i] = 0;
          i++;
        }
      }
    }

    return lps;
  },

  /**
   * Check if a character is a word boundary (non alphanumeric / underscore).
   * Used for "whole word" matching.
   *
   * @param {string} ch  Single character (or undefined for start/end of text)
   * @returns {boolean}  True if the character is a word boundary
   */
  isWordBoundary(ch) {
    if (ch === undefined || ch === null) return true;
    // A to Z, a to z, 0 to 9, _ are NOT boundaries; everything else is
    const code = ch.charCodeAt(0);
    return !(
      (code >= 65 && code <= 90) ||   // A-Z
      (code >= 97 && code <= 122) ||  // a-z
      (code >= 48 && code <= 57) ||   // 0-9
      code === 95                      // _
    );
  },

  /**
   * Precompute KMP state for a given pattern and options.
   * Call this once per search query, then pass the returned object
   * to scan() for each text chunk. This avoids rebuilding the LPS
   * table for every text node.
   *
   * @param {string} pattern  The raw search query
   * @param {Object} options  { caseSensitive, wholeWord }
   * @returns {Object|null}  Prepared search state, or null if pattern is empty
   */
  prepare(pattern, options = {}) {
    if (!pattern || pattern.trim().length === 0) {
      return null;
    }

    const { caseSensitive = false, wholeWord = false } = options;
    const query = pattern.trim();

    const searchPattern = caseSensitive ? query : query.toLowerCase();
    const m = searchPattern.length;

    if (m === 0) return null;

    return {
      original: query,
      searchPattern: searchPattern,
      lps: this.buildLPS(searchPattern),
      m: m,
      caseSensitive: caseSensitive,
      wholeWord: wholeWord
    };
  },

  /**
   * Scan a single text chunk using precomputed KMP state.
   * This is the hot path; it does zero preprocessing, only character
   * comparisons guided by the already built LPS table.
   *
   * @param {string} text  The text chunk to search through
   * @param {Object} state  Precomputed state from prepare()
   * @returns {Array}  Array of { text, index, length } match objects
   */
  scan(text, state) {
    if (!text || !state) return [];

    const { searchPattern, lps, m, caseSensitive, wholeWord } = state;
    const searchText = caseSensitive ? text : text.toLowerCase();
    const n = searchText.length;

    if (m > n) return [];

    const matches = [];
    let i = 0; // index in text
    let j = 0; // index in pattern

    while (i < n) {
      if (searchText[i] === searchPattern[j]) {
        i++;
        j++;
      }

      if (j === m) {
        // Full pattern matched at index (i - j)
        const matchIndex = i - j;

        // Whole word check: characters before and after match must be boundaries
        let valid = true;
        if (wholeWord) {
          const charBefore = matchIndex > 0 ? text[matchIndex - 1] : undefined;
          const charAfter = matchIndex + m < n ? text[matchIndex + m] : undefined;
          valid = this.isWordBoundary(charBefore) && this.isWordBoundary(charAfter);
        }

        if (valid) {
          matches.push({
            text: text.slice(matchIndex, matchIndex + m), // preserve original case
            index: matchIndex,
            length: m
          });
        }

        // Use LPS to continue searching (allows overlapping matches)
        j = lps[j - 1];

      } else if (i < n && searchText[i] !== searchPattern[j]) {
        // Mismatch after j matches
        if (j !== 0) {
          // Jump pattern pointer back using failure table, no backtracking on text
          j = lps[j - 1];
        } else {
          // Pattern pointer already at start, advance text pointer
          i++;
        }
      }
    }

    return matches;
  },

  /**
   * Convenience method: prepare + scan in one call.
   * Use this when searching a single text. For searching many text nodes
   * with the same pattern, use prepare() once then scan() per node.
   *
   * @param {string} text  The text to search through
   * @param {string} pattern  The pattern to search for
   * @param {Object} options  { caseSensitive, wholeWord }
   * @returns {Array}  Array of { text, index, length } match objects
   */
  findMatches(text, pattern, options = {}) {
    const state = this.prepare(pattern, options);
    return this.scan(text, state);
  },

  /**
   * Count matches in text (without collecting match details).
   *
   * @param {string} text  The text to search through
   * @param {string} query  The search query
   * @param {Object} options  Search options
   * @returns {Object}  { total: number }
   */
  countMatches(text, query, options = {}) {
    const matches = this.findMatches(text, query, options);
    return { total: matches.length };
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchEngine;
}
