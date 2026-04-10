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
        this.baseUrl = process.env.HEPSIJET_API_URL || 'https://integration-apitest.hepsijet.com/';
        this.addressId = process.env.HEPSIJET_COMPANY_ADDRESS_ID || 'kuru-kurumsal-202';
        this.xdockCode = process.env.HEPSIJET_XDOCK_CODE || 'KURUMSALBANDIRMA';
        
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
                merchantId: this.customerCode
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
            return { status: 'error', message: 'Hepsijet not configured' };
        }

        try {
            const token = await this.getAuthToken();
            const response = await axios.get(`${this.baseUrl}rest/delivery/v1/tracking-history/${trackingNumber}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            return {
                status: 'success',
                data: response.data
            };

        } catch (error) {
            console.error('[Hepsijet Tracking Error]:', error.response?.data || error.message);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Create a delivery (Waybill)
     */
    async createDelivery(order) {
        if (!this.isConfigured) throw new Error('Hepsijet not configured');

        try {
            const token = await this.getAuthToken();
            
            // Format payload according to KURUMSAL RETAIL.json structure
            const payload = {
                company: {
                    name: "KURUMSAL TEDARİKÇİ",
                    abbreviationCode: this.customerCode
                },
                delivery: {
                    customerDeliveryNo: order._id.toString(),
                    customerOrderId: order._id.toString(),
                    deliveryDateOriginal: new Date().toISOString().split('T')[0],
                    desi: "1",
                    totalParcels: "1",
                    deliveryType: "RETAIL",
                    product: {
                        productCode: "HX_STD"
                    },
                    senderAddress: {
                        companyAddressId: this.addressId
                    },
                    receiver: {
                        name: order.shippingAddress?.fullName || 'Müşteri',
                        phone: order.shippingAddress?.phone || '',
                        city: { name: order.shippingAddress?.city || '' },
                        town: { name: order.shippingAddress?.district || '' },
                        district: { name: order.shippingAddress?.mahalle || '' },
                        addressLine1: order.shippingAddress?.address || ''
                    }
                }
            };

            const response = await axios.post(`${this.baseUrl}rest/delivery/v1/create-delivery`, [payload], {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            return {
                status: 'success',
                data: response.data
            };

        } catch (error) {
            console.error('[Hepsijet Dispatch Error]:', error.response?.data || error.message);
            return { status: 'error', message: error.response?.data?.message || error.message };
        }
    }
}

module.exports = new HepsiJetService();
