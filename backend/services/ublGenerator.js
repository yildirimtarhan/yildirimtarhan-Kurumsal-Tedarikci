const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const xml2js = require('xml2js');

class UBLGenerator {
  constructor() {
    this.builder = new xml2js.Builder({
      headless: false,
      renderOpts: { pretty: true, indent: '  ' }
    });
  }

  async generateInvoice(faturaData, gondericiBilgileri) {
    const uuid = uuidv4();
    const now = new Date();
    const tarih = now.toISOString().split('T')[0];
    const saat = now.toTimeString().split(' ')[0];
    
    const ubl = {
      'Invoice': {
        '$': {
          'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
          'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
          'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
          'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
        },
        'cbc:UBLVersionID': '2.1',
        'cbc:CustomizationID': 'TR1.2',
        'cbc:ProfileID': 'TEMELFATURA',
        'cbc:ID': faturaData.faturaNo || 'TASLAK',
        'cbc:CopyIndicator': 'false',
        'cbc:UUID': uuid,
        'cbc:IssueDate': tarih,
        'cbc:IssueTime': saat,
        'cbc:InvoiceTypeCode': 'SATIS',
        'cbc:DocumentCurrencyCode': 'TRY',
        'cbc:LineCountNumeric': faturaData.kalemler.length.toString(),
        'cbc:Note': faturaData.aciklama || 'İş bu fatura muhteviyatına 7 gün içerisinde itiraz edilmediği taktirde aynen kabul edilmiş sayılır.',
        
        ...(faturaData.custInvId && {
          'cac:AdditionalDocumentReference': {
            'cbc:ID': faturaData.custInvId,
            'cbc:IssueDate': tarih,
            'cbc:DocumentTypeCode': 'CUST_INV_ID'
          }
        }),
        
        'cac:Signature': {
          'cbc:ID': 'Signature_' + uuid.substring(0, 8),
          'cac:SignatoryParty': {
            'cac:PartyIdentification': {
              'cbc:ID': {
                '$': { 'schemeID': 'VKN' },
                '_': gondericiBilgileri.vkn
              }
            },
            'cac:PostalAddress': {
              'cbc:StreetName': gondericiBilgileri.adres?.cadde || '',
              'cbc:BuildingNumber': gondericiBilgileri.adres?.binaNo || '',
              'cbc:CitySubdivisionName': gondericiBilgileri.adres?.ilce || '',
              'cbc:CityName': gondericiBilgileri.adres?.il || '',
              'cbc:PostalZone': gondericiBilgileri.adres?.postaKodu || '',
              'cac:Country': { 'cbc:Name': 'Türkiye' }
            }
          },
          'cac:DigitalSignatureAttachment': {
            'cac:ExternalReference': { 'cbc:URI': '#' + uuid }
          }
        },
        
        'cac:AccountingSupplierParty': {
          'cac:Party': {
            'cbc:WebsiteURI': gondericiBilgileri.website || '',
            'cac:PartyIdentification': {
              'cbc:ID': {
                '$': { 'schemeID': 'VKN' },
                '_': gondericiBilgileri.vkn
              }
            },
            'cac:PartyName': { 'cbc:Name': gondericiBilgileri.unvan },
            'cac:PostalAddress': {
              'cbc:ID': gondericiBilgileri.adresId || '',
              'cbc:StreetName': gondericiBilgileri.adres?.cadde || '',
              'cbc:BuildingNumber': gondericiBilgileri.adres?.binaNo || '',
              'cbc:CitySubdivisionName': gondericiBilgileri.adres?.ilce || '',
              'cbc:CityName': gondericiBilgileri.adres?.il || '',
              'cbc:PostalZone': gondericiBilgileri.adres?.postaKodu || '',
              'cac:Country': { 'cbc:Name': 'Türkiye' }
            },
            'cac:PartyTaxScheme': {
              'cac:TaxScheme': { 'cbc:Name': gondericiBilgileri.vergiDairesi || '' }
            },
            'cac:Contact': {
              'cbc:Telephone': gondericiBilgileri.telefon || '',
              'cbc:ElectronicMail': gondericiBilgileri.email || ''
            }
          }
        },
        
        'cac:AccountingCustomerParty': {
          'cac:Party': {
            'cac:PartyIdentification': {
              'cbc:ID': {
                '$': { 'schemeID': faturaData.aliciVkn.length === 11 ? 'TCKN' : 'VKN' },
                '_': faturaData.aliciVkn
              }
            },
            'cac:PartyName': { 'cbc:Name': faturaData.aliciUnvan },
            'cac:PostalAddress': {
              'cbc:StreetName': faturaData.aliciAdres?.cadde || '',
              'cbc:BuildingNumber': faturaData.aliciAdres?.binaNo || '',
              'cbc:CitySubdivisionName': faturaData.aliciAdres?.ilce || '',
              'cbc:CityName': faturaData.aliciAdres?.il || '',
              'cbc:PostalZone': faturaData.aliciAdres?.postaKodu || '',
              'cac:Country': { 'cbc:Name': 'Türkiye' }
            },
            'cac:PartyTaxScheme': {
              'cac:TaxScheme': { 'cbc:Name': faturaData.aliciVergiDairesi || '' }
            },
            'cac:Contact': {
              'cbc:Telephone': faturaData.aliciTelefon || '',
              'cbc:ElectronicMail': faturaData.aliciEmail || ''
            }
          }
        },
        
        ...(faturaData.odemeSekli && {
          'cac:PaymentMeans': {
            'cbc:PaymentMeansCode': this.getPaymentCode(faturaData.odemeSekli),
            'cbc:PaymentDueDate': faturaData.vadeTarihi || tarih,
            'cbc:InstructionNote': faturaData.odemeNotu || ''
          }
        }),
        
        'cac:TaxTotal': {
          'cbc:TaxAmount': {
            '$': { 'currencyID': 'TRY' },
            '_': faturaData.kdvTutari.toFixed(2)
          },
          'cac:TaxSubtotal': {
            'cbc:TaxableAmount': {
              '$': { 'currencyID': 'TRY' },
              '_': faturaData.matrah.toFixed(2)
            },
            'cbc:TaxAmount': {
              '$': { 'currencyID': 'TRY' },
              '_': faturaData.kdvTutari.toFixed(2)
            },
            'cbc:Percent': faturaData.kdvOrani.toString(),
            'cac:TaxCategory': {
              'cac:TaxScheme': {
                'cbc:Name': 'KDV',
                'cbc:TaxTypeCode': '0015'
              }
            }
          }
        },
        
        'cac:LegalMonetaryTotal': {
          'cbc:LineExtensionAmount': {
            '$': { 'currencyID': 'TRY' },
            '_': faturaData.matrah.toFixed(2)
          },
          'cbc:TaxExclusiveAmount': {
            '$': { 'currencyID': 'TRY' },
            '_': faturaData.matrah.toFixed(2)
          },
          'cbc:TaxInclusiveAmount': {
            '$': { 'currencyID': 'TRY' },
            '_': faturaData.toplamTutar.toFixed(2)
          },
          'cbc:PayableAmount': {
            '$': { 'currencyID': 'TRY' },
            '_': faturaData.toplamTutar.toFixed(2)
          }
        },
        
        'cac:InvoiceLine': faturaData.kalemler.map((kalem, index) => ({
          'cbc:ID': (index + 1).toString(),
          'cbc:InvoicedQuantity': {
            '$': { 'unitCode': this.getUnitCode(kalem.birim) },
            '_': kalem.miktar.toString()
          },
          'cbc:LineExtensionAmount': {
            '$': { 'currencyID': 'TRY' },
            '_': (kalem.miktar * kalem.birimFiyat).toFixed(2)
          },
          'cac:TaxTotal': {
            'cbc:TaxAmount': {
              '$': { 'currencyID': 'TRY' },
              '_': kalem.kdvTutari.toFixed(2)
            },
            'cac:TaxSubtotal': {
              'cbc:TaxableAmount': {
                '$': { 'currencyID': 'TRY' },
                '_': (kalem.miktar * kalem.birimFiyat).toFixed(2)
              },
              'cbc:TaxAmount': {
                '$': { 'currencyID': 'TRY' },
                '_': kalem.kdvTutari.toFixed(2)
              },
              'cbc:Percent': kalem.kdvOrani.toString(),
              'cac:TaxCategory': {
                'cac:TaxScheme': {
                  'cbc:Name': 'KDV',
                  'cbc:TaxTypeCode': '0015'
                }
              }
            }
          },
          'cac:Item': {
            'cbc:Name': kalem.malHizmet,
            ...(kalem.urunKodu && {
              'cac:SellersItemIdentification': {
                'cbc:ID': kalem.urunKodu
              }
            })
          },
          'cac:Price': {
            'cbc:PriceAmount': {
              '$': { 'currencyID': 'TRY' },
              '_': kalem.birimFiyat.toFixed(2)
            }
          }
        }))
      }
    };
    
    return {
      xml: this.builder.buildObject(ubl),
      uuid: uuid,
      faturaNo: faturaData.faturaNo
    };
  }
  
  getPaymentCode(odemeSekli) {
    const kodlar = {
      'NAKİT': '10',
      'KREDİ_KARTI': '48',
      'HAVALE_EFT': '30',
      'ÇEK': '20',
      'SENET': '21',
      'KAPIDA_ODEME': '1'
    };
    return kodlar[odemeSekli] || '1';
  }
  
  getUnitCode(birim) {
    const kodlar = {
      'ADET': 'C62',
      'KG': 'KGM',
      'LT': 'LTR',
      'MT': 'MTR',
      'M2': 'MTK',
      'M3': 'MTQ',
      'PAKET': 'PA',
      'KOLİ': 'CT',
      'PALET': 'D97'
    };
    return kodlar[birim] || 'C62';
  }
}

module.exports = UBLGenerator;