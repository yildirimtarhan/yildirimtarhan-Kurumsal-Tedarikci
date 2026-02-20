const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');

const JWT_SECRET = process.env.JWT_SECRET || "kurumsal-tedarikci-secret-key";

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, message: 'Token gerekli' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Geçersiz token' });
    req.user = user;
    next();
  });
}

// Kargo bilgisi ekle/güncelle
router.post('/bilgi', authenticateToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yetkisiz erişim' });
    }

    const { siparisId, kargoFirmasi, takipNo, durum } = req.body;
    
    const order = await Order.findById(siparisId);
    if (!order) return res.status(404).json({ success: false, message: 'Sipariş bulunamadı' });

    order.kargo = { kargoFirmasi, takipNo, durum, tarih: new Date() };
    await order.save();

    res.json({ success: true, message: 'Kargo bilgisi güncellendi' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Kargo takip bilgisi getir
router.get('/takip/:siparisId', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.siparisId);
    
    if (!order) return res.status(404).json({ success: false, message: 'Sipariş bulunamadı' });
    
    // Sadece kendi siparişi veya admin görebilir
    if (order.email !== req.user.email && req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yetkisiz erişim' });
    }

    res.json({ success: true, kargo: order.kargo || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;