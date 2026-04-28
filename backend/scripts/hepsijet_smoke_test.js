const axios = require('axios');
const path = require('path');
const { randomUUID } = require('crypto');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function baseUrl() {
  const raw = process.env.HEPSIJET_API_URL || 'https://integration-apitest.hepsijet.com/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function basicAuthHeader() {
  const user = mustEnv('HEPSIJET_USER');
  const pass = mustEnv('HEPSIJET_PASSWORD');
  const token = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function getToken() {
  const url = `${baseUrl()}auth/getToken`;
  const merchantId = process.env.HEPSIJET_MERCHANT_ID || mustEnv('HEPSIJET_CUSTOMER_CODE');

  const res = await axios.post(
    url,
    {
      username: mustEnv('HEPSIJET_USER'),
      password: mustEnv('HEPSIJET_PASSWORD'),
      merchantId,
    },
    {
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    }
  );

  const body = res.data;
  const token = body?.token || body?.data?.token;
  if (!token) {
    throw new Error(`Token not found in response: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return token;
}

function buildCommonConfig() {
  return {
    companyName: process.env.HEPSIJET_COMPANY_NAME || 'KURUMSAL TEDARİKÇİ',
    abbreviationCode: mustEnv('HEPSIJET_CUSTOMER_CODE'),
    accountId: process.env.HEPSIJET_ACCOUNT_ID || undefined, // POD docs mention accountId (optional/parametric)

    sender: {
      companyAddressId: mustEnv('HEPSIJET_COMPANY_ADDRESS_ID'),
      country: process.env.HEPSIJET_SENDER_COUNTRY || 'Türkiye',
      city: process.env.HEPSIJET_SENDER_CITY || 'BALIKESİR',
      town: process.env.HEPSIJET_SENDER_TOWN || 'BANDIRMA',
      district: process.env.HEPSIJET_SENDER_DISTRICT || '',
      addressLine1:
        process.env.HEPSIJET_SENDER_ADDRESS_LINE1 ||
        'HACI YUSUF MH. ESER SK. NO:4-10 BANDIRMA-BALIKESİR',
    },
    currentXDockCode: mustEnv('HEPSIJET_XDOCK_CODE'),
  };
}

function buildReceiver() {
  const phone = process.env.HEPSIJET_TEST_PHONE || '05000000000';
  return {
    companyCustomerId: randomUUID(),
    firstName: process.env.HEPSIJET_TEST_FIRST_NAME || 'Test',
    lastName: process.env.HEPSIJET_TEST_LAST_NAME || 'Müşteri',
    phone1: phone,
    phone2: '',
    email: process.env.HEPSIJET_TEST_EMAIL || '',
  };
}

function buildRecipientAddress() {
  const cfg = buildCommonConfig();
  return {
    companyAddressId: randomUUID(),
    country: { name: 'Türkiye' },
    city: { name: process.env.HEPSIJET_TEST_CITY || cfg.sender.city },
    town: { name: process.env.HEPSIJET_TEST_TOWN || cfg.sender.town },
    district: { name: process.env.HEPSIJET_TEST_DISTRICT || cfg.sender.district || '' },
    addressLine1:
      process.env.HEPSIJET_TEST_ADDRESS_LINE1 ||
      'Test adres (lütfen HEPSIJET_TEST_ADDRESS_LINE1 ile gerçek teslimat adresi girin)',
  };
}

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildDeliveryBase({ customerDeliveryNo, productCode, deliveryType, deliverySlotOriginal, desi }) {
  const cfg = buildCommonConfig();
  const receiver = buildReceiver();
  const recipientAddress = buildRecipientAddress();
  const recipientPerson = `${receiver.firstName} ${receiver.lastName}`.trim();

  const company = {
    name: cfg.companyName,
    abbreviationCode: cfg.abbreviationCode,
  };
  if (cfg.accountId) company.accountId = cfg.accountId;

  return {
    company,
    delivery: {
      customerDeliveryNo,
      customerOrderId: customerDeliveryNo,
      totalParcels: '1',
      desi: String(desi),
      deliverySlotOriginal: String(deliverySlotOriginal),
      deliveryDateOriginal: todayPlus(1),
      deliveryType,
      product: { productCode },
      senderAddress: {
        companyAddressId: cfg.sender.companyAddressId,
        country: { name: cfg.sender.country },
        city: { name: cfg.sender.city },
        town: { name: cfg.sender.town },
        district: { name: cfg.sender.district },
        addressLine1: cfg.sender.addressLine1,
      },
      receiver,
      recipientAddress,
      recipientPerson,
      recipientPersonPhone1: receiver.phone1,
    },
    currentXDock: { abbreviationCode: cfg.currentXDockCode },
  };
}

async function sendDeliveryOrderEnhanced({ token, payload }) {
  const url = `${baseUrl()}delivery/sendDeliveryOrderEnhanced`;
  const res = await axios.post(url, payload, {
    headers: {
      Authorization: basicAuthHeader(),
      'X-Auth-Token': token,
      'Content-Type': 'application/json',
    },
    timeout: 120_000,
  });
  return res.data;
}

async function findAvailableReturnedDates({ token, startDate, endDate, city, town }) {
  const url = `${baseUrl()}delivery/findAvailableDeliveryDatesV2`;
  const res = await axios.get(url, {
    params: { startDate, endDate, deliveryType: 'RETURNED', city, town },
    headers: {
      Authorization: basicAuthHeader(),
      'X-Auth-Token': token,
    },
    timeout: 60_000,
  });
  return res.data;
}

async function getDeliveryTracking({ token, customerDeliveryNo }) {
  const url = `${baseUrl()}deliveryTransaction/getDeliveryTracking`;
  const res = await axios.post(
    url,
    { deliveries: [{ customerDeliveryNo }] },
    {
      headers: {
        Authorization: basicAuthHeader(),
        'X-Auth-Token': token,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    }
  );
  return res.data;
}

async function deliveryUpdateTotalParcel({ token, customerDeliveryNo, desiList }) {
  const url = `${baseUrl()}delivery-update`;
  const res = await axios.post(
    url,
    {
      deliveryUpdateType: 'TOTAL_PARCEL',
      customerDeliveryNo,
      totalParcelInfo: {
        totalParcel: desiList.length,
        desi: desiList,
      },
    },
    {
      headers: {
        Authorization: basicAuthHeader(),
        'X-Auth-Token': token,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    }
  );
  return res.data;
}

async function deleteDeliveryOrder({ token, customerDeliveryNo }) {
  const url = `${baseUrl()}delivery/deleteDeliveryOrder/${encodeURIComponent(customerDeliveryNo)}`;
  const res = await axios.post(
    url,
    { deleteReason: 'IPTAL' },
    {
      headers: {
        Authorization: basicAuthHeader(),
        'X-Auth-Token': token,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    }
  );
  return res.data;
}

async function settlementCities({ token }) {
  const url = `${baseUrl()}settlement/cities`;
  const res = await axios.get(url, {
    headers: { Authorization: basicAuthHeader(), 'X-Auth-Token': token },
    timeout: 60_000,
  });
  return res.data;
}

async function settlementTowns({ token, cityId, productCode, serviceType, deliveryType }) {
  const url = `${baseUrl()}settlement/city/${encodeURIComponent(cityId)}/towns`;
  const res = await axios.get(url, {
    params: { productCode, serviceType: serviceType || '', deliveryType },
    headers: { Authorization: basicAuthHeader(), 'X-Auth-Token': token },
    timeout: 60_000,
  });
  return res.data;
}

async function settlementDistricts({ token, townId, productCode, serviceType, deliveryType }) {
  const url = `${baseUrl()}settlement/town/${encodeURIComponent(townId)}/districts`;
  const res = await axios.get(url, {
    params: { productCode, serviceType: serviceType || '', deliveryType },
    headers: { Authorization: basicAuthHeader(), 'X-Auth-Token': token },
    timeout: 60_000,
  });
  return res.data;
}

function normalizeName(x) {
  return String(x || '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function pickFirstIdName(list, idKeys, nameKeys) {
  if (!Array.isArray(list) || !list.length) return null;
  const item = list[0];
  const id = idKeys.map((k) => item?.[k]).find((v) => v !== undefined && v !== null && v !== '');
  const name = nameKeys.map((k) => item?.[k]).find((v) => v !== undefined && v !== null && v !== '');
  if (!id || !name) return null;
  return { id, name };
}

async function resolveServiceableAddress({ token, productCode, serviceType, deliveryType }) {
  const preferredCityName = process.env.HEPSIJET_TEST_CITY || '';
  const preferredTownName = process.env.HEPSIJET_TEST_TOWN || '';

  const citiesRaw = await settlementCities({ token });
  const cities =
    citiesRaw?.data ||
    citiesRaw?.cities ||
    citiesRaw?.result ||
    (Array.isArray(citiesRaw) ? citiesRaw : []) ||
    [];

  let cityPick = null;
  if (preferredCityName) {
    const wanted = normalizeName(preferredCityName);
    const match = (Array.isArray(cities) ? cities : []).find((c) => normalizeName(c?.name || c?.cityName) === wanted);
    if (match) {
      const id = match?.id ?? match?.cityId ?? match?.value ?? match?.code;
      const name = match?.name ?? match?.cityName;
      if (id && name) cityPick = { id, name };
    }
  }
  if (!cityPick) {
    cityPick = pickFirstIdName(cities, ['id', 'cityId', 'value', 'code'], ['name', 'cityName']);
  }
  if (!cityPick) {
    throw new Error(`Settlement cities empty/unparseable: ${JSON.stringify(citiesRaw).slice(0, 500)}`);
  }

  const townsRaw = await settlementTowns({
    token,
    cityId: cityPick.id,
    productCode,
    serviceType,
    deliveryType,
  });
  const towns =
    townsRaw?.data ||
    townsRaw?.towns ||
    townsRaw?.result ||
    (Array.isArray(townsRaw) ? townsRaw : []) ||
    [];

  let townPick = null;
  if (preferredTownName) {
    const wanted = normalizeName(preferredTownName);
    const match = (Array.isArray(towns) ? towns : []).find((t) => normalizeName(t?.name || t?.townName) === wanted);
    if (match) {
      const id = match?.id ?? match?.townId ?? match?.value ?? match?.code;
      const name = match?.name ?? match?.townName;
      if (id && name) townPick = { id, name };
    }
  }
  if (!townPick) {
    townPick = pickFirstIdName(towns, ['id', 'townId', 'value', 'code'], ['name', 'townName']);
  }
  if (!townPick) {
    throw new Error(`No serviceable towns for cityId=${cityPick.id} (${cityPick.name})`);
  }

  const districtsRaw = await settlementDistricts({
    token,
    townId: townPick.id,
    productCode,
    serviceType,
    deliveryType,
  });
  const districts =
    districtsRaw?.data ||
    districtsRaw?.districts ||
    districtsRaw?.result ||
    (Array.isArray(districtsRaw) ? districtsRaw : []) ||
    [];
  const districtPick = pickFirstIdName(districts, ['id', 'districtId', 'value', 'code'], ['name', 'districtName']);

  const resolved = {
    city: cityPick.name,
    town: townPick.name,
    district: districtPick?.name || '',
  };
  if (process.env.HEPSIJET_DEBUG === '1') {
    process.stdout.write(
      `[Settlement] productCode=${productCode} serviceType=${serviceType || ''} deliveryType=${deliveryType} -> ${resolved.city}/${resolved.town}/${resolved.district}\n`
    );
  }
  return resolved;
}

function prefixDeliveryNo(suffix) {
  const prefix = process.env.HEPSIJET_TEST_PREFIX || 'TST';
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${prefix}${ts}${suffix}`;
}

async function runScenario(name, fn) {
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    const out = await fn();
    process.stdout.write(`✅ OK\n`);
    return { ok: true, out };
  } catch (e) {
    const data = e?.response?.data;
    process.stdout.write(`❌ FAIL: ${e.message}\n`);
    if (data) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return { ok: false, error: e };
  }
}

function safeStringify(x) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeReport(reportPath, reportObj) {
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, safeStringify(reportObj), 'utf8');
}

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    env: {
      baseUrl: baseUrl(),
      merchantId: process.env.HEPSIJET_MERCHANT_ID || process.env.HEPSIJET_CUSTOMER_CODE || null,
      customerCode: process.env.HEPSIJET_CUSTOMER_CODE || null,
      companyAddressId: process.env.HEPSIJET_COMPANY_ADDRESS_ID || null,
      xDockCode: process.env.HEPSIJET_XDOCK_CODE || null,
    },
    scenarios: [],
  };
  const reportId = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'tmp', `hepsijet_smoke_report_${reportId}.json`);

  const token = await runScenario('Auth: getToken', async () => await getToken());
  if (!token.ok) process.exitCode = 1;
  if (!token.ok) return;

  const xAuthToken = token.out;

  const results = [];

  results.push(
    await runScenario('STD: sendDeliveryOrderEnhanced (HX_STD)', async () => {
      const payload = buildDeliveryBase({
        customerDeliveryNo: prefixDeliveryNo('STD'),
        productCode: 'HX_STD',
        deliveryType: 'RETAIL',
        deliverySlotOriginal: '0',
        desi: 1,
      });
      const resp = await sendDeliveryOrderEnhanced({ token: xAuthToken, payload });
      report.scenarios.push({ name: 'STD', ok: true, request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload }, response: resp });
      return resp;
    })
  );

  results.push(
    await runScenario('SD: sendDeliveryOrderEnhanced (HX_SD, slot=1)', async () => {
      const addr = await resolveServiceableAddress({
        token: xAuthToken,
        productCode: 'HX_SD',
        serviceType: '',
        deliveryType: 'RETAIL',
      });
      const payload = buildDeliveryBase({
        customerDeliveryNo: prefixDeliveryNo('SD'),
        productCode: 'HX_SD',
        deliveryType: 'RETAIL',
        deliverySlotOriginal: '1',
        desi: 1,
      });
      payload.delivery.recipientAddress.city.name = addr.city;
      payload.delivery.recipientAddress.town.name = addr.town;
      payload.delivery.recipientAddress.district.name = addr.district;
      try {
        const resp = await sendDeliveryOrderEnhanced({ token: xAuthToken, payload });
        report.scenarios.push({ name: 'SD', ok: true, request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload }, response: resp });
        return resp;
      } catch (e) {
        report.scenarios.push({
          name: 'SD',
          ok: false,
          request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload },
          error: { message: e.message, status: e?.response?.status || null, data: e?.response?.data || null },
        });
        throw e;
      }
    })
  );

  results.push(
    await runScenario('ND: sendDeliveryOrderEnhanced (HX_ND, slot=1)', async () => {
      const addr = await resolveServiceableAddress({
        token: xAuthToken,
        productCode: 'HX_ND',
        serviceType: '',
        deliveryType: 'RETAIL',
      });
      const payload = buildDeliveryBase({
        customerDeliveryNo: prefixDeliveryNo('ND'),
        productCode: 'HX_ND',
        deliveryType: 'RETAIL',
        deliverySlotOriginal: '1',
        desi: 1,
      });
      payload.delivery.recipientAddress.city.name = addr.city;
      payload.delivery.recipientAddress.town.name = addr.town;
      payload.delivery.recipientAddress.district.name = addr.district;
      try {
        const resp = await sendDeliveryOrderEnhanced({ token: xAuthToken, payload });
        report.scenarios.push({ name: 'ND', ok: true, request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload }, response: resp });
        return resp;
      } catch (e) {
        report.scenarios.push({
          name: 'ND',
          ok: false,
          request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload },
          error: { message: e.message, status: e?.response?.status || null, data: e?.response?.data || null },
        });
        throw e;
      }
    })
  );

  results.push(
    await runScenario('DT: sendDeliveryOrderEnhanced (HJ_DT)', async () => {
      const addr = await resolveServiceableAddress({
        token: xAuthToken,
        productCode: 'HJ_DT',
        serviceType: '',
        deliveryType: 'RETAIL',
      });
      const payload = buildDeliveryBase({
        customerDeliveryNo: prefixDeliveryNo('DT'),
        productCode: 'HJ_DT',
        deliveryType: 'RETAIL',
        deliverySlotOriginal: '0',
        desi: 1,
      });
      payload.delivery.recipientAddress.city.name = addr.city;
      payload.delivery.recipientAddress.town.name = addr.town;
      payload.delivery.recipientAddress.district.name = addr.district;
      try {
        const resp = await sendDeliveryOrderEnhanced({ token: xAuthToken, payload });
        report.scenarios.push({ name: 'DT', ok: true, request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload }, response: resp });
        return resp;
      } catch (e) {
        report.scenarios.push({
          name: 'DT',
          ok: false,
          request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload },
          error: { message: e.message, status: e?.response?.status || null, data: e?.response?.data || null },
        });
        throw e;
      }
    })
  );

  results.push(
    await runScenario('XL: sendDeliveryOrderEnhanced (HX_STD, desi>=41.11)', async () => {
      const payload = buildDeliveryBase({
        customerDeliveryNo: prefixDeliveryNo('XL'),
        productCode: 'HX_STD',
        deliveryType: 'RETAIL',
        deliverySlotOriginal: '0',
        desi: 41.11,
      });
      payload.serviceType = ['TMH'];
      const resp = await sendDeliveryOrderEnhanced({ token: xAuthToken, payload });
      report.scenarios.push({ name: 'XL', ok: true, request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload }, response: resp });
      return resp;
    })
  );

  results.push(
    await runScenario('POD: sendDeliveryOrderEnhanced (serviceType=POD + deliveryAmountList)', async () => {
      const payload = buildDeliveryBase({
        customerDeliveryNo: prefixDeliveryNo('POD'),
        productCode: 'HX_STD',
        deliveryType: 'RETAIL',
        deliverySlotOriginal: '0',
        desi: 1,
      });
      payload.serviceType = ['POD'];
      payload.deliveryAmountList = [
        { amount: '10000', description: 'Ürün Bedeli', type: 'PRODUCT_AMOUNT', currency: 'TRY' },
      ];
      const resp = await sendDeliveryOrderEnhanced({ token: xAuthToken, payload });
      report.scenarios.push({ name: 'POD', ok: true, request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload }, response: resp });
      return resp;
    })
  );

  results.push(
    await runScenario('RETURNED: findAvailableDeliveryDatesV2 + create (RETURNED)', async () => {
      const cfg = buildCommonConfig();
      const retAddr = await resolveServiceableAddress({
        token: xAuthToken,
        productCode: 'HX_STD',
        serviceType: '',
        deliveryType: 'RETAIL',
      });
      const city = retAddr.city || process.env.HEPSIJET_TEST_CITY || cfg.sender.city;
      const town = retAddr.town || process.env.HEPSIJET_TEST_TOWN || cfg.sender.town;
      const startDate = todayPlus(1);
      const endDate = todayPlus(10);
      const dates = await findAvailableReturnedDates({ token: xAuthToken, startDate, endDate, city, town });

      const payload = buildDeliveryBase({
        customerDeliveryNo: prefixDeliveryNo('RET'),
        productCode: 'HX_STD',
        deliveryType: 'RETURNED',
        deliverySlotOriginal: '0',
        desi: 1,
      });

      // RETURNED role swap: senderAddress becomes customer pickup address; recipientAddress becomes fixed company address.
      const receiver = payload.delivery.receiver;
      payload.delivery.senderAddress = {
        companyAddressId: randomUUID(),
        country: { name: 'Türkiye' },
        city: { name: city },
        town: { name: town },
        district: { name: retAddr.district || process.env.HEPSIJET_TEST_DISTRICT || '' },
        addressLine1:
          process.env.HEPSIJET_TEST_ADDRESS_LINE1 ||
          'Test iade alım adresi (lütfen HEPSIJET_TEST_ADDRESS_LINE1 girin)',
      };
      payload.delivery.recipientAddress = {
        companyAddressId: cfg.sender.companyAddressId,
        country: { name: cfg.sender.country },
        city: { name: cfg.sender.city },
        town: { name: cfg.sender.town },
        district: { name: cfg.sender.district },
        addressLine1: cfg.sender.addressLine1,
      };
      payload.delivery.recipientPerson = process.env.HEPSIJET_RETURN_RECIPIENT_PERSON || 'İade Depo';
      payload.delivery.recipientPersonPhone1 = process.env.HEPSIJET_RETURN_RECIPIENT_PHONE || receiver.phone1;
      payload.__returnedDates = dates;

      try {
        const resp = await sendDeliveryOrderEnhanced({ token: xAuthToken, payload });
        report.scenarios.push({
          name: 'RETURNED',
          ok: true,
          request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload },
          response: resp,
          returnedDates: dates,
        });
        return resp;
      } catch (e) {
        report.scenarios.push({
          name: 'RETURNED',
          ok: false,
          request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload },
          returnedDates: dates,
          error: { message: e.message, status: e?.response?.status || null, data: e?.response?.data || null },
        });
        throw e;
      }
    })
  );

  results.push(
    await runScenario('XL RETURNED (TMH): create', async () => {
      const cfg = buildCommonConfig();
      const retAddr = await resolveServiceableAddress({
        token: xAuthToken,
        productCode: 'HX_STD',
        serviceType: 'TMH',
        deliveryType: 'RETAIL',
      });
      const city = retAddr.city || process.env.HEPSIJET_TEST_CITY || cfg.sender.city;
      const town = retAddr.town || process.env.HEPSIJET_TEST_TOWN || cfg.sender.town;
      const payload = buildDeliveryBase({
        customerDeliveryNo: prefixDeliveryNo('XLR'),
        productCode: 'HX_STD',
        deliveryType: 'RETURNED',
        deliverySlotOriginal: '0',
        desi: 41.11,
      });
      payload.serviceType = ['TMH'];

      const receiver = payload.delivery.receiver;
      payload.delivery.senderAddress = {
        companyAddressId: randomUUID(),
        country: { name: 'Türkiye' },
        city: { name: city },
        town: { name: town },
        district: { name: retAddr.district || process.env.HEPSIJET_TEST_DISTRICT || '' },
        addressLine1:
          process.env.HEPSIJET_TEST_ADDRESS_LINE1 ||
          'Test iade alım adresi (lütfen HEPSIJET_TEST_ADDRESS_LINE1 girin)',
      };
      payload.delivery.recipientAddress = {
        companyAddressId: cfg.sender.companyAddressId,
        country: { name: cfg.sender.country },
        city: { name: cfg.sender.city },
        town: { name: cfg.sender.town },
        district: { name: cfg.sender.district },
        addressLine1: cfg.sender.addressLine1,
      };
      payload.delivery.recipientPerson = process.env.HEPSIJET_RETURN_RECIPIENT_PERSON || 'İade Depo';
      payload.delivery.recipientPersonPhone1 = process.env.HEPSIJET_RETURN_RECIPIENT_PHONE || receiver.phone1;

      try {
        const resp = await sendDeliveryOrderEnhanced({ token: xAuthToken, payload });
        report.scenarios.push({
          name: 'XL_RETURNED_TMH',
          ok: true,
          request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload },
          response: resp,
        });
        return resp;
      } catch (e) {
        report.scenarios.push({
          name: 'XL_RETURNED_TMH',
          ok: false,
          request: { url: `${baseUrl()}delivery/sendDeliveryOrderEnhanced`, payload },
          error: { message: e.message, status: e?.response?.status || null, data: e?.response?.data || null },
        });
        throw e;
      }
    })
  );

  // Post-checks (tracking + update + delete) only for scenarios that created customerDeliveryNo we can recover.
  const successful = results
    .filter((r) => r.ok)
    .map((r) => r.out)
    .filter(Boolean);

  const firstDeliveryNo =
    successful[0]?.delivery?.customerDeliveryNo ||
    successful[0]?.customerDeliveryNo ||
    successful[0]?.data?.customerDeliveryNo ||
    null;

  if (firstDeliveryNo) {
    await runScenario('Tracking: getDeliveryTracking (first created)', async () => {
      const resp = await getDeliveryTracking({ token: xAuthToken, customerDeliveryNo: firstDeliveryNo });
      report.scenarios.push({
        name: 'TRACKING',
        ok: true,
        request: { url: `${baseUrl()}deliveryTransaction/getDeliveryTracking`, payload: { deliveries: [{ customerDeliveryNo: firstDeliveryNo }] } },
        response: resp,
      });
      return resp;
    });

    await runScenario('Update: TOTAL_PARCEL (first created)', async () => {
      const resp = await deliveryUpdateTotalParcel({ token: xAuthToken, customerDeliveryNo: firstDeliveryNo, desiList: [1, 2, 3] });
      report.scenarios.push({
        name: 'UPDATE_TOTAL_PARCEL',
        ok: true,
        request: {
          url: `${baseUrl()}delivery-update`,
          payload: {
            deliveryUpdateType: 'TOTAL_PARCEL',
            customerDeliveryNo: firstDeliveryNo,
            totalParcelInfo: { totalParcel: 3, desi: [1, 2, 3] },
          },
        },
        response: resp,
      });
      return resp;
    });

    await runScenario('Delete: deleteDeliveryOrder (first created)', async () => {
      const resp = await deleteDeliveryOrder({ token: xAuthToken, customerDeliveryNo: firstDeliveryNo });
      report.scenarios.push({
        name: 'DELETE',
        ok: true,
        request: { url: `${baseUrl()}delivery/deleteDeliveryOrder/${firstDeliveryNo}`, payload: { deleteReason: 'IPTAL' } },
        response: resp,
      });
      return resp;
    });
  } else {
    process.stdout.write('\n(Tracking/Update/Delete) skipped: could not determine a created customerDeliveryNo from responses.\n');
  }

  report.finishedAt = new Date().toISOString();
  writeReport(reportPath, report);
  process.stdout.write(`\n[Report] ${reportPath}\n`);

  const failed = results.filter((r) => !r.ok).length;
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Fatal:', e?.response?.data || e);
  process.exitCode = 1;
});

