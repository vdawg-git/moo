{mkBunDerivation, ...}:
mkBunDerivation {
  pname = "moo";
  version = "0.10.0";

  src = ./..;

  bunNix = ./bun.nix;

  index = "./source/index.ts";

  buildFlags = ["--target=bun" "--no-bundle" "--production"];
}
