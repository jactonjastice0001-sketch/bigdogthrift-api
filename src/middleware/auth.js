const jwt = require('jsonwebtoken');

// Sign a JWT token
function sign(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { 
        expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
    });
}

// Verify token (middleware) - alias for auth
function verifyToken(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Missing or invalid Authorization header' 
        });
    }
    
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        next();
    } catch (err) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
}

// Auth middleware (alias for verifyToken)
const auth = verifyToken;

// Require role middleware
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ 
                success: false, 
                message: `This action requires a ${role} account` 
            });
        }
        next();
    };
}

// Is Seller middleware (alias for requireRole('seller'))
function isSeller(req, res, next) {
    if (!req.user || (req.user.role !== 'seller' && req.user.role !== 'admin')) {
        return res.status(403).json({ 
            success: false, 
            message: 'Seller access required' 
        });
    }
    next();
}

// Is Admin middleware (alias for requireRole('admin'))
function isAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    next();
}

module.exports = { 
    sign, 
    verifyToken, 
    auth, 
    requireRole, 
    isSeller, 
    isAdmin 
};
