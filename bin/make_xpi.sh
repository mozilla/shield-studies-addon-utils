#!/usr/bin/env bash
cp dist/StudyUtils.jsm test-addon/

set -eu

BASE_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")""/test-addon"
TMP_DIR=$(mktemp -d)
DEST="${TMP_DIR}/test-addon"
mkdir -p $DEST

# deletes the temp directory
function cleanup {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

while read -r LINE || [[ -n "${LINE}" ]]; do
  mkdir -p "$(dirname "${DEST}/${LINE}")"
  cp -r "${BASE_DIR}/${LINE}" "$(dirname "${DEST}/${LINE}")"
done < "${BASE_DIR}/build-includes.txt"

pushd $DEST
zip -r test-addon.xpi *
mv test-addon.xpi $BASE_DIR
popd
