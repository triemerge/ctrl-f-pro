/**
 * CTRL+F Pro Content Script
 * Handles DOM scanning, highlighting, and navigation
 */

// Import search engine (will be injected)
// SearchEngine is available globally from search-engine.js

(function() {
  'use strict';

  // State
  let currentMatches = [];
  let currentIndex = -1;
  let highlightElements = [];
  let overlayVisible = false;
  let searchOptions = {
    caseSensitive: false,
    wholeWord: false
  };

  // Constants
  const HIGHLIGHT_CLASS = 'ctrlf-pro-highlight';
  const HIGHLIGHT_CURRENT_CLASS = 'ctrlf-pro-highlight-current';
  const OVERLAY_ID = 'ctrlf-pro-overlay';

  /**
   * Get all text nodes in the document
   * @returns {Node[]} Array of text nodes
   */
  function getTextNodes() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script, style, and hidden elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'iframe', 'textarea', 'input'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip our own overlay
          if (parent.closest(`#${OVERLAY_ID}`)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip hidden elements
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Only accept nodes with actual text content
          if (node.textContent.trim().length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    return textNodes;
  }

  /**
   * Clear all highlights
   */
  function clearHighlights() {
    // Remove highlight wrappers and restore original text
    highlightElements.forEach(el => {
      if (el.parentNode) {
        const text = document.createTextNode(el.textContent);
        el.parentNode.replaceChild(text, el);
      }
    });
    highlightElements = [];
    currentMatches = [];
    currentIndex = -1;
    
    // Normalize text nodes
    document.body.normalize();
  }

  /**
   * Highlight matches in the DOM
   * @param {string} query  Search query
   * @param {Object} options  Search options
   * @returns {number}  Number of matches found
   */
  function highlightMatches(query, options = searchOptions) {
    clearHighlights();
    
    if (!query || query.trim().length === 0) {
      return 0;
    }

    const textNodes = getTextNodes();
    const state = SearchEngine.prepare(query, options);
    if (!state) return 0;
    let matchCount = 0;

    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      const matches = SearchEngine.scan(text, state);

      if (matches.length === 0) return;

      // Create document fragment with highlights
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach(m => {
        // Add text before match
        if (m.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
        }

        // Create highlight span
        const span = document.createElement('span');
        span.className = HIGHLIGHT_CLASS;
        span.textContent = m.text;
        span.dataset.matchIndex = matchCount;
        
        fragment.appendChild(span);
        highlightElements.push(span);
        
        currentMatches.push({
          element: span,
          text: m.text
        });

        matchCount++;
        lastIndex = m.index + m.length;
      });

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      // Replace text node with fragment
      textNode.parentNode.replaceChild(fragment, textNode);
    });

    // Auto-select first match
    if (currentMatches.length > 0) {
      currentIndex = 0;
      updateCurrentHighlight();
    }

    return matchCount;
  }

  /**
   * Update the current highlight styling
   */
  function updateCurrentHighlight() {
    // Remove current class from all
    highlightElements.forEach(el => {
      el.classList.remove(HIGHLIGHT_CURRENT_CLASS);
    });

    // Add to current
    if (currentIndex >= 0 && currentIndex < currentMatches.length) {
      const current = currentMatches[currentIndex];
      current.element.classList.add(HIGHLIGHT_CURRENT_CLASS);
    }
  }

  /**
   * Navigate to next match
   */
  function goToNext() {
    if (currentMatches.length === 0) return;
    
    currentIndex = (currentIndex + 1) % currentMatches.length;
    updateCurrentHighlight();
    scrollToCurrent();
  }

  /**
   * Navigate to previous match
   */
  function goToPrevious() {
    if (currentMatches.length === 0) return;
    
    currentIndex = (currentIndex - 1 + currentMatches.length) % currentMatches.length;
    updateCurrentHighlight();
    scrollToCurrent();
  }

  /**
   * Scroll to current match
   */
  function scrollToCurrent() {
    if (currentIndex < 0 || currentIndex >= currentMatches.length) return;
    
    const current = currentMatches[currentIndex];
    current.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  }

  /**
   * Go to specific match by index
   * @param {number} index  Match index
   */
  function goToMatch(index) {
    if (index < 0 || index >= currentMatches.length) return;
    
    currentIndex = index;
    updateCurrentHighlight();
    scrollToCurrent();
  }

  /**
   * Get match counts
   * @returns {Object}  Count object
   */
  function getMatchCounts() {
    return {
      total: currentMatches.length,
      current: currentIndex + 1
    };
  }

  /**
   * Count matches without highlighting (for multi-tab preview)
   * @param {string} query  Search query
   * @param {Object} options  Search options
   * @returns {Object}  Count object
   */
  function countMatchesOnly(query, options = searchOptions) {
    if (!query || query.trim().length === 0) {
      return { total: 0 };
    }

    const textNodes = getTextNodes();
    const state = SearchEngine.prepare(query, options);
    if (!state) return { total: 0 };
    let total = 0;

    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      total += SearchEngine.scan(text, state).length;
    });

    return { total };
  }

  /**
   * Update search options
   * @param {Object} newOptions  New options
   */
  function setOptions(newOptions) {
    searchOptions = { ...searchOptions, ...newOptions };
  }

  // Message listener for communication with background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'search':
        const count = highlightMatches(message.query, message.options || searchOptions);
        sendResponse({ 
          success: true, 
          counts: getMatchCounts(),
          query: message.query
        });
        break;
        
      case 'count':
        const counts = countMatchesOnly(message.query, message.options || searchOptions);
        sendResponse({ 
          success: true, 
          counts: counts,
          query: message.query
        });
        break;
        
      case 'next':
        goToNext();
        sendResponse({ success: true, counts: getMatchCounts() });
        break;
        
      case 'previous':
        goToPrevious();
        sendResponse({ success: true, counts: getMatchCounts() });
        break;
        
      case 'goToMatch':
        goToMatch(message.index);
        sendResponse({ success: true, counts: getMatchCounts() });
        break;
        
      case 'clear':
        clearHighlights();
        sendResponse({ success: true });
        break;
        
      case 'setOptions':
        setOptions(message.options);
        sendResponse({ success: true, options: searchOptions });
        break;
        
      case 'getOptions':
        sendResponse({ success: true, options: searchOptions });
        break;
        
      case 'toggleOverlay':
        toggleOverlay();
        sendResponse({ success: true, visible: overlayVisible });
        break;
        
      case 'ping':
        sendResponse({ success: true, ready: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep message channel open for async response
  });

  /**
   * Toggle search overlay visibility
   */
  function toggleOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlayVisible = !overlayVisible;
      overlay.style.display = overlayVisible ? 'flex' : 'none';
      if (overlayVisible) {
        const input = overlay.querySelector('input');
        if (input) input.focus();
      }
    }
  }

  // Initialize
  console.log('CTRL+F Pro content script loaded');
})();
