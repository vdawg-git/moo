import { schemaUrl } from "#/config/config"

export const examplePlaylist: string = `# yaml-language-server: $schema=${schemaUrl}

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
