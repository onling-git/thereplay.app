// middleware/validate.js

// Ensure a URL param is a number (e.g. :matchId)
exports.requireNumericParam = (paramName) => (req, res, next) => {
  const n = Number(req.params[paramName]);
  if (!Number.isFinite(n)) {
    return res.status(400).json({ error: `Param "${paramName}" must be a number` });
  }
  next();
};

// Ensure a URL param is a slug (lowercase letters/digits/dashes only)
exports.requireSlugParam = (paramName) => (req, res, next) => {
  const val = String(req.params[paramName] || '');
  if (!/^[a-z0-9-]+$/.test(val)) {
    return res.status(400).json({ error: `Param "${paramName}" must be a slug (a-z, 0-9, '-')` });
  }
  next();
};

// Ensure specific JSON body fields are present and non-empty
exports.requireBodyFields = (...fields) => (req, res, next) => {
  for (const f of fields) {
    const v = req.body?.[f];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
      return res.status(400).json({ error: `Body field "${f}" is required` });
    }
  }
  next();
};

// Guard and normalize "limit" query param: 1..max (default def)
exports.limitGuard = (max = 100, def = 20) => (req, res, next) => {
  const val = parseInt(req.query.limit || def, 10);
  if (!Number.isFinite(val) || val < 1 || val > max) {
    return res.status(400).json({ error: `Query "limit" must be between 1 and ${max}` });
  }
  req.query.limit = String(val);
  next();
};

// Optional: validate date query params (?from=ISO&to=ISO)
exports.validateDateWindow = (fromKey = 'from', toKey = 'to') => (req, res, next) => {
  const parse = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  };
  const from = parse(req.query[fromKey]);
  const to = parse(req.query[toKey]);

  if (req.query[fromKey] && !from) {
    return res.status(400).json({ error: `Query "${fromKey}" must be an ISO date` });
  }
  if (req.query[toKey] && !to) {
    return res.status(400).json({ error: `Query "${toKey}" must be an ISO date` });
  }
  if (from && to && from > to) {
    return res.status(400).json({ error: `"${fromKey}" must be <= "${toKey}"` });
  }

  // Attach parsed dates for controllers to use if desired
  req._dateWindow = { from, to };
  next();
};
