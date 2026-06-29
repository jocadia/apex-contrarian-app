import { analyzeMatch, validateApiKey, findMatches } from './api.js';
import { renderDashboard, renderBetSlip, getSlipData, escapeHtml as escHtml } from './components.js';
import * as frameworkPrompt from './framework-prompt.js';

// DOM refs
const els = {
  landing: document.getElementById('landing'),
  setupModal: document.getElementById('setupModal'),
  matchInput: document.getElementById('matchInput'),
  loadingSection: document.getElementById('loadingSection'),
  resultsSection: document.getElementById('resultsSection'),
  historyPanel: document.getElementById('historyPanel'),
  navbar: document.getElementById('navbar'),
  backBtn: document.getElementById('backBtn'),
  historyBtn: document.getElementById('historyBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  ctaBtn: document.getElementById('ctaBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  keyToggle: document.getElementById('keyToggle'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  setupError: document.getElementById('setupError'),
  teamAInput: document.getElementById('teamAInput'),
  teamBInput: document.getElementById('teamBInput'),
  competitionInput: document.getElementById('competitionInput'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  loadingMatch: document.getElementById('loadingMatch'),
  loadingSteps: document.querySelectorAll('.loading-step'),
  resultsContainer: document.getElementById('resultsContainer'),
  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),
  findMatchesSection: document.getElementById('findMatchesSection'),
  findMatchesForm: document.getElementById('findMatchesForm'),
  sportSelect: document.getElementById('sportSelect'),
  numMatches: document.getElementById('numMatches'),
  riskLevel: document.getElementById('riskLevel'),
  timeWindow: document.getElementById('timeWindow'),
  markets: document.getElementById('markets'),
  findMatchesSubmitBtn: document.getElementById('findMatchesSubmitBtn'),
  findMatchesLoading: document.getElementById('findMatchesLoading'),
  findMatchesEstimate: document.getElementById('findMatchesEstimate'),
  findMatchesResults: document.getElementById('findMatchesResults'),
  findMatchesError: document.getElementById('findMatchesError'),
  findMatchesCtaBtn: document.getElementById('findMatchesCtaBtn'),
  findMatchesNavBtn: document.getElementById('findMatchesNavBtn'),
};

let currentApiKey = localStorage.getItem('apex_gemini_key') || '';
let analysisHistory = JSON.parse(localStorage.getItem('apex_history') || '[]');
let isAnalyzing = false;
let currentFindResult = null;

// Proxy URL – now relative to the same server
const PROXY_URL = '/api/book';

function showView(viewId) {
  ['landing', 'matchInput', 'loadingSection', 'resultsSection', 'historyPanel', 'findMatchesSection'].forEach(id => {
    els[id].classList.add('hidden');
  });
  els[viewId].classList.remove('hidden');
  els.navbar.classList.remove('hidden');
  els.backBtn.classList.toggle('hidden', viewId !== 'resultsSection' && viewId !== 'historyPanel' && viewId !== 'matchInput');
}

function enableAnalyzeButton() {
  els.analyzeBtn.disabled = false;
  els.analyzeBtn.querySelector('.analyze-text').textContent = 'ANALYZE MATCH';
  isAnalyzing = false;
}

function disableAnalyzeButton(text = 'Analyzing...') {
  els.analyzeBtn.disabled = true;
  els.analyzeBtn.querySelector('.analyze-text').textContent = text;
  isAnalyzing = true;
}

els.ctaBtn.addEventListener('click', () => {
  if (!currentApiKey) els.setupModal.classList.remove('hidden');
  else showView('matchInput');
});

els.keyToggle.addEventListener('click', () => {
  els.apiKeyInput.type = els.apiKeyInput.type === 'password' ? 'text' : 'password';
});

els.saveKeyBtn.addEventListener('click', async () => {
  const key = els.apiKeyInput.value.trim();
  if (!key) return showError('Enter an API key.');
  els.saveKeyBtn.textContent = 'Validating...';
  els.saveKeyBtn.disabled = true;
  try {
    const valid = await validateApiKey(key);
    if (valid) {
      currentApiKey = key;
      localStorage.setItem('apex_gemini_key', key);
      els.setupModal.classList.add('hidden');
      showView('matchInput');
    } else {
      showError('Invalid API key. Try again.');
    }
  } catch {
    showError('Network error.');
  } finally {
    els.saveKeyBtn.textContent = 'Save & Continue';
    els.saveKeyBtn.disabled = false;
  }
});

function showError(msg) {
  els.setupError.textContent = msg;
  els.setupError.classList.remove('hidden');
  setTimeout(() => els.setupError.classList.add('hidden'), 5000);
}

function checkInputs() {
  const ta = els.teamAInput.value.trim();
  const tb = els.teamBInput.value.trim();
  els.analyzeBtn.disabled = !(ta && tb) || isAnalyzing;
}
els.teamAInput.addEventListener('input', checkInputs);
els.teamBInput.addEventListener('input', checkInputs);

function startLoadingState(ta, tb) {
  showView('loadingSection');
  els.loadingMatch.textContent = `${ta} vs ${tb}`;
  els.loadingSteps.forEach(el => el.classList.remove('active', 'done'));
  let step = 0;
  els.loadingSteps[0].classList.add('active');
  const timer = setInterval(() => {
    if (step < 4) {
      els.loadingSteps[step].classList.remove('active');
      els.loadingSteps[step].classList.add('done');
      step++;
      els.loadingSteps[step].classList.add('active');
    } else {
      clearInterval(timer);
    }
  }, 3500);
}

els.analyzeBtn.addEventListener('click', async () => {
  if (isAnalyzing || els.analyzeBtn.disabled) return;

  const teamA = els.teamAInput.value.trim();
  const teamB = els.teamBInput.value.trim();
  const comp = els.competitionInput.value.trim();
  if (!teamA || !teamB) return;

  disableAnalyzeButton('Analyzing...');
  startLoadingState(teamA, teamB);

  try {
    const result = await analyzeMatch(currentApiKey, teamA, teamB, comp, frameworkPrompt);
    saveToHistory(teamA, teamB, comp, result);
    els.resultsContainer.innerHTML = renderDashboard(result);
    showView('resultsSection');
  } catch (error) {
    console.error(error);
    let msg = error.message || 'Unknown error';
    if (msg.includes('API_QUOTA_EXHAUSTED')) {
      msg = 'Too Many Requests – please wait 60 seconds and try again.';
    } else if (msg.includes('API_KEY_INVALID')) {
      alert('Your API key is invalid. Please update it in settings.');
      currentApiKey = '';
      localStorage.removeItem('apex_gemini_key');
      showView('landing');
      enableAnalyzeButton();
      return;
    }
    els.resultsContainer.innerHTML = `
      <div class="error-card glass-card">
        <h3>Analysis Failed</h3>
        <p>${escapeHtml(msg)}</p>
        <button class="nav-btn" onclick="document.getElementById('backBtn').click()">Try Again</button>
      </div>
    `;
    showView('resultsSection');
  } finally {
    enableAnalyzeButton();
  }
});

els.backBtn.addEventListener('click', () => showView('matchInput'));
els.settingsBtn.addEventListener('click', () => {
  els.apiKeyInput.value = currentApiKey;
  els.setupModal.classList.remove('hidden');
});
document.getElementById('setupOverlay').addEventListener('click', () => {
  if (currentApiKey) els.setupModal.classList.add('hidden');
});

els.historyBtn.addEventListener('click', () => {
  renderHistoryList();
  showView('historyPanel');
});

function saveToHistory(ta, tb, comp, result) {
  const record = { id: Date.now().toString(), date: new Date().toLocaleDateString(), teamA: ta, teamB: tb, competition: comp, result };
  analysisHistory.unshift(record);
  if (analysisHistory.length > 20) analysisHistory = analysisHistory.slice(0, 20);
  localStorage.setItem('apex_history', JSON.stringify(analysisHistory));
}

function renderHistoryList() {
  if (!analysisHistory.length) {
    els.historyList.classList.add('hidden');
    els.historyEmpty.classList.remove('hidden');
    return;
  }
  els.historyEmpty.classList.add('hidden');
  els.historyList.classList.remove('hidden');
  els.historyList.innerHTML = analysisHistory.map(item => `
    <div class="history-item glass-card" data-id="${item.id}">
      <div class="history-item-top">
        <span class="history-date">${item.date}</span>
        <span class="badge ${item.result.pass ? 'badge-pass' : 'badge-misses'}">${item.result.pass ? 'PASS' : (item.result.misses?.length || 0) + ' Misses'}</span>
      </div>
      <h3>${escapeHtml(item.teamA)} vs ${escapeHtml(item.teamB)}</h3>
      <p class="text-muted">${escapeHtml(item.competition || 'No competition')}</p>
      <button class="view-history-btn" onclick="window.loadHistoryItem('${item.id}')">View Analysis</button>
    </div>
  `).join('');
}

window.loadHistoryItem = (id) => {
  const item = analysisHistory.find(i => i.id === id);
  if (item) {
    els.resultsContainer.innerHTML = renderDashboard(item.result);
    showView('resultsSection');
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== Find Matches ==========

const marketOptions = {
  football: [
    'Match Winner', 'Over/Under 2.5', 'Both Teams to Score (BTTS)',
    'Double Chance', 'Asian Handicap', 'Over/Under 1.5', 'Over/Under 3.5',
    'First Half Winner', 'First Half Over/Under 0.5', 'First Half BTTS',
    'Draw No Bet', 'Win to Nil',
    'Home Win or Over 2.5',
    'Away Win or Over 2.5',
    'Draw or Over 2.5',
    'Home Win or Under 2.5',
    'Away Win or Under 2.5',
    'Draw or Under 2.5',
    'Any team to Score 2+ Goals in a Row',
    'Any team to Score 3+ Goals in a Row'
  ],
  basketball: [
    'Match Winner (Moneyline)', 'Spread', 'Over/Under (Total)',
    'Team Total', 'Player Points', 'Player Rebounds', 'Player Assists',
    'First Half Spread', 'First Half Total', 'Quarter Spread', 'Quarter Total'
  ],
  tennis: [
    'Match Winner', 'Set Handicap', 'Total Games', 'Set Total',
    'Any Set to Tiebreak', 'Correct Set Score', 'Player Aces', 'Player Double Faults',
    'First Set Winner', 'Break Points', 'Total Sets'
  ]
};

function updateMarkets() {
  const sport = els.sportSelect.value;
  const options = marketOptions[sport] || [];
  const select = els.markets;
  select.innerHTML = '';
  options.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    if (options.indexOf(m) < 3 && !m.includes(' or ')) {
      opt.selected = true;
    } else if (m === 'Match Winner' || m === 'Over/Under 2.5' || m === 'Both Teams to Score (BTTS)') {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

els.sportSelect.addEventListener('change', updateMarkets);
updateMarkets();

els.findMatchesCtaBtn.addEventListener('click', () => {
  if (!currentApiKey) els.setupModal.classList.remove('hidden');
  else showView('findMatchesSection');
});

els.findMatchesNavBtn.addEventListener('click', () => {
  if (!currentApiKey) els.setupModal.classList.remove('hidden');
  else showView('findMatchesSection');
});

els.findMatchesForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentApiKey) {
    els.setupModal.classList.remove('hidden');
    return;
  }

  const numMatches = parseInt(els.numMatches.value);
  const riskLevel = els.riskLevel.value;
  const timeWindowHours = parseFloat(els.timeWindow.value);
  const sport = els.sportSelect.value;
  const selectedMarkets = Array.from(els.markets.selectedOptions).map(opt => opt.value);

  if (selectedMarkets.length === 0) {
    els.findMatchesError.textContent = 'Please select at least one market.';
    els.findMatchesError.classList.remove('hidden');
    return;
  }

  els.findMatchesResults.classList.add('hidden');
  els.findMatchesError.classList.add('hidden');
  els.findMatchesLoading.classList.remove('hidden');

  const estimate = 5 + numMatches * 2;
  els.findMatchesEstimate.textContent = `Searching for matches... estimated time: ~${estimate} seconds`;

  try {
    const result = await findMatches(currentApiKey, numMatches, riskLevel, selectedMarkets, timeWindowHours, sport);
    currentFindResult = result;
    if (result && result.matches && result.matches.length > 0) {
      const slipHtml = renderBetSlip(result.matches);
      els.findMatchesResults.innerHTML = slipHtml;
      els.findMatchesResults.classList.remove('hidden');

      // Store booking data (including selections with event IDs) for the proxy
      const allKey = 'slip_all_' + Date.now();
      if (!window._bookingData) window._bookingData = {};
      window._bookingData[allKey] = {
        selections: result.selections || [],
        bookingCode: result.bookingCode || null,
        totalOdds: result.totalOdds || 'N/A',
        error: result.error || null
      };
      // Also store per-match keys
      if (result.selections && result.selections.length > 0) {
        result.selections.forEach((sel, idx) => {
          const singleKey = 'slip_' + allKey + '_' + idx;
          window._bookingData[singleKey] = {
            selections: [sel],
            bookingCode: null,
            totalOdds: sel.odds || 'N/A',
            error: null
          };
        });
      }
    } else {
      els.findMatchesResults.innerHTML = `<p class="text-muted">${result.message || 'No matches found within the time window matching your criteria.'}</p>`;
      els.findMatchesResults.classList.remove('hidden');
    }
  } catch (error) {
    let msg = error.message || 'Unknown error';
    if (msg.includes('API_QUOTA_EXHAUSTED')) {
      msg = 'Too Many Requests – please wait and try again.';
    } else if (msg.includes('API_KEY_INVALID')) {
      alert('Your API key is invalid. Please update it in settings.');
      currentApiKey = '';
      localStorage.removeItem('apex_gemini_key');
      showView('landing');
      return;
    }
    els.findMatchesError.textContent = msg;
    els.findMatchesError.classList.remove('hidden');
  } finally {
    els.findMatchesLoading.classList.add('hidden');
  }
});

// ========== SportyBet Booking via Proxy ==========

async function fetchBookingFromProxy(selections) {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selections })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Proxy request failed');
  }

  return response.json();
}

function buildSuccessModalHtml(result) {
  const rows = (result.selections || []).map(s => `
    <div class="booking-selection-row">
      <span class="booking-teams">${escHtml(s.homeTeam || '')} vs ${escHtml(s.awayTeam || '')}</span>
      <span class="booking-pick">${escHtml(s.market || '')} — ${escHtml(s.pick || '')} @ ${escHtml(String(s.odds || ''))}</span>
    </div>
  `).join('');

  const code = result.bookingCode || '';

  return `
    <div class="booking-success">
      <div class="booking-icon">🎟️</div>
      <h3>Booking Code Ready!</h3>
      <div class="booking-code-display">
        <span id="booking-code-text">${escHtml(code)}</span>
        <button class="copy-code-btn" id="copy-code-btn">📋 Copy</button>
      </div>
      <p class="booking-instructions">
        Go to <a href="https://www.sportybet.com/ng" target="_blank" rel="noopener" class="step-link">sportybet.com/ng</a>,
        tap <strong>Booking Code</strong> in the menu, enter this code and your slip loads instantly.
      </p>
      <div class="booking-summary">
        <div class="booking-total-odds">Combined Odds: <strong>${escHtml(String(result.totalOdds || 'N/A'))}</strong></div>
        <div class="booking-selections">${rows}</div>
      </div>
    </div>
  `;
}

// Modal functions
(function initBookingModal() {
  const modal = document.createElement('div');
  modal.id = 'sportybet-modal';
  modal.className = 'sportybet-modal hidden';
  modal.innerHTML = `
    <div class="sportybet-overlay"></div>
    <div class="sportybet-content glass-card">
      <button class="sportybet-close">✕</button>
      <div id="sportybet-modal-body"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.sportybet-overlay').addEventListener('click', closeBookingModal);
  modal.querySelector('.sportybet-close').addEventListener('click', closeBookingModal);
})();

function showBookingModal(html) {
  document.getElementById('sportybet-modal-body').innerHTML = html;
  document.getElementById('sportybet-modal').classList.remove('hidden');
}

function closeBookingModal() {
  document.getElementById('sportybet-modal').classList.add('hidden');
}

async function handleBooking(key) {
  const data = window._bookingData && window._bookingData[key];
  if (!data || !data.selections || data.selections.length === 0) {
    showBookingModal(`
      <div class="booking-error">
        <div class="booking-icon">⚠️</div>
        <h3>No Booking Data</h3>
        <p>Missing selection details. Please re-run Find Matches.</p>
      </div>
    `);
    return;
  }

  showBookingModal(`
    <div class="booking-loading">
      <div class="small-spinner" style="margin:0 auto 1rem;border:3px solid var(--border);border-top-color:var(--accent-gold);border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;"></div>
      <p>Generating your SportyBet booking code...</p>
    </div>
  `);

  try {
    const result = await fetchBookingFromProxy(data.selections);
    showBookingModal(buildSuccessModalHtml({
      bookingCode: result.bookingCode,
      selections: result.selections,
      totalOdds: result.totalOdds
    }));
    setTimeout(() => {
      const copyBtn = document.getElementById('copy-code-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const code = document.getElementById('booking-code-text').textContent;
          navigator.clipboard.writeText(code).then(() => {
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
          });
        });
      }
    }, 100);
  } catch (err) {
    showBookingModal(`
      <div class="booking-error">
        <div class="booking-icon">⚠️</div>
        <h3>Booking Failed</h3>
        <p>${escapeHtml(err.message || 'Unknown error')}</p>
        <p class="text-muted" style="margin-top:1rem;font-size:0.9rem;">
          Visit <a href="https://www.sportybet.com/ng" target="_blank" rel="noopener" class="step-link">sportybet.com/ng</a> to add picks manually.
        </p>
      </div>
    `);
  }
}

els.findMatchesResults.addEventListener('click', (e) => {
  const bookAllBtn = e.target.closest('.book-all-btn');
  const bookSingleBtn = e.target.closest('.book-single-btn');

  if (bookAllBtn) {
    const key = bookAllBtn.dataset.slipKey;
    handleBooking(key);
  } else if (bookSingleBtn) {
    const key = bookSingleBtn.dataset.slipKey;
    handleBooking(key);
  }
});

// --- Init ---
if (!currentApiKey) els.navbar.classList.add('hidden');
else els.navbar.classList.remove('hidden');
checkInputs();