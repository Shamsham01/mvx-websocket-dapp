const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { getBillingPrefs, upsertBillingPrefs } = require('../services/supabaseBillingPrefs');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const prefs = await getBillingPrefs(req.user.address);
    res.json({ prefs });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load billing preferences' });
  }
});

router.put('/', authenticate, async (req, res) => {
  try {
    const { feeToken } = req.body || {};
    if (feeToken !== 'USDC' && feeToken !== 'REWARD') {
      return res.status(400).json({ error: 'feeToken must be USDC or REWARD' });
    }

    const prefs = await upsertBillingPrefs(req.user.address, feeToken);
    res.json({ prefs });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to save billing preferences' });
  }
});

module.exports = router;
