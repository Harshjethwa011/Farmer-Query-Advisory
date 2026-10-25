import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MarkdownContent from '../src/components/MarkdownContent.js';

function renderMarkdown(markdown) {
  return renderToStaticMarkup(
    React.createElement(MarkdownContent, null, markdown)
  );
}

test('assistant Markdown renders headings, emphasis, lists, tables, and rules', () => {
  const html = renderMarkdown([
    '# Possible issue',
    '',
    '**Possible causes** and *careful advice*.',
    '',
    '- Check soil moisture',
    '- Inspect affected leaves',
    '',
    '1. Start with observation',
    '2. Ask a local expert',
    '',
    '| Sign | Meaning |',
    '| --- | --- |',
    '| Yellow leaves | Several possible causes |',
    '',
    '---',
  ].join('\n'));

  assert.match(html, /<h1>Possible issue<\/h1>/);
  assert.match(html, /<strong>Possible causes<\/strong>/);
  assert.match(html, /<em>careful advice<\/em>/);
  assert.match(html, /<ul>[\s\S]*<\/ul>/);
  assert.match(html, /<ol>[\s\S]*<\/ol>/);
  assert.match(html, /<div class="markdown-table-wrap"><table>/);
  assert.match(html, /<th>Sign<\/th>/);
  assert.match(html, /<td>Yellow leaves<\/td>/);
  assert.match(html, /<hr\/>/);
});

test('assistant Markdown skips raw HTML and blocks unsafe links and remote images', () => {
  const html = renderMarkdown([
    '<img src=x onerror="alert(1)">',
    '',
    '[unsafe](javascript:alert%281%29)',
    '',
    '[safe](https://example.test/advice)',
    '',
    '![tracking image](https://example.test/image.png)',
  ].join('\n'));

  assert.doesNotMatch(html, /onerror|<img|javascript:|href=""/i);
  assert.match(html, /<span>unsafe<\/span>/);
  assert.match(html, /<a href="https:\/\/example\.test\/advice">safe<\/a>/);
  assert.match(html, /tracking image/);
  assert.doesNotMatch(html, /<img|image\.png/);
});
