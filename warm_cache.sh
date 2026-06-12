#!/bin/sh
# Pre-warms the Sanfer bridge metric caches so user requests are always
# served from disk. Hourly: standard windows. With "wide" arg (4x daily):
# the full programme window too.
IDS="390,399,402,403,405,406,408,409,410,411,413,419,420,421,423,428,432,433,436,439,440,445,446,448,449,453,454,455,457,460,461,462,464,465,467,468,481,484,488,489,490,491,492,493"
B="https://serv.aux-rolplay.com/sanfer/bridge/"
TODAY=$(date -u +%F)
# Programme start — all real data is from this date forward
EPOCH="2026-06-01"

# Default window (full programme) + certification window + catalogs + org
curl -fsS -o /dev/null --max-time 300 "${B}?action=sim.demorp6&ids=${IDS}&date_from=${EPOCH}&date_to=${TODAY}&refresh=1"
curl -fsS -o /dev/null --max-time 300 "${B}?action=sim.demorp6&ids=${IDS}&date_from=2026-06-08&date_to=2026-06-22&refresh=1"
curl -fsS -o /dev/null --max-time 300 "${B}?action=objections.demorp6&ids=${IDS}&date_from=${EPOCH}&date_to=${TODAY}&refresh=1"
curl -fsS -o /dev/null --max-time 120 "${B}?action=activities.demorp6&ids=${IDS}&refresh=1"
curl -fsS -o /dev/null --max-time 120 "${B}?action=org.members&refresh=1"
curl -fsS -o /dev/null --max-time 120 "${B}?action=org.admins&refresh=1"

if [ "$1" = "wide" ]; then
  # Last 15 days and 7 days for quick-filter presets
  for D in 7 15; do
    F=$(date -u -d "${D} days ago" +%F)
    curl -fsS -o /dev/null --max-time 300 "${B}?action=sim.demorp6&ids=${IDS}&date_from=${F}&date_to=${TODAY}&refresh=1"
    curl -fsS -o /dev/null --max-time 300 "${B}?action=objections.demorp6&ids=${IDS}&date_from=${F}&date_to=${TODAY}&refresh=1"
  done
  # Cert-window objections
  curl -fsS -o /dev/null --max-time 300 "${B}?action=objections.demorp6&ids=${IDS}&date_from=2026-06-08&date_to=2026-06-22&refresh=1"
fi
