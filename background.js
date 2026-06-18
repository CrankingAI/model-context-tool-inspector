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

chrome.runtime.onMessage.addListener(async ({ action, tools }, { tab, origin }, sendResponse) => {
  if (action == 'INJECT_GET_LOCATION_LISTENER') {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: getLocation,
    });
    return;
  }
  if (action == 'GET_LOCATION') {
    sendResponse(origin);
    return;
  }
  const text = tools?.length ? `${tools.length}` : '';
  chrome.action.setBadgeText({ text, tabId: tab.id });
});

// Listen for location requests from an embedded frame and sends it back.
function getLocation() {
  if (window == window.top) return;
  window.onmessage = async ({ data, source, origin }) => {
    if (data.action === 'GET_LOCATION') {
      const location = await chrome.runtime.sendMessage({ action: 'GET_LOCATION' });
      source.postMessage({ action: 'GET_LOCATION_RESPONSE', location }, origin);
    }
  };
}
