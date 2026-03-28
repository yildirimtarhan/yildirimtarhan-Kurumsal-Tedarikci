/**
 * Müşteri Fatura Servisi
 * Müşterilerin kendi faturalarını görüntülemesi ve indirmesi için
 */

class MusteriFaturaService {
    constructor() {
        // Backend API'yi kendi domain'imizden çağırıyoruz.
        // localhost geliştirme için port farklı olabiliyor.
        this.baseUrl = window.location.origin.includes('localhost')
            ? 'http://localhost:3000/api'
            : `${window.location.origin}/api`;
        this.token = localStorage.getItem('token') || sessionStorage.getItem('token');
        this.musteriId = localStorage.getItem('musteriId') || sessionStorage.getItem('musteriId');
    }

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

    // Müşterinin kendi faturalarını getir
    async getMusteriFaturalar(filters = {}) {
        const queryParams = new URLSearchParams();
        
        if (filters.durum) queryParams.append('durum', filters.durum);
        if (filters.baslangicTarihi) queryParams.append('baslangicTarihi', filters.baslangicTarihi);
        if (filters.bitisTarihi) queryParams.append('bitisTarihi', filters.bitisTarihi);
        if (filters.sayfa) queryParams.append('sayfa', filters.sayfa);
        if (filters.limit) queryParams.append('limit', filters.limit);

        return this.request(`/musteri/faturalar?${queryParams.toString()}`);
    }

    // Fatura detayı getir
    async getFaturaDetay(faturaId) {
        return this.request(`/musteri/faturalar/${faturaId}`);
    }

    // PDF indir
    async downloadPDF(faturaId) {
        const response = await fetch(`${this.baseUrl}/musteri/faturalar/${faturaId}/pdf`, {
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

    // Ödeme durumu kontrolü (vadesi yaklaşanlar)
    async getVadeYaklasanFaturalar() {
        return this.request('/musteri/faturalar/vade-yaklasan');
    }

    // Ödeme bildirimi gönder (manuel hatırlatma)
    async odemeHatirlatmaGonder(faturaId) {
        return this.request(`/musteri/faturalar/${faturaId}/hatirlatma`, {
            method: 'POST'
        });
    }
}

// Global instance
window.musteriFaturaService = new MusteriFaturaService();