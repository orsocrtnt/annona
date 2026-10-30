#!/usr/bin/env node
// Carte des connexions TutelLiv : imports, appels /api et tables Prisma.
// À lancer depuis la racine du dépôt :
//   node .claude/skills/tutelliv-carte/carte.mjs                      → génère outputs/carte/carte.html
//   node .claude/skills/tutelliv-carte/carte.mjs utilise-par <cible>  → tout ce qui dépend de la cible
//   node .claude/skills/tutelliv-carte/carte.mjs depend-de <cible>    → tout ce que la cible utilise
//   node .claude/skills/tutelliv-carte/carte.mjs chemin <de> <vers>   → pourquoi <de> dépend de <vers>
// Options : --avec-types (compte aussi les `import type`, ignorés par défaut), --max N (éléments affichés par couche, 40 par défaut).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
if (!fs.existsSync(path.join(ROOT, 'src/app')) || !fs.existsSync(path.join(ROOT, 'prisma/schema.prisma'))) {
  console.error('Lancer depuis la racine du dépôt TutelLiv (src/app et prisma/schema.prisma introuvables).');
  process.exit(1);
}
const ts = createRequire(path.join(ROOT, 'package.json'))('typescript');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const LAYERS = [
  ['page', 'Pages'], ['layout', 'Gabarits'], ['api', 'Routes API'], ['feature', 'Features'],
  ['composant', 'Composants'], ['domaine', 'Domaines'], ['service', 'Services'], ['lib', 'Lib'],
  ['hook', 'Hooks'], ['store', 'Stores'], ['type', 'Types'], ['app', 'App (autres)'], ['autre', 'Autres'],
  ['table', 'Tables'], ['paquet', 'Paquets'],
];
const EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const NEXT_ENTRIES = /^(page|layout|route|loading|error|not-found|template|default|global-error|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\./;
const PRISMA_READ = ['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'];
const PRISMA_WRITE = ['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany'];
const HTTP = 'GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS';

// ---------- Construction du graphe ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.includes(path.extname(e.name)) && !e.name.endsWith('.d.ts')) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}

function layerOf(f) {
  const base = path.posix.basename(f);
  if (f.startsWith('src/app/api/') && base.startsWith('route.')) return 'api';
  if (f.startsWith('src/app/') && base.startsWith('page.')) return 'page';
  if (f.startsWith('src/app/') && base.startsWith('layout.')) return 'layout';
  if (f.startsWith('src/app/')) return 'app';
  const top = f.split('/')[1];
  return { features: 'feature', components: 'composant', domains: 'domaine', services: 'service', lib: 'lib', hooks: 'hook', stores: 'store', types: 'type' }[top] ?? 'autre';
}

function urlOf(f) {
  const segs = f.replace(/^src\/app\/?/, '').split('/').slice(0, -1).filter((s) => !/^\(.*\)$/.test(s));
  return '/' + segs.join('/');
}

export function build() {
  const files = walk(path.join(ROOT, 'src'));
  const fileSet = new Set(files);
  const pkg = JSON.parse(read('package.json'));
  const deps = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
  const builtins = new Set(builtinModules);
  const models = [...read('prisma/schema.prisma').matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
  const modelByClient = new Map(models.map((m) => [m[0].toLowerCase() + m.slice(1), m]));
  const readOps = new Set(PRISMA_READ);
  const writeOps = new Set(PRISMA_WRITE);

  const nodes = new Map();
  const edges = new Map();
  const unresolved = [];
  const addEdge = (from, to, kind) => {
    if (from === to) return;
    const k = from + '\u0000' + to;
    if (!edges.has(k)) edges.set(k, { from, to, kinds: new Set() });
    edges.get(k).kinds.add(kind);
  };

  for (const f of files) {
    const layer = layerOf(f);
    const segs = f.split('/');
    const n = { id: f, layer, label: f.replace(/^src\//, ''), module: segs.length > 3 ? segs[2] : segs[1], file: true };
    if (layer === 'page' || layer === 'api' || layer === 'layout') n.url = urlOf(f);
    if (layer === 'page') n.label = n.url;
    if (layer === 'api') n.label = n.url;
    const base = path.posix.basename(f);
    n.entry = (f.startsWith('src/app/') && NEXT_ENTRIES.test(base)) || /^src\/(middleware|instrumentation)\./.test(f);
    nodes.set(f, n);
  }
  for (const m of models) nodes.set('table:' + m, { id: 'table:' + m, layer: 'table', label: m, module: 'prisma' });

  const resolveSpec = (from, spec) => {
    let base;
    if (spec.startsWith('@/')) base = 'src/' + spec.slice(2);
    else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    else return null;
    return [base, ...EXT.map((e) => base + e), ...EXT.map((e) => base + '/index' + e)].find((c) => fileSet.has(c)) ?? null;
  };
  const addImport = (from, spec, typeOnly) => {
    const kind = typeOnly ? 'type' : 'import';
    const target = resolveSpec(from, spec);
    if (target) return addEdge(from, target, kind);
    if (spec.startsWith('node:') || builtins.has(spec)) return;
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!deps.has(name)) return;
    const id = 'paquet:' + name;
    if (!nodes.has(id)) nodes.set(id, { id, layer: 'paquet', label: name, module: 'npm' });
    addEdge(from, id, kind);
  };

  const apiCalls = [];
  for (const f of files) {
    const text = read(f);
    const node = nodes.get(f);
    if (node.layer === 'api') {
      const methods = new Set([...text.matchAll(new RegExp(`export\\s+(?:async\\s+function|function|const|let)\\s+(${HTTP})\\b`, 'g'))].map((m) => m[1]));
      for (const m of text.matchAll(new RegExp(`export\\s*\\{[^}]*\\bas\\s+(${HTTP})\\b`, 'g'))) methods.add(m[1]);
      node.methods = [...methods];
    }
    const ext = path.extname(f);
    const kind = { '.tsx': ts.ScriptKind.TSX, '.jsx': ts.ScriptKind.JSX, '.js': ts.ScriptKind.JS, '.mjs': ts.ScriptKind.JS }[ext] ?? ts.ScriptKind.TS;
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, kind);
    const visit = (n) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        addImport(f, n.moduleSpecifier.text, !!n.importClause?.isTypeOnly);
      } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        addImport(f, n.moduleSpecifier.text, n.isTypeOnly);
      } else if (ts.isCallExpression(n)) {
        const arg = n.arguments[0];
        const isDyn = n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require');
        if (isDyn && arg && ts.isStringLiteralLike(arg)) addImport(f, arg.text, false);
        const e = n.expression;
        if (ts.isPropertyAccessExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
          const op = e.name.text;
          const model = modelByClient.get(e.expression.name.text);
          if (model && (readOps.has(op) || writeOps.has(op))) addEdge(f, 'table:' + model, writeOps.has(op) ? 'écriture' : 'lecture');
        }
      }
      let str = null;
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) str = n.text;
      else if (ts.isTemplateExpression(n)) str = n.head.text + n.templateSpans.map((s) => '${}' + s.literal.text).join('');
      if (str && str.startsWith('/api/')) apiCalls.push([f, str]);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  // Appels "/api/..." → fichier route.ts correspondant (segment littéral prioritaire sur [id]).
  const routes = files.filter((f) => nodes.get(f).layer === 'api').map((f) => ({ f, segs: nodes.get(f).url.split('/').filter(Boolean) }));
  const score = (rs, cs, strict) => {
    let sc = 0;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (/^\[\[?\.\.\./.test(r)) return cs.length >= i + (r.startsWith('[[') ? 0 : 1) ? sc : -1;
      if (i >= cs.length) return -1;
      const c = cs[i];
      if (/^\[.*\]$/.test(r)) continue;
      if (c.includes('${}')) { if (strict) return -1; continue; }
      if (r !== c) return -1;
      sc++;
    }
    return rs.length === cs.length ? sc : -1;
  };
  const matchApi = (raw) => {
    const clean = raw.split(/[?#]/)[0];
    const segs = clean.split('/').filter(Boolean);
    const tries = clean.endsWith('/') ? [segs, [...segs, '${}']] : [segs];
    for (const strict of [true, false]) {
      for (const s of tries) {
        let best = null, bestScore = -1;
        for (const r of routes) { const sc = score(r.segs, s, strict); if (sc > bestScore) { best = r; bestScore = sc; } }
        if (best) return best.f;
      }
    }
    return null;
  };
  for (const [f, url] of apiCalls) {
    const target = matchApi(url);
    if (target) addEdge(f, target, 'appel');
    else unresolved.push({ from: f, url: url.replaceAll('${}', '${…}') });
  }

  const hasIncoming = new Set([...edges.values()].map((e) => e.to));
  const orphans = [...nodes.values()].filter((n) => n.file && !n.entry && !hasIncoming.has(n.id)).map((n) => n.id).sort();
  let commit = '';
  try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}
  return {
    root: ROOT, commit, generatedAt: new Date().toISOString(), layers: LAYERS,
    nodes: [...nodes.values()],
    edges: [...edges.values()].map((e) => ({ from: e.from, to: e.to, kinds: [...e.kinds] })),
    unresolved, orphans,
  };
}

// ---------- Parcours ----------
function index(data, withTypes) {
  const out = new Map(), inc = new Map();
  for (const n of data.nodes) { out.set(n.id, []); inc.set(n.id, []); }
  for (const e of data.edges) {
    if (!withTypes && e.kinds.every((k) => k === 'type')) continue;
    out.get(e.from).push(e); inc.get(e.to).push(e);
  }
  return { out, inc, byId: new Map(data.nodes.map((n) => [n.id, n])) };
}
function bfs(idx, start, dir) {
  const parent = new Map([[start, null]]);
  const q = [start];
  while (q.length) {
    const id = q.shift();
    for (const e of (dir === 'down' ? idx.out : idx.inc).get(id)) {
      const nx = dir === 'down' ? e.to : e.from;
      if (!parent.has(nx)) { parent.set(nx, id); q.push(nx); }
    }
  }
  return parent;
}
function findTarget(data, arg) {
  const all = data.nodes;
  const low = arg.toLowerCase();
  const exact = all.filter((n) => n.id === arg || n.id.toLowerCase() === low || n.id === 'table:' + arg || n.id === 'paquet:' + arg
    || n.label.toLowerCase() === low || n.url === arg);
  if (exact.length) return exact;
  return all.filter((n) => n.id.toLowerCase().includes(low) || n.label.toLowerCase().includes(low));
}
function pick(data, arg) {
  const found = findTarget(data, arg);
  if (found.length === 1) return found[0];
  if (!found.length) { console.error(`Rien ne correspond à « ${arg} ».`); process.exit(1); }
  const preferred = found.filter((n) => n.layer === 'page' || n.layer === 'table');
  if (preferred.length === 1) return preferred[0];
  console.error(`« ${arg} » est ambigu (${found.length} résultats), préciser :`);
  for (const n of found.slice(0, 30)) console.error(`  ${n.id}`);
  process.exit(1);
}
const show = (n) => (n.file && n.label !== n.id.replace(/^src\//, '') ? `${n.label}  (${n.id})` : n.label) + (n.methods?.length ? `  [${n.methods.join(' ')}]` : '');

function printGrouped(data, idx, ids, max) {
  const groups = new Map(data.layers.map(([k]) => [k, []]));
  for (const id of ids) groups.get(idx.byId.get(id).layer).push(idx.byId.get(id));
  for (const [k, label] of data.layers) {
    const g = groups.get(k).sort((a, b) => a.label.localeCompare(b.label));
    if (!g.length) continue;
    console.log(`\n${label} (${g.length})`);
    for (const n of g.slice(0, max)) console.log(`  ${show(n)}`);
    if (g.length > max) console.log(`  … +${g.length - max}`);
  }
}

// ---------- Entrée ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const withTypes = args.includes('--avec-types');
  const maxI = args.indexOf('--max');
  const max = maxI >= 0 ? Number(args[maxI + 1]) : 40;
  const pos = args.filter((a, i) => !a.startsWith('--') && (maxI < 0 || i !== maxI + 1));
  const [cmd, a, b] = pos;
  const data = build();
  const idx = index(data, withTypes);

  if (!cmd) {
    const outDir = path.join(ROOT, 'outputs/carte');
    fs.mkdirSync(outDir, { recursive: true });
    const tpl = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'carte.html'), 'utf8');
    const json = JSON.stringify(data).replaceAll('</', '<\\/');
    fs.writeFileSync(path.join(outDir, 'carte.html'), tpl.replace('/*__DATA__*/null', () => json));
    fs.writeFileSync(path.join(outDir, 'carte.json'), JSON.stringify(data, null, 1));
    const count = (l) => data.nodes.filter((n) => n.layer === l).length;
    console.log(`Carte générée : outputs/carte/carte.html (commit ${data.commit})`);
    console.log(`${data.nodes.length} éléments, ${data.edges.length} liens — ${count('page')} pages, ${count('api')} routes API, ${count('table')} tables`);
    console.log(`${data.unresolved.length} appels /api sans route, ${data.orphans.length} fichiers jamais importés`);
  } else if (cmd === 'utilise-par' || cmd === 'depend-de') {
    if (!a) { console.error(`Usage : ${cmd} <cible>`); process.exit(1); }
    const n = pick(data, a);
    const dir = cmd === 'depend-de' ? 'down' : 'up';
    const reach = [...bfs(idx, n.id, dir).keys()].filter((id) => id !== n.id);
    const direct = (dir === 'down' ? idx.out : idx.inc).get(n.id);
    console.log(`${show(n)} — ${dir === 'down' ? 'utilise' : 'est utilisé par'} ${reach.length} éléments (${direct.length} en direct)`);
    console.log(`\nEn direct :`);
    for (const e of direct) console.log(`  ${show(idx.byId.get(dir === 'down' ? e.to : e.from))}  ‹${e.kinds.join(', ')}›`);
    console.log(`\nToute la chaîne :`);
    printGrouped(data, idx, reach, max);
  } else if (cmd === 'chemin') {
    if (!a || !b) { console.error('Usage : chemin <de> <vers>'); process.exit(1); }
    const from = pick(data, a), to = pick(data, b);
    const parent = bfs(idx, from.id, 'down');
    if (!parent.has(to.id)) { console.log(`${from.label} ne dépend pas de ${to.label}.`); process.exit(0); }
    const chain = [];
    for (let x = to.id; x; x = parent.get(x)) chain.unshift(x);
    chain.forEach((id, i) => {
      const e = i ? idx.out.get(chain[i - 1]).find((ed) => ed.to === id) : null;
      console.log(`${i ? `  └─ ‹${e.kinds.join(', ')}› ` : ''}${show(idx.byId.get(id))}`);
    });
  } else {
    console.error(`Commande inconnue « ${cmd} ». Commandes : utilise-par, depend-de, chemin.`);
    process.exit(1);
  }
}
