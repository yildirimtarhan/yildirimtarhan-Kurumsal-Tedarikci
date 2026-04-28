const express = require('express');
const twilio = require('twilio');
const path = require('path');
const AICallSession = require('../models/AICallSession');
const MarketingLead = require('../models/MarketingLead');
const aiAgentService = require('../services/aiAgentService');
const elevenLabsService = require('../services/elevenLabsService');
const { backendPublicUrl } = require('../config/backendPublicUrl');

const router = express.Router();

/**
 * ELEVENLABS SES DOSYALARINI SERVİS ET
 */
router.get('/audio/:fileName', (req, res) => {
  const filePath = elevenLabsService.getAudioPath(req.params.fileName);
  res.sendFile(filePath);
});

/**
 * Giden Arama Başlangıcı (Twilio TwiML)
 */
router.get('/voice/:leadId', async (req, res) => {
  try {
    const lead = await MarketingLead.findById(req.params.leadId);
    if (!lead) return res.status(404).send('Aday bulunamadı');

    const callSid = req.query.CallSid;
    const session = await AICallSession.create({
      leadId: lead._id,
      callSid: callSid,
      to: lead.telefon,
      status: 'in-progress',
      transcript: []
    });

    const initialGreeting = `Merhaba ${lead.yetkiliAdSoyad || ''}, Ben Kurumsal Tedarikçi'den Pelin. Sizi ${lead.firmaAdi} için özel avantajlarımız hakkında bilgilendirmek için arıyorum. Nasılsınız?`;
    
    // Ses dosyasını üret
    const audioFile = await elevenLabsService.textToSpeech(initialGreeting);
    const audioUrl = audioFile ? `${backendPublicUrl()}/api/ai-agent/audio/${audioFile}` : null;

    const response = new twilio.twiml.VoiceResponse();
    
    if (audioUrl) {
      response.play(audioUrl);
    } else {
      response.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, initialGreeting);
    }

    // Kullanıcıyı dinle
    response.gather({
      input: 'speech',
      language: 'tr-TR',
      action: `${backendPublicUrl()}/api/ai-agent/respond/${session._id}`,
      enhanced: true,
      speechTimeout: 'auto'
    });

    res.type('text/xml');
    res.send(response.toString());
  } catch (err) {
    console.error("Voice entry error:", err);
    res.status(500).send('Hata oluştu');
  }
});

/**
 * Konuşmaya Cevap Ver (Twilio Webhook)
 */
router.post('/respond/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const userInput = req.body.SpeechResult;
  const response = new twilio.twiml.VoiceResponse();

  if (!userInput) {
    // Kullanıcı bir şey demediyse tekrar sor veya kapat
    response.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, "Pardon, sizi anlayamadım. Tekrar edebilir misiniz?");
    response.gather({
      input: 'speech',
      language: 'tr-TR',
      action: `${backendPublicUrl()}/api/ai-agent/respond/${sessionId}`,
      enhanced: true
    });
    res.type('text/xml');
    return res.send(response.toString());
  }

  try {
    // Gemini'den cevap al
    const aiResult = await aiAgentService.generateResponse(sessionId, userInput);
    
    // Ses dosyasını üret (ElevenLabs)
    const audioFile = await elevenLabsService.textToSpeech(aiResult.text);
    const audioUrl = audioFile ? `${backendPublicUrl()}/api/ai-agent/audio/${audioFile}` : null;

    if (audioUrl) {
        response.play(audioUrl);
    } else {
        response.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, aiResult.text);
    }

    if (aiResult.shouldEndCall) {
      response.hangup();
      // Görüşme bittiğinde arka planda işlemleri yap
      aiAgentService.processEndOfCall(sessionId);
    } else {
      // Dinlemeye devam et
      response.gather({
        input: 'speech',
        language: 'tr-TR',
        action: `${backendPublicUrl()}/api/ai-agent/respond/${sessionId}`,
        enhanced: true,
        speechTimeout: 'auto'
      });
    }

    res.type('text/xml');
    res.send(response.toString());
  } catch (err) {
    console.error("Respond error:", err);
    response.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, "Sistemde bir hata oluştu, daha sonra tekrar görüşmek üzere.");
    response.hangup();
    res.type('text/xml');
    res.send(response.toString());
  }
});

/**
 * Aramayı Başlat (Outbound Trigger)
 */
router.post('/outbound/:leadId', async (req, res) => {
  try {
    const lead = await MarketingLead.findById(req.params.leadId);
    if (!lead) return res.status(404).json({ success: false, message: 'Aday bulunamadı' });

    if (!lead.smsOnay) {
      return res.status(403).json({ success: false, message: 'Bu adayın sesli iletişim izni bulunmamaktadır.' });
    }

    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    const call = await client.calls.create({
      to: lead.telefon,
      from: process.env.TWILIO_VOICE_FROM,
      url: `${backendPublicUrl()}/api/ai-agent/voice/${lead._id}`,
      record: true,
      statusCallback: `${backendPublicUrl()}/api/ai-agent/status`,
      statusCallbackEvent: ['completed']
    });

    res.json({ success: true, callSid: call.sid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Arama Durumu Bittiğinde (Webhook)
 */
router.post('/status', async (req, res) => {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;
    
    if (callStatus === 'completed') {
        const session = await AICallSession.findOne({ callSid });
        if (session) {
            // Kayıt bilgilerini al
            session.recordingUrl = req.body.RecordingUrl;
            session.duration = req.body.RecordingDuration;
            await session.save();
            
            aiAgentService.processEndOfCall(session._id);
        }
    }
    res.sendStatus(200);
});

module.exports = router;
