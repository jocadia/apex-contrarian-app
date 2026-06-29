import * as findFrameworkFootball from './find-framework-football.js';
import * as findFrameworkBasketball from './find-framework-basketball.js';
import * as findFrameworkTennis from './find-framework-tennis.js';

function extractJSON(text) {
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = clean.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (_) { }
  }

  try {
    return JSON.parse(clean);
  } catch (_) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_) { }
    }
    throw new Error('Could not extract valid JSON from response.');
  }
}

export async function analyzeMatch(apiKey, teamA, teamB, competition, frameworkPrompt) {
  let modelName = localStorage.getItem('apex_best_model');
  if (!modelName || !modelName.startsWith('models/')) {
    modelName = 'models/gemini-2.5-flash';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
  const promptText = frameworkPrompt.buildUserPrompt(teamA, teamB, competition);

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: frameworkPrompt.SYSTEM_PROMPT },
          { text: promptText }
        ]
      }
    ],
    generationConfig: { temperature: 0.2 },
    tools: [{ googleSearch: {} }]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorBody = {};
      try { errorBody = await response.json(); } catch (_) {}
      const msg = errorBody.error?.message || response.statusText;
      console.error('API Error:', response.status, msg, errorBody);
      if (response.status === 429) throw new Error(`API_QUOTA_EXHAUSTED: ${msg}`);
      if (response.status === 400) throw new Error(`Bad Request: ${msg}`);
      if (response.status === 403) throw new Error(`API_KEY_INVALID: ${msg}`);
      throw new Error(`API Error ${response.status}: ${msg}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("No response generated.");

    const responseText = candidate.content?.parts?.[0]?.text;
    if (!responseText) throw new Error("Empty response.");

    return extractJSON(responseText);

  } catch (error) {
    console.error('analyzeMatch error:', error);
    throw error;
  }
}

export async function validateApiKey(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    const usable = (data.models || []).filter(m =>
      m.supportedGenerationMethods?.includes('generateContent') &&
      m.name.includes('gemini') &&
      !/embedding|image|imagen|tts|audio|live|vision|robotics|veo|lyria/i.test(m.name)
    );
    const preferred = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro'];
    let best = null;
    for (const p of preferred) {
      best = usable.find(m => m.name.endsWith(p));
      if (best) break;
    }
    if (!best && usable.length) best = usable[0];
    if (best) {
      localStorage.setItem('apex_best_model', best.name);
    } else {
      localStorage.removeItem('apex_best_model');
    }
    return true;
  } catch {
    return false;
  }
}

export async function findMatches(apiKey, numMatches, riskLevel, markets, timeWindowHours, sport) {
  let modelName = localStorage.getItem('apex_best_model');
  if (!modelName || !modelName.startsWith('models/')) {
    modelName = 'models/gemini-2.5-flash';
  }

  let promptModule;
  switch (sport) {
    case 'basketball':
      promptModule = findFrameworkBasketball;
      break;
    case 'tennis':
      promptModule = findFrameworkTennis;
      break;
    default:
      promptModule = findFrameworkFootball;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
  const promptText = promptModule.buildUserPrompt(numMatches, riskLevel, markets, timeWindowHours);

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: promptModule.SYSTEM_PROMPT },
          { text: promptText }
        ]
      }
    ],
    generationConfig: { temperature: 0.2 },
    tools: [{ googleSearch: {} }]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorBody = {};
      try { errorBody = await response.json(); } catch (_) {}
      const msg = errorBody.error?.message || response.statusText;
      console.error('API Error:', response.status, msg, errorBody);
      if (response.status === 429) throw new Error(`API_QUOTA_EXHAUSTED: ${msg}`);
      if (response.status === 400) throw new Error(`Bad Request: ${msg}`);
      if (response.status === 403) throw new Error(`API_KEY_INVALID: ${msg}`);
      throw new Error(`API Error ${response.status}: ${msg}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("No response generated.");

    const responseText = candidate.content?.parts?.[0]?.text;
    if (!responseText) throw new Error("Empty response.");

    try {
      return extractJSON(responseText);
    } catch (jsonError) {
      const lower = responseText.toLowerCase();
      if (lower.includes('no matches') || lower.includes('not found') || lower.includes('could not find') || lower.includes('no fixtures')) {
        return { matches: [], message: 'No matches found within the time window matching your criteria.' };
      }
      throw jsonError;
    }

  } catch (error) {
    console.error('findMatches error:', error);
    throw error;
  }
}