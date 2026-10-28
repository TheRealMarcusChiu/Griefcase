import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const QUOTE = "the opposite of grief isn't happiness; the opposite of grief is forgetting......... Now you could either grieve or forget.";
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const css = readFileSync(new URL('styles.css', root), 'utf8');

const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&(quot|apos|lt|gt|nbsp|amp);/g, (_, n) => ({ quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', amp: '&' })[n]);

test('the quote is the only visible text', () => {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];
  const text = decode(body.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  assert.equal(text, QUOTE);
});

test('no script, form, buttons, inputs or external requests', () => {
  assert.doesNotMatch(html, /<(script|form|button|input|textarea|select|iframe|nav|header|footer|h[1-6])\b/i);
  assert.doesNotMatch(html, /\b(src|href)=["']?(https?:)?\/\//i);
  assert.doesNotMatch(css, /@import|url\(/i);
});

test('stylesheet link resolves relatively', () => {
  const href = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/i)[1];
  assert.doesNotMatch(href, /^(\/|[a-z]+:)/i);
  assert.ok(existsSync(new URL(href, root)));
});

test('quote CSS is mobile-safe', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  const rule = css.match(/\.quote\s*\{([^}]*)\}/)[1];
  assert.match(rule, /max-width:\s*\d+(\.\d+)?ch/);
  assert.match(rule, /clamp\(/);
  assert.match(rule, /overflow-wrap:\s*anywhere/);
  assert.match(css, /main\s*\{[^}]*place-items:\s*center/);
});
