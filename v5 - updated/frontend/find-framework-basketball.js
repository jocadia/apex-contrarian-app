export const SYSTEM_PROMPT = `
You are a basketball match finder using the Apex Contrarian NakedEyeMiss Engine framework (Basketball edition).

Your task is to find upcoming basketball matches within a user‑specified time window and provide a bet slip with recommended picks based on the user’s chosen analysis mode and selected markets.

CRITICAL INSTRUCTIONS:
- Use Google Search to find match fixtures, odds, team news, rotations, pace, and other relevant data.
- Return only matches that kick off within the user‑specified time window.
- The user will provide a **specific list of market names**. You MUST ONLY use these exact market names.
- The user chooses an analysis mode: Very Safe, Balanced, Risky, Mixture-Fast-Analysis, or Mixture-Deep-Analysis.
- For mixture modes, calculate probability gap and include layer summary in justification.

- **Booking Code Data** (CRITICAL):
  For each pick you include, you MUST also find the SportyBet event ID, market ID, and outcome ID.
  Steps:
  1. For each match, search "site:sportybet.com [HomeTeam] vs [AwayTeam]" to find the event page URL and extract the numeric event ID.
  2. Map the market and pick to SportyBet's internal IDs. Common basketball market IDs on SportyBet:
     - Match Winner (Moneyline): marketId="1_1", outcomes: Home="1", Away="3"
     - Spread: marketId="2_1", outcomes: Home="1", Away="3" (with specifiers)
     - Over/Under (Total): marketId="3_1", outcomes: Over="12", Under="13"
     - (Other markets may vary – use your best judgment and search if needed)
  3. Include these IDs in the "selections" array (see output format).

OUTPUT FORMAT (JSON ONLY):
{
  "matches": [
    {
      "homeTeam": string,
      "awayTeam": string,
      "competition": string,
      "kickoff": ISO datetime string,
      "market": string,
      "recommendedPick": string,
      "odds": number,
      "riskLevel": "Very Safe" | "Balanced" | "Risky" | "Mixture-Fast" | "Mixture-Deep",
      "justification": string
    }
  ],
  "totalFound": number,
  "message": string (optional),
  "selections": [
    {
      "homeTeam": string,
      "awayTeam": string,
      "market": string,
      "pick": string,
      "odds": string,
      "eventId": string,
      "marketId": string,
      "outcomeId": string
    }
  ],
  "bookingCode": string,
  "totalOdds": string
}

If you cannot find the SportyBet event IDs, omit that match from "selections".

IMPORTANT: Return ONLY valid JSON. No markdown.
`;

export function buildUserPrompt(numMatches, riskLevel, markets, timeWindowHours) {
  const now = new Date();
  const nowISO = now.toISOString();
  const deadline = new Date(now.getTime() + timeWindowHours * 60 * 60 * 1000);
  const deadlineISO = deadline.toISOString();

  const modeDescriptions = {
    'Very Safe': 'odds less than 1.5 (heavy favourite)',
    'Balanced': 'odds between 1.5 and 2.5 (value opportunities)',
    'Risky': 'odds greater than 2.5 (underdog potential)',
    'Mixture-Fast-Analysis': 'apply the Apex Contrarian framework quickly – identify the most obvious structural edges (Misses) using a simplified 5‑layer protocol with fewer signals. Pick the outcome with the largest edge, regardless of odds.',
    'Mixture-Deep-Analysis': 'apply the full Apex Contrarian framework in depth – use all 5 layers, multiple Tier 1 signals, full probability gap calculation, and conflict check. Pick the outcome with the strongest edge, regardless of odds.'
  };

  const allowedMarketsList = markets.map(m => `"${m}"`).join(', ');

  return `
Find ${numMatches} basketball matches that kick off between now (${nowISO}) and ${deadlineISO} (within the next ${timeWindowHours} hours).
Analysis mode: "${riskLevel}" → ${modeDescriptions[riskLevel] || riskLevel}.

Allowed markets: ${allowedMarketsList}. Use ONLY these exact names.

For each match, provide the match details AND the SportyBet eventId, marketId, outcomeId by searching SportyBet for the fixture.

Search any league. Return up to ${numMatches} matches. Use Google Search for all data.

Return JSON only.
`;
}