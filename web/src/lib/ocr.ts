// OCR CCCD trong trình duyệt bằng Tesseract.js (vie+eng), miễn phí.
// Tăng độ chính xác bằng: tiền xử lý ảnh (phóng to + xám + tăng tương phản + nhị phân Otsu)
// và quét 2 lượt (1 lượt đọc chữ, 1 lượt riêng đọc số để lấy đúng số CCCD).

export interface OcrFields {
  cccd: string; fullName: string; dob: string; gender: string;
  hometown: string; address: string; issueDate: string; issuePlace: string;
  ocrConfidence: number; rawText: string;
}

function noAccent(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

// --------------------------- tiền xử lý ảnh ---------------------------

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Phóng to + chuyển xám + kéo giãn tương phản. Trả về {grayUrl, grayArr, w, h}. */
async function toGray(dataUrl: string): Promise<{ grayUrl: string; gray: Uint8ClampedArray; w: number; h: number }> {
  const img = await loadImg(dataUrl);
  const scale = Math.min(3, Math.max(1, 1500 / Math.max(img.width, img.height)));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const gray = new Uint8ClampedArray(w * h);
  // histogram để lấy ngưỡng 2%/98% (kéo giãn tương phản, bỏ outlier)
  const hist = new Array(256).fill(0);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    gray[j] = g; hist[g]++;
  }
  const total = w * h; let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.02) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const s = Math.max(0, Math.min(255, ((gray[j] - lo) * 255) / span));
    gray[j] = s; px[i] = px[i + 1] = px[i + 2] = s;
  }
  ctx.putImageData(data, 0, 0);
  return { grayUrl: c.toDataURL('image/jpeg', 0.92), gray, w, h };
}

/** Nhị phân hóa bằng ngưỡng Otsu → ảnh đen trắng sạch (tốt cho đọc số). */
function binarize(gray: Uint8ClampedArray, w: number, h: number): string {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0; for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0, wB = 0, max = 0, thr = 127;
  for (let v = 0; v < 256; v++) {
    wB += hist[v]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += v * hist[v];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; thr = v; }
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const out = ctx.createImageData(w, h);
  for (let j = 0, i = 0; j < gray.length; j++, i += 4) {
    const val = gray[j] > thr ? 255 : 0;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = val; out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return c.toDataURL('image/jpeg', 0.92);
}

// --------------------------- bóc tách trường ---------------------------

export function parseCccd(text: string): Partial<OcrFields> {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const flat = text.replace(/\s+/g, ' ');
  const out: Partial<OcrFields> = {};

  const id12 = flat.match(/\b\d{12}\b/);
  const id9 = flat.match(/\b\d{9}\b/);
  if (id12) out.cccd = id12[0]; else if (id9) out.cccd = id9[0];

  const dates = [...flat.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g)].map((m) => `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`);
  const dobLine = lines.find((l) => /sinh|birth/i.test(noAccent(l)) && /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(l));
  if (dobLine) { const m = dobLine.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if (m) out.dob = `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`; }
  else if (dates[0]) out.dob = dates[0];
  const issueDate = dates.find((d) => d !== out.dob);
  if (issueDate) out.issueDate = issueDate;

  const sex = flat.match(/\b(Nam|Nữ|Nu)\b/i);
  if (sex) out.gender = /n[uữ]/i.test(sex[1]) ? 'Nữ' : 'Nam';

  const isHeader = (l: string) => /cong dan|citizen|identity|viet nam|can cuoc|socialist|cong hoa|doc lap/i.test(noAccent(l));
  const upperName = (l: string) => {
    const letters = l.replace(/[^A-Za-zÀ-ỹ\s]/g, '').trim();
    return letters.length >= 5 && letters === letters.toUpperCase() && letters.split(/\s+/).length >= 2 && !isHeader(l);
  };
  for (let i = 0; i < lines.length; i++) {
    if (/h[oọ] v[aà] t[eê]n|full name|^name/i.test(noAccent(lines[i]))) {
      const after = lines[i].split(/[:：]/)[1]?.trim();
      if (after && upperName(after)) { out.fullName = after; break; }
      if (lines[i + 1] && upperName(lines[i + 1])) { out.fullName = lines[i + 1].trim(); break; }
    }
  }
  if (!out.fullName) { const cand = lines.find(upperName); if (cand) out.fullName = cand.trim(); }

  const grab = (re: RegExp) => {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(noAccent(lines[i]))) {
        let v = lines[i].split(/[:：]/).slice(1).join(':').trim();
        if (!v && lines[i + 1] && !/:/.test(lines[i + 1])) v = lines[i + 1].trim();
        return v.replace(/place of.*/i, '').trim();
      }
    }
    return '';
  };
  const home = grab(/que quan|place of origin|origin/);
  const res = grab(/thuong tru|noi thuong|place of residence|residence/);
  if (home) out.hometown = home;
  if (res) out.address = res;
  return out;
}

// --------------------------- chạy OCR ---------------------------

export async function extractCccdClient(dataUrl: string, onProgress?: (p: number) => void): Promise<OcrFields> {
  const Tesseract = (await import('tesseract.js')).default;
  onProgress?.(5);
  const { grayUrl, gray, w, h } = await toGray(dataUrl);
  const bwUrl = binarize(gray, w, h);
  onProgress?.(15);

  const worker = await Tesseract.createWorker('vie+eng', 1, {
    logger: (m: any) => { if (m.status === 'recognizing text' && onProgress) onProgress(20 + Math.round(m.progress * 60)); },
  });
  try {
    // Lượt 1: đọc chữ (ảnh xám, phân vùng tự động)
    await worker.setParameters({ tessedit_pageseg_mode: '3' as any, preserve_interword_spaces: '1' });
    const r1 = await worker.recognize(grayUrl);
    const fields = parseCccd(r1.data.text);

    // Lượt 2: chỉ đọc số (ảnh nhị phân, whitelist chữ số) → lấy đúng số CCCD
    onProgress?.(82);
    await worker.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '6' as any });
    const r2 = await worker.recognize(bwUrl);
    const digits = r2.data.text.replace(/[^0-9\s]/g, ' ');
    const id12 = digits.match(/\b\d{12}\b/);
    if (id12) fields.cccd = id12[0];
    else if (!fields.cccd) { const id9 = digits.match(/\b\d{9}\b/); if (id9) fields.cccd = id9[0]; }
    onProgress?.(100);

    return {
      cccd: fields.cccd || '', fullName: fields.fullName || '', dob: fields.dob || '',
      gender: fields.gender || '', hometown: fields.hometown || '', address: fields.address || '',
      issueDate: fields.issueDate || '', issuePlace: fields.issuePlace || '',
      ocrConfidence: Math.round((r1.data.confidence || 0) * 10) / 10, rawText: r1.data.text,
    };
  } finally {
    await worker.terminate();
  }
}
