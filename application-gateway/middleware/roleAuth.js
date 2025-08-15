// middleware/roleAuth.js
// Simple static RBAC middleware for MVP
// Later replace with JWT + Fabric CA integration

const TOKENS = {
  'Bearer farmer-token': 'Farmer',
  'Bearer verifier-token': 'Verifier',
  'Bearer admin-token': 'Admin'
};

module.exports = function roleAuth(requiredRoles = []) {
  return (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token || !TOKENS[token]) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
    }

    const userRole = TOKENS[token];

    if (requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: Role ${userRole} not allowed` });
    }

    req.userRole = userRole;
    next();
  };
};
