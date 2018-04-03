
echo "$@"

set -eu
#set -o xtrace

BASE_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
#TMP_DIR="$(mktemp -d)"
#DEST="${TMP_DIR}/addon"
ADDON_VERSION=$(node -p -e "require('./package.json').version");
ADDON_ID=$(node -p -e "require('./package.json').addon.id")
XPI_NAME="${ADDON_ID}-${ADDON_VERSION}".xpi

pushd addon > /dev/null
zip -r  "../${XPI_NAME}" .
popd > /dev/null

rm -f linked-addon.xpi
ln -s "${XPI_NAME}" linked-addon.xpi
echo "SUCCESS: xpi at ${XPI_NAME}"
echo "SUCCESS: symlinked xpi at linked-addon.xpi"
