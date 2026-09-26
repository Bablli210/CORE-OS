#!/usr/bin/env bash
# Writes apps/web/.env.local for `pnpm dev` from the running local Supabase stack (keys are the CLI's local demo keys).
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
cat > apps/web/.env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV
echo "wrote apps/web/.env.local"
