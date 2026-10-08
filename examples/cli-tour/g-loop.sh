for input in ./inputs/*.json
do
  grail run \
    --config ./config \
    --inputs-file "$input" \
    --output summary
done
