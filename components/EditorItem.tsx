
import React, { useRef, useEffect } from 'react';
import { ListItemNode } from '../types';
import { PlusIcon, TrashIcon, ArrowRightIcon, ArrowLeftIcon } from './icons';

interface EditorItemProps {
  node: ListItemNode;
  level: number;
  onUpdateText: (id: string, text: string) => void;
  onAddItem: (parentId: string | null) => void;
  onDeleteItem: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
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
    } else if (e.key === 'Backspace' && node.text === '') {
        e.preventDefault();
        onDeleteItem(node.id);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="group flex items-center space-x-2 py-1">
        <span className="text-xl font-bold text-slate-400 dark:text-slate-600 w-8 text-right">
          {'#'.repeat(level)}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={node.text}
          onChange={(e) => onUpdateText(node.id, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type here..."
          className="flex-grow bg-transparent focus:outline-none text-slate-800 dark:text-slate-200 text-lg py-1"
        />
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button onClick={() => onAddItem(node.id)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
            <PlusIcon className="w-5 h-5" />
          </button>
          <button onClick={() => onIndent(node.id)} disabled={isFirst} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed">
            <ArrowRightIcon className="w-5 h-5" />
          </button>
          <button onClick={() => onOutdent(node.id)} disabled={parentIsRoot} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <button onClick={() => onDeleteItem(node.id)} className="p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500">
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div style={{ paddingLeft: `${level * 1.5}rem` }}>
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
