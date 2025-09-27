
import { ListItemNode } from '../types';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const parseMarkdown = (markdown: string): ListItemNode[] => {
  const lines = markdown.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const rootNodes: ListItemNode[] = [];
  const parentStack: (ListItemNode | null)[] = [null]; // stack[level] gives parent

  lines.forEach(line => {
    const levelMatch = line.match(/^(#+)\s/);
    if (!levelMatch) return;

    const level = levelMatch[1].length;
    const text = line.substring(levelMatch[0].length);

    const newNode: ListItemNode = {
      id: generateId(),
      text,
      children: [],
    };

    while (parentStack.length > level) {
      parentStack.pop();
    }

    const parent = parentStack[parentStack.length - 1];

    if (parent) {
      parent.children.push(newNode);
    } else {
      rootNodes.push(newNode);
    }
    
    parentStack.push(newNode);
  });

  return rootNodes;
};


const serializeNode = (node: ListItemNode, level: number): string => {
  const prefix = '#'.repeat(level);
  const currentNodeText = `${prefix} ${node.text}`;
  const childrenText = node.children.map(child => serializeNode(child, level + 1)).join('\n');
  return `${currentNodeText}${childrenText ? '\n' + childrenText : ''}`;
};

export const serializeToMarkdown = (nodes: ListItemNode[]): string => {
  return nodes.map(node => serializeNode(node, 1)).join('\n');
};
