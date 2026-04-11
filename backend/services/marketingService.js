const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Firmaya özel teklif metni üretir
 */
async function generateBusinessProposal(leadData) {
  const prompt = `
    Sen profesyonel bir B2B Satış ve Pazarlama Uzmanısın. 
    "Kurumsal Tedarikçi" isimli bir firma adına çalışıyorsun.
    Aşağıdaki firma bilgilerine dayanarak, onlara neden bizimle çalışmaları gerektiğini anlatan, ikna edici ve samimi bir satış teklifi maili yaz.
    
    KURUMSAL TEDARİKÇİ HAKKINDA:
    - Ofis kırtasiye, temizlik ürünleri, teknoloji malzemeleri ve gıda tedariği yapıyoruz.
    - Online sipariş portalı, anlık bakiye takibi, fatura yönetimi ve kapıya teslimat gibi avantajlarımız var.
    - ERP entegrasyonu sayesinde büyük firmaların satın alma süreçlerini kolaylaştırıyoruz.
    
    HEDEF FİRMA BİLGİLERİ:
    Firma Adı: ${leadData.firmaAdi}
    Sektör: ${leadData.sektor || 'Genel'}
    Yetkili: ${leadData.yetkiliAdSoyad || 'Satın Alma Yöneticisi'}
    Web Sitesi: ${leadData.webSitesi || 'Belirtilmedi'}
    
    YAZIM KURALLARI:
    1. Konu başlığı dikkat çekici ve profesyonel olsun.
    2. Mail içeriği firma özelinde olsun (sektörüne atıfta bulun).
    3. Avantajlarımızı liste halinde sun.
    4. Mail sonuna bir randevu veya demo talebi ekle.
    5. Dil: Türkçe ve nazik.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini teklif üretme hatası:", error);
    throw new Error("Teklif metni üretilemedi.");
  }
}

/**
 * Sosyal medya içeriği ve Video senaryosu üretir
 */
async function generateSocialContent(platform, productInfo) {
  const prompt = `
    Sen dünyanın en iyi Sosyal Medya İçerik Üreticisi ve Kreatif Direktörüsün.
    "${platform.toUpperCase()}" platformu için "${productInfo}" hakkında bir içerik planı hazırla.
    
    İÇERİK TİPLERİ:
    1. Etkileşim odaklı bir açıklama (Caption).
    2. Trend olan 10 hashtag.
    3. 15-30 saniyelik bir REELS/VIDEO senaryosu (Sahneleri görsel olarak betimle).
    
    DİL: Türkçe, modern, enerjik ve "Kurumsal Tedarikçi" markasının (tedarikci.org.tr) kimliğine uygun olsun.
    FORMAT: JSON formatında yanıt ver: { "caption": "...", "hashtags": ["..."], "video_script": { "scenes": ["..."], "voiceover": "..." } }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    // JSON parse denemesi
    const text = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Sosyal medya üretim hatası:", error);
    return { error: "Yapay zeka içeriği oluşturamadı." };
  }
}

module.exports = { generateBusinessProposal, generateSocialContent };
