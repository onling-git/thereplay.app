// middleware/apiKey.js
module.exports = function requireApiKey(requireForAll = true) {
  return (req, res, next) => {
    const key = req.header('x-api-key') || req.query.api_key;
    if (!key || key !== process.env.ADMIN_API_KEY) {
      if (requireForAll) return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
};
