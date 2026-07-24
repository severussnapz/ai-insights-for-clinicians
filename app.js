const form = document.getElementById("insightForm");
const generateBtn = document.getElementById("generateBtn");
const generateDraftBtn = document.getElementById("generateDraftBtn");
const clearBtn = document.getElementById("clearBtn");
const copyAllBtn = document.getElementById("copyAllBtn");
const outputSection = document.getElementById("outputSection");
const statusLine = document.getElementById("statusLine");
const troubleshootBox = document.getElementById("troubleshootBox");
const troubleshootList = document.getElementById("troubleshootList");

const entryTypeInput = document.getElementById("entryType");
const reflectionInput = document.getElementById("reflectionInput");
const draftTitleInput = document.getElementById("draftTitle");

const providerInput = document.getElementById("provider");
const apiEndpointInput = document.getElementById("apiEndpoint");
const modelNameInput = document.getElementById("modelName");
const modelTemplatesEl = document.getElementById("modelTemplates");
const apiKeyInput = document.getElementById("apiKey");
const apiVersionInput = document.getElementById("apiVersion");
const deploymentNameInput = document.getElementById("deploymentName");
const siteUrlInput = document.getElementById("siteUrl");
const appNameInput = document.getElementById("appName");
const providerHint = document.getElementById("providerHint");
const rememberSettingsInput = document.getElementById("rememberSettings");
const testConnectionBtn = document.getElementById("testConnectionBtn");
const connectionBadge = document.getElementById("connectionBadge");
const clearConnectionBtn = document.getElementById("clearConnectionBtn");

const saveDraftBtn = document.getElementById("saveDraftBtn");
const historyList = document.getElementById("historyList");

const exportTxtBtn = document.getElementById("exportTxtBtn");
const exportMdBtn = document.getElementById("exportMdBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");

const aiPromptOutput = document.getElementById("aiPromptOutput");
const summaryOutput = document.getElementById("summaryOutput");
const learningOutput = document.getElementById("learningOutput");
const actionOutput = document.getElementById("actionOutput");
const capabilityOutput = document.getElementById("capabilityOutput");

const copyButtons = Array.from(document.querySelectorAll(".copy-btn"));

const SETTINGS_KEY = "aiInsightsSettingsV1";
const DRAFTS_KEY = "aiInsightsDraftsV1";
const LAST_CONNECTION_KEY = "aiInsightsLastConnectionV1";

const PROVIDER_PRESETS = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
    hint: "OpenAI selected: uses Bearer token + chat completions format.",
  },
  azure: {
    endpoint: "https://your-resource.openai.azure.com",
    model: "",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    hint:
      "Azure OpenAI selected: uses api-key header and adds api-version query parameter.",
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o-mini",
      "openai/gpt-4.1-mini",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash-001",
    ],
    hint: "OpenRouter selected: uses Bearer token and optional HTTP-Referer / X-Title headers.",
  },
};

let activeMode = "ai";

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function providerDisplayName(provider) {
  if (provider === "azure") {
    return "Azure OpenAI";
  }
  if (provider === "openrouter") {
    return "OpenRouter";
  }
  return "OpenAI";
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString();
}

function renderConnectionBadge(record) {
  if (!record || !record.provider || !record.timestamp) {
    connectionBadge.textContent = "";
    connectionBadge.classList.add("hidden");
    clearConnectionBtn.classList.add("hidden");
    return;
  }

  const providerName = providerDisplayName(record.provider);
  const modelLabel = record.model ? ` | Model: ${record.model}` : "";
  const stamp = formatTimestamp(record.timestamp);
  connectionBadge.textContent = `Last successful connection: ${providerName}${modelLabel} | ${stamp}`;
  connectionBadge.classList.remove("hidden");
  clearConnectionBtn.classList.remove("hidden");
}

function saveLastConnection(record) {
  localStorage.setItem(LAST_CONNECTION_KEY, JSON.stringify(record));
  renderConnectionBadge(record);
}

function loadLastConnection() {
  const raw = localStorage.getItem(LAST_CONNECTION_KEY);
  if (!raw) {
    renderConnectionBadge(null);
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    renderConnectionBadge(parsed);
  } catch {
    localStorage.removeItem(LAST_CONNECTION_KEY);
    renderConnectionBadge(null);
  }
}

function clearLastConnection() {
  localStorage.removeItem(LAST_CONNECTION_KEY);
  renderConnectionBadge(null);
  setStatus("Stored connection history cleared.", "success");
}

function splitSentences(value) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toWordLimitedText(value, limit) {
  const words = normalizeWhitespace(value).split(" ");
  if (words.length <= limit) {
    return words.join(" ");
  }
  return `${words.slice(0, limit).join(" ")}...`;
}

function detectFocusAreas(text) {
  const lowered = text.toLowerCase();
  const focus = [];

  if (/(history|listen|communication|explain|shared decision)/.test(lowered)) {
    focus.push("Communication and consultation");
  }
  if (/(safety|risk|red flag|follow-up|escalat)/.test(lowered)) {
    focus.push("Patient safety and risk management");
  }
  if (/(team|colleague|handover|multidisciplinary|mdt)/.test(lowered)) {
    focus.push("Working with colleagues and teams");
  }
  if (/(diagnos|uncertain|investigat|differential)/.test(lowered)) {
    focus.push("Clinical decision-making under uncertainty");
  }
  if (/(ethic|consent|capacity|confidentiality)/.test(lowered)) {
    focus.push("Ethical and professional practice");
  }

  if (!focus.length) {
    focus.push("Reflective practice and quality improvement");
  }

  return focus;
}

function buildSummary(entryType, reflectionText) {
  const sentences = splitSentences(reflectionText);
  const primary = sentences[0] || toWordLimitedText(reflectionText, 40);
  const secondary =
    sentences[1] || "I reviewed my approach and identified practical areas to improve future care.";

  return [
    `Entry type: ${entryType}`,
    "",
    `What happened: ${toWordLimitedText(primary, 38)}`,
    `Why it mattered: ${toWordLimitedText(secondary, 34)}`,
    "",
    "Reflective lens: What? So what? Now what?",
  ].join("\n");
}

function buildLearningPoints(reflectionText, focusAreas) {
  const starter = toWordLimitedText(reflectionText, 48);

  return [
    `- Key insight: ${starter}`,
    "- I noticed how my assumptions influenced the first stage of assessment.",
    "- I will strengthen documentation of uncertainty and explicit safety-netting.",
    `- Capability emphasis: ${focusAreas.join("; ")}.`,
    "- CPD need: targeted update and peer discussion on a similar case theme.",
  ].join("\n");
}

function buildActionPlan(focusAreas) {
  const plan = [
    "1. Complete a short focused CPD activity and log one practical change to consultations.",
    "2. Use a structured reflection template in the next relevant case within 2 weeks.",
    "3. Discuss this case theme in supervision or a practice meeting and document feedback.",
  ];

  if (focusAreas.includes("Patient safety and risk management")) {
    plan.push("4. Add a personal checklist for red flags and explicit follow-up advice.");
  }

  return plan.join("\n");
}

function buildCapabilityMapping(focusAreas) {
  const lines = [
    "- Communication and consultation skills: clarified narrative and expectations.",
    "- Clinical management: balanced immediate concerns with uncertainty.",
    "- Maintaining performance, learning and teaching: identified CPD goal from practice.",
    "- Organisation, management and leadership: defined a team feedback step.",
  ];

  focusAreas.forEach((item) => {
    lines.push(`- Additional relevance: ${item}.`);
  });

  return lines.join("\n");
}

function buildAiPrompt(entryType, reflectionText, focusAreas) {
  return [
    "You are a writing assistant for UK GP appraisal entries.",
    "Use a concise, professional tone aligned with common FourteenFish portfolio expectations and RCGP reflective practice themes.",
    "Do not fabricate facts. Keep patient details de-identified. Avoid legal or definitive clinical advice.",
    "Base reflective framing on RCGP principles for meaningful reflection and capability development.",
    "",
    `ENTRY TYPE: ${entryType}`,
    `CLINICIAN INPUT: ${normalizeWhitespace(reflectionText)}`,
    `FOCUS AREAS: ${focusAreas.join("; ")}`,
    "",
    "Return JSON only with exactly these keys:",
    "suggestedTitle (string)",
    "summary (string, max 90 words)",
    "learningPoints (array of 3-5 strings)",
    "actionPlan (array of 3-4 strings)",
    "capabilityLinks (array of 4-6 strings)",
    "",
    "Writing constraints:",
    "- Use plain English and short sentences.",
    "- Keep wording ready to paste into appraisal forms.",
    "- Avoid repetition and generic filler.",
  ].join("\n");
}

function setStatus(message, tone = "") {
  statusLine.textContent = message;
  statusLine.classList.remove("error", "success");
  if (tone) {
    statusLine.classList.add(tone);
  }
}

function clearTroubleshooting() {
  troubleshootList.innerHTML = "";
  troubleshootBox.classList.add("hidden");
}

function renderTroubleshooting(items) {
  troubleshootList.innerHTML = "";
  if (!items.length) {
    troubleshootBox.classList.add("hidden");
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    troubleshootList.appendChild(li);
  });
  troubleshootBox.classList.remove("hidden");
}

function buildTroubleshootingHints(error, provider) {
  const hints = [];
  const status = Number(error?.httpStatus || 0);
  const message = String(error?.message || "").toLowerCase();
  const providerLabel = provider === "azure" ? "Azure OpenAI" : provider === "openrouter" ? "OpenRouter" : "OpenAI";

  if (status === 400) {
    hints.push("The request format was rejected. Confirm endpoint, request path, and model/deployment values.");
    if (provider === "azure") {
      hints.push("For Azure, check deployment name and API version match your resource configuration.");
    }
  }
  if (status === 401) {
    hints.push("Authentication failed. Re-check API key and ensure there are no extra spaces.");
    hints.push(`Confirm the key belongs to the selected provider (${providerLabel}).`);
  }
  if (status === 403) {
    hints.push("Access was denied. Check project permissions, subscription status, or provider policy settings.");
  }
  if (status === 404) {
    hints.push("Endpoint not found. Verify the URL path and region/resource hostname.");
    if (provider === "azure") {
      hints.push("Azure often returns 404 for incorrect deployment names or wrong regional resource endpoints.");
    }
  }
  if (status === 408) {
    hints.push("Request timed out. Retry and check network reliability.");
  }
  if (status === 409) {
    hints.push("Conflict response received. Retry shortly; if persistent, verify provider-side quotas and deployment health.");
  }
  if (status === 422) {
    hints.push("Validation error from provider. Check model identifier and payload constraints.");
  }
  if (status === 429) {
    hints.push("Rate limit exceeded. Wait and retry, reduce frequency, or switch to a lower-latency model.");
  }
  if ([500, 502, 503, 504].includes(status)) {
    hints.push("Provider service is temporarily unavailable. Retry in a minute.");
  }

  if (message.includes("failed to fetch") || message.includes("networkerror")) {
    hints.push("Network/CORS issue detected. If running from local file, provider may block browser-side cross-origin calls.");
    hints.push("If CORS blocks requests, use a small backend proxy to call the provider securely.");
  }

  if (message.includes("valid json") || message.includes("missing required fields")) {
    hints.push("The AI response was not in the expected JSON format. Retry with the same prompt or use a more reliable model.");
  }

  if (!hints.length) {
    hints.push("Check provider settings (endpoint, model/deployment, key) and retry.");
    hints.push("Use Generate Draft Only while AI connectivity is being configured.");
  }

  return hints;
}

function setCopiedState(button) {
  const original = button.textContent;
  button.classList.add("copied");
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.classList.remove("copied");
    button.textContent = original;
  }, 1200);
}

async function copyText(text, button) {
  if (!text.trim()) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      setCopiedState(button);
    }
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    if (button) {
      setCopiedState(button);
    }
  }
}

function allOutputText() {
  return [
    "AI Prompt",
    aiPromptOutput.value,
    "",
    "Suggested Entry Summary",
    summaryOutput.value,
    "",
    "Learning Points",
    learningOutput.value,
    "",
    "Action Plan",
    actionOutput.value,
    "",
    "Capability Mapping",
    capabilityOutput.value,
  ].join("\n");
}

function allOutputMarkdown() {
  return [
    "# AI Insights for Clinicians",
    "",
    "## AI Prompt",
    aiPromptOutput.value,
    "",
    "## Suggested Entry Summary",
    summaryOutput.value,
    "",
    "## Learning Points",
    learningOutput.value,
    "",
    "## Action Plan",
    actionOutput.value,
    "",
    "## Capability Mapping",
    capabilityOutput.value,
  ].join("\n");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function currentTitle() {
  const title = normalizeWhitespace(draftTitleInput.value);
  return title || `reflection-${new Date().toISOString().slice(0, 10)}`;
}

function buildLocalDraftPayload(entryType, reflectionText, focusAreas) {
  return {
    suggestedTitle: currentTitle(),
    summary: buildSummary(entryType, reflectionText),
    learningPoints: buildLearningPoints(reflectionText, focusAreas).split("\n"),
    actionPlan: buildActionPlan(focusAreas).split("\n"),
    capabilityLinks: buildCapabilityMapping(focusAreas).split("\n"),
  };
}

function assignOutputs(payload) {
  const suggestedTitle = normalizeWhitespace(payload.suggestedTitle || "");
  if (suggestedTitle && !normalizeWhitespace(draftTitleInput.value)) {
    draftTitleInput.value = suggestedTitle;
  }

  summaryOutput.value = payload.summary || "";
  learningOutput.value = Array.isArray(payload.learningPoints)
    ? payload.learningPoints.map((item) => `- ${String(item).replace(/^[-\s]+/, "")}`).join("\n")
    : String(payload.learningPoints || "");
  actionOutput.value = Array.isArray(payload.actionPlan)
    ? payload.actionPlan
        .map((item, index) => `${index + 1}. ${String(item).replace(/^\d+\.\s*/, "")}`)
        .join("\n")
    : String(payload.actionPlan || "");
  capabilityOutput.value = Array.isArray(payload.capabilityLinks)
    ? payload.capabilityLinks.map((item) => `- ${String(item).replace(/^[-\s]+/, "")}`).join("\n")
    : String(payload.capabilityLinks || "");
}

function extractJsonBlock(text) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }
  return text.slice(first, last + 1);
}

function parseAiResponse(text) {
  const direct = text.trim();
  const jsonCandidate = direct.startsWith("{") ? direct : extractJsonBlock(direct);
  if (!jsonCandidate) {
    throw new Error("AI response did not include valid JSON.");
  }

  const parsed = JSON.parse(jsonCandidate);
  if (!parsed.summary || !parsed.learningPoints || !parsed.actionPlan || !parsed.capabilityLinks) {
    throw new Error("AI response JSON is missing required fields.");
  }
  return parsed;
}

async function sendAiRequest(prompt) {
  const provider = providerInput.value;
  const endpoint = normalizeWhitespace(apiEndpointInput.value);
  const model = normalizeWhitespace(modelNameInput.value);
  const apiKey = normalizeWhitespace(apiKeyInput.value);
  const apiVersion = normalizeWhitespace(apiVersionInput.value);
  const deploymentName = normalizeWhitespace(deploymentNameInput.value);
  const siteUrl = normalizeWhitespace(siteUrlInput.value);
  const appName = normalizeWhitespace(appNameInput.value);

  if (!endpoint || !apiKey) {
    throw new Error("API endpoint and API key are required for AI generation.");
  }

  if ((provider === "openai" || provider === "openrouter") && !model) {
    throw new Error("Model name is required for the selected provider.");
  }

  const messages = [
    {
      role: "system",
      content:
        "You are a UK GP appraisal writing assistant. Return strict JSON only, no markdown fences.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  let requestUrl = endpoint;
  const headers = {
    "Content-Type": "application/json",
  };
  let body = {};

  if (provider === "azure") {
    const version = apiVersion || "2024-02-15-preview";
    const cleanEndpoint = endpoint.replace(/\/+$/, "");
    if (deploymentName && !cleanEndpoint.includes("/deployments/")) {
      requestUrl = `${cleanEndpoint}/openai/deployments/${encodeURIComponent(
        deploymentName,
      )}/chat/completions`;
    } else {
      requestUrl = cleanEndpoint;
    }

    if (!/api-version=/.test(requestUrl)) {
      requestUrl += requestUrl.includes("?") ? `&api-version=${encodeURIComponent(version)}` : `?api-version=${encodeURIComponent(version)}`;
    }

    headers["api-key"] = apiKey;
    body = {
      temperature: 0.3,
      messages,
    };
  } else if (provider === "openrouter") {
    headers.Authorization = `Bearer ${apiKey}`;
    if (siteUrl) {
      headers["HTTP-Referer"] = siteUrl;
    }
    if (appName) {
      headers["X-Title"] = appName;
    }
    body = {
      model,
      temperature: 0.3,
      messages,
    };
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      temperature: 0.3,
      messages,
    };
  }

  let response;
  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    const networkError = new Error(`AI request could not be completed: ${error.message || "network error"}`);
    networkError.provider = provider;
    throw networkError;
  }

  if (!response.ok) {
    const text = await response.text();
    const httpError = new Error(`AI request failed (${response.status}): ${text.slice(0, 240)}`);
    httpError.httpStatus = response.status;
    httpError.provider = provider;
    httpError.responseText = text;
    throw httpError;
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message?.content;
  if (!message) {
    throw new Error("AI response was empty.");
  }

  return {
    message,
    provider,
    model,
  };
}

async function invokeAi(prompt) {
  const { message } = await sendAiRequest(prompt);

  return parseAiResponse(message);
}

async function testConnection() {
  clearTroubleshooting();
  setStatus("Testing AI connection...");
  testConnectionBtn.disabled = true;

  try {
    const { provider, model } = await sendAiRequest(
      "Reply with exactly CONNECTION_OK and no other text.",
    );
    const modelLabel = model ? ` (${model})` : "";
    setStatus(`Connection successful for ${provider}${modelLabel}.`, "success");
    saveLastConnection({
      provider,
      model,
      timestamp: new Date().toISOString(),
    });
    saveSettingsIfNeeded();
  } catch (error) {
    renderTroubleshooting(buildTroubleshootingHints(error, providerInput.value));
    setStatus(`Connection test failed. ${error.message}`, "error");
  } finally {
    testConnectionBtn.disabled = false;
  }
}

function readDrafts() {
  const raw = localStorage.getItem(DRAFTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function renderDraftHistory() {
  const drafts = readDrafts();
  if (!drafts.length) {
    historyList.innerHTML = "<p class=\"history-meta\">No saved versions yet.</p>";
    return;
  }

  historyList.innerHTML = "";

  drafts
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .forEach((draft) => {
      const item = document.createElement("article");
      item.className = "history-item";

      const meta = document.createElement("p");
      meta.className = "history-meta";
      meta.textContent = `${new Date(draft.savedAt).toLocaleString()} - ${draft.entryType}`;

      const title = document.createElement("p");
      title.className = "history-title";
      title.textContent = draft.title || "Untitled draft";

      const actions = document.createElement("div");
      actions.className = "history-actions";

      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "ghost-btn";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        restoreDraft(draft.id);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "ghost-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        deleteDraft(draft.id);
      });

      actions.appendChild(loadBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(meta);
      item.appendChild(title);
      item.appendChild(actions);
      historyList.appendChild(item);
    });
}

function saveCurrentDraft() {
  const reflectionText = normalizeWhitespace(reflectionInput.value);
  if (!reflectionText || !summaryOutput.value.trim()) {
    setStatus("Generate output before saving a version.", "error");
    return;
  }

  const drafts = readDrafts();
  const item = {
    id: crypto.randomUUID(),
    title: currentTitle(),
    entryType: entryTypeInput.value,
    reflectionText,
    aiPrompt: aiPromptOutput.value,
    summary: summaryOutput.value,
    learning: learningOutput.value,
    action: actionOutput.value,
    capability: capabilityOutput.value,
    savedAt: new Date().toISOString(),
  };

  drafts.push(item);
  writeDrafts(drafts);
  renderDraftHistory();
  setStatus("Version saved to local history.", "success");
}

function restoreDraft(id) {
  const draft = readDrafts().find((item) => item.id === id);
  if (!draft) {
    return;
  }

  draftTitleInput.value = draft.title;
  entryTypeInput.value = draft.entryType;
  reflectionInput.value = draft.reflectionText;
  aiPromptOutput.value = draft.aiPrompt;
  summaryOutput.value = draft.summary;
  learningOutput.value = draft.learning;
  actionOutput.value = draft.action;
  capabilityOutput.value = draft.capability;
  outputSection.classList.remove("hidden");
  setStatus("Saved version restored.", "success");
}

function deleteDraft(id) {
  const remaining = readDrafts().filter((item) => item.id !== id);
  writeDrafts(remaining);
  renderDraftHistory();
  setStatus("Saved version deleted.", "success");
}

function saveSettingsIfNeeded() {
  if (!rememberSettingsInput.checked) {
    localStorage.removeItem(SETTINGS_KEY);
    return;
  }

  const data = {
    provider: providerInput.value,
    endpoint: normalizeWhitespace(apiEndpointInput.value),
    model: normalizeWhitespace(modelNameInput.value),
    apiVersion: normalizeWhitespace(apiVersionInput.value),
    deployment: normalizeWhitespace(deploymentNameInput.value),
    siteUrl: normalizeWhitespace(siteUrlInput.value),
    appName: normalizeWhitespace(appNameInput.value),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

function renderModelTemplates(provider) {
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openai;
  const models = Array.isArray(preset.models) ? preset.models : [];
  const currentModel = normalizeWhitespace(modelNameInput.value);

  modelTemplatesEl.innerHTML = "";
  if (!models.length) {
    return;
  }

  models.forEach((model) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "model-chip";
    button.textContent = model;
    if (currentModel === model) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      modelNameInput.value = model;
      renderModelTemplates(providerInput.value);
      saveSettingsIfNeeded();
      setStatus(`Model template applied: ${model}`);
    });
    modelTemplatesEl.appendChild(button);
  });
}

function setProviderVisibility(provider) {
  const allProviderRows = Array.from(document.querySelectorAll(".provider-row"));
  allProviderRows.forEach((element) => {
    element.classList.add("hidden-row");
  });

  const visibleRows = Array.from(document.querySelectorAll(`.provider-${provider}`));
  visibleRows.forEach((element) => {
    element.classList.remove("hidden-row");
  });

  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openai;
  providerHint.textContent = preset.hint;
  renderModelTemplates(provider);
}

function applyProviderPreset(provider, force) {
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openai;
  if (force || !normalizeWhitespace(apiEndpointInput.value)) {
    apiEndpointInput.value = preset.endpoint;
  }
  if (force || !normalizeWhitespace(modelNameInput.value)) {
    modelNameInput.value = preset.model;
  }
  setProviderVisibility(provider);
}

function loadSavedSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    applyProviderPreset(providerInput.value, false);
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed.provider) {
      providerInput.value = parsed.provider;
    }
    if (parsed.endpoint) {
      apiEndpointInput.value = parsed.endpoint;
    }
    if (parsed.model) {
      modelNameInput.value = parsed.model;
    }
    if (parsed.apiVersion) {
      apiVersionInput.value = parsed.apiVersion;
    }
    if (parsed.deployment) {
      deploymentNameInput.value = parsed.deployment;
    }
    if (parsed.siteUrl) {
      siteUrlInput.value = parsed.siteUrl;
    }
    if (parsed.appName) {
      appNameInput.value = parsed.appName;
    }
    rememberSettingsInput.checked = true;
    setProviderVisibility(providerInput.value);
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
    applyProviderPreset(providerInput.value, false);
  }
}

function clearOutputs() {
  aiPromptOutput.value = "";
  summaryOutput.value = "";
  learningOutput.value = "";
  actionOutput.value = "";
  capabilityOutput.value = "";
  outputSection.classList.add("hidden");
}

async function generate(mode) {
  const reflectionText = normalizeWhitespace(reflectionInput.value);
  const entryType = entryTypeInput.value;

  if (!reflectionText) {
    reflectionInput.focus();
    setStatus("Enter a reflection prompt to continue.", "error");
    return;
  }

  activeMode = mode;
  generateBtn.disabled = true;
  generateDraftBtn.disabled = true;
  clearTroubleshooting();
  setStatus(mode === "ai" ? "Generating with AI..." : "Generating draft template...");

  const focusAreas = detectFocusAreas(reflectionText);
  const prompt = buildAiPrompt(entryType, reflectionText, focusAreas);
  aiPromptOutput.value = prompt;

  try {
    if (mode === "ai") {
      const payload = await invokeAi(prompt);
      assignOutputs(payload);
      setStatus("AI output generated successfully.", "success");
      clearTroubleshooting();
    } else {
      assignOutputs(buildLocalDraftPayload(entryType, reflectionText, focusAreas));
      setStatus("Draft template generated.", "success");
      clearTroubleshooting();
    }
  } catch (error) {
    assignOutputs(buildLocalDraftPayload(entryType, reflectionText, focusAreas));
    renderTroubleshooting(buildTroubleshootingHints(error, providerInput.value));
    setStatus(`AI unavailable. Draft template generated instead. ${error.message}`, "error");
  } finally {
    outputSection.classList.remove("hidden");
    outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
    generateBtn.disabled = false;
    generateDraftBtn.disabled = false;
    saveSettingsIfNeeded();
  }
}

function exportTxt() {
  if (!summaryOutput.value.trim()) {
    setStatus("Generate output before exporting.", "error");
    return;
  }
  downloadFile(`${safeFilename(currentTitle()) || "ai-insights"}.txt`, allOutputText(), "text/plain");
  setStatus("TXT export downloaded.", "success");
}

function exportMd() {
  if (!summaryOutput.value.trim()) {
    setStatus("Generate output before exporting.", "error");
    return;
  }
  downloadFile(`${safeFilename(currentTitle()) || "ai-insights"}.md`, allOutputMarkdown(), "text/markdown");
  setStatus("Markdown export downloaded.", "success");
}

function exportPdf() {
  if (!summaryOutput.value.trim()) {
    setStatus("Generate output before exporting.", "error");
    return;
  }

  const jspdfNs = window.jspdf;
  if (!jspdfNs || !jspdfNs.jsPDF) {
    setStatus("PDF library not available. Check network access and retry.", "error");
    return;
  }

  const { jsPDF } = jspdfNs;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 42;
  const top = 52;
  const width = 510;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("AI Insights for Clinicians", left, top);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const lines = doc.splitTextToSize(allOutputText(), width);
  doc.text(lines, left, top + 24);

  doc.save(`${safeFilename(currentTitle()) || "ai-insights"}.pdf`);
  setStatus("PDF export downloaded.", "success");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await generate("ai");
});

generateDraftBtn.addEventListener("click", async () => {
  await generate("draft");
});

clearBtn.addEventListener("click", () => {
  form.reset();
  draftTitleInput.value = "";
  apiKeyInput.value = "";
  clearOutputs();
  clearTroubleshooting();
  setStatus("Form cleared.");
  reflectionInput.focus();
});

copyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.getAttribute("data-copy-target");
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) {
      return;
    }
    copyText(target.value, button);
  });
});

copyAllBtn.addEventListener("click", () => {
  copyText(allOutputText(), copyAllBtn);
});

saveDraftBtn.addEventListener("click", () => {
  saveCurrentDraft();
});

exportTxtBtn.addEventListener("click", () => {
  exportTxt();
});

exportMdBtn.addEventListener("click", () => {
  exportMd();
});

exportPdfBtn.addEventListener("click", () => {
  exportPdf();
});

apiEndpointInput.addEventListener("change", saveSettingsIfNeeded);
modelNameInput.addEventListener("change", saveSettingsIfNeeded);
modelNameInput.addEventListener("input", () => {
  renderModelTemplates(providerInput.value);
});
rememberSettingsInput.addEventListener("change", saveSettingsIfNeeded);
providerInput.addEventListener("change", () => {
  applyProviderPreset(providerInput.value, true);
  saveSettingsIfNeeded();
});
apiVersionInput.addEventListener("change", saveSettingsIfNeeded);
deploymentNameInput.addEventListener("change", saveSettingsIfNeeded);
siteUrlInput.addEventListener("change", saveSettingsIfNeeded);
appNameInput.addEventListener("change", saveSettingsIfNeeded);
testConnectionBtn.addEventListener("click", async () => {
  await testConnection();
});
clearConnectionBtn.addEventListener("click", () => {
  clearLastConnection();
});

loadSavedSettings();
loadLastConnection();
renderDraftHistory();
clearTroubleshooting();
setStatus("Ready. Add reflection details and generate insights.");
