#!/usr/bin/env bash
# One-time setup for the Android APK build (.github/workflows/android.yml): makes the signing key,
# stores it in the repository's GitHub Actions secrets and starts a build that publishes the APK.
#
# Every APK has to be signed with this same key, or Android won't install it over the previous one
# (the app would have to be removed first, and its progress with it). The key stays outside the repo,
# in ~/.sukima-nihongo-signing: keep that folder. Running the script again reuses the key there.
#
# Needs bash (Git Bash on Windows), openssl and the GitHub CLI signed in (gh auth login).
set -euo pipefail

REPO=fuyo1622/sukima-nihongo
DIR="${SIGNING_DIR:-$HOME/.sukima-nihongo-signing}"
KEY="$DIR/release.p12"

gh auth status >/dev/null

if [ -f "$KEY" ]; then
  echo "Using the signing key in $DIR"
else
  if gh secret list --repo "$REPO" | grep -q '^ANDROID_KEYSTORE_BASE64' && [ "${NEW_KEY:-}" != 1 ]; then
    echo "$REPO already has a signing key, made on another computer: copy its $DIR folder here."
    echo "(NEW_KEY=1 replaces it, but then installed APKs can't be updated, only reinstalled.)"
    exit 1
  fi
  mkdir -p "$DIR"
  openssl rand -hex 16 | tr -dc '0-9a-f' > "$DIR/password.txt"
  # MSYS2_ARG_CONV_EXCL keeps Git Bash from turning the "/CN=..." name into a Windows path.
  MSYS2_ARG_CONV_EXCL='/CN=' openssl req -x509 -newkey rsa:2048 -nodes -days 10000 -subj '/CN=Sukima Nihongo' \
    -keyout "$DIR/key.pem" -out "$DIR/certificate.pem" 2>/dev/null
  PW=$(cat "$DIR/password.txt") openssl pkcs12 -export -name sukima -inkey "$DIR/key.pem" \
    -in "$DIR/certificate.pem" -out "$KEY" -passout env:PW
  rm "$DIR/key.pem"
  cat > "$DIR/README.txt" <<EOF
Signing key of the スキマ日語 Android APK (made by scripts/android-signing.sh).
Keep this folder: every APK must be signed with this key to install over the previous one.
release.p12 (PKCS12, alias sukima) and its password are also in the GitHub Actions secrets
ANDROID_KEYSTORE_BASE64 and ANDROID_KEYSTORE_PASSWORD of $REPO.
EOF
  echo "Made a new signing key in $DIR"
fi

base64 < "$KEY" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO"
gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO" < "$DIR/password.txt"
echo "Stored the key in the GitHub Actions secrets of $REPO"

gh workflow run android.yml --repo "$REPO" --ref master
echo "Started the APK build: https://github.com/$REPO/actions/workflows/android.yml"
echo "In about 20 minutes the APK is at https://github.com/$REPO/releases/latest"
