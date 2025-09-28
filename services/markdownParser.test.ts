import { describe, it, expect } from 'vitest';

import { parseMarkdown, serializeToMarkdown } from './markdownParser';
import type { ListItemNode } from '../types';

describe('parseMarkdown', () => {
  it('creates a hierarchical node tree from markdown headings and paragraphs', () => {
    const markdown = [
      '# Heading 1',
      'Paragraph under heading 1',
      '',
      '## Heading 1.1',
      'Nested paragraph',
      '',
      '# Heading 2',
      'Paragraph under heading 2',
    ].join('\n');

    const result = parseMarkdown(markdown);

    expect(result).toHaveLength(2);

    const [firstHeading, secondHeading] = result;

    expect(firstHeading.text).toBe('Heading 1');
    expect(firstHeading.isCollapsed).toBe(false);
    expect(firstHeading.children).toHaveLength(2);
    expect(firstHeading.children[0]?.text).toBe('Paragraph under heading 1');

    const nestedHeading = firstHeading.children[1];
    expect(nestedHeading?.text).toBe('Heading 1.1');
    expect(nestedHeading?.children).toHaveLength(1);
    expect(nestedHeading?.children[0]?.text).toBe('Nested paragraph');

    expect(secondHeading.text).toBe('Heading 2');
    expect(secondHeading.children).toHaveLength(1);
    expect(secondHeading.children[0]?.text).toBe('Paragraph under heading 2');
  });

  it('treats standalone paragraphs as top-level nodes', () => {
    const markdown = [
      'First paragraph',
      '',
      'Second paragraph',
    ].join('\n');

    const result = parseMarkdown(markdown);

    expect(result).toHaveLength(2);
    expect(result.map(node => node.text)).toEqual([
      'First paragraph',
      'Second paragraph',
    ]);
  });
});

describe('serializeToMarkdown', () => {
  it('renders nodes with nested headings and paragraphs to markdown text', () => {
    const nodes: ListItemNode[] = [
      {
        id: '1',
        text: 'Heading 1',
        isCollapsed: false,
        children: [
          {
            id: '1-1',
            text: 'Paragraph under heading 1',
            isCollapsed: false,
            children: [],
          },
          {
            id: '1-2',
            text: 'Heading 1.1',
            isCollapsed: false,
            children: [
              {
                id: '1-2-1',
                text: 'Nested paragraph',
                isCollapsed: false,
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: '2',
        text: 'Standalone paragraph',
        isCollapsed: false,
        children: [],
      },
    ];

    expect(serializeToMarkdown(nodes)).toBe(
      [
        '# Heading 1',
        'Paragraph under heading 1',
        '',
        '## Heading 1.1',
        'Nested paragraph',
        '',
        'Standalone paragraph',
      ].join('\n'),
    );
  });
});
