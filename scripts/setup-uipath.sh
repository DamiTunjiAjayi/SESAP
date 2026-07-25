#!/usr/bin/env bash
# =============================================================================
# SESAP — end-to-end setup on ANY UiPath org/tenant.
#
# Does everything we did by hand, in order:
#   1. verify CLI login            5. publish package
#   2. resolve folder              6. deploy (first-time) or upgrade
#   3. create the Orchestrator queue 7. provision the Data Fabric entity
#   4. build + pack the Coded App   8. print the live URL
#
# Usage:
#   SESAP_ORG=stanbgdgzsbd ./scripts/setup-uipath.sh
#
# Optional env:
#   SESAP_TENANT   (default DefaultTenant)
#   SESAP_PROFILE  (uip login profile, default none)
#   SESAP_FOLDER   (default Shared)
#   SESAP_APP_NAME (default "SESAP Support Platform")
#   SESAP_VERSION  (default 2.3.0)
# =============================================================================
set -uo pipefail

ORG="${SESAP_ORG:?Set SESAP_ORG, e.g. SESAP_ORG=stanbgdgzsbd}"
TENANT="${SESAP_TENANT:-DefaultTenant}"
PROFILE="${SESAP_PROFILE:-}"
FOLDER="${SESAP_FOLDER:-Shared}"
APP_NAME="${SESAP_APP_NAME:-SESAP Support Platform}"
VERSION="${SESAP_VERSION:-2.3.0}"
QUEUE="SESAP_NewTickets"
BASE_URL="https://cloud.uipath.com"

export PATH="$HOME/.npm-global/bin:$PATH"
P=(); [ -n "$PROFILE" ] && P=(--profile "$PROFILE")

say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
ok()  { printf '  \033[0;32m✓ %s\033[0m\n' "$1"; }
die() { printf '  \033[0;31m✗ %s\033[0m\n' "$1"; exit 1; }

# ---- 1. login -----------------------------------------------------------------
say "1/7  Checking UiPath login ($ORG / $TENANT)"
STATUS=$(uip login status "${P[@]}" --output json 2>/dev/null || true)
echo "$STATUS" | grep -q '"Status": *"Logged in"' || die "Not logged in. Run:
  uip login ${P[*]} --organization $ORG --tenant $TENANT --no-browser"
echo "$STATUS" | grep -q "\"Organization\": *\"$ORG\"" || die "Logged into a DIFFERENT org. Re-run:
  uip login ${P[*]} --organization $ORG --tenant $TENANT --no-browser"
ok "Authenticated to $ORG / $TENANT"

# ---- 2. folder ----------------------------------------------------------------
say "2/7  Resolving folder '$FOLDER'"
FOLDER_KEY=$(uip or folders list "${P[@]}" --output json 2>/dev/null \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);
      const f=(j.Data||[]).find(x=>x.Path==='$FOLDER'||x.Name==='$FOLDER');
      process.stdout.write(f?f.Key:'')}catch(e){}})")
[ -n "$FOLDER_KEY" ] || die "Folder '$FOLDER' not found. Available:
$(uip or folders list "${P[@]}" --output json 2>/dev/null | grep '"Path"')"
ok "Folder key: $FOLDER_KEY"

# ---- 3. queue -----------------------------------------------------------------
say "3/7  Ensuring queue '$QUEUE'"
EXISTS=$(uip or queues list "${P[@]}" --folder-key "$FOLDER_KEY" --output json 2>/dev/null | grep -c "\"Name\": *\"$QUEUE\"" || true)
if [ "$EXISTS" -gt 0 ]; then
  ok "Queue already exists"
else
  uip or queues create "$QUEUE" "${P[@]}" --folder-key "$FOLDER_KEY" \
    --description "New SESAP tickets awaiting Data Fabric sync + triage (created unassigned)" \
    --enforce-unique-reference --max-retries 2 >/dev/null 2>&1 \
    && ok "Queue created" || die "Queue creation failed"
fi

# ---- 4. build + pack ----------------------------------------------------------
say "4/7  Building the app"
npm run build >/dev/null 2>&1 || die "npm run build failed"
ok "dist/ built"

say "5/7  Packing v$VERSION"
uip codedapp pack ./dist "${P[@]}" --name "$APP_NAME" --version "$VERSION" \
  --content-type webapp --main-file index.html \
  --description "SESAP — Stanbic IBTC Enterprise Support & Automation Platform" >/dev/null 2>&1 \
  || die "pack failed"
SANITIZED=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]')
ok "Packed: $SANITIZED.$VERSION.nupkg"

# ---- 5. publish ---------------------------------------------------------------
say "6/7  Publishing + deploying"
uip codedapp publish "${P[@]}" --name "$SANITIZED" --version "$VERSION" --type Web >/dev/null 2>&1 \
  || die "publish failed"
ok "Published to Orchestrator"
sleep 15   # allow indexing

PATH_NAME=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
# First deploy needs --path-name; upgrades must OMIT it (else "routing name must be unique").
OUT=$(uip codedapp deploy "${P[@]}" --name "$APP_NAME" --path-name "$PATH_NAME" --folder-key "$FOLDER_KEY" 2>&1)
if echo "$OUT" | grep -q "routing name must be unique\|already"; then
  OUT=$(uip codedapp deploy "${P[@]}" --name "$APP_NAME" --folder-key "$FOLDER_KEY" 2>&1)
fi
echo "$OUT" | grep -q "successfully" && ok "Deployed" || die "deploy failed:
$OUT"

# ---- 6. Data Fabric entity ----------------------------------------------------
say "7/7  Provisioning Data Fabric entity 'Ticket'"
PAYLOAD=$(uip login refresh "${P[@]}" --output json 2>/dev/null || true)
TOKEN=$(printf '%s' "$PAYLOAD" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).Data.AccessToken||'')}catch(e){}})")
if [ -z "$TOKEN" ]; then
  printf '  \033[0;33m! Could not mint a token — skipping entity provisioning\033[0m\n'
else
  UIPATH_TOKEN="$TOKEN" UIPATH_BASE_URL="$BASE_URL" UIPATH_ORG="$ORG" UIPATH_TENANT="$TENANT" \
    node scripts/provision-datafabric.mjs 2>&1 | sed 's/^/  /' || \
    printf '  \033[0;33m! Entity not created — enable Data Fabric (Admin → %s → Services → Add Services → Data Fabric), then re-run:\n    npm run provision:datafabric\033[0m\n' "$TENANT"
fi

# ---- done ---------------------------------------------------------------------
printf '\n\033[1;32m═══ SESAP setup complete ═══\033[0m\n'
printf '  App URL : https://%s.uipath.host/%s\n' "$ORG" "$PATH_NAME"
printf '  Queue   : %s (folder %s)\n' "$QUEUE" "$FOLDER"
printf '  Logins  : staff  admin / sesap2026\n'
printf '            customer  user / sesap2026\n\n'
