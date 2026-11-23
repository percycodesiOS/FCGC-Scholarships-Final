'use strict';

// Files are combined on the applicant's device. Only Submit sends the resulting PDF and photo to the Foundation.
function validateAttachments(files) {
  if (files.length > 8) throw new Error('Choose up to eight supporting files.');
  let total = 0;
  for (const file of files) {
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      throw new Error('Supporting files must be PDF, JPG, or PNG.');
    }
    total += file.size;
    if (file.size > 5000000 || total > 15000000) {
      throw new Error('Keep each supporting file under 5 MB and all supporting files under 15 MB.');
    }
  }
}

async function appendAttachments(bytes, files) {
  validateAttachments(files);
  if (!files.length) return bytes;
  const { PDFDocument, PDFName } = PDFLib;
  const packet = await PDFDocument.load(bytes);
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    if (file.type === 'application/pdf') {
      let source;
      try { source = await PDFDocument.load(buffer); }
      catch { throw new Error(`Could not read ${file.name}. Use an unlocked PDF, JPG, or PNG.`); }
      if (source.getPageCount() > 30) throw new Error('Each supporting PDF may contain up to 30 pages.');
      const form = source.getForm();
      if (form.getFields().some(field => field instanceof PDFLib.PDFSignature)) {
        throw new Error(`${file.name} has a certificate signature. Upload a readable PDF copy so it can be included in the one application packet; retain the signed original.`);
      }
      if (form.getFields().length) form.flatten();
      for (const page of source.getPages()) page.node.delete(PDFName.of('Annots'));
      for (const page of await packet.copyPages(source, source.getPageIndices())) packet.addPage(page);
    } else {
      let picture;
      try { picture = file.type === 'image/png' ? await packet.embedPng(buffer) : await packet.embedJpg(buffer); }
      catch { throw new Error(`Could not read ${file.name}. Choose a valid JPG or PNG image.`); }
      const size = picture.scaleToFit(540, 720);
      const page = packet.addPage([612, 792]);
      page.drawImage(picture, { x: (612 - size.width) / 2, y: (792 - size.height) / 2, ...size });
    }
    if (packet.getPageCount() > 100) throw new Error('The completed packet may contain up to 100 pages.');
  }
  return packet.save();
}

const supportingFiles = document.getElementById('supportingFiles');
function describeAttachments() {
  const files = Array.from(supportingFiles.files);
  const status = document.getElementById('attachmentStatus');
  try {
    validateAttachments(files);
    status.className = 'small';
    status.textContent = files.length ? `${files.length} file(s) selected: ${files.map(file => file.name).join('; ')}. They will follow your application in the downloaded packet.` : 'No supporting files selected. Explain pending or unavailable documents in the application.';
  } catch (error) {
    status.className = 'error';
    status.textContent = error.message;
  }
  document.getElementById('clearAttachments').hidden = !files.length;
  document.getElementById('downloadReady').hidden = true;
}
supportingFiles.addEventListener('change', describeAttachments);
document.getElementById('clearAttachments').addEventListener('click', () => {
  supportingFiles.value = '';
  describeAttachments();
});

// Dedicated Applicant Digital Photo uploader with automatic browser resize/compression to crisp JPEG.
let preparedPhoto = null;
let photoPreviewUrl = null;

function clearPhotoPreviewUrl() {
  if (photoPreviewUrl) {
    URL.revokeObjectURL(photoPreviewUrl);
    photoPreviewUrl = null;
  }
}

async function normalizePhotoToJpeg(file) {
  const lowerName = (file.name || '').toLowerCase();
  if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
    throw new Error('iPhone HEIC photos are not supported directly. Please choose a JPG or PNG photo (on iPhone, pick Options → Most Compatible when sharing or upload a JPG copy).');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(lowerName)) {
    throw new Error('Choose a JPG, PNG, or WebP photo of the applicant.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Choose a photo smaller than 20 MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not open that photo. Please choose a standard JPG or PNG image.'));
      el.src = objectUrl;
    });
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not prepare the photo. Try a JPG or PNG image.'))),
        'image/jpeg',
        0.88,
      );
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > 4.5 * 1024 * 1024) {
      throw new Error('The photo is still too large after compression. Please choose a smaller JPG or PNG photo.');
    }
    const baseName = (file.name || 'applicant-photo').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'applicant-photo';
    return {
      bytes,
      file: new File([bytes], `${baseName}.jpg`, { type: 'image/jpeg' }),
      width,
      height,
      originalName: file.name,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const applicantPhotoInput = document.getElementById('applicantPhoto');
const photoPreviewWrap = document.getElementById('photoPreviewWrap');
const photoPreviewImg = document.getElementById('photoPreviewImg');
const photoFileName = document.getElementById('photoFileName');
const photoFileDetail = document.getElementById('photoFileDetail');
const photoStatus = document.getElementById('photoStatus');
const clearPhotoBtn = document.getElementById('clearPhoto');

function resetApplicantPhoto(silent = false) {
  preparedPhoto = null;
  clearPhotoPreviewUrl();
  if (applicantPhotoInput) applicantPhotoInput.value = '';
  if (photoPreviewWrap) photoPreviewWrap.hidden = true;
  if (photoPreviewImg) photoPreviewImg.removeAttribute('src');
  if (photoStatus && !silent) {
    photoStatus.className = 'hint';
    photoStatus.textContent = 'No applicant photo selected yet.';
  }
}

if (applicantPhotoInput) {
  applicantPhotoInput.addEventListener('change', async () => {
    const file = applicantPhotoInput.files?.[0];
    if (!file) {
      resetApplicantPhoto();
      window.dispatchEvent(new CustomEvent('fcgc-photo-changed'));
      return;
    }
    if (photoStatus) {
      photoStatus.className = 'hint';
      photoStatus.textContent = 'Preparing photo…';
    }
    try {
      const result = await normalizePhotoToJpeg(file);
      preparedPhoto = result;
      clearPhotoPreviewUrl();
      photoPreviewUrl = URL.createObjectURL(result.file);
      photoPreviewImg.src = photoPreviewUrl;
      photoFileName.textContent = result.originalName;
      photoFileDetail.textContent = `Ready · ${result.width}×${result.height} px · ${Math.max(1, Math.round(result.bytes.length / 1024))} KB JPEG (included in PDF & email)`;
      photoPreviewWrap.hidden = false;
      photoStatus.className = 'small';
      photoStatus.textContent = 'Applicant photo ready. It will be included directly inside your submitted application.';
    } catch (error) {
      resetApplicantPhoto(true);
      photoStatus.className = 'error';
      photoStatus.textContent = error instanceof Error ? error.message : 'Could not load that photo.';
    }
    window.dispatchEvent(new CustomEvent('fcgc-photo-changed'));
  });
}

if (clearPhotoBtn) {
  clearPhotoBtn.addEventListener('click', () => {
    resetApplicantPhoto();
    window.dispatchEvent(new CustomEvent('fcgc-photo-changed'));
  });
}

window.FCGCPhoto = {
  getPreparedPhoto: () => preparedPhoto,
  clearPhoto: () => resetApplicantPhoto(),
};
