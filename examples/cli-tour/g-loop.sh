#!/usr/bin/env bash

# g-loop.sh
# Runs GRAIL once for each JSON file in ./inputs.
# Saves each pursuit result, including observations, to
# ./observations using the corresponding input filename.

mkdir -p ./observations

shopt -s nullglob

for input in ./inputs/*.json
do
  name=$(basename "$input" .json)

  grail run \
    --progress \
    --config ./config \
    --inputs-file "$input" \
    --output json \
    > "./observations/${name}.json"
done
