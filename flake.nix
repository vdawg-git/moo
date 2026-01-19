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

      # Only build for x86_64-linux since binary release is only for that architecture
      mooPackage =
        if system == "x86_64-linux"
        then
          pkgs.stdenv.mkDerivation {
            pname = name;
            inherit version;

            src = pkgs.fetchurl {
              url = "https://github.com/vdawg/moo/releases/download/${version}/moo";
              sha256 = "0n5wlgnbdwr80pdrwfs131bsi7n0sx1lrvi6p3mk6mhx81rd51xa";
            };

            dontUnpack = true;
            dontBuild = true;
            dontStrip = true; # Disable stripping to preserve embedded JS code

            installPhase = ''
              runHook preInstall

              mkdir -p $out/bin
              cp $src $out/bin/moo
              chmod +x $out/bin/moo

              # Install desktop file
              mkdir -p $out/share/applications
              cp ${desktopItem}/share/applications/* $out/share/applications/

              runHook postInstall
            '';

            meta = with pkgs.lib; {
              description = "Sick terminal music player";
              homepage = "https://github.com/vdawg/moo";
              license = licenses.mit;
              platforms = ["x86_64-linux"];
              maintainers = [];
            };
          }
        else throw "moo binary is only available for x86_64-linux";
    in {
      devShell = with pkgs;
        mkShell {
          buildInputs = [
            bun
            lnav
          ];

          shellHook = ''
            bun install --frozen-lockfile
          '';
        };

      packages.default = mooPackage;
    });
}
