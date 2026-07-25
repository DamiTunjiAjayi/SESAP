// =============================================================================
// SESAP → UiPath Orchestrator Storage Bucket ("SESAP-Attachments").
//
// Solves the attachment-persistence gap: files uploaded in the Coded App are
// pushed to a real Storage Bucket (Shared/SESAP-Live) so they survive reloads
// and are reachable by robots / Document Understanding — not just in-browser
// blobs. Each ticket's files live under  tickets/<Ref>/<filename>.
//
// Mechanism (all via the official SDK, browser-native in a Coded App):
//   • uploadFile()  → Orchestrator GetWriteUri → direct PUT to pre-signed blob
//   • getFileMetaData(prefix) → list a ticket's files (for hydrate-on-open)
//   • getReadUri()  → pre-signed download URL (open / analyse)
//
// Everything is best-effort and never throws: if the bucket scope isn't granted
// yet (or a browser CORS pre-flight blocks the blob PUT), callers fall back to
// the local blob URL and the app keeps working exactly as before.
// =============================================================================

// SESAP-Attachments bucket in Shared/SESAP-Live (provisioned via the Orchestrator API).
const BUCKET_ID = 195596
const FOLDER_KEY = 'c034c633-bf82-47ba-9e35-8955ea38d2b0'

let _state = null // { ok, buckets }

// A bucket call must NEVER hang the UI. A CORS-blocked blob PUT can leave a fetch
// pending indefinitely, so every bucket operation is raced against a timeout that
// resolves to a diagnostic instead of hanging forever.
function withTimeout(promise, ms, onTimeout) {
  return Promise.race([
    Promise.resolve(promise).catch((e) => ({ __error: e?.message || String(e) })),
    new Promise((resolve) => setTimeout(() => resolve(onTimeout), ms)),
  ])
}

async function init() {
  if (_state) return _state
  _state = await withTimeout(
    (async () => {
      try {
        const [{ UiPath }, { Buckets }] = await Promise.all([
          import('@uipath/uipath-typescript/core'),
          import('@uipath/uipath-typescript/buckets'),
        ])
        const sdk = new UiPath()
        await sdk.initialize()
        return { ok: true, buckets: new Buckets(sdk) }
      } catch (e) {
        console.warn('[SESAP] Storage bucket init failed:', e)
        return { ok: false, error: e?.message || 'init failed' }
      }
    })(),
    12000,
    { ok: false, error: 'init timeout (SDK import/auth blocked)' },
  )
  return _state
}

// Bucket blob paths never contain a leading slash internally.
const pathFor = (ref, name) => `tickets/${String(ref || 'UNKNOWN')}/${name}`

/**
 * Upload a File/Blob to the ticket's folder in the bucket. Never throws.
 * Rich diagnostics: distinguishes an Orchestrator GetWriteUri failure (a SCOPE
 * problem → HTTP 403/401 with a status) from a browser CORS/network block on the
 * Azure blob PUT (a TypeError "Failed to fetch"/timeout with no status). The
 * exact detail is logged to the console AND returned so the cause is unambiguous.
 */
export async function uploadAttachment(ref, file) {
  const s = await init()
  if (!s.ok) return { ok: false, error: s.error || 'unavailable' }
  const path = pathFor(ref, file.name)
  let timer
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ __timeout: true }), 20000) })
  try {
    const res = await Promise.race([
      s.buckets.uploadFile(BUCKET_ID, path, file, { folderKey: FOLDER_KEY }),
      timeout,
    ])
    clearTimeout(timer)
    if (res?.__timeout) {
      console.warn('[SESAP][bucket] upload TIMEOUT after 20s — the blob PUT got no response (usually a CORS block on the storage account).')
      return { ok: false, error: 'timeout after 20s — blob PUT blocked (CORS)' }
    }
    console.info('[SESAP][bucket] upload OK', path, res)
    return { ok: res?.success !== false, path, statusCode: res?.statusCode }
  } catch (e) {
    clearTimeout(timer)
    const status = e?.statusCode ?? e?.status ?? e?.response?.status ?? e?.cause?.status ?? ''
    let body = e?.response?.data ?? e?.response?.body ?? e?.body ?? e?.responseText ?? ''
    if (body && typeof body !== 'string') { try { body = JSON.stringify(body) } catch { body = String(body) } }
    // Full object to the console for a definitive read.
    console.error('[SESAP][bucket] upload FAILED — full error:', e)
    console.error('[SESAP][bucket] parsed →', { name: e?.name, status, message: e?.message, body })
    const isCors = e?.name === 'TypeError' && /fetch|network|load failed/i.test(e?.message || '')
    const label = isCors
      ? 'CORS/network block on the blob PUT'
      : (status === 403 || status === 401 ? `scope/permission (HTTP ${status})` : 'error')
    return { ok: false, error: `${label} — ${e?.name || 'Error'}${status ? ' ' + status : ''}: ${e?.message || ''}${body ? ' | ' + String(body).slice(0, 160) : ''}`.trim() }
  }
}

/** List the files stored for a ticket (used to hydrate attachments on open). */
export async function listAttachments(ref) {
  const s = await init()
  if (!s.ok) return { ok: false, files: [] }
  try {
    const raw = await withTimeout(
      s.buckets.getFiles(BUCKET_ID, { folderKey: FOLDER_KEY, directory: `tickets/${ref}`, recursive: true }),
      12000,
      { __timeout: true },
    )
    if (raw?.__timeout || raw?.__error) return { ok: false, files: [] }
    const res = raw
    const items = res?.items ?? res?.value ?? (Array.isArray(res) ? res : [])
    const files = items
      .filter((f) => !f.isDirectory)
      .map((f) => {
        const path = f.path || f.fullPath || ''
        return { name: path.split('/').pop(), path, size: f.size ?? 0, type: f.contentType || '' }
      })
      .filter((f) => f.name)
    return { ok: true, files }
  } catch (e) {
    return { ok: false, files: [], error: e?.message || 'list failed' }
  }
}

/** Resolve a short-lived, openable download URL for a stored blob path. */
export async function attachmentUrl(path) {
  const s = await init()
  if (!s.ok || !path) return null
  const res = await withTimeout(
    s.buckets.getReadUri(BUCKET_ID, path, { folderKey: FOLDER_KEY }),
    12000,
    { __timeout: true },
  )
  if (res?.__timeout || res?.__error) return null
  return res?.uri || res?.Uri || null
}

/** Delete a stored blob from the bucket by path. Never throws. */
export async function deleteAttachment(path) {
  const s = await init()
  if (!s.ok || !path) return { ok: false, error: s.error || 'unavailable' }
  try {
    await s.buckets.deleteFile(BUCKET_ID, path, { folderKey: FOLDER_KEY })
    return { ok: true }
  } catch (e) {
    console.warn('[SESAP][bucket] delete failed:', e)
    return { ok: false, error: e?.message || 'delete failed' }
  }
}

export const STORAGE_BUCKET = { id: BUCKET_ID, folderKey: FOLDER_KEY, name: 'SESAP-Attachments' }
