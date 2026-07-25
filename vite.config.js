import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Injects the `uipath:*` meta tags the UiPath SDK reads at runtime.
 *
 * `new UiPath()` (no args) loads its config from these meta tags — see
 * UiPathMetaTags in @uipath/uipath-typescript. Without them the SDK cannot
 * initialize inside the Coded App and Data Fabric writes silently fall back.
 *
 * Single source of truth: uipath.json. Placeholder values are skipped, so the
 * build stays clean until a real External Application clientId is filled in.
 */
function uipathMeta() {
  return {
    name: 'uipath-meta-tags',
    transformIndexHtml(html) {
      const file = resolve(process.cwd(), 'uipath.json')
      let cfg = {}
      if (existsSync(file)) {
        try {
          cfg = JSON.parse(readFileSync(file, 'utf8'))
        } catch {
          cfg = {}
        }
      }
      // Per-org overrides so ONE codebase serves multiple orgs:
      //   SESAP_CLIENT_ID=… SESAP_ORG_NAME=… SESAP_REDIRECT_URI=… npm run build
      const env = process.env
      cfg = {
        ...cfg,
        ...(env.SESAP_CLIENT_ID ? { clientId: env.SESAP_CLIENT_ID } : {}),
        ...(env.SESAP_SCOPE ? { scope: env.SESAP_SCOPE } : {}),
        ...(env.SESAP_ORG_NAME ? { orgName: env.SESAP_ORG_NAME } : {}),
        ...(env.SESAP_TENANT_NAME ? { tenantName: env.SESAP_TENANT_NAME } : {}),
        ...(env.SESAP_BASE_URL ? { baseUrl: env.SESAP_BASE_URL } : {}),
        ...(env.SESAP_REDIRECT_URI ? { redirectUri: env.SESAP_REDIRECT_URI } : {}),
      }
      const map = {
        'uipath:client-id': cfg.clientId,
        'uipath:scope': cfg.scope,
        'uipath:org-name': cfg.orgName,
        'uipath:tenant-name': cfg.tenantName,
        'uipath:base-url': cfg.baseUrl,
        'uipath:redirect-uri': cfg.redirectUri,
      }
      const tags = Object.entries(map)
        .filter(([, v]) => v && !String(v).startsWith('REPLACE_WITH'))
        .map(([name, content]) => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' }))
      if (tags.length) console.log(`[uipath-meta] injected ${tags.length} meta tag(s) from uipath.json`)
      else console.warn('[uipath-meta] no uipath.json values yet — SDK auth will not initialize')
      return { html, tags }
    },
  }
}

export default defineConfig({
  // Relative base so assets resolve correctly when the app is hosted under a
  // sub-path (e.g. https://<org>.uipath.host/<path-name>) by UiPath.
  base: './',
  plugins: [react(), uipathMeta()],
})
