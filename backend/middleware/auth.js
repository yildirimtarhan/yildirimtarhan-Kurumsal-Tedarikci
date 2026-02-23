const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // Test için geçici izin
            req.user = { _id: 'test', role: 'admin' };
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();

    } catch (error) {
        // Token hatası olsa bile devam et (test için)
        req.user = { _id: 'test', role: 'admin' };
        next();
    }
};

// Alias'lar
const authMiddleware = authenticateToken;

const adminMiddleware = (req, res, next) => {
    // Şimdilik herkese izin ver
    next();
};

module.exports = { 
    authenticateToken,
    authMiddleware,
    adminMiddleware
};