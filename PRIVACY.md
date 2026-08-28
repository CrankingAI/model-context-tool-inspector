# Privacy Policy for WebMCP - Model Context Tool Inspector

**Last Updated:** August 2026

This Privacy Policy explains how the **WebMCP - Model Context Tool Inspector** Chrome extension ("the Extension", "we", "us", or "our") handles user information and data.

We are committed to respecting your privacy. The Extension is designed as a developer tool to inspect, monitor, and execute WebMCP tools (`document.modelContext`), and it operates with a privacy-first approach: **we do not collect, track, store, or sell any personal data.**

---

## 1. Information We Do Not Collect

- **No Personal Identifiable Information (PII):** We do not collect names, email addresses, physical addresses, phone numbers, or any other identifying personal information.
- **No Browsing History or Analytics:** We do not track, log, or transmit your browsing history, web activity, or usage analytics.
- **No Telemetry or Tracking Pixels:** The Extension contains no third-party tracking code, analytics libraries, advertising trackers, or fingerprinting scripts.
- **No First-Party Server:** The extension does not communicate with any custom or developer-hosted backend servers.

---

## 2. Information Handled Locally

The Extension processes data locally within your browser to provide its developer inspection capabilities:

- **WebMCP Tool Metadata:** The content script inspects the active web page's `document.modelContext` API to read registered tool names, descriptions, input schemas, frame IDs, and tool annotations (such as `readOnlyHint` and `untrustedContentHint`). This information is displayed in the extension's side panel for inspection.
- **Tool Execution Data:** When you manually execute a tool or trigger tool execution via the AI assistant, the input parameters and execution results are passed directly between the extension and the web page/frame.
- **Local Storage (`localStorage`):** The following configuration settings are stored locally on your machine within the browser's extension storage:
  - **Gemini API Key:** If you provide a Google Gemini API key to enable AI features, it is stored locally in `localStorage.apiKey`. It is never transmitted anywhere other than directly to Google's Gemini API endpoints.
  - **Microsoft Foundry / Azure OpenAI Credentials:** If you provide Microsoft Foundry (Azure OpenAI) credentials to enable AI features, they are stored locally in `localStorage.azureEndpoint`, `localStorage.azureDeployment`, and `localStorage.azureApiKey`. They are never transmitted anywhere other than directly to the Foundry endpoint you configured.
  - **Selected Provider and Model:** Your chosen AI provider (`gemini` or `azure`) is saved in `localStorage.provider`, and your chosen Gemini model (e.g., `gemini-3.6-flash`) in `localStorage.model`.
  - **Prompt Suggestion Preference:** Your preference for automatic prompt generation is saved in `localStorage.suggestUserPrompt`.
- **Clipboard Access:** The extension will only write data (such as tool definitions in JSON/ScriptToolConfig format or session debug traces) to your clipboard when you explicitly click the corresponding "Copy" buttons. The extension never reads from your clipboard.

---

## 3. Third-Party Services and Network Requests

The Extension does not transmit any data over the network by default.

### Google Gemini API

If and only if you provide a Gemini API key and use the AI interaction features (such as sending prompts or enabling prompt suggestions), the Extension communicates directly from your browser to Google's Gemini API endpoints (`generativelanguage.googleapis.com` via the official `@google/genai` library).

When using these features:

- Your user prompt, available tool declarations (names, descriptions, schemas), and tool execution results are transmitted to Google to process model responses and function calls.
- This data transfer is subject to [Google's Privacy Policy](https://policies.google.com/privacy) and the [Google APIs Terms of Service / Generative AI Additional Terms of Service](https://ai.google.dev/terms).
- If you do not provide an API key, no network requests to Google Gemini are made.

### Microsoft Foundry / Azure OpenAI

If and only if you provide Microsoft Foundry credentials (endpoint, deployment name, and API key), select Microsoft Foundry as the AI provider, and use the AI interaction features, the Extension communicates directly from your browser to the Foundry endpoint you configured (typically `https://<your-resource>.services.ai.azure.com` or `https://<your-resource>.openai.azure.com`).

When using these features:

- Your user prompt, available tool declarations (names, descriptions, schemas), and tool execution results are transmitted to your Foundry resource to process model responses and function calls.
- This data transfer is subject to [Microsoft's Privacy Statement](https://privacy.microsoft.com/privacystatement) and the [Microsoft Product Terms](https://www.microsoft.com/licensing/terms) applicable to your Azure subscription.
- If you do not provide Microsoft Foundry credentials, no network requests to Azure are made.

---

## 4. Permissions Used and Why

The Extension requests the following permissions in its `manifest.json`:

| Permission                        | Purpose                                                                                                                                                                    |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidePanel`                       | Displays the Tool Inspector user interface in Chrome's side panel.                                                                                                         |
| `activeTab`                       | Grants temporary access to interact with the currently active tab to inspect and execute tools.                                                                            |
| `scripting`                       | Allows injecting the content scripts and frame resolution helpers required to communicate with `document.modelContext`.                                                    |
| `webNavigation`                   | Enumerates frame origins (`chrome.webNavigation.getAllFrames`) within the active tab to discover tools in embedded frames and update the tool badge count upon navigation. |
| `host_permissions` (`<all_urls>`) | Enables the extension to inject content scripts across any web page where developers are testing WebMCP tools.                                                             |

---

## 5. Data Retention and Security

- All settings and configuration data remain in your browser's local storage and can be deleted at any time by updating/clearing the credentials in the extension UI, resetting local storage, or uninstalling the extension.
- Network communication with the configured AI provider (when enabled) uses encrypted HTTPS/TLS connections.

---

## 6. Children's Privacy

The Extension does not knowingly collect or solicit any personal information from children under the age of 13.

---

## 7. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be reflected by updating the "Last Updated" date at the top of this document in the project repository.

---

## 8. Open Source and Contact

This Extension is open source under the Apache-2.0 license. This build is a DevPartners fork of the upstream project. You can inspect the source code and verify our privacy practices directly on GitHub:

- **Repository (this fork):** [CrankingAI/model-context-tool-inspector](https://github.com/CrankingAI/model-context-tool-inspector)
- **Upstream original:** [beaufortfrancois/model-context-tool-inspector](https://github.com/beaufortfrancois/model-context-tool-inspector)
- **Issues & Inquiries:** If you have questions or feedback regarding this Privacy Policy, please open an issue in the repository.
