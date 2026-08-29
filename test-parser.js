import { parseJuniorsXml } from "./packages/application/src/importer/parsers/xml-juniors-parser.js";
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sokker>
  <juniors>
    <junior>
      <id>5001</id>
      <formation>0</formation>
    </junior>
    <junior>
      <id>5002</id>
      <formation>1</formation>
    </junior>
  </juniors>
</sokker>`;
console.log(parseJuniorsXml(xml));
