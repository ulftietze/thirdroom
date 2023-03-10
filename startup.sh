#!/bin/bash

#git clone https://github.com/emscripten-core/emsdk.git /emsdk
#cd /emsdk
#git pull
#./emsdk install latest
#./emsdk activate latest
#source ./emsdk_env.sh

cd /thirdroom || exit 1
git config --global --add safe.directory '*'

yarn install
yarn build
