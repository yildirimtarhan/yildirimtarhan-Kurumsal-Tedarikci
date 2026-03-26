const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const Order = require('../models/Order');
const Tahsilat = require('../models/Tahsilat');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function getUserIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

function formatPrice2(n) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

function toKurus(amount) {
  const x = Number(amount || 0);
  return Math.round(x * 100);
}

router.post('/init', authMiddleware, async (req, res) => {
  try {
    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({
        success: false,
        message: 'PayTR bilgileri eksik. PAYTR_MERCHANT_ID/KEY/SALT tanımlayın.'
      });
    }

    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId gerekli' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Sipariş bulunamadı' });

    // Sipariş sahibi kontrolü (admin hariç)
    const isAdmin = req.user?.rol === 'admin' || req.user?.role === 'admin';
    if (!isAdmin && String(order.userId || '') !== String(req.userId || req.user?.userId || req.user?.id || '')) {
      return res.status(403).json({ success: false, message: 'Yetkisiz' });
    }

    const email = order.email || req.user?.email || 'no-reply@tedarikci.org.tr';
    const user_name = (order.shippingAddress?.fullName || '').trim() || 'Müşteri';
    const user_phone = (order.shippingAddress?.phone || '').trim() || (req.user?.telefon || '').trim() || '0000000000';
    const user_address = `${order.shippingAddress?.address || ''} ${order.shippingAddress?.district || ''}/${order.shippingAddress?.city || ''}`.trim() || (order.adres || '').trim() || 'Adres';

    const currency = (process.env.PAYTR_CURRENCY || 'TL').toUpperCase();
    const test_mode = Number(process.env.PAYTR_TEST_MODE || 1); // testte 1
    const debug_on = Number(process.env.PAYTR_DEBUG_ON || 1);
    const no_installment = Number(process.env.PAYTR_NO_INSTALLMENT || 0);
    const max_installment = Number(process.env.PAYTR_MAX_INSTALLMENT || 0);
    const timeout_limit = Number(process.env.PAYTR_TIMEOUT_MINUTES || 30);
    const lang = (process.env.PAYTR_LANG || 'tr').toLowerCase();

    const baseFrontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5500').replace(/\/$/, '');
    const merchant_ok_url = process.env.PAYTR_OK_URL || `${baseFrontendUrl}/siparisler.html?paytr=success`;
    const merchant_fail_url = process.env.PAYTR_FAIL_URL || `${baseFrontendUrl}/siparisler.html?paytr=failed`;

    const merchant_oid = order.paytr?.merchantOid || `ORD${String(order._id)}`;

    const basket = (order.items || []).map((it) => ([
      String(it.ad || 'Ürün'),
      formatPrice2(it.fiyat || 0),
      Number(it.adet || 1)
    ]));
    const user_basket = Buffer.from(JSON.stringify(basket), 'utf8').toString('base64');

    const payment_total = Number(order.toplam ?? order.total ?? (Number(order.subtotal || 0) + Number(order.kdv || 0)) ?? 0);
    const payment_amount = toKurus(payment_total);

    const user_ip = getUserIp(req);

    const hash_str = `${merchant_id}${user_ip}${merchant_oid}${email}${payment_amount}${user_basket}${no_installment}${max_installment}${currency}${test_mode}`;
    const paytr_token = crypto
      .createHmac('sha256', merchant_key)
      .update(hash_str + merchant_salt)
      .digest('base64');

    // Siparişe PayTR bilgilerini yaz (notify'da eşlemek için)
    order.paymentProvider = 'paytr';
    order.paymentStatus = order.paymentStatus || 'pending';
    order.paytr = order.paytr || {};
    order.paytr.merchantOid = merchant_oid;
    order.paytr.paymentAmount = payment_amount;
    order.paytr.currency = currency;
    order.paytr.testMode = test_mode;
    await order.save();

    const payload = new URLSearchParams({
      merchant_id,
      user_ip,
      merchant_oid,
      email,
      payment_amount: String(payment_amount),
      paytr_token,
      user_basket,
      debug_on: String(debug_on),
      no_installment: String(no_installment),
      max_installment: String(max_installment),
      user_name,
      user_address,
      user_phone,
      merchant_ok_url,
      merchant_fail_url,
      timeout_limit: String(timeout_limit),
      currency,
      test_mode: String(test_mode),
      lang
    });

    const r = await axios.post('https://www.paytr.com/odeme/api/get-token', payload.toString(), {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    });

    const data = r.data;
    if (!data || data.status !== 'success' || !data.token) {
      return res.status(400).json({
        success: false,
        message: 'PayTR token alınamadı',
        reason: data?.reason || data
      });
    }

    return res.json({
      success: true,
      token: data.token,
      merchantOid: merchant_oid
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'PayTR init hata: ' + err.message });
  }
});

// PayTR Callback URL (panelden bu endpoint verilecek): /api/paytr/notify
router.post('/notify', async (req, res) => {
  try {
    const post = req.body || {};

    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
    if (!merchant_key || !merchant_salt) {
      return res.status(500).send('PAYTR notification failed: missing merchant credentials');
    }

    const hash = crypto
      .createHmac('sha256', merchant_key)
      .update(String(post.merchant_oid || '') + merchant_salt + String(post.status || '') + String(post.total_amount || ''))
      .digest('base64');

    if (hash !== post.hash) {
      return res.status(400).send('PAYTR notification failed: bad hash');
    }

    const order = await Order.findOne({ 'paytr.merchantOid': post.merchant_oid });
    if (!order) {
      // Sipariş bulunamasa da PayTR tekrar denemesin
      return res.send('OK');
    }

    // Idempotent: daha önce işlendiyse sadece OK
    if (order.paytr?.notifiedAt) {
      return res.send('OK');
    }

    const status = String(post.status || '');
    const paymentType = String(post.payment_type || '');
    const totalAmount = Number(post.total_amount || null);
    const paymentAmount = post.payment_amount != null ? Number(post.payment_amount) : null;

    order.paymentProvider = 'paytr';
    order.paytr = order.paytr || {};
    order.paytr.status = status === 'success' ? 'success' : 'failed';
    order.paytr.paymentType = paymentType || null;
    order.paytr.totalAmount = Number.isFinite(totalAmount) ? totalAmount : null;
    order.paytr.paymentAmount = Number.isFinite(paymentAmount) ? paymentAmount : (order.paytr.paymentAmount || null);
    order.paytr.currency = post.currency || order.paytr.currency || null;
    order.paytr.testMode = post.test_mode != null ? Number(post.test_mode) : order.paytr.testMode;
    order.paytr.failedReasonCode = post.failed_reason_code || null;
    order.paytr.failedReasonMsg = post.failed_reason_msg || null;
    order.paytr.notifiedAt = new Date();

    if (status === 'success') {
      order.paymentStatus = 'paid';

      // Tahsilat kaydı oluştur (varsa tekrarlama)
      const existing = await Tahsilat.findOne({ siparisId: order._id, tahsilatTipi: 'KREDİ_KARTI', durum: 'ONAYLANDI' });
      if (!existing) {
        await Tahsilat.create({
          cariHesapId: undefined, // sistemde cari zorunlu; yoksa oluşturmayalım
          tutar: Number(order.toplam || 0),
          tahsilatTipi: 'KREDİ_KARTI',
          durum: 'ONAYLANDI',
          aciklama: `PayTR ödeme onayı (${post.merchant_oid})`,
          siparisId: order._id
        }).catch(() => {
          // Cari zorunluluğu nedeniyle fail olabilir; siparişi yine de paid yapıyoruz.
        });
      }
    } else {
      order.paymentStatus = 'failed';
    }

    await order.save();

    return res.send('OK');
  } catch (err) {
    return res.status(500).send('PAYTR notification failed: ' + err.message);
  }
});

module.exports = router;

