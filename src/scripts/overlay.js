/**
 * CTRL+F Pro - UI Overlay
 * Creates and manages the floating search bar interface
 */

(function() {
  'use strict';

  const OVERLAY_ID = 'ctrlf-pro-overlay';
  
  // State
  let isExpanded = false;
  let settingsExpanded = false;
  let searchTimeout = null;
  let tabResults = [];
  let filteredTabs = [];
  
  // Options
  let options = {
    smartMode: true,
    caseSensitive: false,
    wholeWord: false
  };

  /**
   * SVG Icons
   */
  const Icons = {
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    chevronUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>`,
    tab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M4 8h16"/></svg>`
  };

  /**
   * Create the overlay HTML
   */
  function createOverlay() {
    // Check if already exists
    if (document.getElementById(OVERLAY_ID)) {
      return document.getElementById(OVERLAY_ID);
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <!-- Search Bar -->
      <div class="ctrlf-pro-searchbar">
        <span class="ctrlf-pro-search-icon">${Icons.search}</span>
        <input type="text" class="ctrlf-pro-input" placeholder="Search in page..." autocomplete="off" spellcheck="false" />
        <span class="ctrlf-pro-counter">0 results</span>
        <div class="ctrlf-pro-divider"></div>
        <div class="ctrlf-pro-nav-group">
          <button class="ctrlf-pro-btn ctrlf-pro-btn-prev" title="Previous (Shift+Enter)">${Icons.chevronUp}</button>
          <button class="ctrlf-pro-btn ctrlf-pro-btn-next" title="Next (Enter)">${Icons.chevronDown}</button>
        </div>
        <div class="ctrlf-pro-divider"></div>
        <button class="ctrlf-pro-btn ctrlf-pro-btn-toggle ctrlf-pro-btn-smart active" title="Smart search (word variations)">Aa+</button>
        <button class="ctrlf-pro-btn ctrlf-pro-btn-expand" title="Search all tabs">${Icons.tab}</button>
        <button class="ctrlf-pro-btn ctrlf-pro-btn-settings" title="Settings">${Icons.settings}</button>
        <button class="ctrlf-pro-btn ctrlf-pro-btn-close" title="Close (Esc)">${Icons.close}</button>
      </div>

      <!-- Multi-Tab Dropdown -->
      <div class="ctrlf-pro-dropdown">
        <div class="ctrlf-pro-dropdown-header">
          <span class="ctrlf-pro-dropdown-title">Results in all tabs</span>
          <span class="ctrlf-pro-dropdown-count">0 tabs</span>
        </div>
        <div class="ctrlf-pro-tab-filter">
          <input type="text" class="ctrlf-pro-tab-filter-input" placeholder="Filter tabs..." />
        </div>
        <div class="ctrlf-pro-tab-list"></div>
      </div>

      <!-- Settings Panel -->
      <div class="ctrlf-pro-settings">
        <div class="ctrlf-pro-settings-content">
          <div class="ctrlf-pro-setting-row">
            <span class="ctrlf-pro-setting-label">Smart search (word variations)</span>
            <label class="ctrlf-pro-toggle">
              <input type="checkbox" id="ctrlf-setting-smart" checked />
              <span class="ctrlf-pro-toggle-slider"></span>
            </label>
          </div>
          <div class="ctrlf-pro-setting-row">
            <span class="ctrlf-pro-setting-label">Case sensitive</span>
            <label class="ctrlf-pro-toggle">
              <input type="checkbox" id="ctrlf-setting-case" />
              <span class="ctrlf-pro-toggle-slider"></span>
            </label>
          </div>
          <div class="ctrlf-pro-setting-row">
            <span class="ctrlf-pro-setting-label">Whole word only</span>
            <label class="ctrlf-pro-toggle">
              <input type="checkbox" id="ctrlf-setting-whole" />
              <span class="ctrlf-pro-toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    attachEventListeners(overlay);
    
    return overlay;
  }

  /**
   * Attach event listeners to overlay elements
   */
  function attachEventListeners(overlay) {
    const input = overlay.querySelector('.ctrlf-pro-input');
    const btnPrev = overlay.querySelector('.ctrlf-pro-btn-prev');
    const btnNext = overlay.querySelector('.ctrlf-pro-btn-next');
    const btnSmart = overlay.querySelector('.ctrlf-pro-btn-smart');
    const btnExpand = overlay.querySelector('.ctrlf-pro-btn-expand');
    const btnSettings = overlay.querySelector('.ctrlf-pro-btn-settings');
    const btnClose = overlay.querySelector('.ctrlf-pro-btn-close');
    const dropdown = overlay.querySelector('.ctrlf-pro-dropdown');
    const settings = overlay.querySelector('.ctrlf-pro-settings');
    const tabFilterInput = overlay.querySelector('.ctrlf-pro-tab-filter-input');

    // Search input
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(e.target.value);
      }, 150);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          navigatePrevious();
        } else {
          navigateNext();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideOverlay();
      }
    });

    // Navigation buttons
    btnPrev.addEventListener('click', navigatePrevious);
    btnNext.addEventListener('click', navigateNext);

    // Smart mode toggle
    btnSmart.addEventListener('click', () => {
      options.smartMode = !options.smartMode;
      btnSmart.classList.toggle('active', options.smartMode);
      updateSettings();
      performSearch(input.value);
    });

    // Expand multi-tab dropdown
    btnExpand.addEventListener('click', () => {
      isExpanded = !isExpanded;
      dropdown.classList.toggle('expanded', isExpanded);
      settings.classList.remove('expanded');
      settingsExpanded = false;
      
      if (isExpanded) {
        searchAllTabs(input.value);
      }
    });

    // Settings toggle
    btnSettings.addEventListener('click', () => {
      settingsExpanded = !settingsExpanded;
      settings.classList.toggle('expanded', settingsExpanded);
      dropdown.classList.remove('expanded');
      isExpanded = false;
    });

    // Close button
    btnClose.addEventListener('click', hideOverlay);

    // Tab filter
    tabFilterInput.addEventListener('input', (e) => {
      filterTabs(e.target.value);
    });

    // Settings toggles
    overlay.querySelector('#ctrlf-setting-smart').addEventListener('change', (e) => {
      options.smartMode = e.target.checked;
      btnSmart.classList.toggle('active', options.smartMode);
      updateSettings();
      performSearch(input.value);
    });

    overlay.querySelector('#ctrlf-setting-case').addEventListener('change', (e) => {
      options.caseSensitive = e.target.checked;
      updateSettings();
      performSearch(input.value);
    });

    overlay.querySelector('#ctrlf-setting-whole').addEventListener('change', (e) => {
      options.wholeWord = e.target.checked;
      updateSettings();
      performSearch(input.value);
    });

    // Global keyboard listener
    document.addEventListener('keydown', handleGlobalKeydown);
  }

  /**
   * Handle global keyboard shortcuts
   */
  function handleGlobalKeydown(e) {
    // Ctrl+Shift+F to toggle
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      toggleOverlay();
    }
  }

  /**
   * Perform search in current tab
   */
  async function performSearch(query) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    const counter = overlay.querySelector('.ctrlf-pro-counter');
    
    if (!query || query.trim().length === 0) {
      counter.textContent = '0 results';
      counter.classList.remove('has-results');
      chrome.runtime.sendMessage({ action: 'clear' });
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'searchActive',
        query: query,
        options: options
      });

      if (response?.result?.counts) {
        const { total, current } = response.result.counts;
        counter.textContent = total > 0 ? `${current} of ${total}` : 'No results';
        counter.classList.toggle('has-results', total > 0);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  /**
   * Search across all tabs
   */
  async function searchAllTabs(query) {
    if (!query || query.trim().length === 0) {
      updateTabList([]);
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'searchAll',
        query: query,
        options: options
      });

      if (response?.results?.tabs) {
        tabResults = response.results.tabs;
        filteredTabs = [...tabResults];
        updateTabList(filteredTabs);
        updateDropdownCount(response.results);
      }
    } catch (error) {
      console.error('Multi-tab search error:', error);
    }
  }

  /**
   * Update the tab results list
   */
  function updateTabList(tabs) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    const tabList = overlay.querySelector('.ctrlf-pro-tab-list');
    
    if (tabs.length === 0) {
      tabList.innerHTML = '<div class="ctrlf-pro-no-results">No results found in other tabs</div>';
      return;
    }

    tabList.innerHTML = tabs.map(tab => `
      <div class="ctrlf-pro-tab-item" data-tab-id="${tab.tabId}">
        <img class="ctrlf-pro-tab-favicon" src="${tab.favicon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%236c757d%22><rect width=%2218%22 height=%2218%22 x=%223%22 y=%223%22 rx=%222%22/></svg>'}" alt="" />
        <div class="ctrlf-pro-tab-info">
          <div class="ctrlf-pro-tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
          <div class="ctrlf-pro-tab-url">${escapeHtml(new URL(tab.url).hostname)}</div>
        </div>
        <span class="ctrlf-pro-tab-count">${tab.counts.total} match${tab.counts.total !== 1 ? 'es' : ''}</span>
      </div>
    `).join('');

    // Add click handlers
    tabList.querySelectorAll('.ctrlf-pro-tab-item').forEach(item => {
      item.addEventListener('click', () => {
        const tabId = parseInt(item.dataset.tabId, 10);
        switchToTab(tabId);
      });
    });
  }

  /**
   * Update dropdown header count
   */
  function updateDropdownCount(results) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    const count = overlay.querySelector('.ctrlf-pro-dropdown-count');
    count.textContent = `${results.tabCount} tab${results.tabCount !== 1 ? 's' : ''} · ${results.total} total`;
  }

  /**
   * Filter tabs by search term
   */
  function filterTabs(filter) {
    if (!filter || filter.trim().length === 0) {
      filteredTabs = [...tabResults];
    } else {
      const lower = filter.toLowerCase();
      filteredTabs = tabResults.filter(tab => 
        tab.title.toLowerCase().includes(lower) ||
        tab.url.toLowerCase().includes(lower)
      );
    }
    updateTabList(filteredTabs);
  }

  /**
   * Switch to a specific tab
   */
  async function switchToTab(tabId) {
    try {
      await chrome.runtime.sendMessage({
        action: 'switchTab',
        tabId: tabId
      });
    } catch (error) {
      console.error('Error switching tab:', error);
    }
  }

  /**
   * Navigate to next match
   */
  async function navigateNext() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'navigate', direction: 'next' });
      if (response?.result?.counts) {
        updateCounter(response.result.counts);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }

  /**
   * Navigate to previous match
   */
  async function navigatePrevious() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'navigate', direction: 'previous' });
      if (response?.result?.counts) {
        updateCounter(response.result.counts);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }

  /**
   * Update the result counter display
   */
  function updateCounter(counts) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    const counter = overlay.querySelector('.ctrlf-pro-counter');
    counter.textContent = counts.total > 0 ? `${counts.current} of ${counts.total}` : 'No results';
    counter.classList.toggle('has-results', counts.total > 0);
  }

  /**
   * Update settings in background
   */
  async function updateSettings() {
    try {
      await chrome.runtime.sendMessage({
        action: 'setOptions',
        options: options
      });
    } catch (error) {
      console.error('Settings update error:', error);
    }
  }

  /**
   * Show the overlay
   */
  function showOverlay() {
    const overlay = createOverlay();
    overlay.style.display = 'flex';
    overlay.classList.add('visible');
    
    const input = overlay.querySelector('.ctrlf-pro-input');
    input.focus();
    input.select();
  }

  /**
   * Hide the overlay
   */
  function hideOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('visible');
      
      // Clear highlights
      chrome.runtime.sendMessage({ action: 'clear' });
      
      // Reset state
      isExpanded = false;
      settingsExpanded = false;
      overlay.querySelector('.ctrlf-pro-dropdown').classList.remove('expanded');
      overlay.querySelector('.ctrlf-pro-settings').classList.remove('expanded');
    }
  }

  /**
   * Toggle overlay visibility
   */
  function toggleOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay && overlay.style.display === 'flex') {
      hideOverlay();
    } else {
      showOverlay();
    }
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Listen for toggle message from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleOverlay') {
      toggleOverlay();
      sendResponse({ success: true, visible: document.getElementById(OVERLAY_ID)?.style.display === 'flex' });
    }
    return true;
  });

  // Initialize overlay on load
  createOverlay();
  
  console.log('CTRL+F Pro UI overlay loaded');
})();
