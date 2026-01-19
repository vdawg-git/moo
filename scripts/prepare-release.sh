#!/usr/bin/env bash
set -euo pipefail

echo "Compiling binary..."
mkdir -p ./dist

bun build --compile  ./source/index.ts --no-compile-autoload-dotenv --sourcemap ./source/index.ts --outfile ./dist/moo

echo "Calculating hash..."
HASH=$(nix-hash --type sha256 --flat --base32 dist/moo)

echo "Updating flake.nix with hash: $HASH"
sed -i "s/sha256 = \".*\";/sha256 = \"$HASH\";/" flake.nix

echo "Staging flake.nix..."
git add flake.nix
git commit -m "chore: update flake.nix with new binary hash"

echo "Release preparation complete!"
