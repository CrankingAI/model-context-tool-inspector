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

// Update badge text with the number of tools per tab.
chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId) => updateBadge(tabId));
chrome.webNavigation.onCompleted.addListener(({ tabId }) => updateBadge(tabId));

async function updateBadge(tabId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id !== tabId) return;
  chrome.action.setBadgeText({ text: '', tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  const fromOrigins = await getAllFrameOrigins(tab.id);
  const message = { action: 'LIST_TOOLS', fromOrigins };
  chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(({ message }) => {
    chrome.runtime.sendMessage({ message });
  });
}

chrome.runtime.onMessage.addListener(({ action, tools }, { tab, frameId }, sendResponse) => {
  if (action == 'INJECT_GET_FRAME_ID') {
    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: getFrameId,
    });
    return;
  }
  if (action == 'GET_FRAME_ID') {
    sendResponse(frameId);
    return;
  }
  const text = tools?.length ? `${tools.length}` : '';
  chrome.action.setBadgeText({ text, tabId: tab.id });
});

// Listen for frameId requests from a window and sends it back.
function getFrameId() {
  window.onmessage = async ({ data, source, origin }) => {
    if (data.action !== 'GET_FRAME_ID') return;
    for (let i = 0; i < 10; i++) {
      const frameId = await chrome.runtime.sendMessage({ action: 'GET_FRAME_ID' });
      if (frameId != null) {
        return source.postMessage({ action: 'GET_FRAME_ID_RESPONSE', frameId }, origin);
      }
    }
    console.debug('[WebMCP] failed to get frameId after 10 attempts');
  };
}
