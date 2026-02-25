/**
 * Fatura Servisi - Frontend
 * Taxten e-fatura entegrasyonu için API çağrıları
 */

class FaturaService {
    constructor() {
        this.baseUrl = window.location.origin.includes('localhost') 
            ? 'http://localhost:3000/api' 
            : 'https://your-render-backend.onrender.com/api';
        this.token = localStorage.getItem('token');
    }

    // HTTP istekleri için yardımcı metod
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Bir hata oluştu');
            }
            
            return data;
        } catch (error) {
            console.error('API Hatası:', error);
            throw error;
        }
    }

    // ===== FATURA OLUŞTURMA =====

    /**
     * Siparişten fatura oluştur
     */
    async createFromSiparis(siparisId, faturaData = {}) {
        return this.request('/faturalar/from-siparis', {
            method: 'POST',
            body: JSON.stringify({ siparisId, ...faturaData })
        });
    }

    /**
     * Manuel fatura oluştur
     */
    async createManual(faturaData) {
        return this.request('/faturalar', {
            method: 'POST',
            body: JSON.stringify(faturaData)
        });
    }

    /**
     * Toplu fatura oluştur (birden fazla sipariş için)
     */
    async createBulk(siparisIds, faturaData = {}) {
        return this.request('/faturalar/bulk', {
            method: 'POST',
            body: JSON.stringify({ siparisIds, ...faturaData })
        });
    }

    // ===== FATURA LİSTELEME =====

    /**
     * Fatura listesi getir
     */
    async getFaturalar(filters = {}) {
        const queryParams = new URLSearchParams();
        
        if (filters.durum) queryParams.append('durum', filters.durum);
        if (filters.tip) queryParams.append('tip', filters.tip);
        if (filters.baslangicTarihi) queryParams.append('baslangicTarihi', filters.baslangicTarihi);
        if (filters.bitisTarihi) queryParams.append('bitisTarihi', filters.bitisTarihi);
        if (filters.musteriId) queryParams.append('musteriId', filters.musteriId);
        if (filters.sayfa) queryParams.append('sayfa', filters.sayfa);
        if (filters.limit) queryParams.append('limit', filters.limit);

        return this.request(`/faturalar?${queryParams.toString()}`);
    }

    /**
     * Fatura detayı getir
     */
    async getFaturaById(faturaId) {
        return this.request(`/faturalar/${faturaId}`);
    }

    /**
     * Siparişe ait faturaları getir
     */
    async getFaturalarBySiparis(siparisId) {
        return this.request(`/faturalar/siparis/${siparisId}`);
    }

    // ===== TAXTEN İŞLEMLERİ =====

    /**
     * Taxten'e fatura gönder
     */
    async sendToTaxten(faturaId) {
        return this.request(`/faturalar/${faturaId}/taxten-gonder`, {
            method: 'POST'
        });
    }

    /**
     * Taxten'den fatura durumunu sorgula
     */
    async checkTaxtenStatus(faturaId) {
        return this.request(`/faturalar/${faturaId}/taxten-durum`, {
            method: 'GET'
        });
    }

    /**
     * Taxten UUID ile sorgula
     */
    async getByTaxtenUuid(uuid) {
        return this.request(`/faturalar/taxten-uuid/${uuid}`);
    }

    // ===== PDF VE YAZDIRMA =====

    /**
     * Fatura PDF'i indir
     */
    async downloadPDF(faturaId) {
        const response = await fetch(`${this.baseUrl}/faturalar/${faturaId}/pdf`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'PDF indirme hatası');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fatura-${faturaId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    /**
     * Fatura önizleme URL'i al
     */
    getPreviewUrl(faturaId) {
        return `${this.baseUrl}/faturalar/${faturaId}/preview?token=${this.token}`;
    }

    // ===== İPTAL VE İADE =====

    /**
     * Fatura iptal et
     */
    async cancelFatura(faturaId, aciklama) {
        return this.request(`/faturalar/${faturaId}/iptal`, {
            method: 'POST',
            body: JSON.stringify({ aciklama })
        });
    }

    /**
     * İade faturası oluştur
     */
    async createIadeFatura(faturaId, iadeData) {
        return this.request(`/faturalar/${faturaId}/iade`, {
            method: 'POST',
            body: JSON.stringify(iadeData)
        });
    }

    // ===== İSTATİSTİKLER =====

    /**
     * Fatura istatistikleri getir
     */
    async getIstatistikler(tarihAraligi = {}) {
        const queryParams = new URLSearchParams();
        if (tarihAraligi.baslangic) queryParams.append('baslangic', tarihAraligi.baslangic);
        if (tarihAraligi.bitis) queryParams.append('bitis', tarihAraligi.bitis);
        
        return this.request(`/faturalar/istatistikler?${queryParams.toString()}`);
    }

    /**
     * Tahsilat durumu güncelle
     */
    async updateTahsilat(faturaId, tahsilatData) {
        return this.request(`/faturalar/${faturaId}/tahsilat`, {
            method: 'PUT',
            body: JSON.stringify(tahsilatData)
        });
    }
}

// Global instance
window.faturaService = new FaturaService();