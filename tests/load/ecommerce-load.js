import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const PROFILE = (__ENV.PROFILE || '100').toLowerCase();

const apiErrors = new Rate('api_error_rate');
const bundleLatency = new Trend('storefront_bundle_ms', true);
const catalogLatency = new Trend('catalog_list_ms', true);
const pdpLatency = new Trend('pdp_detail_ms', true);
const availLatency = new Trend('pdp_availability_ms', true);
const searchLatency = new Trend('search_ms', true);

const PROFILES = {
  smoke: [
    { duration: '5s', target: 10 },
    { duration: '10s', target: 10 },
    { duration: '3s', target: 0 },
  ],
  '100': [
    { duration: '5s', target: 100 },
    { duration: '15s', target: 100 },
    { duration: '5s', target: 0 },
  ],
  '500': [
    { duration: '8s', target: 250 },
    { duration: '10s', target: 500 },
    { duration: '15s', target: 500 },
    { duration: '5s', target: 0 },
  ],
  '1000': [
    { duration: '10s', target: 500 },
    { duration: '10s', target: 1000 },
    { duration: '15s', target: 1000 },
    { duration: '5s', target: 0 },
  ],
  '5000': [
    { duration: '30s', target: 1000 },
    { duration: '30s', target: 3000 },
    { duration: '30s', target: 5000 },
    { duration: '60s', target: 5000 },
    { duration: '15s', target: 0 },
  ],
  '10000': [
    { duration: '30s', target: 2000 },
    { duration: '45s', target: 5000 },
    { duration: '45s', target: 10000 },
    { duration: '90s', target: 10000 },
    { duration: '20s', target: 0 },
  ],
  progressive: [
    { duration: '15s', target: 100 },
    { duration: '20s', target: 500 },
    { duration: '30s', target: 1000 },
    { duration: '45s', target: 5000 },
    { duration: '60s', target: 10000 },
    { duration: '20s', target: 0 },
  ],
};

export const options = {
  stages: PROFILES[PROFILE] || PROFILES['100'],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    api_error_rate: ['rate<0.02'],
  },
  discardResponseBodies: false,
};

const PRODUCT_SLUGS = [
  'tailored-virgin-wool-suit',
  'tailored-virgin-wool-overcoat-with-cashmere-scarf',
  'sartorial-poplin-and-twill-dress-shirts-trio',
  'merino-wool-ribbed-turtleneck',
];

const SEARCH_TERMS = ['cashmere', 'shirt', 'wool', 'leather', 'coat'];

export default function () {
  const headers = {
    Accept: 'application/json',
    Origin: BASE_URL,
  };

  const roll = Math.random();
  const slug = PRODUCT_SLUGS[Math.floor(Math.random() * PRODUCT_SLUGS.length)];

  if (roll < 0.25) {
    // Storefront bootstrap published bundle (KV-cached hot path)
    const res = http.get(`${BASE_URL}/api/storefront/published`, { headers, tags: { endpoint: 'storefront_published' } });
    bundleLatency.add(res.timings.duration);
    const ok = check(res, {
      'published bundle 200': (r) => r.status === 200,
      'published bundle json success': (r) => r.body && r.body.includes('"success":true'),
    });
    apiErrors.add(!ok);
  } else if (roll < 0.45) {
    // Homepage static HTML
    const res = http.get(`${BASE_URL}/`, { tags: { endpoint: 'homepage_html' } });
    const ok = check(res, {
      'home 200': (r) => r.status === 200,
      'home html': (r) => r.body && r.body.includes('DEYNOLD DANNY'),
    });
    apiErrors.add(!ok);
  } else if (roll < 0.65) {
    // Catalog listing (KV-cached)
    const res = http.get(`${BASE_URL}/api/products?limit=24`, { headers, tags: { endpoint: 'catalog_list' } });
    catalogLatency.add(res.timings.duration);
    const ok = check(res, {
      'products 200': (r) => r.status === 200,
      'products success': (r) => r.body && r.body.includes('"success":true'),
    });
    apiErrors.add(!ok);
  } else if (roll < 0.80) {
    // PDP Detail + Live Availability
    const pdp = http.get(`${BASE_URL}/api/products/${slug}`, { headers, tags: { endpoint: 'pdp_detail' } });
    pdpLatency.add(pdp.timings.duration);
    const avail = http.get(`${BASE_URL}/api/products/${slug}/availability`, {
      headers,
      tags: { endpoint: 'pdp_availability' },
    });
    availLatency.add(avail.timings.duration);
    const ok =
      check(pdp, { 'pdp 200': (r) => r.status === 200 }) &&
      check(avail, { 'avail 200': (r) => r.status === 200 });
    apiErrors.add(!ok);
  } else if (roll < 0.92) {
    // FTS5 Search
    const q = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    const res = http.get(`${BASE_URL}/api/search?q=${q}`, { headers, tags: { endpoint: 'search' } });
    searchLatency.add(res.timings.duration);
    const ok = check(res, {
      'search 200': (r) => r.status === 200,
    });
    apiErrors.add(!ok);
  } else {
    // Health check
    const res = http.get(`${BASE_URL}/health`, { headers, tags: { endpoint: 'health' } });
    const ok = check(res, { 'health 200': (r) => r.status === 200 });
    apiErrors.add(!ok);
  }

  sleep(0.2 + Math.random() * 0.4);
}
