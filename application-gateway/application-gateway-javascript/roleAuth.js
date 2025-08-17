// middleware/roleAuth.js
module.exports = () => (req, res, next) => {
  try {
    if (process.env.DISABLE_AUTH === 'true') {
      console.log('⚠️  Auth middleware disabled for testing');
      return next(); // ✅ ensure next() is called
    }

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const validTokens = ['farmer-token', 'verifier-token', 'admin-token'];

    if (validTokens.includes(token)) {
      console.log(`✅ Auth success for token: ${token}`);
      return next();
    }

    console.warn(`❌ Auth failed. Provided token: ${token}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal auth error' });
  }
};
