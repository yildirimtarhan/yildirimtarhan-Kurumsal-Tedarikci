const axios = require('axios');
const { backendPublicUrl } = require('../config/backendPublicUrl');

const SEND_URL = 'https://api.netgsm.com.tr/voicesms/send';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * +905xxxxxxxxx veya 10 hane 5xxxxxxxxx
 */
function toNetgsmNo(e164OrDigits) {
  let d = String(e164OrDigits).replace(/\D/g, '');
  if (d.startsWith('90')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length !== 10 || !d.startsWith('5')) return null;
  return d;
}

/**
 * NetGSM: başlangıç–bitiş arası en az 1 saat, en fazla 21 saat (Europe/Istanbul).
 */
function istanbulSchedule(hoursWindow = 2) {
  const now = new Date();
  const end = new Date(now.getTime() + Math.min(Math.max(hoursWindow, 1), 21) * 3600000);
  const fmt = (d) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);
    const g = (t) => parts.find((p) => p.type === t)?.value || '00';
    const dd = g('day').padStart(2, '0');
    const mm = g('month').padStart(2, '0');
    const yyyy = g('year');
    let HH = g('hour');
    let min = g('minute');
    if (HH.length === 1) HH = `0${HH}`;
    if (min.length === 1) min = `0${min}`;
    return { date: `${dd}${mm}${yyyy}`, time: `${HH}${min}` };
  };
  const a = fmt(now);
  const b = fmt(end);
  return {
    startdate: a.date,
    starttime: a.time,
    stopdate: b.date,
    stoptime: b.time
  };
}

/**
 * Basit sesli mesaj (TTS metin) — netgsm1/voicemail Package::basitSesliMsg ile uyumlu XML.
 * @param {object} p
 * @param {string[]} p.numbers - 10 hane 5xxxxxxxxx
 * @param {string} p.baslangictext - Okunacak metin (TTS)
 * @param {number} [p.keypad] - 0: tuş yok (varsayılan). 1: tuşlı — henüz desteklenmiyor.
 * @param {number} [p.ringtime] - 10–30 sn
 * @param {string} [p.reportUrl] - NetGSM durum webhook (header &lt;url&gt;)
 */
async function sendBasitSesliMesaj({ numbers, baslangictext, keypad = 0, ringtime = 25, reportUrl }) {
  const usercode = process.env.NETGSM_USERCODE;
  const password = process.env.NETGSM_PASSWORD;
  if (!usercode || !password) {
    throw new Error('NetGSM ses için NETGSM_USERCODE ve NETGSM_PASSWORD gerekli (SMS ile aynı).');
  }

  if (!numbers || !numbers.length) {
    throw new Error('Aranacak numara yok');
  }
  const text = String(baslangictext || '').trim();
  if (!text) {
    throw new Error('Ses metni boş');
  }

  let rt = Number(ringtime);
  if (Number.isNaN(rt)) rt = 25;
  rt = Math.min(30, Math.max(10, rt));

  const sch = istanbulSchedule(Number(process.env.NETGSM_VOICE_WINDOW_HOURS || 2));

  let gsmXml = '';
  for (const n of numbers) {
    gsmXml += `<no>${escapeXml(n)}</no>\r\n`;
  }

  const baslangic = `<text>${escapeXml(text.slice(0, 2000))}</text>`;

  if (keypad !== 0) {
    throw new Error('Tuşlu sesli mesaj (keypad=1) bu sürümde desteklenmiyor.');
  }

  let headerExtra = '';
  if (reportUrl && /^https?:\/\//i.test(reportUrl)) {
    headerExtra = `<url>${escapeXml(reportUrl)}</url>\r\n`;
  }

  const xmlData = `<?xml version="1.0"?>
<mainbody>
<header>
<usercode>${escapeXml(usercode)}</usercode>
<password>${escapeXml(password)}</password>
<startdate>${sch.startdate}</startdate>
<starttime>${sch.starttime}</starttime>
<stopdate>${sch.stopdate}</stopdate>
<stoptime>${sch.stoptime}</stoptime>
<key>0</key>
<ringtime>${rt}</ringtime>
${headerExtra}</header>
<body>
${baslangic}${gsmXml}
</body>
</mainbody>`;

  const { data } = await axios.post(SEND_URL, xmlData, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    timeout: 45000,
    responseType: 'text',
    transformResponse: [(r) => r]
  });

  const raw = String(data ?? '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  const code = parts[0] || 'xx';
  const bulkid = parts[1] || '';

  const okCodes = ['00', '01', '02'];
  if (okCodes.includes(code)) {
    return { ok: true, code, bulkid, raw };
  }

  const errors = {
    30: 'Geçersiz kullanıcı/şifre veya API izni yok (IP kısıtı dahil).',
    40: 'Ses / metin hatası.',
    45: 'Telefon numarası eksik veya hatalı.',
    70: 'Parametre hatası — tarih/saat veya XML kontrol edin.'
  };
  const msg = errors[code] || `NetGSM yanıt: ${raw || code}`;
  const err = new Error(msg);
  err.netgsmCode = code;
  err.netgsmRaw = raw;
  throw err;
}

function buildNetgsmReportUrl() {
  const token = process.env.NETGSM_VOICE_WEBHOOK_TOKEN;
  if (!token) return null;
  const base = backendPublicUrl();
  if (!/^https:\/\//i.test(base)) return null;
  return `${base}/api/voice/netgsm-report?token=${encodeURIComponent(token)}`;
}

module.exports = {
  toNetgsmNo,
  sendBasitSesliMesaj,
  buildNetgsmReportUrl,
  istanbulSchedule
};
