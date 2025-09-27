
import React, { useRef, useEffect } from 'react';
import { ListItemNode } from '../types';
import { TrashIcon, ArrowRightIcon, ArrowLeftIcon } from './icons';

interface EditorItemProps {
  node: ListItemNode;
  level: number;
  onUpdateText: (id: string, text: string) => void;
  onAddItem: (parentId: string | null) => void;
  onDeleteItem: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onNavigateFocus: (id: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
  parentIsRoot: boolean;
  itemToFocusId: string | null;
  onFocusHandled: () => void;
}

const EditorItem: React.FC<EditorItemProps> = ({
  node,
  level,
  onUpdateText,
  onAddItem,
  onDeleteItem,
  onIndent,
  onOutdent,
  onNavigateFocus,
  isFirst,
  isLast,
  parentIsRoot,
  itemToFocusId,
  onFocusHandled,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (itemToFocusId === node.id && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      onFocusHandled();
    }
  }, [itemToFocusId, node.id, onFocusHandled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddItem(node.id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdent(node.id);
      } else {
        onIndent(node.id);
      }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigateFocus(node.id, 'up');
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigateFocus(node.id, 'down');
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center group space-x-2 py-1">
        <input
          ref={inputRef}
          type="text"
          value={node.text}
          onChange={(e) => onUpdateText(node.id, e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-grow bg-transparent focus:outline-none focus:bg-slate-200 dark:focus:bg-slate-700 rounded-md px-2 py-1"
          placeholder="Type here..."
        />
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button onClick={() => onIndent(node.id)} title="Indent (Tab)" className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed" disabled={isFirst && parentIsRoot}>
                <ArrowRightIcon className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={() => onOutdent(node.id)} title="Outdent (Shift+Tab)" className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed" disabled={parentIsRoot}>
                <ArrowLeftIcon className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={() => onDeleteItem(node.id)} title="Delete item" className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">
                <TrashIcon className="w-4 h-4 text-red-500" />
            </button>
        </div>
      </div>
      <div style={{ paddingLeft: `1.5rem` }} className="relative">
        {node.children.length > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700 ml-3"></div>}
        {node.children.map((childNode, index) => (
          <EditorItem
            key={childNode.id}
            node={childNode}
            level={level + 1}
            onUpdateText={onUpdateText}
            onAddItem={onAddItem}
            onDeleteItem={onDeleteItem}
            onIndent={onIndent}
            onOutdent={onOutdent}
            onNavigateFocus={onNavigateFocus}
            isFirst={index === 0}
            isLast={index === node.children.length - 1}
            parentIsRoot={false}
            itemToFocusId={itemToFocusId}
            onFocusHandled={onFocusHandled}
          />
        ))}
      </div>
    </div>
  );
};

export default EditorItem;
