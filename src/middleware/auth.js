const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwtSecret');

// Every logged-in staff role (customers using the QR menu never have a token)
const STAFF_ROLES = ['admin', 'cashier', 'waiter', 'cake_chef', 'snacks_chef'];

const auth = (roles = []) => {
  // roles param can be a single role string or an array of roles
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;

      // Check if user role matches allowed roles
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
      }

      next();
    } catch (err) {
      res.status(401).json({ message: 'Token is not valid' });
    }
  };
};

// Never blocks: sets req.user when a valid token is present, otherwise req.user = null.
// Used on routes shared by public QR customers and logged-in staff.
const optionalAuth = (req, res, next) => {
  req.user = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (err) {
      req.user = null;
    }
  }
  next();
};

const isStaff = (req) => !!(req.user && STAFF_ROLES.includes(req.user.role));

module.exports = auth;
module.exports.STAFF_ROLES = STAFF_ROLES;
module.exports.staffOnly = auth(STAFF_ROLES);
module.exports.adminOnly = auth(['admin']);
module.exports.optionalAuth = optionalAuth;
module.exports.isStaff = isStaff;
