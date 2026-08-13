#!/usr/bin/env bash
# Local App Store IPA only. Never use cloud EAS builds.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env.production
set +a

export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
export EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP=1

if [[ ! -x "$DEVELOPER_DIR/usr/bin/xcodebuild" ]]; then
  echo "Xcode missing: mount 'Mikhail Seagate 2TB SSD' ( /Applications/Xcode.app is a symlink there ), then retry." >&2
  exit 1
fi

"$DEVELOPER_DIR/usr/bin/xcodebuild" -version

exec eas build --platform ios --profile production --local --non-interactive
