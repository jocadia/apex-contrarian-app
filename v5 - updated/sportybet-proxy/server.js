const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// SportyBet booking proxy
app.post('/api/book', async (req, res) => {
  try {
    const { selections } = req.body;

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: 'Invalid selections' });
    }

    const payload = {
      selectionsCount: selections.length,
      selections: selections.map(s => ({
        eventId: s.eventId,
        marketId: s.marketId,
        outcomeId: s.outcomeId,
        specifiers: s.specifiers || ''
      })),
      source: 'PC',
      currency: 'NGN'
    };

    const response = await axios.post(
      'https://www.sportybet.com/api/ng/orders/share',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://www.sportybet.com',
          'Referer': 'https://www.sportybet.com/ng/'
        }
      }
    );

    const bookingCode = response.data?.data?.bookingCode || response.data?.data?.code || null;
    if (!bookingCode) {
      return res.status(500).json({ error: 'No booking code returned from SportyBet' });
    }

    res.json({
      bookingCode,
      selections: selections.map(s => ({
        homeTeam: s.homeTeam || '',
        awayTeam: s.awayTeam || '',
        market: s.market || '',
        pick: s.pick || '',
        odds: s.odds || '',
        eventId: s.eventId,
        marketId: s.marketId,
        outcomeId: s.outcomeId
      })),
      totalOdds: response.data?.data?.totalOdds || 'N/A'
    });

  } catch (error) {
    console.error('SportyBet proxy error:', error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.message || 'Failed to generate booking code'
    });
  }
});

// Fallback to frontend index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});