/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

console.debug(`[WebMCP] Content script injected in ${window.location.href}`);

// This file can be evaluated twice in the same frame: once as the manifest
// content script and once injected by background.js at install time into tabs
// that were already loading. Only var and function declarations are
// redeclaration-safe at the top level, and all side effects are guarded below
// so the second copy is a no-op.
var webmcpContentScriptLoaded;
var timeout;
var frameIdCache;
var toolChangeListenerInstalled;

if (!webmcpContentScriptLoaded) {
  webmcpContentScriptLoaded = true;
  frameIdCache = new WeakMap();

  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  window.addEventListener('toolactivated', ({ toolName }) => {
    console.debug(`[WebMCP] Tool "${toolName}" started execution.`);
  });

  window.addEventListener('toolcancel', ({ toolName }) => {
    console.debug(`[WebMCP] Tool "${toolName}" execution is cancelled.`);
  });

  if (window === window.top) {
    chrome.runtime.sendMessage({ type: 'contentScriptReady' }).catch(() => {});
  }
}

function onRuntimeMessage(message, _, reply) {
  const { action, name, inputArgs, fromOrigins } = message;
  try {
    if (!document.modelContext) {
      throw new Error('Error: You must run Chrome with the "WebMCP for testing" flag enabled.');
    }
    if (action == 'LIST_TOOLS') {
      debouncedListTools(fromOrigins);
      installToolChangeListener();
    }
    if (action == 'EXECUTE_TOOL') {
      console.debug(`[WebMCP] Execute tool "${name}" with ${inputArgs} in ${window.location.href}`);
      let targetFrame, loadPromise;
      // Check if this tool is associated with a form target
      const formTarget = document.querySelector(`form[toolname="${name}"]`)?.target;
      if (formTarget) {
        // May be null, e.g. for target="_blank"; the result then lives in a
        // new tab and the sidebar retrieves it from there.
        targetFrame = document.querySelector(`[name=${formTarget}]`);
      }
      if (targetFrame) {
        loadPromise = new Promise((resolve) => {
          targetFrame.addEventListener('load', resolve, { once: true });
        });
      }
      // Execute the experimental tool
      document.modelContext
        .getTools()
        .then(async (tools) => {
          const tool = tools.find((t) => t.name === name && t.window === window);
          let result;
          try {
            result = await document.modelContext.executeTool(tool, JSON.parse(inputArgs));
          } catch (e) {
            // TODO: Remove this when executeTool doesn't accept JSON stringified inputArgs anymore in Chrome Stable.
            if (e.message.startsWith('Failed to parse input')) {
              result = await document.modelContext.executeTool(tool, inputArgs);
            } else {
              throw e;
            }
          }
          return result;
        })
        .then(async (result) => {
          // If result is null and we have a target frame, wait for the frame to reload.
          if (result === null && targetFrame) {
            console.debug(`[WebMCP] Waiting for form target ${targetFrame} to load`);
            await loadPromise;
            console.debug('[WebMCP] Get cross document script tool result');
            result = targetFrame.contentWindow.document.querySelector(
              'script[type="application/ld+json"]',
            )?.textContent;
          }
          reply(result);
        })
        .catch(({ message }) => reply(JSON.stringify(message)));
      return true;
    }
    if (action == 'GET_CROSS_DOCUMENT_SCRIPT_TOOL_RESULT') {
      console.debug(`[WebMCP] Get cross document script tool result in ${window.location.href}`);
      reply(document.querySelector('script[type="application/ld+json"]')?.textContent);
    }
  } catch ({ message }) {
    chrome.runtime.sendMessage({ message });
  }
}

// Refresh the tool list whenever the page's tool registry changes. Prefer
// addEventListener over assigning ontoolchange: it doesn't compete for the
// single handler slot, so we never have to rely on how the slot is scoped
// between worlds (in current Chrome builds the isolated world gets its own,
// so page scripts can't actually clobber ours — addEventListener just avoids
// depending on that). Fall back to the property only when ModelContext isn't
// an EventTarget in this build.
function installToolChangeListener() {
  if (toolChangeListenerInstalled) return;
  toolChangeListenerInstalled = true;
  if (typeof document.modelContext.addEventListener === 'function') {
    document.modelContext.addEventListener('toolchange', () => debouncedListTools());
  } else {
    document.modelContext.ontoolchange = () => debouncedListTools();
  }
}

function debouncedListTools(fromOrigins) {
  clearTimeout(timeout);
  timeout = setTimeout(() => listTools(fromOrigins), 100);
}

async function listTools(fromOrigins) {
  // toolchange refreshes don't carry an origins list, and one bound at
  // LIST_TOOLS time goes stale when frames are added or removed later — ask
  // the background for the tab's current frame origins instead.
  if (!fromOrigins) {
    try {
      fromOrigins = await chrome.runtime.sendMessage({
        type: 'internal',
        action: 'GET_FRAME_ORIGINS',
      });
    } catch {
      // Background unreachable; fall through to an unfiltered getTools().
    }
  }
  let tools = [];
  const registered = fromOrigins
    ? await document.modelContext.getTools({ fromOrigins })
    : await document.modelContext.getTools();
  for (const tool of registered) {
    const frameId = tool.window == window ? 0 : await getFrameId(tool.window);
    const inputSchema =
      typeof tool.inputSchema === 'string' ? tool.inputSchema : JSON.stringify(tool.inputSchema);
    tools.push({
      description: tool.description,
      inputSchema,
      readOnlyHint: tool.annotations?.readOnlyHint ? '✓' : undefined,
      untrustedContentHint: tool.annotations?.untrustedContentHint ? '✓' : undefined,
      name: tool.name,
      frameId,
    });
  }
  console.debug(`[WebMCP] Got ${tools.length} tools`, tools);
  chrome.runtime.sendMessage({ tools, url: window.location.href });
}

async function getFrameId(targetWindow) {
  if (frameIdCache.has(targetWindow)) return frameIdCache.get(targetWindow);
  // The postMessage relay can miss a beat (e.g. a slow service worker still
  // injecting the responder); retry before reporting the frame as unknown.
  for (let attempt = 0; attempt < 3; attempt++) {
    const frameId = await requestFrameId(targetWindow);
    if (frameId != null) {
      frameIdCache.set(targetWindow, frameId);
      return frameId;
    }
  }
  return null;
}

async function requestFrameId(targetWindow) {
  await chrome.runtime.sendMessage({ action: 'INJECT_GET_FRAME_ID' });
  const promise = new Promise((resolve) => {
    let timeoutId;
    const listener = ({ source, data }) => {
      if (source == targetWindow && data.action === 'GET_FRAME_ID_RESPONSE') {
        window.removeEventListener('message', listener);
        clearTimeout(timeoutId);
        resolve(data.frameId);
      }
    };
    window.addEventListener('message', listener);
    timeoutId = setTimeout(() => {
      window.removeEventListener('message', listener);
      resolve(null);
    }, 2000);
  });
  targetWindow.postMessage({ action: 'GET_FRAME_ID' }, '*');
  return promise;
}
