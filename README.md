# WebMCP - Model Context Tool Inspector (DevPartners)

> **DevPartners fork.** This is a derivative of the upstream
> [beaufortfrancois/model-context-tool-inspector](https://github.com/beaufortfrancois/model-context-tool-inspector),
> extended with multi-provider LLM support (Microsoft Foundry / Azure OpenAI alongside Gemini)
> and assorted fixes. It is not the Chrome Web Store build; the name, icon, and tooltip carry a
> DevPartners marker so the two can't be confused when installed side by side.

A Chrome Extension that allows developers to inspect, monitor, and execute WebMCP tools manually or with an LLM (Google Gemini or Microsoft Foundry, including Azure OpenAI).

## Prerequisites

**Important:**  You must enable the "WebMCP for testing" flag in `chrome://flags` to turn it on in Chrome 150.0.7861.0 or higher.

## Installation

This fork is installed from source. (The [Chrome Web Store listing](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) is the upstream original, without this fork's changes.)

### Install from source

1.  **Download the Source:**
    Clone this repository or download the source files into a directory.

2.  **Install dependencies:**
    In the directory, run `npm install`.

3.  **Open Chrome Extensions:**
    Navigate to `chrome://extensions/` in your browser address bar.

4.  **Enable Developer Mode:**
    Toggle the **Developer mode** switch in the top right corner of the Extensions page.

5.  **Load Unpacked:**
    Click the **Load unpacked** button that appears in the top left. Select the directory containing `manifest.json` (the folder where you saved the files).

## Usage

1.  **Navigate to a Page:**
    Open a web page that exposes Model Context tools.

2.  **Open the Inspector:**
    Click the extension's action icon (the puzzle piece or pinned icon) in the Chrome toolbar. This will open the **Side Panel**.

3.  **Inspect Tools:**
    * The extension will inject a content script to query the page.
    * A table will appear listing all available tools found on the page.

4.  **Execute a Tool:**
    * **Tool:** Select the desired tool from the dropdown menu.
    * **Input Arguments:** Enter the arguments for the tool in the text area.
        * *Note:* The input must be valid JSON (e.g., `{"text": "hello world"}`).
    * Click **Execute Tool**.

5.  **Exercise Tools with an LLM (optional):**
    * Pick an AI provider (Google Gemini or Microsoft Foundry / Azure OpenAI) in the **︙** menu next to the User Prompt field.
    * Set your credentials with the corresponding button:
        * **Gemini:** an [API key](https://aistudio.google.com/apikey); pick the model in the **︙** menu.
        * **Microsoft Foundry / Azure OpenAI:** your resource endpoint, the name of a model deployment that supports function calling, and an API key. Any Foundry chat model that speaks the OpenAI chat completions syntax works:
            * *Azure OpenAI* deployments (e.g., `gpt-4o`): use the bare resource endpoint, e.g. `https://myresource.openai.azure.com` or `https://myresource.services.ai.azure.com`.
            * *Other Foundry models sold by Azure* with function calling, such as DeepSeek, Grok, or Llama: use the bare resource endpoint too (they share the `/openai/v1` route).
            * *Microsoft MAI frontier models* (e.g., `MAI-Thinking-1`): append the MAI route to the endpoint, e.g. `https://myresource.services.ai.azure.com/mai/v1`.
            * Endpoints already ending in a `/v1` route or in `/chat/completions` are used as-is, so any OpenAI-compatible endpoint works. Claude on Foundry is *not* supported (it uses the Anthropic-native API).
    * Type a prompt (or accept a suggested one) and click **Send**. The model can then call the page's WebMCP tools to answer.

## Disclaimer

This is not an officially supported Google product. This project is not
eligible for the [Google Open Source Software Vulnerability Rewards
Program](https://bughunters.google.com/open-source-security).
