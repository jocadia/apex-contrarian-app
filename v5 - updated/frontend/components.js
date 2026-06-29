// components.js

// Registry to store match data — avoids broken inline JSON in onclick attributes
const _betSlipRegistry = new Map();

export function renderDashboard(data) {
  let html = `
    <div class="match-header glass-card">
      <h2>${escapeHtml(data.matchInfo.teamA)} <span class="text-muted">VS</span> ${escapeHtml(data.matchInfo.teamB)}</h2>
      <p class="competition-date">${escapeHtml(data.matchInfo.competition || 'Not specified')} • ${escapeHtml(data.matchInfo.date)}</p>
      <div class="research-summary">
        <strong>Research Summary:</strong> ${escapeHtml(data.matchInfo.researchSummary)}
      </div>
    </div>
  `;

  if (data.pass) {
    html += renderPassCard(data.pass);
  } else if (data.misses && data.misses.length > 0) {
    html += `<div class="misses-container">`;
    data.misses.forEach(miss => {
      html += renderMissCard(miss);
    });
    html += `</div>`;
    
    if (data.conflictCheck) {
      html += renderConflictMatrix(data.conflictCheck);
    }
  } else {
    html += `<div class="error-card glass-card">No misses or pass data returned by the engine.</div>`;
  }

  if (data.disclaimer) {
    html += `<div class="disclaimer">${escapeHtml(data.disclaimer)}</div>`;
  }

  return html;
}

function renderMissCard(miss) {
  const isStrict = miss.track === "STRICT";
  const trackClass = isStrict ? "strict" : "non-strict";
  const trackLabel = isStrict ? "🟢 STRICT" : "🔵 NON-STRICT";
  const verdictClass = miss.verdict === "FLAG" ? "verdict-flag" : "verdict-watch";

  let html = `
    <div class="miss-card glass-card ${trackClass}">
      <div class="miss-header">
        <div class="header-top">
          <h3>Miss ${miss.number}</h3>
          <span class="track-badge ${trackClass}">${trackLabel}</span>
          <span class="category-badge">${escapeHtml(miss.categoryCode)}</span>
          <span class="category-badge">${escapeHtml(miss.deepSignal)}</span>
        </div>
        <div class="market-info">
          <strong>Market:</strong> ${escapeHtml(miss.market)}<br/>
          <span class="text-muted">${escapeHtml(miss.bookOdds)}</span>
        </div>
        <div class="verdict-badge ${verdictClass}">${escapeHtml(miss.verdict)}</div>
      </div>

      <div class="miss-body">
        <div class="miss-layer">
          <div class="layer-title">Layer 1: Category</div>
          <div class="layer-content">${escapeHtml(miss.layer1_category)}</div>
        </div>
        
        <div class="miss-layer">
          <div class="layer-title">Layer 2: Popular Narrative</div>
          <div class="layer-content">${escapeHtml(miss.layer2_narrative)}</div>
        </div>
        
        <div class="miss-layer">
          <div class="layer-title">Layer 3: Signal Stack</div>
          <div class="layer-content signals-list">
  `;

  miss.layer3_signals.forEach(sig => {
    html += `
      <div class="signal-item">
        <span class="signal-tier">${escapeHtml(sig.tier)}</span>
        <strong>Source:</strong> ${escapeHtml(sig.source)}<br/>
        <strong>Finding:</strong> ${escapeHtml(sig.finding)}<br/>
        <strong>Direction:</strong> ${escapeHtml(sig.direction)}
      </div>
    `;
  });

  html += `
          </div>
        </div>
        
        <div class="miss-layer">
          <div class="layer-title">Layer 4: Probability Gap</div>
          <div class="layer-content gap-content">
  `;

  const gapStr = miss.layer4_gap.gap;
  const gapVal = parseFloat(gapStr) || 0;
  const gaugeWidth = Math.min(Math.max(gapVal, 0), 30) * (100/30);

  html += `
    <div class="gap-gauge">
      <div class="gauge-bg">
        <div class="gauge-fill" style="width: ${gaugeWidth}%"></div>
      </div>
      <div class="gap-value">${escapeHtml(gapStr)}</div>
    </div>
    <div class="gap-details">
      Raw Implied: ${escapeHtml(miss.layer4_gap.rawImplied)} | Overround: ${escapeHtml(miss.layer4_gap.overround)} | Stripped: ${escapeHtml(miss.layer4_gap.strippedFair)}<br/>
      Framework Estimate: ${escapeHtml(miss.layer4_gap.frameworkEstimate)}<br/>
      <strong>Direction:</strong> ${escapeHtml(miss.layer4_gap.direction)}<br/>
      <div class="derivation text-muted">${escapeHtml(miss.layer4_gap.derivation)}</div>
    </div>
  `;

  if (!isStrict && miss.layer4_gap.confidenceBand) {
    html += `<div class="confidence-band">Confidence: ${escapeHtml(miss.layer4_gap.confidenceBand)}</div>`;
  }

  html += `
          </div>
        </div>
        
        <div class="miss-layer">
          <div class="layer-title">Layer 5: Falsification Clause</div>
          <div class="layer-content falsification-box">
            ${escapeHtml(miss.layer5_falsification)}
          </div>
        </div>
        
        <div class="mef-gate">
          <strong>ME-F Gate:</strong> ${escapeHtml(miss.mefGateResult)}
        </div>
      </div>
    </div>
  `;

  return html;
}

function renderPassCard(pass) {
  return `
    <div class="pass-card glass-card">
      <div class="pass-header">
        <h3>PASS</h3>
        <span class="text-muted">NO QUALIFYING MISSES IDENTIFIED</span>
      </div>
      <div class="pass-body">
        <p><strong>Candidates Reviewed:</strong> ${pass.candidatesReviewed}</p>
        <div class="rejection-reasons">
          <strong>Rejection Reasons:</strong>
          <ul>
            ${pass.rejectionReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
        <p class="pass-recommendation"><strong>Recommendation:</strong> ${escapeHtml(pass.recommendation)}</p>
      </div>
    </div>
  `;
}

function renderConflictMatrix(conflictCheck) {
  let html = `
    <div class="conflict-matrix glass-card">
      <h3>Miss Conflict Check</h3>
      <p><strong>Central Scoreline:</strong> ${escapeHtml(conflictCheck.centralScoreline)}</p>
      <div class="matrix-table-wrapper">
        <table class="matrix-table">
          <thead>
            <tr>
              <th>Comparison</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
  `;

  if (conflictCheck.matrix && conflictCheck.matrix.length > 0) {
    conflictCheck.matrix.forEach(rel => {
      const isCompat = rel.compatible;
      const statusClass = isCompat ? "conflict-compatible" : "conflict-incompatible";
      const statusIcon = isCompat ? "✅ Compatible" : "❌ Incompatible";
      html += `
        <tr>
          <td>Miss ${rel.miss1} vs Miss ${rel.miss2}</td>
          <td class="${statusClass}">${statusIcon}</td>
          <td>${escapeHtml(rel.reason)}</td>
        </tr>
      `;
    });
  } else {
    html += `<tr><td colspan="3" class="text-muted">No conflicts to check (single or zero misses)</td></tr>`;
  }

  html += `
          </tbody>
        </table>
      </div>
      <p class="matrix-verdict ${conflictCheck.allCompatible ? 'text-green' : 'text-crimson'}">
        <strong>Verdict:</strong> ${conflictCheck.allCompatible ? 'All Misses Compatible - OK to Publish' : 'Conflicts Detected - Review Required'}
      </p>
    </div>
  `;

  return html;
}

// Bet Slip Renderer
export function renderBetSlip(matches) {
  if (!matches || matches.length === 0) {
    return `<p class="text-muted">No matches found.</p>`;
  }

  // Store all matches under one key for "Book All"
  const allKey = 'slip_all_' + Date.now();
  _betSlipRegistry.set(allKey, matches);

  let html = `
    <div class="bet-slip-toolbar">
      <span class="slip-count">${matches.length} pick${matches.length !== 1 ? 's' : ''}</span>
      <button class="book-all-btn" data-slip-key="${allKey}" id="book-all-btn-${allKey}">
        <span class="book-btn-icon">🎟️</span>
        Book All on SportyBet
      </button>
    </div>
    <div class="bet-slip-container">
  `;

  matches.forEach((match, idx) => {
    const market = match.market || 'N/A';
    const pick = match.recommendedPick || '';
    const odds = match.odds || 'N/A';
    let riskClass = match.riskLevel ? match.riskLevel.toLowerCase().replace(' ', '-') : '';
    if (riskClass === 'mixture-fast-analysis') riskClass = 'mixture-fast';
    if (riskClass === 'mixture-deep-analysis') riskClass = 'mixture-deep';

    // Store each single match under its own key
    const singleKey = 'slip_' + allKey + '_' + idx;
    _betSlipRegistry.set(singleKey, [match]);

    html += `
      <div class="bet-slip-card glass-card">
        <div class="bet-slip-header">
          <span class="bet-slip-teams">${escapeHtml(match.homeTeam)} <span class="vs-text">vs</span> ${escapeHtml(match.awayTeam)}</span>
          <span class="bet-slip-competition">${escapeHtml(match.competition || '')}</span>
          <span class="bet-slip-kickoff">${escapeHtml(match.kickoff ? new Date(match.kickoff).toLocaleString() : '')}</span>
        </div>
        <div class="bet-slip-market">
          <strong>Market:</strong> ${escapeHtml(market)}
        </div>
        <div class="bet-slip-pick">
          <span class="pick-label">Recommended Pick:</span>
          <span class="pick-value">${escapeHtml(pick)} @ ${escapeHtml(String(odds))}</span>
          <span class="risk-badge ${riskClass}">${escapeHtml(match.riskLevel || '')}</span>
        </div>
        <div class="bet-slip-justification">${escapeHtml(match.justification || '')}</div>
        <div class="bet-slip-actions">
          <button class="book-single-btn" data-slip-key="${singleKey}">
            🎟️ Book on SportyBet
          </button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

// Expose registry so app.js can read it
export function getSlipData(key) {
  return _betSlipRegistry.get(key) || null;
}

export function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
