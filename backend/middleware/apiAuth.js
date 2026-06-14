const ExternalProject = require('../models/ExternalProject');

const apiAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'API anahtarı (x-api-key) eksik.' });
  }

  try {
    const project = await ExternalProject.findOne({ apiKey, isActive: true });
    if (!project) {
      return res.status(403).json({ success: false, message: 'Geçersiz veya pasif API anahtarı.' });
    }

    // Yetkilendirilen projeyi request nesnesine ekle
    req.externalProject = project;
    next();
  } catch (error) {
    console.error("API Auth Hatası:", error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

module.exports = apiAuth;
