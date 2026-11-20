// 从源码中提取每张 Supabase 表实际使用的列，供完整建表 SQL 核对
// 用法: node check-report/extract-table-columns.mjs > check-report/table-columns.json
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name)) files.push(p);
  }
})(join(ROOT, 'src'));

const tables = {};
function note(table, col, file, kind) {
  if (!col || !/^[a-z_][a-z0-9_]*$/.test(col)) return;
  const t = (tables[table] ||= { cols: {}, files: new Set() });
  (t.cols[col] ||= new Set()).add(kind);
  t.files.add(file.replace(ROOT, '').replace(/\\/g, '/'));
}

// 平衡花括号截取对象字面量，返回 depth=1 的键
function objectKeys(src, start) {
  const open = src.indexOf('{', start);
  if (open < 0 || open - start > 40) return [];
  let depth = 0, keys = [], buf = '', inStr = null, expectKey = true;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      else if (depth === 1 && expectKey) buf += c;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; if (depth === 2) { expectKey = false; buf = ''; } continue; }
    if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0) break;
      if (depth === 1) { expectKey = true; buf = ''; }
      continue;
    }
    if (depth === 1) {
      if (c === ':' && expectKey) { keys.push(buf.trim()); expectKey = false; buf = ''; continue; }
      if (c === ',' ) { expectKey = true; buf = ''; continue; }
      if (expectKey) buf += c;
    }
  }
  return keys.map(k => k.replace(/^['"`]|['"`]$/g, ''));
}

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const re = /\.from\(\s*['"]([a-z_]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const table = m[1];
    let chain = src.slice(m.index, m.index + 2500);
    // 截断到下一条 .from( ，避免串到别的表链上
    const nextFrom = chain.indexOf('.from(', 8);
    if (nextFrom > 0) chain = chain.slice(0, nextFrom);
    // 写入列
    for (const method of ['insert', 'upsert', 'update']) {
      const wre = new RegExp(`\\.${method}\\s*\\(`, 'g');
      let w;
      while ((w = wre.exec(chain))) {
        // 数组形式 insert([{...}]) 取第一个对象
        for (const key of objectKeys(chain, w.index + w[0].length)) note(table, key, file, method);
      }
    }
    // 过滤/排序列
    const fre = /\.(eq|neq|gt|gte|lt|lte|like|ilike|in|contains|containedBy|overlaps|is|filter|match|order)\(\s*['"]([a-z_][a-z0-9_]*)['"]/g;
    let f;
    while ((f = fre.exec(chain))) note(table, f[2], file, f[1]);
    // select 列清单
    const sre = /\.select\(\s*['"`]([^'"`]*)['"`]/g;
    let s;
    while ((s = sre.exec(chain))) {
      for (const part of s[1].split(',')) {
        const col = part.trim().split(/[\s(]/)[0];
        if (col && col !== '*') note(table, col, file, 'select');
      }
    }
  }
}

const out = {};
for (const [t, v] of Object.entries(tables).sort()) {
  out[t] = { cols: Object.fromEntries(Object.entries(v.cols).sort().map(([c, k]) => [c, [...k]])), files: [...v.files].sort() };
}
console.log(JSON.stringify(out, null, 2));