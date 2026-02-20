const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "kurumsal-tedarikci-secret-key";

// ==========================
// KULLANICI TOKEN KONTROLÜ
// ==========================
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Token gerekli"
    });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = decoded;
    req.userId = decoded.id || decoded.userId;
    
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token geçersiz veya süresi dolmuş"
    });
  }
}

// ==========================
// ADMIN KONTROLÜ
// ==========================
function requireAdmin(req, res, next) {
  // Token kontrolü önce yapılmalı
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Yetkilendirme gerekli"
    });
  }

  // Admin mi kontrol et
  const isAdmin = req.user.rol === "admin" || req.user.role === "admin";
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Admin yetkisi gerekli"
    });
  }

  next();
}

// ==========================
// TEK MIDDLEWARE (Token + Admin)
// ==========================
function adminOnly(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Token gerekli"
    });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    const isAdmin = decoded.rol === "admin" || decoded.role === "admin";
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin yetkisi gerekli"
      });
    }

    req.user = decoded;
    req.userId = decoded.id || decoded.userId;
    
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token geçersiz veya süresi dolmuş"
    });
  }
}

module.exports = {
  authenticateToken,
  requireAdmin,
  adminOnly
};