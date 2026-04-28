const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgnuM0mSAb8D'; 
    this.audioDir = path.join(__dirname, '../data/audio_cache');
    
    // Ses Ayarları (Doğallık İçin)
    this.stability = parseFloat(process.env.ELEVENLABS_STABILITY) || 0.45;
    this.similarity = parseFloat(process.env.ELEVENLABS_SIMILARITY) || 0.8;
    this.style = parseFloat(process.env.ELEVENLABS_STYLE) || 0.2;
    this.useSpeakerBoost = process.env.ELEVENLABS_SPEAKER_BOOST !== 'false';

    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  async textToSpeech(text) {
    if (!this.apiKey) {
      console.warn('⚠️ ELEVENLABS_API_KEY eksik, TTS çalışmayacak.');
      return null;
    }

    const hash = crypto.createHash('md5').update(text).digest('hex');
    const fileName = `${hash}.mp3`;
    const filePath = path.join(this.audioDir, fileName);

    if (fs.existsSync(filePath)) {
      return fileName;
    }

    try {
      const response = await axios({
        method: 'post',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
        data: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: this.stability,
            similarity_boost: this.similarity,
            style: this.style,
            use_speaker_boost: this.useSpeakerBoost
          }
        },
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer'
      });

      fs.writeFileSync(filePath, response.data);
      return fileName;
    } catch (error) {
      console.error('❌ ElevenLabs TTS Hatası:', error.response?.data?.toString() || error.message);
      return null;
    }
  }

  getAudioPath(fileName) {
    return path.join(this.audioDir, fileName);
  }
}

module.exports = new ElevenLabsService();
