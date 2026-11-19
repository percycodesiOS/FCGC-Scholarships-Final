import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const TMP = mkdtempSync(path.join(os.tmpdir(), 'fcgc-v2-test-'));
test.after(() => rmSync(TMP, { recursive: true, force: true }));

let secModPromise;
function loadSecurityModule() {
  if (!secModPromise) {
    const src = readFileSync(path.join(ROOT, 'lib/security.ts'), 'utf8').replace(
      "import { env } from 'cloudflare:workers';",
      'const env = { MAIL_ENCRYPTION_KEY: Buffer.from(new Uint8Array(32).fill(7)).toString("base64") };',
    );
    const out = path.join(TMP, 'security.mts');
    writeFileSync(out, src, 'utf8');
    secModPromise = import(pathToFileURL(out).href);
  }
  return secModPromise;
}

let contentModPromise;
function loadContentModule() {
  if (!contentModPromise) {
    const defaultsJson = readFileSync(path.join(ROOT, 'lib/default-content.json'), 'utf8');
    const src = readFileSync(path.join(ROOT, 'lib/content.ts'), 'utf8').replace(
      "import initial from './default-content.json';",
      `const initial = ${defaultsJson};`,
    );
    const out = path.join(TMP, 'content.mts');
    writeFileSync(out, src, 'utf8');
    contentModPromise = import(pathToFileURL(out).href);
  }
  return contentModPromise;
}

test('constant-time string comparison matches equal strings and rejects mismatches', async () => {
  const sec = await loadSecurityModule();
  assert.equal(sec.timingSafeEqualString('abc-123', 'abc-123'), true);
  assert.equal(sec.timingSafeEqualString('abc-123', 'abc-124'), false);
  assert.equal(sec.timingSafeEqualString('abc', 'abcd'), false);
  assert.equal(sec.timingSafeEqualString('', ''), true);
});

test('Eastern Time automatic deadline handles both EDT (summer) and EST (winter) accurately', async () => {
  const sec = await loadSecurityModule();
  // June 18, 2027 4:30 p.m. EDT = 20:30 UTC
  const edtUtc = sec.easternWallTimeToUtcMs('2027-06-18T16:30');
  assert.equal(new Date(edtUtc).toISOString(), '2027-06-18T20:30:00.000Z');
  // January 15, 2027 4:30 p.m. EST = 21:30 UTC
  const estUtc = sec.easternWallTimeToUtcMs('2027-01-15T16:30');
  assert.equal(new Date(estUtc).toISOString(), '2027-01-15T21:30:00.000Z');

  assert.equal(sec.isDeadlinePassed('2027-06-18T16:30', true, edtUtc - 1000), false);
  assert.equal(sec.isDeadlinePassed('2027-06-18T16:30', true, edtUtc), true);
  assert.equal(sec.isDeadlinePassed('2027-06-18T16:30', false, edtUtc + 999999), false);
  assert.match(sec.formatEasternDeadline('2027-06-18T16:30'), /June 18, 2027.*4:30 p\.m\. EDT/);
});

test('PDF active-content scanner accepts all three approved Foundation masters and blocks active JS/Launch PDFs', async () => {
  const sec = await loadSecurityModule();
  for (const rel of [
    'public/apply/application.pdf',
    'public/apply/cover-letter.pdf',
    'public/apply/packet-blank.pdf',
  ]) {
    const res = sec.scanPdfForActiveContent(new Uint8Array(readFileSync(path.join(ROOT, rel))));
    assert.equal(res.ok, true, `${rel} should pass: ${res.ok ? '' : res.reason}`);
  }

  const jsPdf = new TextEncoder().encode(
    '%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n' +
      ' '.repeat(120) +
      '\n%%EOF',
  );
  const launchPdf = new TextEncoder().encode(
    '%PDF-1.7\n1 0 obj << /A << /S /Launch /F (cmd.exe) >> >> endobj\n' + ' '.repeat(120) + '\n%%EOF',
  );
  const truncatedPdf = new TextEncoder().encode('%PDF-1.7\n' + 'x'.repeat(150));

  assert.equal(sec.scanPdfForActiveContent(jsPdf).ok, false);
  assert.equal(sec.scanPdfForActiveContent(launchPdf).ok, false);
  assert.equal(sec.scanPdfForActiveContent(truncatedPdf).ok, false);
});

test('HKDF derives separate AES-GCM and HMAC subkeys from MAIL_ENCRYPTION_KEY', async () => {
  const sec = await loadSecurityModule();
  const aesKey = await sec.deriveAesGcmKey('mail-storage');
  const hmacKey = await sec.deriveHmacKey('submission-token');
  assert.equal(aesKey.algorithm.name, 'AES-GCM');
  assert.equal(hmacKey.algorithm.name, 'HMAC');

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(JSON.stringify({ ok: true }));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, payload);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipher);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plain)), { ok: true });
});

test('Fetch Metadata guard blocks cross-site API requests while allowing Microsoft OAuth GET navigation callback', async () => {
  const sec = await loadSecurityModule();
  const crossPut = new Request('https://example.test/api/content', {
    method: 'PUT',
    headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' },
  });
  const blocked = sec.checkFetchMetadata(crossPut);
  assert.ok(blocked && blocked.status === 403);

  const sameOriginPut = new Request('https://example.test/api/content', {
    method: 'PUT',
    headers: { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' },
  });
  assert.equal(sec.checkFetchMetadata(sameOriginPut), null);

  const oauthCallback = new Request('https://example.test/api/mail/microsoft/callback?code=abc&state=123', {
    method: 'GET',
    headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' },
  });
  assert.equal(sec.checkFetchMetadata(oauthCallback), null);
});

test('Security headers apply full defense-in-depth including blob: frame-src on /apply for PDF preview', async () => {
  const sec = await loadSecurityModule();
  const applyResp = sec.applySecurityHeaders(
    new Request('https://fcgc.example/apply/index.html'),
    new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  );
  assert.equal(applyResp.headers.get('x-frame-options'), 'DENY');
  assert.equal(applyResp.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(applyResp.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(applyResp.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  assert.equal(applyResp.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(applyResp.headers.get('strict-transport-security') || '', /max-age=31536000/);
  const csp = applyResp.headers.get('content-security-policy') || '';
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /frame-src 'self' blob:/);
});

test('Content validation strips accidental blank lines and generates plain-English change summaries', async () => {
  const contentMod = await loadContentModule();
  const dirtyDraft = {
    ...contentMod.defaults,
    year: '2028',
    deadline: 'Friday, June 16, 2028 · 4:30 p.m. EDT',
    deadlineIso: '2028-06-16T16:30',
    eligibility: ['Rule 1', '', '   ', 'Rule 2'],
    requirements: ['Doc 1', ''],
  };
  const cleaned = contentMod.validate(dirtyDraft);
  assert.deepEqual(cleaned.eligibility, ['Rule 1', 'Rule 2']);
  assert.deepEqual(cleaned.requirements, ['Doc 1']);

  const diff = contentMod.describeContentChanges(contentMod.defaults, cleaned);
  assert.ok(diff.some((d) => d.includes('2027 -> 2028')));
  assert.ok(diff.some((d) => d.includes('Automatic close set to 2028-06-16 16:30 ET')));

  const pub = contentMod.publicContentView(cleaned);
  assert.equal('revision' in pub, false);
  assert.equal('submissionRecipients' in pub, false);
  assert.equal(pub.primaryRecipient, 'scholarshipfoundation@foxchapelgolfclub.com');
});
