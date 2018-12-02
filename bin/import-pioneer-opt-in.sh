#!/usr/bin/env bash

echo "$@"

set -eu
#set -o xtrace

BASE_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"

# download and build xpi for https://github.com/mozilla/pioneer-opt-in.git
if [ ! -d "pioneer-opt-in" ]; then
    git clone https://github.com/mozilla/pioneer-opt-in.git
fi
cd pioneer-opt-in
bin/make-xpi.sh .
cd -

echo
echo "SUCCESS: pioneer-opt-in xpi available at pioneer-opt-in/pioneer-opt-in.xpi"
echo
