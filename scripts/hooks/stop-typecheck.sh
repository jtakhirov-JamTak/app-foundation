#!/usr/bin/env bash
# Turn-boundary typecheck, wired as a Stop hook in .claude/settings.json.
#
# Stop rather than PostToolUse on purpose: per-edit typechecking flags
# intentionally incomplete intermediate states mid-refactor and burns context on
# noise. A turn-boundary check runs once a coherent batch of edits has landed.
#
# This is advisory speed, not enforcement — `npm run verify` remains the hard
# gate. Exit 2 is what makes it self-correcting rather than merely
# informational: it blocks the stop and feeds stderr back.
set -uo pipefail

INPUT="$(cat)"

# Loop guard. Parsed with node, NOT jq: jq is not installed here and is not
# guaranteed on any derived app's machine, and a missing jq would make this test
# silently never fire — the silent-exit class non-negotiable #9 exists to
# prevent. A parse failure yields "false", failing toward running the check
# rather than toward skipping it quietly. Claude Code independently overrides a
# Stop hook after 8 consecutive blocks, so this guard has a backstop beneath it.
ACTIVE="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v=false;try{v=JSON.parse(s).stop_hook_active===true}catch{}process.stdout.write(String(v))})')"

if [ "$ACTIVE" = "true" ]; then
  exit 0
fi

if ! OUT="$(npm run typecheck 2>&1)"; then
  printf '%s\n' "$OUT" | tail -20 >&2
  echo "typecheck failed — fix before ending the turn" >&2
  exit 2
fi

exit 0
