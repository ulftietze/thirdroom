#!/bin/bash

cd $(dirname $0)

mkdir -p ./build

emcc \
  -O3 \
  -g \
  --no-entry \
  -s ALLOW_MEMORY_GROWTH=0 \
  -s INITIAL_MEMORY=67108864 \
  -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
  -Wl,--import-memory \
  -o ./build/interactable-example.wasm \
  src/*.c \

ls -hal src/../../../../src/engine