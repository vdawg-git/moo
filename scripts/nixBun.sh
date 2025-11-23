#!/usr/bin/env bash

bun2nix -o ./nix/bun.nix || echo 'bun2nix not installed. skipping bun2nix..'