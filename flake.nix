{
  description = "Moo Flake";
  inputs = {
    nixpkgs.url = "github:NixOs/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
      };

      packageJson = builtins.fromJSON (builtins.readFile ./package.json);
      name = packageJson.name;
      version = packageJson.version;

      mooPackage = let
        mooBin = builtins.fetchurl {
          url = "https://github.com/vdawg-git/moo/releases/download/${version}/moo";
          sha256 = "1d3nasncrqjb8w70x2a2s4d56xm068anfy94yyziqklb4xnnnnjf";
        };
      in
        pkgs.runCommand "moo-${version}" {
          meta = with pkgs.lib; {
            description = "Sick terminal music player";
            homepage = "https://github.com/vdawg-git/moo";
            license = licenses.mit;
            platforms = ["x86_64-linux"];
          };
        } ''
          mkdir -p $out/bin
          cp ${mooBin} $out/bin/moo
          chmod +x $out/bin/moo
        '';
    in {
      devShells.default = with pkgs;
        mkShell {
          buildInputs = [
            bun
            lnav
            ffmpeg-headless
            mpv
          ];

          shellHook = ''
            bun install --frozen-lockfile
          '';
        };

      packages.default = mooPackage;
    });
}
