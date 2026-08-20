import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../src/ui/renderUi.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

assert.match(ui, /if \(options\.expanded\) card\.append\(replies\)/, 'collapsed comments must not remain in the DOM');
assert.match(ui, /fullContent: true/, 'generated trends must opt into full-body rendering');
assert.match(ui, /right\.createdAt\.localeCompare\(left\.createdAt\)/, 'newest generated trends must render first');
assert.match(ui, /forum-reply-body/, 'comment author and body must share one wrapping text flow');
assert.doesNotMatch(ui, /`\$\{post\.excerpt\}…`/, 'post renderer must not append a fake ellipsis');
assert.match(ui, /forum-post-footer/, 'comment and delete controls must share the card footer');
assert.match(css, /\.forum-post-excerpt\.is-full-content\s*\{[^}]*display:\s*block[^}]*-webkit-line-clamp:\s*unset/s, 'full trend bodies must disable line clamping');
assert.match(css, /\.forum-reply-preview\s*\{[^}]*grid-template-columns:\s*14px minmax\(0, 1fr\)/s, 'comments must not reserve a separate author column');
assert.match(css, /\.trend-delete-button\s*\{[^}]*margin-left:\s*auto[^}]*font-size:\s*11px/s, 'delete control must stay compact and right-aligned');

console.log('trends UI contract passed: full body / comment toggle / wrapping / footer actions');
