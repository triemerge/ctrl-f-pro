/**
 * CTRL+F Pro - Search Engine
 * Handles text matching for cross-tab search
 */

const SearchEngine = {
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
    const { caseSensitive = false, wholeWord = false } = options;
    
    let pattern = this.escapeRegex(query);
    
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
      matches.push({
        text: match[0],
        index: match.index,
        length: match[0].length
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
   * @returns {Object} - Match count
   */
  countMatches(text, query, options = {}) {
    const matches = this.findMatches(text, query, options);
    
    return {
      total: matches.length
    };
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchEngine;
}
