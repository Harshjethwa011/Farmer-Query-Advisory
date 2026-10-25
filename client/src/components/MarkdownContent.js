import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const allowedProtocols = new Set(['http:', 'https:', 'mailto:']);

function safeUrlTransform(value) {
  const url = value.trim();

  try {
    const parsed = new URL(url, 'https://fieldwise.invalid');
    return allowedProtocols.has(parsed.protocol) ? url : '';
  } catch {
    return '';
  }
}

export default function MarkdownContent({ children }) {
  return React.createElement(
    ReactMarkdown,
    {
      remarkPlugins: [remarkGfm],
      skipHtml: true,
      urlTransform: safeUrlTransform,
      components: {
        a: ({ href, children: linkText }) => href
          ? React.createElement('a', { href }, linkText)
          : React.createElement('span', null, linkText),
        img: ({ alt }) => React.createElement('span', null, alt || ''),
        table: ({ children: tableContent }) => React.createElement(
          'div',
          { className: 'markdown-table-wrap' },
          React.createElement('table', null, tableContent)
        ),
      },
    },
    children
  );
}
