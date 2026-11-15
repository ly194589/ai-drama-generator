// 死代码扫描：从 Next.js 入口出发做 import 可达性分析，列出零引用文件
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

function resolve(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  const cands = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  for (const c of cands) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}

const edges = new Map();
for (const f of files) {
  const text = fs.readFileSync(f, 'utf-8');
  const set = new Set();
  for (const m of text.matchAll(IMPORT_RE)) {
    const r = resolve(m[1], f);
    if (r) set.add(r);
  }
  edges.set(f, set);
}

const entries = files.filter(f => {
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  return /^app\/.*\/(page|layout|route|error|not-found|loading|template|default)\.tsx?$/.test(rel)
    || /^app\/(page|layout|error|not-found|loading|global-error)\.tsx?$/.test(rel)
    // Next.js 元数据路由由框架直接调用，无显式 import
    || /^app\/(robots|sitemap|manifest)\.tsx?$/.test(rel)
    // drizzle 数据模型定义，作为表结构文档保留
    || rel === 'storage/database/shared/schema.ts'
    || rel === 'storage/database/shared/relations.ts'
    || rel === 'proxy.ts' || rel === 'middleware.ts';
});

const seen = new Set(entries);
const queue = [...entries];
while (queue.length) {
  const f = queue.pop();
  for (const dep of edges.get(f) || []) {
    if (!seen.has(dep)) { seen.add(dep); queue.push(dep); }
  }
}

const dead = files.filter(f => !seen.has(f));
console.log('entries:', entries.length, 'reachable:', seen.size, 'total:', files.length);
console.log('--- unreachable files ---');
for (const f of dead) console.log(path.relative(ROOT, f).replace(/\\/g, '/'));