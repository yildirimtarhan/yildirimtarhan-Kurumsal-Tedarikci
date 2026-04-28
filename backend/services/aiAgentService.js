const { GoogleGenerativeAI } = require("@google/generative-ai");
const AICallSession = require("../models/AICallSession");
const MarketingLead = require("../models/MarketingLead");
const emailService = require("./emailService");

class AIAgentService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  getSystemPrompt(leadData) {
    const firmaAdi = leadData?.firmaAdi || "Değerli Müşterimiz";
    const yetkili = leadData?.yetkiliAdSoyad || "Yetkili";
    
    return `
      Sen "Kurumsal Tedarikçi" (tedarikci.org.tr) firmasının profesyonel, ikna edici ve yardımsever yapay zeka satış temsilcisisini.
      Adın: "Pelin" (veya Kurumsal Destek Asistanı).
      
      HEDEF:
      - ${firmaAdi} firmasından ${yetkili} ile görüşüyorsun.
      - Amacın firmayı Kurumsal Tedarikçi ile çalışmaya ikna etmek.
      - Ofis kırtasiye, temizlik, teknoloji ve gıda tedariği gibi tüm kurumsal ihtiyaçları tek noktadan, uygun fiyatla ve ERP entegrasyonuyla karşıladığımızı anlat.
      - Avantajlarımız: Online portal, kolay fatura takibi, hızlı teslimat, geniş ürün yelpazesi.
      
      KURALLAR:
      1. KISA ve ÖZ konuş. Telefon görüşmesi yapıyorsun, uzun paragraflar kurma.
      2. Samimi ama profesyonel bir Türkçe kullan.
      3. Müşterinin itirazlarını (fiyat, mevcut tedarikçi vb.) nazikçe karşıla ve çözüm odaklı ol.
      4. Eğer müşteri ilgilenirse, bir randevu oluşturmayı veya bir teklif e-postası göndermeyi teklif et.
      5. İLGİ VARSA MUTLAKA SOR: "Size özel tekliflerimizi ve fiyat listemizi e-posta veya SMS ile iletebilmemiz için iletişim onayınızı alabilir miyim?" diye sor. Bu yasal bir zorunluluktur.
      6. Görüşme bittiğinde veya müşteri kapatmak istediğinde nazikçe vedalaş ve [END_CALL] etiketini mesajın sonuna ekle.
      7. Eğer bir e-posta gönderilmesi gerekiyorsa [SEND_EMAIL] etiketini ekle.
      
      Şu anki görüşme akışına göre cevap ver.
    `;
  }

  async generateResponse(sessionId, userInput) {
    const session = await AICallSession.findById(sessionId).populate('leadId');
    if (!session) throw new Error("Oturum bulunamadı");

    const history = session.transcript.map(m => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }]
    }));

    const systemPrompt = this.getSystemPrompt(session.leadId);
    
    // Gemini 1.5 prompt yapısı
    const chat = this.model.startChat({
      history: history,
      systemInstruction: systemPrompt
    });

    const result = await chat.sendMessage(userInput);
    const response = await result.response;
    const text = response.text();

    // Transkripti güncelle
    session.transcript.push({ role: 'user', text: userInput });
    session.transcript.push({ role: 'model', text: text });
    await session.save();

    const shouldEndCall = text.includes("[END_CALL]");
    const shouldSendEmail = text.includes("[SEND_EMAIL]");

    // Etiketleri temizle (sesli okuma için)
    let cleanText = text.replace(/\[END_CALL\]/g, "").replace(/\[SEND_EMAIL\]/g, "").trim();

    return {
      text: cleanText,
      shouldEndCall,
      shouldSendEmail
    };
  }

  async processEndOfCall(sessionId) {
    const session = await AICallSession.findById(sessionId).populate('leadId');
    if (!session || session.status === 'completed') return;

    // 1. Özet ve Notlar Oluştur
    const transcriptText = session.transcript.map(m => `${m.role}: ${m.text}`).join("\n");
    const summaryPrompt = `Aşağıdaki telefon görüşmesini özetle ve önemli notları çıkar. 
    Müşteri iletişim onayı (E-posta veya SMS ile bilgilendirme) verdi mi? 
    Yanıtı JSON formatında ver: { "summary": "...", "notes": "...", "sendFollowUp": true/false, "emailOnay": true/false, "smsOnay": true/false }
    
    GÖRÜŞME:\n${transcriptText}`;

    try {
      const result = await this.model.generateContent(summaryPrompt);
      const summaryText = result.response.text().replace(/```json|```/g, "").trim();
      const summaryData = JSON.parse(summaryText);

      session.summary = summaryData.summary;
      session.notes = summaryData.notes;
      session.status = 'completed';
      await session.save();

      // 2. MarketingLead Güncelle
      if (session.leadId) {
        const lead = session.leadId;
        lead.aiNotlari = (lead.aiNotlari ? lead.aiNotlari + "\n" : "") + 
                         `--- AI Görüşme (${new Date().toLocaleDateString('tr-TR')}) ---\n` +
                         `Özet: ${summaryData.summary}\nNotlar: ${summaryData.notes}`;
        
        lead.aktiviteler.push({
          tip: 'arama',
          baslik: 'AI Görüşmesi Tamamlandı',
          not: summaryData.summary,
          sonuc: 'ulasildi',
          olusturan: 'ai_pelin'
        });

        // SÖZLÜ ONAY TESPİTİ VE GÜNCELLEME
        if (summaryData.emailOnay && !lead.emailOnay) {
          lead.emailOnay = true;
          lead.onayTarihi = new Date();
          lead.onayIp = "Verbal_AI_Call"; // Sesli onay olarak işaretle
        }
        if (summaryData.smsOnay && !lead.smsOnay) {
          lead.smsOnay = true;
          lead.onayTarihi = new Date();
          lead.onayIp = "Verbal_AI_Call";
        }

        await lead.save();

        // 3. E-posta Gönder (Eğer gerekiyorsa veya Gemini karar verdiyse)
        const lastMsg = session.transcript[session.transcript.length - 1]?.text || "";
        if (summaryData.sendFollowUp || lastMsg.includes("[SEND_EMAIL]")) {
           await this.sendFollowUpEmail(session, lead);
        }
      }
    } catch (err) {
      console.error("Özet oluşturma hatası:", err);
      session.status = 'completed';
      await session.save();
    }
  }

  async sendFollowUpEmail(session, lead) {
    const transcriptText = session.transcript.map(m => `${m.role}: ${m.text}`).join("\n");
    const emailPrompt = `Sen Kurumsal Tedarikçi satış temsilcisisin. 
    Az önce ${lead.yetkiliAdSoyad} ile yaptığın telefon görüşmesine istinaden profesyonel ve etkileyici bir takip e-postası yaz.
    
    KURALLAR:
    1. Görüşmede konuşulan spesifik konulara (varsa itirazlara veya ilgi alanlarına) değin.
    2. Kurumsal Tedarikçi'nin avantajlarından (ERP entegrasyonu, geniş ürün yelpazesi, hızlı teslimat) bahset.
    3. Tonlama: Profesyonel, çözüm odaklı ve kurumsal.
    4. Yanıtı şu formatta ver:
       KONU: [Profesyonel bir konu başlığı]
       İÇERİK: [E-posta içeriği - paragraf yapısında]
    
    KONUŞMA GEÇMİŞİ:\n${transcriptText}`;

    try {
      const result = await this.model.generateContent(emailPrompt);
      const emailOutput = result.response.text();
      
      let subject = `Kurumsal Tedarikçi — Görüşmemiz Hakkında`;
      let body = emailOutput;

      // Basit bir parser (KONU: ... İÇERİK: ...)
      const subjectMatch = emailOutput.match(/KONU:\s*(.*)/i);
      const contentMatch = emailOutput.match(/İÇERİK:\s*([\s\S]*)/i);

      if (subjectMatch) subject = subjectMatch[1].trim();
      if (contentMatch) body = contentMatch[1].trim();

      // HTML satır sonlarını düzenle
      const htmlBody = body.replace(/\n/g, '<br>');

      await emailService.sendAIFollowUp(
        lead.email,
        lead.yetkiliAdSoyad || "Yetkili",
        lead.firmaAdi || "Firmanız",
        htmlBody,
        subject
      );

      session.emailSent = true;
      await session.save();
      
      console.log(`📧 Takip e-postası gönderildi: ${lead.email}`);
    } catch (err) {
      console.error("Takip e-postası gönderme hatası:", err);
    }
  }
}

module.exports = new AIAgentService();
