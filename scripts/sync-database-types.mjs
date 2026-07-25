import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import process from "node:process";

import { readDatabaseTypeSlices } from "./database-type-slices.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function nameOf(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  throw new Error(`Unsupported database property: ${node.getText()}`);
}

function property(typeNode, name, { optional = false } = {}) {
  if (!ts.isTypeLiteralNode(typeNode)) throw new Error(`Expected type literal for ${name}`);
  const member = typeNode.members.find(
    (candidate) => ts.isPropertySignature(candidate) && nameOf(candidate.name) === name,
  );
  if (!member || !ts.isPropertySignature(member) || !member.type) {
    if (optional) return null;
    throw new Error(`Generated database types are missing ${name}`);
  }
  return member;
}

function indent(text, spaces) {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function selectedTypeLiteral(typeNode, sourceFile, selectedNames) {
  if (!ts.isTypeLiteralNode(typeNode)) throw new Error("Expected generated object type");
  const members = typeNode.members.filter(
    (member) => ts.isPropertySignature(member) && selectedNames(nameOf(member.name)),
  );
  if (members.length === 0) return "{ [_ in never]: never }";
  return `{\n${members.map((member) => indent(member.getText(sourceFile), 2)).join("\n")}\n}`;
}

function buildOutput(raw, selectTable, selectFunction, banner = "") {
  const sourceFile = ts.createSourceFile("database.raw.ts", raw, ts.ScriptTarget.Latest, true);
  const jsonAlias = sourceFile.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === "Json",
  );
  const databaseAlias = sourceFile.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === "Database",
  );
  if (!jsonAlias || !databaseAlias || !ts.isTypeAliasDeclaration(databaseAlias)) {
    throw new Error("Supabase output does not contain Json and Database type aliases");
  }

  // Emitted by some Supabase CLI versions and absent in others; carry it
  // through when present rather than requiring it.
  const internal = property(databaseAlias.type, "__InternalSupabase", { optional: true });
  const publicMember = property(databaseAlias.type, "public");
  const tables = property(publicMember.type, "Tables");
  const views = property(publicMember.type, "Views");
  const functions = property(publicMember.type, "Functions");
  const enums = property(publicMember.type, "Enums");
  const composites = property(publicMember.type, "CompositeTypes");

  const tableText = selectedTypeLiteral(tables.type, sourceFile, selectTable);
  const functionText = selectedTypeLiteral(functions.type, sourceFile, selectFunction);

  const internalText = internal ? `${indent(internal.getText(sourceFile), 2)}\n` : "";

  return `${banner}${jsonAlias.getText(sourceFile)}\n\nexport type Database = {\n${internalText}  public: {\n    Tables: ${indent(tableText, 4).trimStart()}\n${indent(
    views.getText(sourceFile),
    4,
  )}\n    Functions: ${indent(functionText, 4).trimStart()}\n${indent(
    enums.getText(sourceFile),
    4,
  )}\n${indent(composites.getText(sourceFile), 4)}\n  }\n}\n`;
}

function generatedText() {
  const inputPath = process.argv[2];
  if (inputPath && !inputPath.startsWith("--")) return readFile(inputPath, "utf8");

  // spawnSync can't launch the CLI's .cmd shim on Windows without a shell; the
  // command and args are fixed literals, so shell interpolation is not a risk.
  const result = spawnSync(
    "npx",
    ["--no-install", "supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      shell: process.platform === "win32",
    },
  );
  if (result.error) {
    console.error(result.error);
    throw new Error("Supabase type generation failed");
  }
  if (result.status !== 0 || !result.stdout) {
    throw new Error("Supabase type generation failed");
  }
  return Promise.resolve(result.stdout);
}

const raw = await generatedText();
const slices = await readDatabaseTypeSlices();
const slicedTables = new Set(slices.flatMap((slice) => [...slice.tables]));
const slicedFunctions = new Set(slices.flatMap((slice) => [...slice.functions]));

const base = buildOutput(
  raw,
  (name) => !slicedTables.has(name),
  (name) => !slicedFunctions.has(name),
);
await writeFile("src/types/database.ts", base);

for (const slice of slices) {
  const output = buildOutput(
    raw,
    (name) => slice.tables.has(name),
    (name) => slice.functions.has(name),
    "// OPTIONAL FEATURE GENERATED DATABASE TYPES.\n// Deleted with the feature folder.\n\n",
  );
  await writeFile(slice.outputPath, output);
}

console.log(
  `Database types synchronized: base schema plus ${slices.length} optional feature slice(s).`,
);
