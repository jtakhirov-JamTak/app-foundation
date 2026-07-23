import { readFile } from "node:fs/promises";
import process from "node:process";
import { createRequire } from "node:module";

import { readDatabaseTypeSlices } from "./database-type-slices.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const generatedPath = process.argv[2];
if (!generatedPath) {
  throw new Error("Usage: node scripts/check-generated-types.mjs <generated-database-types.ts>");
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  throw new Error(`Unsupported property name: ${node.getText()}`);
}

function typeLiteralProperty(typeNode, name) {
  if (!typeNode || !ts.isTypeLiteralNode(typeNode)) {
    throw new Error(`Expected a type literal while reading ${name}`);
  }
  const property = typeNode.members.find(
    (member) => ts.isPropertySignature(member) && propertyName(member.name) === name,
  );
  if (!property || !ts.isPropertySignature(property) || !property.type) {
    throw new Error(`Missing Database property: ${name}`);
  }
  return property.type;
}

function normalizeType(typeNode, sourceFile) {
  return typeNode.getText(sourceFile).replace(/\s+/g, "");
}

function shapeOfObject(typeNode, sourceFile) {
  if (!ts.isTypeLiteralNode(typeNode)) {
    throw new Error(`Expected object type, received: ${typeNode.getText(sourceFile)}`);
  }

  return Object.fromEntries(
    typeNode.members
      .filter(ts.isPropertySignature)
      .map((member) => {
        if (!member.type) throw new Error("Database property is missing a type");
        return [
          propertyName(member.name),
          {
            optional: Boolean(member.questionToken),
            type: normalizeType(member.type, sourceFile),
          },
        ];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function namedObject(typeNode, sourceFile, childShapeNames) {
  if (ts.isMappedTypeNode(typeNode)) return {};
  if (!ts.isTypeLiteralNode(typeNode)) {
    throw new Error(`Expected named object, received: ${typeNode.getText(sourceFile)}`);
  }

  return Object.fromEntries(
    typeNode.members
      .filter(ts.isPropertySignature)
      .map((member) => {
        if (!member.type) throw new Error("Database member is missing a type");
        const name = propertyName(member.name);
        const entry = {};
        for (const childName of childShapeNames) {
          const child = typeLiteralProperty(member.type, childName);
          entry[childName] = ts.isTypeLiteralNode(child)
            ? shapeOfObject(child, sourceFile)
            : { __type: normalizeType(child, sourceFile) };
        }
        return [name, entry];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function extractContract(text, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const database = sourceFile.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === "Database",
  );
  if (!database || !ts.isTypeAliasDeclaration(database)) {
    throw new Error(`${fileName} does not export type Database`);
  }

  const publicSchema = typeLiteralProperty(database.type, "public");
  const tables = typeLiteralProperty(publicSchema, "Tables");
  const functions = typeLiteralProperty(publicSchema, "Functions");

  return {
    tables: namedObject(tables, sourceFile, ["Row", "Insert"]),
    functions: namedObject(functions, sourceFile, ["Args"]),
  };
}

function mergeContracts(contracts) {
  return contracts.reduce(
    (merged, contract) => ({
      tables: { ...merged.tables, ...contract.tables },
      functions: { ...merged.functions, ...contract.functions },
    }),
    { tables: {}, functions: {} },
  );
}

const slices = await readDatabaseTypeSlices();
const committedPaths = ["src/types/database.ts", ...slices.map((slice) => slice.outputPath)];

const committed = mergeContracts(
  await Promise.all(
    committedPaths.map(async (path) => extractContract(await readFile(path, "utf8"), path)),
  ),
);
const generatedText = await readFile(generatedPath, "utf8");
const generated = extractContract(generatedText, generatedPath);

const committedJson = JSON.stringify(committed, null, 2);
const generatedJson = JSON.stringify(generated, null, 2);
if (committedJson !== generatedJson) {
  console.error("Committed database types do not match the rebuilt schema contract.");
  console.error("--- committed contract\n" + committedJson);
  console.error("--- generated contract\n" + generatedJson);
  process.exit(1);
}

console.log(
  `Generated database contract matches the base types and ${slices.length} optional feature slice(s).`,
);
