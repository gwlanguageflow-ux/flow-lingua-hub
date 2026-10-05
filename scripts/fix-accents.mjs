// Restaura acentuação em frases visíveis ao usuário. Usa apenas frases completas
// para não alterar identificadores, chaves de banco ou nomes de campos.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/routes", "src/components", "src/functions", "src/server", "src/lib"];
const replacements = [
  ["Nao foi possivel", "Não foi possível"],
  ["nao foi possivel", "não foi possível"],
  ["Nao foi poss", "Não foi poss"],
  ["Voce ainda nao", "Você ainda não"],
  ["voce sera direcionado", "você será direcionado"],
  ["Voce ", "Você "],
  ["plano proprio", "plano próprio"],
  ["planos proprios", "planos próprios"],
  ["valor e descricao", "valor e descrição"],
  ["um valor valido", "um valor válido"],
  ["link externo valido", "link externo válido"],
  ["chave Pix nao foi", "chave Pix não foi"],
];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx?|ts)$/.test(name) && name !== "routeTree.gen.ts") patch(full);
  }
}

function patch(file) {
  const original = readFileSync(file, "utf8");
  let next = original;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== original) {
    writeFileSync(file, next);
    console.log("atualizado:", file);
  }
}

roots.forEach(walk);
