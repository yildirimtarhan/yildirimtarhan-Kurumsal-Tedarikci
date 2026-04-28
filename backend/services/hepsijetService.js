const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Hepsijet Service
 * Handles interactions with the Hepsijet tracking and dispatch API.
 * Needs HEPSIJET_API_KEY and HEPSIJET_COMPANY_CODE environment variables to operate.
 */
class HepsiJetService {
    constructor() {
        this.user = process.env.HEPSIJET_USER || '';
        this.password = process.env.HEPSIJET_PASSWORD || '';
        this.customerCode = process.env.HEPSIJET_CUSTOMER_CODE || 'KURUMSAL';
        this.merchantId = process.env.HEPSIJET_MERCHANT_ID || this.customerCode;
        const rawBase =
            process.env.HEPSIJET_API_URL ||
            process.env.HEPSIJET_BASE_URL ||
            'https://integration-apitest.hepsijet.com/';
        this.baseUrl = String(rawBase).endsWith('/') ? String(rawBase) : `${rawBase}/`;
        this.addressId = process.env.HEPSIJET_COMPANY_ADDRESS_ID || 'kuru-kurumsal-202';
        this.xdockCode = process.env.HEPSIJET_XDOCK_CODE || 'KURUMSALBANDIRMA';

        this.senderCountry = process.env.HEPSIJET_SENDER_COUNTRY || 'Türkiye';
        this.senderCity = process.env.HEPSIJET_SENDER_CITY || 'BALIKESİR';
        this.senderTown = process.env.HEPSIJET_SENDER_TOWN || 'BANDIRMA';
        this.senderDistrict = process.env.HEPSIJET_SENDER_DISTRICT || 'HACI YUSUF';
        this.senderAddressLine1 =
            process.env.HEPSIJET_SENDER_ADDRESS_LINE1 ||
            'HACI YUSUF MH. ESER SK. NO:4-10 BANDIRMA-BALIKESİR';
        
        this.token = null;
        this.tokenExpiry = null;
        this.isConfigured = !!this.user && !!this.password;
    }

    /**
     * Get Authentication Token (JWT)
     */
    async getAuthToken() {
        if (this.token && this.tokenExpiry > Date.now()) {
            return this.token;
        }

        try {
            // Updated to use the correct /auth/getToken endpoint found in integration environment
            const response = await axios.post(`${this.baseUrl}auth/getToken`, {
                username: this.user,
                password: this.password,
                merchantId: this.merchantId
            });

            if (response.data && response.data.status === 'SUCCESS' && response.data.token) {
                this.token = response.data.token;
                this.tokenExpiry = Date.now() + (20 * 60 * 60 * 1000);
                return this.token;
            }
            throw new Error(`Hepsijet auth failed: ${response.data?.message || 'No token received'}`);
        } catch (error) {
            console.error('[Hepsijet Auth Error]:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Track a shipment by its tracking number.
     * @param {string} trackingNumber - HJXXXXXX
     * @returns {Object} Tracking flow information.
     */
    async trackShipment(trackingNumber) {
        if (!this.isConfigured) {
            return { success: false, error: 'Hepsijet not configured' };
        }

        try {
            const token = await this.getAuthToken();
            const response = await axios.get(`${this.baseUrl}rest/delivery/v1/tracking-history/${trackingNumber}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            return {
                success: true,
                data: response.data,
            };

        } catch (error) {
            console.error('[Hepsijet Tracking Error]:', error.response?.data || error.message);
            return { success: false, error: error.response?.data?.message || error.message };
        }
    }

    /**
     * Create a delivery (Waybill)
     */
    async createDelivery(order) {
        if (!this.isConfigured) throw new Error('Hepsijet not configured');

        try {
            const token = await this.getAuthToken();
            
            const orderId = order?._id?.toString?.() || String(order?._id || '');
            const customerDeliveryNo =
                (order?.orderNumber && String(order.orderNumber)) ||
                (order?.erpOrderId && String(order.erpOrderId)) ||
                orderId;

            const deliveryDateOriginal = new Date().toISOString().split('T')[0];
            const totalParcels = String(order?.kargoBilgisi?.parcaSayisi || 1);
            const desi = String(order?.kargoBilgisi?.agirlik || 1);

            // Receiver / recipient mapping (Order schema: shippingAddress {fullName, phone, city, district, address})
            const fullName = String(order?.shippingAddress?.fullName || '').trim();
            const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
            const lastName = rest.length ? rest.join(' ') : '';

            const receiverPhone = String(order?.shippingAddress?.phone || '').trim();
            const receiverEmail = String(order?.email || '').trim();

            const payload = {
                company: {
                    name: "KURUMSAL TEDARİKÇİ",
                    abbreviationCode: this.customerCode
                },
                delivery: {
                    deliveryDateOriginal,
                    customerDeliveryNo,
                    customerOrderId: customerDeliveryNo,
                    desi,
                    totalParcels,
                    deliveryType: "RETAIL",
                    deliverySlotOriginal: "0",
                    product: {
                        productCode: "HX_STD"
                    },
                    senderAddress: {
                        companyAddressId: this.addressId,
                        country: { name: this.senderCountry },
                        city: { name: this.senderCity },
                        town: { name: this.senderTown },
                        district: { name: this.senderDistrict },
                        addressLine1: this.senderAddressLine1
                    },
                    receiver: {
                        companyCustomerId: order?.userId?.toString?.() || '',
                        firstName: firstName || 'Müşteri',
                        lastName,
                        phone1: receiverPhone,
                        phone2: "",
                        email: receiverEmail
                    },
                    recipientAddress: {
                        companyAddressId: "",
                        country: { name: "Türkiye" },
                        city: { name: String(order?.shippingAddress?.city || '').trim() },
                        town: { name: String(order?.shippingAddress?.district || '').trim() },
                        district: { name: String(order?.shippingAddress?.district || '').trim() },
                        addressLine1: String(order?.shippingAddress?.address || '').trim()
                    },
                    recipientPerson: fullName || `${firstName || 'Müşteri'}${lastName ? ' ' + lastName : ''}`,
                    recipientPersonPhone1: receiverPhone
                }
                ,
                currentXDock: {
                    abbreviationCode: this.xdockCode
                }
            };

            const response = await axios.post(`${this.baseUrl}rest/delivery/v1/create-delivery`, [payload], {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const body = response?.data;
            const trackingNo =
                body?.trackingNo ||
                body?.trackingNumber ||
                body?.deliveryNo ||
                body?.deliveryNumber ||
                body?.data?.trackingNo ||
                body?.data?.trackingNumber ||
                (Array.isArray(body) ? (body[0]?.trackingNo || body[0]?.trackingNumber || body[0]?.deliveryNo) : null) ||
                null;

            return {
                success: true,
                trackingNo,
                data: body,
            };

        } catch (error) {
            console.error('[Hepsijet Dispatch Error]:', error.response?.data || error.message);
            return { success: false, error: error.response?.data?.message || error.message };
        }
    }
}

module.exports = new HepsiJetService();
