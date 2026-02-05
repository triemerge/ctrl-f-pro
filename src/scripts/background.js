/**
 * CTRL+F Pro - Background Service Worker
 * Handles multi-tab communication and coordination
 */

// State
let globalQuery = '';
let globalOptions = {
  smartMode: true,
  caseSensitive: false,
  wholeWord: false
};
let tabResults = new Map();

/**
 * Send message to a tab's content script
 * @param {number} tabId - Tab ID
 * @param {Object} message - Message to send
 * @returns {Promise} - Response promise
 */
async function sendToTab(tabId, message) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    console.log(`Tab ${tabId} not ready:`, error.message);
    return null;
  }
}

/**
 * Get all searchable tabs
 * @returns {Promise<chrome.tabs.Tab[]>} - Array of tabs
 */
async function getSearchableTabs() {
  const tabs = await chrome.tabs.query({});
  
  // Filter out restricted URLs
  return tabs.filter(tab => {
    if (!tab.url) return false;
    const url = tab.url.toLowerCase();
    
    // Skip chrome:// pages, extensions, devtools, etc.
    const restricted = [
      'chrome://',
      'chrome-extension://',
      'devtools://',
      'edge://',
      'about:',
      'moz-extension://',
      'file://'
    ];
    
    return !restricted.some(prefix => url.startsWith(prefix));
  });
}

/**
 * Inject content script into a tab if not already present
 * @param {number} tabId - Tab ID
 */
async function ensureContentScript(tabId) {
  try {
    // Check if script is already injected
    const response = await sendToTab(tabId, { action: 'ping' });
    if (response?.ready) return true;
    
    // Inject the scripts
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/scripts/search-engine.js', 'src/scripts/content.js']
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['src/styles/overlay.css']
    });
    
    return true;
  } catch (error) {
    console.log(`Cannot inject into tab ${tabId}:`, error.message);
    return false;
  }
}

/**
 * Search in a specific tab
 * @param {number} tabId - Tab ID
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {boolean} highlightOnly - Whether to highlight or just count
 * @returns {Promise<Object>} - Search result
 */
async function searchInTab(tabId, query, options, highlightOnly = false) {
  try {
    await ensureContentScript(tabId);
    
    const action = highlightOnly ? 'search' : 'count';
    const response = await sendToTab(tabId, { 
      action: action, 
      query: query,
      options: options 
    });
    
    if (response?.success) {
      return {
        tabId: tabId,
        counts: response.counts,
        success: true
      };
    }
    
    return { tabId: tabId, counts: { total: 0, exact: 0, smart: 0 }, success: false };
  } catch (error) {
    return { tabId: tabId, counts: { total: 0, exact: 0, smart: 0 }, success: false };
  }
}

/**
 * Search across all tabs
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Aggregated results
 */
async function searchAllTabs(query, options = globalOptions) {
  const tabs = await getSearchableTabs();
  tabResults.clear();
  
  // Search in all tabs in parallel
  const searchPromises = tabs.map(async tab => {
    const result = await searchInTab(tab.id, query, options, false);
    
    if (result.counts.total > 0) {
      tabResults.set(tab.id, {
        tabId: tab.id,
        title: tab.title,
        url: tab.url,
        favicon: tab.favIconUrl,
        counts: result.counts
      });
    }
    
    return result;
  });
  
  await Promise.all(searchPromises);
  
  // Calculate totals
  let totalExact = 0;
  let totalSmart = 0;
  
  tabResults.forEach(result => {
    totalExact += result.counts.exact;
    totalSmart += result.counts.smart;
  });
  
  return {
    total: totalExact + totalSmart,
    exact: totalExact,
    smart: totalSmart,
    tabCount: tabResults.size,
    tabs: Array.from(tabResults.values())
  };
}

/**
 * Highlight matches in the active tab
 * @param {string} query - Search query
 * @param {Object} options - Search options
 */
async function highlightActiveTab(query, options = globalOptions) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (activeTab) {
    await ensureContentScript(activeTab.id);
    return await sendToTab(activeTab.id, { action: 'search', query, options });
  }
  
  return null;
}

/**
 * Navigate to next/previous match in active tab
 * @param {string} direction - 'next' or 'previous'
 */
async function navigateMatch(direction) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (activeTab) {
    return await sendToTab(activeTab.id, { action: direction });
  }
  
  return null;
}

/**
 * Clear highlights in active tab
 */
async function clearActiveTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (activeTab) {
    return await sendToTab(activeTab.id, { action: 'clear' });
  }
  
  return null;
}

/**
 * Switch to a tab and highlight matches
 * @param {number} tabId - Tab ID to switch to
 */
async function switchToTabAndHighlight(tabId) {
  try {
    // Switch to the tab
    await chrome.tabs.update(tabId, { active: true });
    
    // Get the tab's window and focus it
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    
    // Highlight matches in the newly active tab
    if (globalQuery) {
      await searchInTab(tabId, globalQuery, globalOptions, true);
    }
    
    return true;
  } catch (error) {
    console.error('Error switching to tab:', error);
    return false;
  }
}

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-search') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (activeTab) {
      await ensureContentScript(activeTab.id);
      await sendToTab(activeTab.id, { action: 'toggleOverlay' });
    }
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'searchAll':
        globalQuery = message.query;
        if (message.options) globalOptions = message.options;
        const allResults = await searchAllTabs(message.query, globalOptions);
        sendResponse({ success: true, results: allResults });
        break;
        
      case 'searchActive':
        globalQuery = message.query;
        if (message.options) globalOptions = message.options;
        const activeResult = await highlightActiveTab(message.query, globalOptions);
        sendResponse({ success: true, result: activeResult });
        break;
        
      case 'navigate':
        const navResult = await navigateMatch(message.direction);
        sendResponse({ success: true, result: navResult });
        break;
        
      case 'clear':
        await clearActiveTab();
        sendResponse({ success: true });
        break;
        
      case 'switchTab':
        const switched = await switchToTabAndHighlight(message.tabId);
        sendResponse({ success: switched });
        break;
        
      case 'getTabResults':
        sendResponse({ 
          success: true, 
          tabs: Array.from(tabResults.values()),
          query: globalQuery,
          options: globalOptions
        });
        break;
        
      case 'setOptions':
        globalOptions = { ...globalOptions, ...message.options };
        sendResponse({ success: true, options: globalOptions });
        break;
        
      case 'getOptions':
        sendResponse({ success: true, options: globalOptions });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  
  return true; // Keep channel open for async response
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  await ensureContentScript(tab.id);
  await sendToTab(tab.id, { action: 'toggleOverlay' });
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabResults.delete(tabId);
});

console.log('CTRL+F Pro background service worker started');
