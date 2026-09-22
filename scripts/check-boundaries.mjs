import ts from 'typescript';
import {sourceFiles} from './files.mjs';

const errors = [];
const rawColor = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:bg|text|border|ring|fill|stroke)-(?:blue|red|green|gray|slate|zinc|neutral|stone|orange|amber|yellow|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b|\b(?:bg|text|border)-(?:white|black)\b/i;
for (const {file, text} of await sourceFiles()) {
  if (file.endsWith('.css')) {
    for (const [line, value] of text.split('\n').entries()) {
      if (rawColor.test(value) && !value.trim().startsWith('--')) errors.push(`${file}:${line + 1}: color literal outside token declaration`);
    }
    continue;
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) {
      const value = node.text;
      if (/[가-힣]/.test(value)) errors.push(`${file}: untranslated Korean string`);
      if (rawColor.test(value)) errors.push(`${file}: raw color instead of semantic token`);
      if (ts.isJsxText(node) && /[a-zA-Z]/.test(value)) errors.push(`${file}: untranslated JSX text`);
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = node.moduleSpecifier.text;
      if (file.replaceAll('\\', '/').startsWith('src/components/') && /lib\/sources|firebase-admin|firebase\/admin|(?:^|\/)env$/.test(target)) errors.push(`${file}: UI imports an external/server boundary`);
      if (/^['"]use client['"];/.test(text) && /server-only|firebase-admin|firebase\/admin|(?:^|\/)env$/.test(target)) errors.push(`${file}: server module imported by client`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('String, color and server/client boundary checks passed.');
