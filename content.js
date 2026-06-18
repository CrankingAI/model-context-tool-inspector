/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

console.debug(`[WebMCP] Content script injected in ${window.location.href}`);

chrome.runtime.onMessage.addListener((message, _, reply) => {
  const { action, name, inputArgs, location, fromOrigins } = message;
  try {
    if (!document.modelContext) {
      throw new Error('Error: You must run Chrome with the "WebMCP for testing" flag enabled.');
    }
    if (action == 'LIST_TOOLS') {
      debouncedListTools(fromOrigins);
      document.modelContext.ontoolchange = debouncedListTools.bind(null, fromOrigins);
    }
    if (action == 'EXECUTE_TOOL') {
      if (location && location !== window.location.href) return;
      console.debug(`[WebMCP] Execute tool "${name}" with ${inputArgs} in ${location}`);
      let targetFrame, loadPromise;
      // Check if this tool is associated with a form target
      const formTarget = document.querySelector(`form[toolname="${name}"]`)?.target;
      if (formTarget) {
        targetFrame = document.querySelector(`[name=${formTarget}]`);
        loadPromise = new Promise((resolve) => {
          targetFrame.addEventListener('load', resolve, { once: true });
        });
      }
      // Execute the experimental tool
      document.modelContext
        .getTools()
        .then((tools) => {
          const tool = tools.find((t) => t.name === name && t.window === window);
          if (!tool) throw new Error('NO_TOOL_FOUND');
          return document.modelContext.executeTool(tool, inputArgs);
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
        .catch(({ message }) => {
          if (message !== 'NO_TOOL_FOUND') reply(JSON.stringify(message));
        });
      return true;
    }
    if (action == 'GET_CROSS_DOCUMENT_SCRIPT_TOOL_RESULT') {
      if (location && !window.location.href.startsWith(location)) return;
      console.debug(`[WebMCP] Get cross document script tool result in ${location}`);
      reply(document.querySelector('script[type="application/ld+json"]')?.textContent);
    }
  } catch ({ message }) {
    chrome.runtime.sendMessage({ message });
  }
});

let timeout;
function debouncedListTools(fromOrigins) {
  clearTimeout(timeout);
  timeout = setTimeout(() => listTools(fromOrigins), 100);
}

async function listTools(fromOrigins) {
  let tools = [];
  for (const tool of await document.modelContext.getTools({ fromOrigins })) {
    let location;
    try {
      location = tool.window.location.href;
    } catch {
      location = await getLocation(tool.window);
    }
    tools.push({
      description: tool.description,
      inputSchema: tool.inputSchema,
      readOnlyHint: tool.annotations?.readOnlyHint ? '✓' : undefined,
      untrustedContentHint: tool.annotations?.untrustedContentHint ? '✓' : undefined,
      name: tool.name,
      location,
    });
  }
  console.debug(`[WebMCP] Got ${tools.length} tools`, tools);
  chrome.runtime.sendMessage({ tools, url: window.location.href });
}

async function getLocation(crossOriginIframeWindow) {
  await chrome.runtime.sendMessage({ action: 'INJECT_GET_LOCATION_LISTENER' });
  const promise = new Promise((resolve) => {
    const listener = ({ source, data }) => {
      if (source == crossOriginIframeWindow && data.action === 'GET_LOCATION_RESPONSE') {
        window.removeEventListener('message', listener);
        resolve(data.location);
      }
    };
    window.addEventListener('message', listener);
  });
  crossOriginIframeWindow.postMessage({ action: 'GET_LOCATION' }, '*');
  return promise;
}

window.addEventListener('toolactivated', ({ toolName }) => {
  console.debug(`[WebMCP] Tool "${toolName}" started execution.`);
});

window.addEventListener('toolcancel', ({ toolName }) => {
  console.debug(`[WebMCP] Tool "${toolName}" execution is cancelled.`);
});
