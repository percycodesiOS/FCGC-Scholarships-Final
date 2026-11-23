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
    const deadlineSrc = readFileSync(path.join(ROOT, 'lib/deadline.ts'), 'utf8');
    writeFileSync(path.join(TMP, 'deadline.mts'), deadlineSrc, 'utf8');
    const src = readFileSync(path.join(ROOT, 'lib/security.ts'), 'utf8')
      .replace(
        "import { env } from 'cloudflare:workers';",
        'const env = { MAIL_ENCRYPTION_KEY: Buffer.from(new Uint8Array(32).fill(7)).toString("base64") };',
      )
      .replace("from './deadline';", "from './deadline.mts';");
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
  const edtUtc = sec.easternWallTimeToUtcMs('2027-06-18T16:30');
  assert.equal(new Date(edtUtc).toISOString(), '2027-06-18T20:30:00.000Z');
  const estUtc = sec.easternWallTimeToUtcMs('2027-01-15T16:30');
  assert.equal(new Date(estUtc).toISOString(), '2027-01-15T21:30:00.000Z');

  assert.equal(sec.isDeadlinePassed('2027-06-18T16:30', true, edtUtc - 1000), false);
  assert.equal(sec.isDeadlinePassed('2027-06-18T16:30', true, edtUtc), true);
  assert.equal(sec.isDeadlinePassed('2027-06-18T16:30', false, edtUtc + 999999), false);
  assert.match(sec.formatEasternDeadline('2027-06-18T16:30'), /June 18, 2027.*4:30 p\.m\. EDT/);
});

test('PDF scanner accepts Foundation masters + benign FAFSA zoom OpenAction, blocks JS/Launch/action OpenAction', async () => {
  const sec = await loadSecurityModule();
  for (const rel of [
    'public/apply/application.pdf',
    'public/apply/cover-letter.pdf',
    'public/apply/packet-blank.pdf',
  ]) {
    const res = sec.scanPdfForActiveContent(new Uint8Array(readFileSync(path.join(ROOT, rel))));
    assert.equal(res.ok, true, `${rel} should pass: ${res.ok ? '' : res.reason}`);
  }

  // Benign FAFSA / university viewer zoom array destination should PASS
  const benignFafsaPdf = new TextEncoder().encode(
    '%PDF-1.7\n1 0 obj << /Type /Catalog /OpenAction [3 0 R /FitH 792] >> endobj\n' + ' '.repeat(120) + '\n%%EOF',
  );
  assert.equal(sec.scanPdfForActiveContent(benignFafsaPdf).ok, true);

  // Executable OpenAction dictionary / JavaScript / Launch MUST FAIL
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

test('Applicant photo magic-byte validator accepts real JPEG/PNG and rejects spoofed files', async () => {
  const sec = await loadSecurityModule();
  const fakeJpg = new Uint8Array(256);
  fakeJpg[0] = 0xff;
  fakeJpg[1] = 0xd8;
  fakeJpg[2] = 0xff;
  const jpgCheck = sec.validatePhotoBytes(fakeJpg, 'image/jpeg');
  assert.equal(jpgCheck.ok, true);

  const fakePng = new Uint8Array(256);
  fakePng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngCheck = sec.validatePhotoBytes(fakePng, 'image/png');
  assert.equal(pngCheck.ok, true);

  const spoofed = new TextEncoder().encode('<html><script>alert(1)</script></html>'.repeat(10));
  assert.equal(sec.validatePhotoBytes(spoofed, 'image/jpeg').ok, false);
});

test('HKDF derives separate AES-GCM and HMAC subkeys and verifies Club Microsoft 365 admin sessions', async () => {
  const sec = await loadSecurityModule();
  const aesKey = await sec.deriveAesGcmKey('mail-storage');
  const hmacKey = await sec.deriveHmacKey('submission-token');
  assert.equal(aesKey.algorithm.name, 'AES-GCM');
  assert.equal(hmacKey.algorithm.name, 'HMAC');

  const token = await sec.signAdminSession('jmacek@foxchapelgolfclub.com', 'Janet Macek');
  const verified = await sec.verifyAdminSession(token);
  assert.ok(verified);
  assert.equal(verified.email, 'jmacek@foxchapelgolfclub.com');
  assert.equal(verified.provider, 'microsoft');

  // Tampering with signature must fail
  const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  assert.equal(await sec.verifyAdminSession(tampered), null);

  // Expired session must fail
  const expired = await sec.signAdminSession('jmacek@foxchapelgolfclub.com', 'Janet Macek', -5000);
  assert.equal(await sec.verifyAdminSession(expired), null);
});

test('Fetch Metadata guard blocks cross-site admin APIs while allowing OAuth & Club-framed student submissions', async () => {
  const sec = await loadSecurityModule();

  // Cross-site PUT to admin /api/content MUST be blocked
  const crossPut = new Request('https://example.test/api/content', {
    method: 'PUT',
    headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' },
  });
  const blocked = sec.checkFetchMetadata(crossPut);
  assert.ok(blocked && blocked.status === 403);

  // Same-origin PUT allowed
  const sameOriginPut = new Request('https://example.test/api/content', {
    method: 'PUT',
    headers: { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' },
  });
  assert.equal(sec.checkFetchMetadata(sameOriginPut), null);

  // Microsoft Entra OAuth callback allowed
  const oauthCallback = new Request('https://example.test/api/mail/microsoft/callback?code=abc&state=123', {
    method: 'GET',
    headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' },
  });
  assert.equal(sec.checkFetchMetadata(oauthCallback), null);

  // Club-framed student GET /api/application & POST /api/applications with matching Origin allowed
  const framedGet = new Request('https://example.test/api/application', {
    method: 'GET',
    headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' },
  });
  assert.equal(sec.checkFetchMetadata(framedGet), null);

  const framedPost = new Request('https://example.test/api/applications', {
    method: 'POST',
    headers: {
      Origin: 'https://example.test',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
    },
  });
  assert.equal(sec.checkFetchMetadata(framedPost), null);

  // Cross-site POST to /api/applications from an attacker origin MUST STILL BE BLOCKED
  const attackerPost = new Request('https://example.test/api/applications', {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
    },
  });
  assert.ok(sec.checkFetchMetadata(attackerPost)?.status === 403);
});

test('Security headers allow foxchapelgolfclub.org framing on public pages and strictly DENY framing on /manage', async () => {
  const sec = await loadSecurityModule();
  const applyResp = sec.applySecurityHeaders(
    new Request('https://fcgc.example/apply/index.html'),
    new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  );
  assert.equal(applyResp.headers.get('x-frame-options'), null);
  const applyCsp = applyResp.headers.get('content-security-policy') || '';
  assert.match(applyCsp, /frame-ancestors 'self' https:\/\/foxchapelgolfclub\.org https:\/\/www\.foxchapelgolfclub\.org/);
  assert.match(applyCsp, /frame-src 'self' blob:/);

  const manageResp = sec.applySecurityHeaders(
    new Request('https://fcgc.example/manage'),
    new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  );
  assert.equal(manageResp.headers.get('x-frame-options'), 'DENY');
  const manageCsp = manageResp.headers.get('content-security-policy') || '';
  assert.match(manageCsp, /frame-ancestors 'none'/);
  assert.match(manageCsp, /object-src 'none'/);
});

test('Content validation strips blank lines, removes wparks photoEmail requirement, and builds change summaries', async () => {
  const contentMod = await loadContentModule();
  assert.equal(contentMod.defaults.photoEmail, '');
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
  assert.equal(cleaned.photoEmail, '');

  const diff = contentMod.describeContentChanges(contentMod.defaults, cleaned);
  assert.ok(diff.some((d) => d.includes('2027 -> 2028')));
  assert.ok(diff.some((d) => d.includes('Automatic close set to 2028-06-16 16:30 ET')));

  const pub = contentMod.publicContentView(cleaned);
  assert.equal('revision' in pub, false);
  assert.equal('submissionRecipients' in pub, false);
  assert.equal('photoEmail' in pub, false);
  assert.equal(pub.primaryRecipient, 'scholarshipfoundation@foxchapelgolfclub.com');
});
