const express = require('express');
const twilio = require('twilio');
const AICallSession = require('../models/AICallSession');
const apiAuth = require('../middleware/apiAuth');
const aiAgentService = require('../services/aiAgentService');
const elevenLabsService = require('../services/elevenLabsService');
const { backendPublicUrl } = require('../config/backendPublicUrl');

const router = express.Router();

/**
 * @route POST /api/external/call
 * @desc Belirtilen numaraya AI botu üzerinden arama başlatır. (API Key Yetkilendirmeli)
 */
router.post('/call', apiAuth, async (req, res) => {
  try {
    const { to, prompt, initialGreeting, webhookUrl } = req.body;
    const project = req.externalProject;

    if (!to) {
      return res.status(400).json({ success: false, message: 'Aranacak numara ("to") belirtilmelidir.' });
    }

    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

    // Eşsiz geçici callSid oluşturulur, Twilio çağrıyı başlatınca güncellenecek
    const session = await AICallSession.create({
      externalProjectId: project._id,
      customPrompt: prompt,
      initialGreeting: initialGreeting || "Merhaba, size nasıl yardımcı olabilirim?",
      webhookUrl: webhookUrl || project.webhookUrl,
      to: to,
      status: 'in-progress',
      transcript: [],
      callSid: 'pending_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    });

    const call = await client.calls.create({
      to: to,
      from: process.env.TWILIO_VOICE_FROM,
      url: `${backendPublicUrl()}/api/external/voice/${session._id}`,
      record: true,
      statusCallback: `${backendPublicUrl()}/api/external/status/${session._id}`,
      statusCallbackEvent: ['completed']
    });

    session.callSid = call.sid;
    await session.save();

    res.json({ 
      success: true, 
      message: 'Arama başlatıldı.', 
      callSid: call.sid, 
      sessionId: session._id 
    });

  } catch (error) {
    console.error('Dış Arama Hatası:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/external/sms
 * @desc Belirtilen numaraya SMS gönderir. (API Key Yetkilendirmeli)
 */
router.post('/sms', apiAuth, async (req, res) => {
  try {
    const { to, message } = req.body;
    const project = req.externalProject;

    if (!to || !message) {
      return res.status(400).json({ success: false, message: 'to ve message zorunludur.' });
    }

    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_VOICE_FROM,
      to: to
    });

    // Projeden bakiye düşümü (opsiyonel)
    if (project.balance > 0) {
      project.balance -= 1;
      await project.save();
    }

    res.json({ success: true, message: 'SMS gönderildi', messageId: sms.sid });

  } catch (error) {
    console.error('Dış SMS Hatası:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Twilio Webhook: Giden Arama Başlangıcı (Açık Endpoint)
 */
const handleVoiceEntry = async (req, res) => {
  try {
    const session = await AICallSession.findById(req.params.sessionId);
    if (!session) return res.status(404).send('Oturum bulunamadı');

    const greeting = session.initialGreeting || 'Merhaba, nasıl yardımcı olabilirim?';

    // ElevenLabs ses dosyasını üret
    const audioFile = await elevenLabsService.textToSpeech(greeting);
    const audioUrl = audioFile ? `${backendPublicUrl()}/api/ai-agent/audio/${audioFile}` : null;

    const response = new twilio.twiml.VoiceResponse();
    
    if (audioUrl) {
      response.play(audioUrl);
    } else {
      response.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, greeting);
    }

    // Kullanıcıyı dinlemeye başla
    response.gather({
      input: 'speech',
      language: 'tr-TR',
      action: `${backendPublicUrl()}/api/external/respond/${session._id}`,
      enhanced: true,
      speechTimeout: 'auto'
    });

    res.type('text/xml');
    res.send(response.toString());
  } catch (err) {
    console.error("External voice entry error:", err);
    res.status(500).send('Hata oluştu');
  }
};

router.post('/voice/:sessionId', handleVoiceEntry);
router.get('/voice/:sessionId', handleVoiceEntry);

/**
 * Twilio Webhook: Konuşmaya Cevap Ver (Açık Endpoint)
 */
router.post('/respond/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const userInput = req.body.SpeechResult;
  const response = new twilio.twiml.VoiceResponse();

  if (!userInput) {
    response.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, "Pardon, sizi anlayamadım. Tekrar edebilir misiniz?");
    response.gather({
      input: 'speech',
      language: 'tr-TR',
      action: `${backendPublicUrl()}/api/external/respond/${sessionId}`,
      enhanced: true
    });
    res.type('text/xml');
    return res.send(response.toString());
  }

  try {
    const aiResult = await aiAgentService.generateResponse(sessionId, userInput);
    const audioFile = await elevenLabsService.textToSpeech(aiResult.text);
    const audioUrl = audioFile ? `${backendPublicUrl()}/api/ai-agent/audio/${audioFile}` : null;

    if (audioUrl) {
      response.play(audioUrl);
    } else {
      response.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, aiResult.text);
    }

    if (aiResult.shouldEndCall) {
      response.hangup();
      // Arka planda aramayı sonlandır, webhook tetiklenecek
      aiAgentService.processEndOfCall(sessionId);
    } else {
      response.gather({
        input: 'speech',
        language: 'tr-TR',
        action: `${backendPublicUrl()}/api/external/respond/${sessionId}`,
        enhanced: true,
        speechTimeout: 'auto'
      });
    }

    res.type('text/xml');
    res.send(response.toString());
  } catch (err) {
    console.error("External respond error:", err);
    response.say({ language: 'tr-TR', voice: 'Polly.Filiz' }, "Sistemde bir hata oluştu, lütfen daha sonra tekrar deneyiniz.");
    response.hangup();
    res.type('text/xml');
    res.send(response.toString());
  }
});

/**
 * Twilio Webhook: Arama Durumu Bittiğinde (Açık Endpoint)
 */
router.post('/status/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const callStatus = req.body.CallStatus;

  if (callStatus === 'completed') {
    const session = await AICallSession.findById(sessionId);
    if (session) {
      session.recordingUrl = req.body.RecordingUrl;
      session.duration = req.body.RecordingDuration;
      await session.save();

      await aiAgentService.processEndOfCall(session._id);
    }
  }
  res.sendStatus(200);
});

module.exports = router;
