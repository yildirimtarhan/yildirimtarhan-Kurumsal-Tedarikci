const express = require('express');
const twilio = require('twilio');
const VoiceCallJob = require('../models/VoiceCallJob');
const {
  mapTwilioStatus,
  updateJobByTwilioSid,
  mapNetgsmReportState,
  updateJobByNetgsmBulkId
} = require('../services/voiceOutboundService');

const router = express.Router();

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Twilio bu URL'den TwiML çeker — kamuya açık (Twilio imzası ile doğrulanabilir).
 */
router.get('/twiml/:jobId', async (req, res) => {
  try {
    const token = process.env.TWILIO_TOKEN;
    if (process.env.NODE_ENV === 'production' && token && req.headers['x-twilio-signature']) {
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const valid = twilio.validateRequest(
        token,
        req.headers['x-twilio-signature'],
        fullUrl,
        {}
      );
      if (!valid) {
        return res.status(403).send('Forbidden');
      }
    }

    const job = await VoiceCallJob.findById(req.params.jobId);
    res.type('text/xml; charset=utf-8');

    if (!job || job.status === 'canceled') {
      return res.send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>'
      );
    }

    const raw = (job.mesaj || 'Merhaba. Kurumsal Tedarikçi. İyi günler.').slice(0, 1200);
    const text = escapeXml(raw);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="tr-TR" voice="Polly.Filiz">${text}</Say>
  <Pause length="1"/>
  <Say language="tr-TR" voice="Polly.Filiz">İyi günler dileriz.</Say>
</Response>`;
    res.send(xml);
  } catch (err) {
    res.type('text/xml; charset=utf-8');
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="tr-TR" voice="Polly.Filiz">Sistem hatası.</Say><Hangup/></Response>'
    );
  }
});

/**
 * Twilio arama durumu geri bildirimi
 */
router.post(
  '/status',
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      const token = process.env.TWILIO_TOKEN;
      if (process.env.NODE_ENV === 'production' && token) {
        const signature = req.headers['x-twilio-signature'];
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const valid = twilio.validateRequest(token, signature, fullUrl, req.body);
        if (!valid) {
          return res.status(403).send('Forbidden');
        }
      }

      const callSid = req.body.CallSid;
      const callStatus = req.body.CallStatus;
      if (callSid && callStatus) {
        await updateJobByTwilioSid(callSid, {
          status: mapTwilioStatus(callStatus),
          durumDetay: callStatus
        });
      }
      res.sendStatus(204);
    } catch (e) {
      res.sendStatus(204);
    }
  }
);

/**
 * NetGSM sesli mesaj webhook (basit/dinamik gönderimde header &lt;url&gt; ile tanımlanır).
 * Güvenlik: NETGSM_VOICE_WEBHOOK_TOKEN query ile gönderilir.
 */
router.post('/netgsm-report', express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const expected = process.env.NETGSM_VOICE_WEBHOOK_TOKEN;
    if (expected && String(req.query.token || '') !== String(expected)) {
      return res.status(403).json({ ok: false });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const bulkid = body.bulkid != null ? body.bulkid : body.bulkId;
    if (bulkid != null && bulkid !== '') {
      await updateJobByNetgsmBulkId(String(bulkid), {
        status: mapNetgsmReportState(body.state),
        durumDetay: JSON.stringify({
          state: body.state,
          callee: body.callee,
          caller: body.caller
        }).slice(0, 800)
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: true });
  }
});

module.exports = router;
