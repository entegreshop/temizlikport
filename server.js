const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3080;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const RESERVATIONS_FILE = path.join(DATA_DIR, 'reservations.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-publishable-api-key'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 10 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function buildCorporateSvgLogo(companyName) {
  const clean = String(companyName || 'KURUMSAL').replace(/[<>&"']/g, '').toUpperCase();
  const initial = clean.charAt(0) || 'T';
  const colors = ['#0284c7', '#1d4ed8', '#059669', '#0f172a', '#4f46e5', '#0891b2'];
  const color = colors[clean.length % colors.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 64'><rect x='8' y='14' width='36' height='36' rx='9' fill='${color}'/><text x='26' y='39' text-anchor='middle' font-family='Space Grotesk, Arial, sans-serif' font-size='18' font-weight='900' fill='#ffffff'>${initial}</text><text x='54' y='39' font-family='Space Grotesk, Arial, sans-serif' font-size='17' font-weight='800' fill='#0f172a'>${clean.substring(0, 18)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function saveBase64Logo(base64Str, prefix = 'ref') {
  if (!base64Str || typeof base64Str !== 'string') return '';
  const match = base64Str.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return base64Str;
  const mime = match[1];
  const b64 = match[2];
  let ext = 'png';
  if (mime.includes('svg')) ext = 'svg';
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
  else if (mime.includes('webp')) ext = 'webp';

  const filename = `${prefix}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(b64, 'base64'));
  return `/api/media/${filename}`;
}

function sha256Hash(val) {
  if (!val) return undefined;
  const normalized = String(val).trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function dispatchMetaCapiEvent({ tracking, eventName, eventSourceUrl, clientIp, userAgent, customData, userData }) {
  return new Promise((resolve) => {
    const pixelId = String((tracking && tracking.metaPixelId) || '').trim();
    const accessToken = String((tracking && tracking.metaAccessToken) || '').trim();
    if (!pixelId || !accessToken) {
      return resolve({ skipped: true, reason: 'Meta Pixel ID veya CAPI Access Token tanımlı değil' });
    }

    const cleanPhone = String((userData && userData.phone) || '').replace(/\D/g, '');
    const normalizedPhone = cleanPhone.startsWith('0') ? '9' + cleanPhone : (cleanPhone && !cleanPhone.startsWith('90') ? '90' + cleanPhone : cleanPhone);

    const userPayload = {
      client_ip_address: clientIp || undefined,
      client_user_agent: userAgent || undefined
    };
    if (normalizedPhone) userPayload.ph = [sha256Hash(normalizedPhone)];
    if (userData && userData.company) userPayload.fn = [sha256Hash(userData.company)];

    const eventPayload = {
      data: [
        {
          event_name: eventName || 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: eventSourceUrl || 'https://temizlikport.com',
          user_data: userPayload,
          custom_data: customData || { currency: 'TRY', value: 0 }
        }
      ]
    };

    if (tracking.metaTestEventCode && String(tracking.metaTestEventCode).trim()) {
      eventPayload.test_event_code = String(tracking.metaTestEventCode).trim();
    }

    const postBody = JSON.stringify(eventPayload);
    const reqOpts = {
      hostname: 'graph.facebook.com',
      path: `/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      }
    };

    const fbReq = https.request(reqOpts, (fbRes) => {
      let raw = '';
      fbRes.on('data', d => { raw += d; });
      fbRes.on('end', () => {
        try {
          resolve({ status: fbRes.statusCode, response: JSON.parse(raw) });
        } catch {
          resolve({ status: fbRes.statusCode, raw });
        }
      });
    });
    fbReq.on('error', (err) => resolve({ error: err.message }));
    fbReq.write(postBody);
    fbReq.end();
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Healthcheck
  if (pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', platform: 'temizlikport.com', engine: 'Astro SSR + MedusaJS' });
  }

  // 2. Serve Uploaded Media (/api/media/:filename)
  const mediaMatch = pathname.match(/^\/api\/media\/([a-zA-Z0-9_.-]+)$/);
  if (mediaMatch && req.method === 'GET') {
    const file = path.basename(mediaMatch[1]);
    const fullPath = path.join(UPLOADS_DIR, file);
    if (!fs.existsSync(fullPath)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    return fs.createReadStream(fullPath).pipe(res);
  }

  // 3. MedusaJS Store API Compatible Endpoint: GET /store/products
  if (pathname === '/store/products' && req.method === 'GET') {
    const storeData = readJson(SERVICES_FILE, { services: [] });
    const products = (storeData.services || []).map(s => ({
      id: s.id,
      title: s.title,
      handle: s.handle,
      subtitle: s.subtitle,
      description: s.description,
      variants: [
        {
          id: s.medusaVariantId,
          title: 'Standart Kurumsal Paket',
          prices: [{ currency_code: 'try', amount: Number(s.basePriceTL || 2450) * 100 }]
        }
      ],
      metadata: {
        service_category: s.code,
        base_fee_tl: s.baseFee,
        rate_per_sqm_tl: s.ratePerSqm,
        unit_label: s.unitLabel,
        badge: s.badge,
        features: s.features
      }
    }));
    return sendJson(res, 200, { products, count: products.length });
  }

  // 4. GET & POST /api/services (Full Pricing Rules, Services, Frequencies, Addons, References & Tracking)
  if (pathname === '/api/services' && req.method === 'GET') {
    const data = readJson(SERVICES_FILE, {
      settings: {},
      tracking: {},
      frequencies: [],
      addons: [],
      services: [],
      referencesSettings: {},
      references: []
    });
    return sendJson(res, 200, { success: true, ...data });
  }

  if (pathname === '/api/services' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const current = readJson(SERVICES_FILE, {});
      const updated = {
        ...current,
        settings: body.settings ? { ...current.settings, ...body.settings } : current.settings,
        tracking: body.tracking ? { ...(current.tracking || {}), ...body.tracking } : (current.tracking || {}),
        frequencies: Array.isArray(body.frequencies) ? body.frequencies : current.frequencies,
        addons: Array.isArray(body.addons) ? body.addons : current.addons,
        services: Array.isArray(body.services) ? body.services : current.services,
        referencesSettings: body.referencesSettings
          ? { ...current.referencesSettings, ...body.referencesSettings }
          : current.referencesSettings,
        references: Array.isArray(body.references) ? body.references : current.references
      };
      writeJson(SERVICES_FILE, updated);
      return sendJson(res, 200, { success: true, ...updated });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  // 4b. GET /api/tracking/public (Storefront Tracking Config - Excludes secret CAPI token)
  if (pathname === '/api/tracking/public' && req.method === 'GET') {
    const current = readJson(SERVICES_FILE, {});
    const tr = current.tracking || {};
    return sendJson(res, 200, {
      success: true,
      tracking: {
        ga4MeasurementId: tr.ga4MeasurementId || '',
        gtmContainerId: tr.gtmContainerId || '',
        googleAdsId: tr.googleAdsId || '',
        googleAdsConversionLabel: tr.googleAdsConversionLabel || '',
        googleAdsWhatsappLabel: tr.googleAdsWhatsappLabel || '',
        metaPixelId: tr.metaPixelId || '',
        capiEnabled: Boolean(tr.metaPixelId && tr.metaAccessToken),
        customHeadHtml: tr.customHeadHtml || '',
        customBodyHtml: tr.customBodyHtml || ''
      }
    });
  }

  // 4c. POST /api/tracking/capi (Server-Side Meta Conversions API Endpoint)
  if (pathname === '/api/tracking/capi' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const current = readJson(SERVICES_FILE, {});
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      const result = await dispatchMetaCapiEvent({
        tracking: current.tracking || {},
        eventName: body.eventName || 'Lead',
        eventSourceUrl: body.eventSourceUrl || `https://${req.headers.host || 'temizlikport.com'}`,
        clientIp,
        userAgent,
        customData: body.customData || { currency: 'TRY', value: 0 },
        userData: body.userData || {}
      });

      return sendJson(res, 200, { success: true, capi: result });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  // 5. POST /api/references (Add new corporate reference logo to marquee band)
  if (pathname === '/api/references' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      if (!name) return sendJson(res, 400, { success: false, error: 'Firma adı zorunludur.' });

      const current = readJson(SERVICES_FILE, {});
      const refs = Array.isArray(current.references) ? current.references : [];

      let finalLogo = String(body.logoUrl || '').trim();
      if (body.logoBase64 && String(body.logoBase64).startsWith('data:image/')) {
        finalLogo = saveBase64Logo(body.logoBase64, 'ref');
      } else if (!finalLogo) {
        finalLogo = buildCorporateSvgLogo(name);
      }

      const newRef = {
        id: 'ref-' + Date.now(),
        name: name.toUpperCase(),
        sector: String(body.sector || 'Kurumsal Müşteri').trim(),
        logoUrl: finalLogo,
        active: true
      };
      refs.push(newRef);
      current.references = refs;
      writeJson(SERVICES_FILE, current);

      return sendJson(res, 201, { success: true, reference: newRef, references: refs });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  // 6. DELETE /api/references/:id
  const refDelMatch = pathname.match(/^\/api\/references\/([a-zA-Z0-9_-]+)$/);
  if (refDelMatch && req.method === 'DELETE') {
    const id = refDelMatch[1];
    const current = readJson(SERVICES_FILE, {});
    current.references = (current.references || []).filter(r => r.id !== id);
    writeJson(SERVICES_FILE, current);
    return sendJson(res, 200, { success: true, references: current.references });
  }

  // 7. POST /api/reservation.json (Create Instant Quote Reservation & Medusa LineItem)
  if ((pathname === '/api/reservation.json' || pathname === '/store/carts') && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const meta = body.metadata || {};
      const list = readJson(RESERVATIONS_FILE, []);
      const newRes = {
        id: 'RES-' + Math.floor(1000 + Math.random() * 9000),
        createdAt: new Date().toISOString(),
        status: 'Yeni Teklif Talebi',
        customerCompany: meta.customer_company || 'Kurumsal Müşteri',
        customerPhone: meta.customer_phone || '-',
        serviceType: meta.service_type || 'Kurumsal Ofis Temizliği',
        medusaVariantId: body.variant_id || 'variant_ofis_standart',
        squareMeters: Number(meta.square_meters || 100),
        roomCount: Number(meta.room_count || 1),
        restroomCount: Number(meta.restroom_count || 1),
        frequency: meta.frequency || 'Tek Seferlik',
        addons: meta.selected_addons || [],
        recommendedStaff: Number(meta.recommended_staff || 1),
        calculatedPriceTL: Number(meta.calculated_price_tl || 2450),
        preferredDate: meta.preferred_date || ''
      };
      list.unshift(newRes);
      writeJson(RESERVATIONS_FILE, list);

      // Automatically trigger Server-Side Meta CAPI Lead event if configured
      const storeConfig = readJson(SERVICES_FILE, {});
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';
      dispatchMetaCapiEvent({
        tracking: storeConfig.tracking || {},
        eventName: 'Lead',
        eventSourceUrl: `https://${req.headers.host || 'temizlikport.com'}/#fiyat-hesapla`,
        clientIp,
        userAgent,
        customData: {
          currency: 'TRY',
          value: newRes.calculatedPriceTL,
          content_name: newRes.serviceType,
          content_category: `${newRes.squareMeters} m2 - ${newRes.frequency}`
        },
        userData: {
          phone: newRes.customerPhone,
          company: newRes.customerCompany
        }
      }).catch(() => {});

      return sendJson(res, 201, {
        success: true,
        reservationId: newRes.id,
        cart: { id: 'cart_' + newRes.id, item: newRes }
      });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  // 8. GET /api/reservations
  if (pathname === '/api/reservations' && req.method === 'GET') {
    const reservations = readJson(RESERVATIONS_FILE, []);
    return sendJson(res, 200, { success: true, reservations });
  }

  // 9. Static & Page Routing
  let filePath = path.join(PUBLIC_DIR, 'index.html');
  if (pathname === '/admin' || pathname === '/admin.html') {
    filePath = path.join(PUBLIC_DIR, 'admin.html');
  } else if (pathname !== '/' && pathname !== '/index.html') {
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const candidate = path.join(PUBLIC_DIR, safePath);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      filePath = candidate;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/html; charset=utf-8';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(`🚀 TEMİZLİKPORT (Astro SSR + MedusaJS) Live!`);
  console.log(`📡 Storefront : http://localhost:${PORT}`);
  console.log(`⚙️  Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🛒 Medusa API : http://localhost:${PORT}/store/products`);
  console.log(`===================================================`);
});
