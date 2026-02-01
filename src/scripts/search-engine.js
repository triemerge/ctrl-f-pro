/**
 * CTRL+F Pro - Search Engine
 * Handles exact matching and smart word variation generation
 */

const SearchEngine = {
  // Common English suffixes for word variations
  suffixes: ['s', 'es', 'ed', 'ing', 'er', 'ers', 'est', 'ly', 'tion', 'sion', 'ment', 'ness', 'ful', 'less', 'able', 'ible', 'ous', 'ive', 'al', 'ial'],
  
  // Common prefix patterns
  prefixes: ['un', 're', 'pre', 'dis', 'mis', 'non', 'over', 'under', 'out', 'sub'],

  /**
   * Get the stem/root of a word (simplified stemming)
   * @param {string} word - The word to stem
   * @returns {string} - The stemmed word
   */
  getStem(word) {
    const lower = word.toLowerCase();
    
    // Handle common endings
    const endings = [
      { suffix: 'ies', replace: 'y' },
      { suffix: 'ied', replace: 'y' },
      { suffix: 'ying', replace: 'y' },
      { suffix: 'ves', replace: 'f' },
      { suffix: 'ing', replace: '' },
      { suffix: 'ed', replace: '' },
      { suffix: 'es', replace: '' },
      { suffix: 's', replace: '' },
      { suffix: 'er', replace: '' },
      { suffix: 'est', replace: '' },
      { suffix: 'ly', replace: '' },
      { suffix: 'ment', replace: '' },
      { suffix: 'ness', replace: '' },
      { suffix: 'ful', replace: '' },
      { suffix: 'less', replace: '' },
      { suffix: 'tion', replace: '' },
      { suffix: 'sion', replace: '' },
      { suffix: 'ure', replace: '' },
    ];

    for (const { suffix, replace } of endings) {
      if (lower.endsWith(suffix) && lower.length > suffix.length + 2) {
        let stem = lower.slice(0, -suffix.length) + replace;
        // Handle doubled consonants (e.g., "running" -> "run")
        if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
          stem = stem.slice(0, -1);
        }
        return stem;
      }
    }
    
    return lower;
  },

  /**
   * Generate word variations for smart search
   * @param {string} word - The base word
   * @returns {string[]} - Array of word variations
   */
  generateVariations(word) {
    const variations = new Set();
    const lower = word.toLowerCase();
    const stem = this.getStem(lower);
    
    // Add original word
    variations.add(lower);
    variations.add(stem);
    
    // Generate suffix variations
    const suffixesToTry = ['s', 'es', 'ed', 'ing', 'er', 'ers', 'est', 'ly', 'tion', 'ment', 'ness', 'ful', 'less', 'able'];
    
    for (const suffix of suffixesToTry) {
      variations.add(stem + suffix);
      variations.add(lower + suffix);
      
      // Handle special cases
      if (stem.endsWith('e')) {
        variations.add(stem.slice(0, -1) + suffix);
      }
      
      // Double consonant variations (run -> running)
      if (/[bcdfghlmnprstvwz]$/.test(stem)) {
        variations.add(stem + stem[stem.length - 1] + suffix);
      }
      
      // Y to I variations (try -> tries, tried)
      if (stem.endsWith('y')) {
        variations.add(stem.slice(0, -1) + 'i' + suffix);
      }
    }
    
    // Add prefix variations
    for (const prefix of this.prefixes) {
      if (lower.startsWith(prefix)) {
        variations.add(lower.slice(prefix.length));
      }
    }
    
    return Array.from(variations).filter(v => v.length >= 2);
  },

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Build search regex based on options
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {RegExp} - Compiled regex
   */
  buildRegex(query, options = {}) {
    const { smartMode = true, caseSensitive = false, wholeWord = false } = options;
    
    let patterns = [];
    
    if (smartMode) {
      const variations = this.generateVariations(query);
      patterns = variations.map(v => this.escapeRegex(v));
    } else {
      patterns = [this.escapeRegex(query)];
    }
    
    // Sort by length descending to match longer variations first
    patterns.sort((a, b) => b.length - a.length);
    
    let pattern = patterns.join('|');
    
    if (wholeWord) {
      pattern = `\\b(${pattern})\\b`;
    } else {
      pattern = `(${pattern})`;
    }
    
    const flags = caseSensitive ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  },

  /**
   * Find all matches in text
   * @param {string} text - Text to search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} - Array of match objects
   */
  findMatches(text, query, options = {}) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const regex = this.buildRegex(query.trim(), options);
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];
      const isExact = matchedText.toLowerCase() === query.toLowerCase();
      
      matches.push({
        text: matchedText,
        index: match.index,
        length: matchedText.length,
        isExact: isExact
      });

      // Prevent infinite loop for zero-length matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }

    return matches;
  },

  /**
   * Count matches in text
   * @param {string} text - Text to search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - Count object with exact and smart counts
   */
  countMatches(text, query, options = {}) {
    const matches = this.findMatches(text, query, options);
    
    return {
      total: matches.length,
      exact: matches.filter(m => m.isExact).length,
      smart: matches.filter(m => !m.isExact).length
    };
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchEngine;
}
