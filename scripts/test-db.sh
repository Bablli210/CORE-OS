#!/usr/bin/env bash
# Resets the local Supabase database (migrations + seed) and runs every SQL test in supabase/tests.
# Requires: supabase CLI running locally (`supabase start`).
set -euo pipefail
cd "$(dirname "$0")/.."
supabase db reset --local >/dev/null
DB_URL=$(supabase status -o env 2>/dev/null | grep '^DB_URL' | cut -d= -f2- | tr -d '"')
for f in supabase/tests/*.sql; do
  echo "== $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | grep -E "PASS|FAIL|ERROR|PASSED" | sed 's/.*NOTICE:  //'
done
