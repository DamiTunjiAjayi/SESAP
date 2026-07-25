// =============================================================================
// SESAP Document Understanding (IDP) — reads a ticket/chat attachment and writes
// out, for the agent, a structured read-out of what the document contains.
//
// Runs entirely client-side and is REAL:
//   • text files (txt/csv/json/md/log/xml/html, any text/* MIME) — read directly
//   • scanned images (png/jpg/…, e.g. an ID card) — on-device OCR via Tesseract.js
//   • PDFs — text layer extracted via pdf.js (pdfjs-dist)
// The heavy OCR/PDF engines are lazy-loaded (dynamic import) only when such a
// file is attached, so the main app bundle stays small. If OCR/extraction yields
// nothing readable (e.g. a blank or non-text image), it degrades gracefully to a
// filename-based classification rather than fabricating content.
// =============================================================================

const RX = {
  amount: /(?:₦|NGN|N=|\$|USD|£|GBP|€|EUR)\s?\d[\d,]*(?:\.\d{1,2})?/gi,
  date: /\b(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4})\b/gi,
  email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
  account: /\b\d{10}\b/g, // NUBAN (Nigerian bank account) numbers are 10 digits
  reference: /\b(?:REF|TXN|TRN|RRN|SESAP|INV)[-:#\s]?[A-Z0-9]{4,}\b/gi,
  phone: /\b(?:\+?234|0)\d{9,10}\b/g,
  // Identity-document signals often found on an ID card / passport / licence.
  idNumber: /\b(?:[A-Z]{2,3}\d{6,}|\d{11}|[A-Z0-9]{9,12})\b/g,
  mrz: /[A-Z0-9<]{20,}/g, // passport/ID machine-readable zone
}

const TEXTUAL = /^(text\/|application\/(json|csv|xml|xhtml\+xml|x-ndjson))/i
const TEXT_EXT = /\.(txt|csv|tsv|json|md|log|xml|yml|yaml|html?|ini|conf)$/i

function classify(name, text) {
  const s = `${name} ${text}`.toLowerCase()
  if (/\b(invoice|proforma)\b/.test(s)) return 'Invoice'
  if (/\b(statement|account activity|transaction history)\b/.test(s)) return 'Bank statement'
  if (/\b(receipt|payment confirmation|transfer confirmation|debit alert|credit alert)\b/.test(s)) return 'Payment receipt / alert'
  if (/\b(passport|national id|nin|identity card|driver'?s? licen|voter|utility bill|kyc)\b/.test(s)) return 'Identity / KYC document'
  if (/\b(dispute|chargeback|complaint|unauthori[sz]ed|fraud)\b/.test(s)) return 'Dispute / fraud report'
  if (/\b(form|application|mandate|request)\b/.test(s)) return 'Application / mandate form'
  return 'General correspondence'
}

const uniq = (arr, n = 8) => Array.from(new Set(arr.map((x) => x.trim()))).filter(Boolean).slice(0, n)

function extractFields(text) {
  const grab = (rx) => uniq((text.match(rx) || []))
  return {
    amounts: grab(RX.amount),
    dates: grab(RX.date),
    accounts: grab(RX.account),
    references: grab(RX.reference),
    emails: grab(RX.email),
    phones: grab(RX.phone),
  }
}

function summarise(docType, fields, text) {
  const bits = []
  if (fields.amounts.length) bits.push(`${fields.amounts.length} amount(s) (e.g. ${fields.amounts[0]})`)
  if (fields.accounts.length) bits.push(`${fields.accounts.length} account number(s)`)
  if (fields.references.length) bits.push(`ref ${fields.references[0]}`)
  if (fields.dates.length) bits.push(`date ${fields.dates[0]}`)
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const lead = bits.length ? `Detected ${bits.join(', ')}.` : `No structured fields detected.`
  return `${docType} · ${words} words. ${lead}`
}

const humanType = (att) => {
  const t = att?.type || ''
  const n = att?.name || ''
  if (/^image\//.test(t) || /\.(png|jpe?g|gif|bmp|webp|tiff?)$/i.test(n)) return 'image'
  if (/pdf/.test(t) || /\.pdf$/i.test(n)) return 'pdf'
  return 'other'
}

// --- Heavy engines, lazy-loaded only when actually needed ---------------------

// On-device OCR for a scanned image / photo of an ID card, receipt, etc.
async function ocrImage(url) {
  const { default: Tesseract } = await import('tesseract.js')
  const { data } = await Tesseract.recognize(url, 'eng')
  return (data?.text || '').replace(/[ \t]+\n/g, '\n').trim()
}

// Extract the text layer from a (text-based) PDF via pdf.js.
async function extractPdfText(url) {
  const pdfjs = await import('pdfjs-dist')
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  } catch { /* worker path resolved by bundler; ignore if already set */ }
  const pdf = await pdfjs.getDocument({ url }).promise
  const pages = Math.min(pdf.numPages, 15)
  let text = ''
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => it.str).join(' ') + '\n'
  }
  return text.trim()
}

function readOut(name, docType, text, { via } = {}) {
  const fields = extractFields(text)
  return {
    ok: true, name, extracted: true, docType,
    summary: summarise(docType, fields, text) + (via ? ` (${via})` : ''),
    fields,
    textPreview: text.slice(0, 1500),
  }
}

/**
 * Analyse an attachment. Returns:
 *   { ok, name, docType, summary, fields, textPreview, extracted:boolean, note }
 * Never throws — the caller shows `note` on failure.
 */
export async function extractDocument(att) {
  const name = att?.name || 'document'
  const isText = TEXTUAL.test(att?.type || '') || TEXT_EXT.test(name)

  if (!att?.url) {
    return { ok: false, name, extracted: false, docType: 'Unavailable',
      note: 'This attachment is not available to read (no content is retained after reload without a backend store).' }
  }

  // 1) Plain-text documents — read directly.
  if (isText) {
    try {
      const res = await fetch(att.url)
      const raw = await res.text()
      const text = raw.slice(0, 20000)
      return readOut(name, classify(name, text), text)
    } catch (e) {
      return { ok: false, name, extracted: false, docType: 'Unreadable',
        note: `Could not read the document (${e?.message || 'error'}).` }
    }
  }

  // 2) Images (OCR) and PDFs (text layer) — genuinely read the content.
  const kind = humanType(att)
  if (kind === 'image' || kind === 'pdf') {
    try {
      const text = kind === 'image' ? await ocrImage(att.url) : await extractPdfText(att.url)
      // Require a little real signal so we don't present OCR noise as content.
      if (text && text.replace(/\s/g, '').length >= 8) {
        return readOut(name, classify(name, text), text,
          { via: kind === 'image' ? 'read via on-device OCR' : 'extracted from PDF text' })
      }
      // Fell through: nothing legible (blank/low-quality image, or scanned PDF w/ no text layer).
      return {
        ok: true, name, extracted: false, docType: classify(name, ''),
        summary: `${classify(name, '')} — ${kind === 'image' ? 'image' : 'PDF'} attached; no legible text could be read${kind === 'pdf' ? ' (looks like a scanned PDF with no text layer)' : ''}.`,
        fields: null,
        note: kind === 'pdf'
          ? 'This PDF has no selectable text layer. Convert it to an image and re-upload to run OCR, or route it through the UiPath Document Understanding service.'
          : 'The image was too low-quality to OCR. Try a sharper, well-lit photo.',
      }
    } catch (e) {
      return {
        ok: true, name, extracted: false, docType: classify(name, ''),
        summary: `${classify(name, '')} — could not fully read the ${kind}.`,
        fields: null,
        note: `On-device reading hit an error (${e?.message || 'error'}). You can still open the file from the ticket.`,
      }
    }
  }

  // 3) Other binary types.
  return {
    ok: true, name, extracted: false, docType: classify(name, ''),
    summary: `${classify(name, '')} — this file type is not text-readable in the browser.`,
    fields: null,
    note: 'Unsupported file type for in-app reading.',
  }
}

// A short one-line note suitable for posting to the ticket timeline.
export function duNote(result) {
  if (!result?.ok) return `📄 Document Understanding could not read "${result?.name}".`
  const f = result.fields
  const found = f
    ? [f.amounts.length && `${f.amounts.length} amount(s)`, f.accounts.length && `${f.accounts.length} account(s)`,
       f.references.length && `${f.references.length} ref(s)`, f.dates.length && `${f.dates.length} date(s)`]
        .filter(Boolean).join(', ')
    : ''
  return `📄 Document Understanding read "${result.name}" → ${result.docType}. ${found ? `Extracted: ${found}.` : result.summary}`
}
