/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from './js-genai.js';

// LLM provider abstraction. Each provider exposes:
// - label:            display name used in button labels
// - credentialsNoun:  what the credentials button says it sets
// - isConfigured:     whether credentials are present
// - generateText(contents): one-shot text generation (no tools)
// - createChat():     a chat whose send() takes either a user `message` or
//   `toolResults`, plus `systemInstruction` (array of strings) and `tools`
//   ([{name, description, parameters}]), and resolves to
//   {text, toolCalls: [{id, name, args}], response}.

export function createProvider(settings) {
  return settings.provider === 'azure'
    ? createFoundryProvider(settings)
    : createGeminiProvider(settings);
}

function createGeminiProvider({ apiKey, model }) {
  const genAI = apiKey ? new GoogleGenAI({ apiKey }) : undefined;

  function toGeminiConfig(systemInstruction, tools) {
    return {
      systemInstruction,
      tools: [
        {
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.parameters,
          })),
        },
      ],
    };
  }

  return {
    label: 'Gemini',
    credentialsNoun: 'API key',
    isConfigured: Boolean(apiKey),

    async generateText(contents) {
      const response = await genAI.models.generateContent({ model, contents });
      return response.text;
    },

    createChat() {
      const chat = genAI.chats.create({ model });
      return {
        async send({ message, toolResults, systemInstruction, tools }) {
          const geminiMessage = toolResults
            ? toolResults.map(({ id, name, result, error }) => ({
                functionResponse: { id, name, response: error ? { error } : { result } },
              }))
            : message;
          const response = await chat.sendMessage({
            message: geminiMessage,
            config: toGeminiConfig(systemInstruction, tools),
          });
          return {
            text: response.text,
            toolCalls: (response.functionCalls || []).map(({ id, name, args }) => {
              return { id, name, args };
            }),
            response,
          };
        },
      };
    },
  };
}

// Microsoft Foundry, including Azure OpenAI. All Foundry chat models sold by
// Azure that speak the OpenAI chat completions syntax work here: Azure OpenAI
// deployments as well as models like DeepSeek, Grok, and Llama on the
// /openai/v1 route, and Microsoft's MAI models (e.g. MAI-Thinking-1) on the
// /mai/v1 route. (Claude on Foundry uses the Anthropic-native API and is not
// supported.)
function createFoundryProvider({ azureEndpoint, azureDeployment, azureApiKey }) {
  // Accepts the endpoint shapes the Azure portals hand out: a bare resource
  // endpoint (https://myresource.services.ai.azure.com, …openai.azure.com, or
  // …cognitiveservices.azure.com), which gets the OpenAI-compatible /openai/v1
  // route; a Foundry project endpoint (…/api/projects/<name>), which serves
  // inference at the resource root; an endpoint already naming a /v1 API route
  // (such as /mai/v1 for MAI models); a Responses API URL (…/openai/v1/responses),
  // which the Foundry portal hands out and which shares a base with chat
  // completions; or a full …/chat/completions URL, kept verbatim — query
  // string included, so legacy deployment URLs with ?api-version=… work.
  function chatCompletionsUrl() {
    let raw = azureEndpoint.trim();
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const url = new URL(raw);
    if (url.pathname.replace(/\/+$/, '').endsWith('/chat/completions')) return url.href;
    let base = (url.origin + url.pathname).replace(/\/+$/, '');
    base = base.replace(/\/api\/projects\/[^/]+$/, '');
    base = base.replace(/\/responses$/, '');
    if (!/\/v1$/.test(base)) base += '/openai/v1';
    return `${base}/chat/completions`;
  }

  async function complete(messages, tools) {
    const request = { model: azureDeployment, messages };
    if (tools?.length) {
      request.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }
    const res = await fetch(chatCompletionsUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': azureApiKey },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      throw new Error(`Microsoft Foundry request failed (${res.status}): ${await res.text()}`);
    }
    const response = await res.json();
    return { response, reply: response.choices[0].message };
  }

  return {
    label: 'Microsoft Foundry',
    credentialsNoun: 'credentials',
    isConfigured: Boolean(azureEndpoint && azureDeployment && azureApiKey),

    async generateText(contents) {
      const { reply } = await complete([{ role: 'user', content: contents.join('\n') }]);
      return reply.content;
    },

    createChat() {
      const messages = [];
      return {
        async send({ message, toolResults, systemInstruction, tools }) {
          if (messages.length === 0) {
            messages.push({ role: 'system', content: systemInstruction.join('\n') });
          }
          if (toolResults) {
            for (const { id, result, error } of toolResults) {
              messages.push({
                role: 'tool',
                tool_call_id: id,
                content: JSON.stringify(error ? { error } : { result }),
              });
            }
          } else {
            messages.push({ role: 'user', content: message });
          }
          const { response, reply } = await complete(messages, tools);
          messages.push(reply);
          return {
            text: reply.content ?? '',
            toolCalls: (reply.tool_calls || [])
              .filter((toolCall) => toolCall.type === 'function')
              .map((toolCall) => ({
                id: toolCall.id,
                name: toolCall.function.name,
                args: JSON.parse(toolCall.function.arguments || '{}'),
              })),
            response,
          };
        },
      };
    },
  };
}
