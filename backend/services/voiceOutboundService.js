const axios = require('axios');
const twilio = require('twilio');
const VoiceCallJob = require('../models/VoiceCallJob');
const { backendPublicUrl } = require('../config/backendPublicUrl');
const netgsmVoice = require('./netgsmVoiceService');

/**
 * TR cep: 05xx / 5xx / +905xx → E.164 +90XXXXXXXXXX
 */
function normalizeTrE164(input) {
  if (!input) return null;
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('90')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length !== 10) return null;
  if (!d.startsWith('5')) return null;
  return `+90${d}`;
}

function buildMarketingCallScript(lead, tur, ozelMetin) {
  const ad = (lead.yetkiliAdSoyad || 'yetkili').trim();
  const firma = (lead.firmaAdi || 'firmanız').trim();

  if (tur === 'randevu_hatirlatma') {
    return `Merhaba, ${ad} Bey ya da Hanım. Kurumsal Tedarikçi'den arıyoruz. ${firma} için planladığımız görüşme randevunuzu hatırlatmak istedik. Bilgi ve iletişim için web sitemiz: tedarikci dot org dot tr. İyi günler.`;
  }
  if (tur === 'tanitim') {
    return `İyi günler, ${ad} Bey ya da Hanım. Kurumsal Tedarikçi'den arıyoruz. ${firma} firmasına kurumsal tedarik ve e dönüşüm çözümlerimiz hakkında kısa bilgi vermek için ulaştık. Detaylar için tedarikci dot org dot tr. Teşekkürler, iyi günler.`;
  }
  if (tur === 'ozel' && ozelMetin && String(ozelMetin).trim()) {
    return String(ozelMetin).trim().slice(0, 1200);
  }
  throw new Error('Geçersiz script türü veya özel metin boş');
}

function mapTwilioStatus(callStatus) {
  const m = {
    queued: 'queued',
    initiated: 'calling',
    ringing: 'ringing',
    'in-progress': 'answered',
    completed: 'completed',
    busy: 'busy',
    'no-answer': 'no_answer',
    canceled: 'canceled',
    failed: 'failed'
  };
  return m[callStatus] || 'calling';
}

/**
 * @param {object} opts
 * @param {object} opts.lead - MarketingLead doc
 * @param {string} opts.tur - randevu_hatirlatma | tanitim | ozel
 * @param {string} [opts.ozelMetin]
 */
async function initiateOutboundCall({ lead, tur, ozelMetin }) {
  const provider = String(process.env.VOICE_PROVIDER || 'none').toLowerCase();
  if (provider === 'none' || provider === '' || provider === 'off') {
    throw new Error(
      'Sesli arama kapalı. VOICE_PROVIDER=netgsm | twilio | webhook ve ortam değişkenlerini ayarlayın.'
    );
  }

  // İletişim izni kontrolü (Sesli arama için SMS/Telefon izni gerekir)
  if (!lead.smsOnay) {
    throw new Error('Bu adayın sesli iletişim (SMS/Telefon) izni bulunmamaktadır.');
  }

  const to = normalizeTrE164(lead.telefon);
  if (!to) {
    throw new Error('Geçerli Türkiye cep telefonu yok (10 hane, 5 ile başlayan).');
  }

  const mesaj = buildMarketingCallScript(lead, tur, ozelMetin);

  const job = await VoiceCallJob.create({
    marketingLeadId: lead._id,
    telefon: to,
    mesaj,
    provider,
    status: 'queued',
    scriptTur: tur
  });

  if (provider === 'netgsm') {
    const gsm10 = netgsmVoice.toNetgsmNo(to);
    if (!gsm10) {
      job.status = 'failed';
      job.hata = 'NetGSM için geçersiz numara';
      await job.save();
      throw new Error(job.hata);
    }
    try {
      const reportUrl = netgsmVoice.buildNetgsmReportUrl();
      const ringtime = Number(process.env.NETGSM_VOICE_RINGTIME || 25);
      const result = await netgsmVoice.sendBasitSesliMesaj({
        numbers: [gsm10],
        baslangictext: mesaj,
        keypad: 0,
        ringtime,
        reportUrl: reportUrl || undefined
      });
      job.netgsmBulkId = result.bulkid || '';
      job.status = 'calling';
      job.durumDetay = `netgsm ${result.code}`;
      await job.save();
      return {
        success: true,
        jobId: job._id,
        provider: 'netgsm',
        bulkid: result.bulkid,
        netgsmCode: result.code
      };
    } catch (e) {
      job.status = 'failed';
      job.hata = e.message || 'NetGSM sesli mesaj hatası';
      await job.save();
      throw e;
    }
  }

  if (provider === 'webhook') {
    const url = process.env.VOICE_WEBHOOK_URL;
    if (!url) {
      job.status = 'failed';
      job.hata = 'VOICE_WEBHOOK_URL tanımlı değil';
      await job.save();
      throw new Error(job.hata);
    }
    try {
      const headers = {};
      const secret = process.env.VOICE_WEBHOOK_SECRET;
      if (secret) headers.Authorization = `Bearer ${secret}`;

      await axios.post(
        url,
        {
          telefon: to,
          mesaj,
          leadId: String(lead._id),
          firmaAdi: lead.firmaAdi,
          yetkiliAdSoyad: lead.yetkiliAdSoyad,
          jobId: String(job._id),
          scriptTur: tur
        },
        { headers, timeout: 20000 }
      );
      job.status = 'delegated';
      await job.save();
      return { success: true, jobId: job._id, provider: 'webhook' };
    } catch (e) {
      job.status = 'failed';
      job.hata = e.message || 'Webhook hatası';
      await job.save();
      throw e;
    }
  }

  if (provider === 'twilio') {
    const from = process.env.TWILIO_VOICE_FROM;
    const sid = process.env.TWILIO_SID;
    const token = process.env.TWILIO_TOKEN;
    if (!from || !sid || !token) {
      job.status = 'failed';
      job.hata = 'Twilio ses eksik: TWILIO_VOICE_FROM, TWILIO_SID, TWILIO_TOKEN';
      await job.save();
      throw new Error(job.hata);
    }

    const base = backendPublicUrl();
    if (!/^https:\/\//i.test(base)) {
      job.status = 'failed';
      job.hata = 'TwiML için HTTPS public URL gerekli (BACKEND_PUBLIC_URL / RENDER_EXTERNAL_URL)';
      await job.save();
      throw new Error(job.hata);
    }

    const client = twilio(sid, token);
    try {
      const call = await client.calls.create({
        to,
        from,
        url: `${base}/api/voice/twiml/${job._id}`,
        method: 'GET',
        statusCallback: `${base}/api/voice/status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        timeout: 45
      });
      job.twilioCallSid = call.sid;
      job.status = 'calling';
      await job.save();
      return { success: true, jobId: job._id, callSid: call.sid, provider: 'twilio' };
    } catch (e) {
      job.status = 'failed';
      job.hata = e.message || 'Twilio arama hatası';
      await job.save();
      throw e;
    }
  }

  job.status = 'failed';
  job.hata = `Bilinmeyen VOICE_PROVIDER: ${provider}`;
  await job.save();
  throw new Error(job.hata);
}

async function updateJobByTwilioSid(callSid, patch) {
  if (!callSid) return null;
  return VoiceCallJob.findOneAndUpdate(
    { twilioCallSid: callSid },
    { $set: patch },
    { new: true }
  );
}

function mapNetgsmReportState(state) {
  const n = Number(state);
  if (n === 1) return 'answered';
  if (n === 2 || n === 3) return 'no_answer';
  if (n === 7) return 'busy';
  return 'completed';
}

async function updateJobByNetgsmBulkId(bulkid, patch) {
  if (!bulkid) return null;
  return VoiceCallJob.findOneAndUpdate(
    { netgsmBulkId: String(bulkid) },
    { $set: patch },
    { new: true }
  );
}

module.exports = {
  normalizeTrE164,
  buildMarketingCallScript,
  initiateOutboundCall,
  mapTwilioStatus,
  updateJobByTwilioSid,
  mapNetgsmReportState,
  updateJobByNetgsmBulkId
};
