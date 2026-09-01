/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAllFrameOrigins } from './utils.js';

// Allows users to open the side panel by clicking the action icon.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Inject content script in all tabs first.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  tabs.forEach(({ id: tabId }) => {
    chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        files: ['content.js'],
      })
      .catch(() => {});
  });
});

// Update badge text (tool count) and icon color per tab; the red icon
// variants mark a page with registered WebMCP tools.
const DEFAULT_ICON = { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' };
const ACTIVE_ICON = { 16: 'icons/icon16-active.png', 32: 'icons/icon32-active.png', 48: 'icons/icon48-active.png', 128: 'icons/icon128-active.png' };

chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId) => updateBadge(tabId));
chrome.webNavigation.onCompleted.addListener(({ tabId }) => updateBadge(tabId));

async function updateBadge(tabId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== tabId) return;
  chrome.action.setBadgeText({ text: '', tabId });
  chrome.action.setIcon({ tabId, path: DEFAULT_ICON });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  const fromOrigins = await getAllFrameOrigins(tab.id);
  const message = { action: 'LIST_TOOLS', fromOrigins };
  chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(({ message }) => {
    chrome.runtime.sendMessage({ message });
  });
}

chrome.runtime.onMessage.addListener(({ action, tools }, { tab, frameId }, sendResponse) => {
  // Fresh frame origins for a toolchange-driven refresh (the message carries
  // type: 'internal' so the sidebar's listener ignores it).
  if (action == 'GET_FRAME_ORIGINS') {
    getAllFrameOrigins(tab.id).then(sendResponse);
    return true;
  }
  if (action == 'INJECT_GET_FRAME_ID') {
    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: getFrameId,
    }).catch(() => {}).finally(sendResponse);
    return true;
  }
  if (action == 'GET_FRAME_ID') {
    sendResponse(frameId);
    return;
  }
  if (tools !== undefined) {
    const text = tools.length ? `${tools.length}` : '';
    chrome.action.setBadgeText({ text, tabId: tab.id });
    chrome.action.setIcon({ tabId: tab.id, path: tools.length ? ACTIVE_ICON : DEFAULT_ICON });
  }
});

// Listen for frameId requests from a window and sends it back.
function getFrameId() {
  // This function is re-injected on every INJECT_GET_FRAME_ID request;
  // only register the listener once per document.
  if (window.webmcpFrameIdListenerInstalled) return;
  window.webmcpFrameIdListenerInstalled = true;
  window.addEventListener('message', async ({ data, source, origin }) => {
    if (data.action !== 'GET_FRAME_ID') return;
    for (let i = 0; i < 10; i++) {
      const frameId = await chrome.runtime.sendMessage({ action: 'GET_FRAME_ID' });
      if (frameId != null) {
        return source.postMessage({ action: 'GET_FRAME_ID_RESPONSE', frameId }, origin);
      }
      await new Promise(r => setTimeout(r, 100)); // wait 100ms before retrying
    }
    console.debug('[WebMCP] failed to get frameId after 10 attempts');
  });
}
