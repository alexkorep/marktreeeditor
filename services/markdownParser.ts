
import { ListItemNode } from '../types';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const parseMarkdown = (markdown: string): ListItemNode[] => {
  const lines = markdown.split(/\r?\n/);
  const rootNodes: ListItemNode[] = [];
  const parentStack: (ListItemNode | null)[] = [null];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;

    const text = paragraphBuffer.join('\n').trim();
    paragraphBuffer = [];
    if (text === '') return;

    const parent = parentStack[parentStack.length - 1] ?? null;
    const newNode: ListItemNode = {
      id: generateId(),
      text,
      isCollapsed: false,
      children: [],
    };

    if (parent) {
      parent.children.push(newNode);
    } else {
      rootNodes.push(newNode);
    }
  };

  lines.forEach(line => {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      flushParagraph();
      return;
    }

    const levelMatch = line.match(/^(#+)\s+(.*)$/);
    if (levelMatch) {
      flushParagraph();

      const level = levelMatch[1].length;
      const text = levelMatch[2].trim();

      const newNode: ListItemNode = {
        id: generateId(),
        text,
        isCollapsed: false,
        children: [],
      };

      while (parentStack.length > level) {
        parentStack.pop();
      }

      const parent = parentStack[parentStack.length - 1] ?? null;

      if (parent) {
        parent.children.push(newNode);
      } else {
        rootNodes.push(newNode);
      }

      parentStack.push(newNode);
    } else {
      paragraphBuffer.push(trimmedLine);
    }
  });

  flushParagraph();

  return rootNodes;
};

const serializeNode = (node: ListItemNode, level: number): string => {
  if (node.children.length === 0) {
    return node.text;
  }

  const headingLine = `${'#'.repeat(level)} ${node.text}`;
  const childrenBlocks = node.children
    .map(child => serializeNode(child, level + 1))
    .filter(text => text !== '');

  if (childrenBlocks.length === 0) {
    return headingLine;
  }

  const childrenText = childrenBlocks.join('\n\n');
  return `${headingLine}\n${childrenText}`;
};

export const serializeToMarkdown = (nodes: ListItemNode[]): string => {
  return nodes
    .map(node => serializeNode(node, 1))
    .filter(text => text !== '')
    .join('\n\n');
};
