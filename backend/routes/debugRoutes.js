const express = require('express');
const router = express.Router();
const { get } = require('../utils/sportmonks');
const apiKey = require('../middleware/apiKey');

// Hit: GET /api/debug/sportmonks?path=/leagues&page=1
router.get('/sportmonks', apiKey(true), async (req, res) => {
  try {
    const { path = '/', ...rest } = req.query;
    const { data } = await get(path, rest);
    res.json({ ok: true, path, params: rest, data });
  } catch (e) {
    console.error('[debug] sportmonks', e?.response?.data || e.message);
    res.status(500).json({
      ok: false,
      error: 'debug failed',
      detail: e?.response?.data || e.message
    });
  }
});

module.exports = router;
