export const examplePlaylist: string = `# yaml-language-server: $schema=https://raw.githubusercontent.com/vdawg-git/moo/refs/heads/main/other/schemas/mooPlaylist.json

rules:
  - all:
      - artist:
          includes: ["Rick Astley", "Waterman"]
      - title:
          includes: ["never gonna give you up"]

  - any:
      - genre:
          includes: "deephouse"

`
