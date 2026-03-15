const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Token gerekli' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        req.userId = decoded.userId || decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token geçersiz veya süresi dolmuş' });
    }
};

const authMiddleware = authenticateToken;

const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Giriş yapmanız gerekir' });
    }
    const isAdmin = req.user.rol === 'admin' || req.user.role === 'admin';
    if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Yetkisiz erişim (Admin gerekli)' });
    }
    next();
};

module.exports = {
    authenticateToken,
    authMiddleware,
    adminMiddleware
};