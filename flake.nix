{
  description = "Moo Flake";
  inputs = {
    nixpkgs.url = "github:NixOs/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
    bun2nix.url = "github:baileyluTCD/bun2nix?tag=2.0.6";
    bun2nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  # Use the cached version of bun2nix from the garnix cli
  nixConfig = {
    extra-substituters = [
      "https://cache.nixos.org"
      "https://cache.garnix.io"
    ];
    extra-trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "cache.garnix.io:CTFPyKSLcx5RMJKfLo5EEPUObbA78b0YQ2DTCJXqr9g="
    ];
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    bun2nix,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {inherit system;};
      lib = pkgs.lib;
      bunNix = import ./nix/bun.nix;
      nodeModules = bun2nix.lib.${system}.mkBunNodeModules {packages = bunNix;};

      name = "moo";

      desktopItem = pkgs.makeDesktopItem {
        inherit name;
        exec = "${name} %u";
        desktopName = name;
        comment = "Sick terminal music player";
        terminal = true;
        type = "Application";
        categories = ["Audio"];
        keywords = ["playlists" "music player" "music"];
      };
    in {
      devShell = with pkgs;
        mkShell {
          buildInputs = [
            bun
            lnav
            bun2nix.packages.${system}.default
          ];

          shellHook = ''
            bun install --frozen-lockfile
          '';
        };

      packages.default = pkgs.stdenv.mkDerivation {
        pname = name;
        version = "0.10.0";
        src = ./.;
        buildInputs = with pkgs; [bun ffmpeg];

        installPhase = ''
          mkdir -p $out/bin

          cat >> $out/bin/moo <<EOF
            #!${pkgs.runtimeShell}
            cd $out/src
            ${lib.getExe' pkgs.bun "bun"} run ./source/index.ts "\$@"
          EOF

          chmod +x $out/bin/moo
          cp -r . $out/src
          rm -rf $out/src/node_modules
          ln -s ${nodeModules}/node_modules $out/src/node_modules
        '';

        postInstall = ''
          mkdir -p $out/share/applications
          cp ${desktopItem}/share/applications/* $out/share/applications/
        '';
      };
    });
}
