
import React from 'react';
import { ListItemNode } from '../types';
import EditorItem from './EditorItem';
import { PlusIcon } from './icons';

interface EditorProps {
  nodes: ListItemNode[];
  onUpdateText: (id: string, text: string) => void;
  onAddItem: (parentId: string | null) => void;
  onDeleteItem: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  itemToFocusId: string | null;
  onFocusHandled: () => void;
}

const Editor: React.FC<EditorProps> = ({ 
    nodes, 
    onUpdateText, 
    onAddItem, 
    onDeleteItem,
    onIndent,
    onOutdent,
    itemToFocusId,
    onFocusHandled
}) => {
  return (
    <div className="p-4 sm:p-8 h-full overflow-y-auto">
      {nodes.length > 0 ? (
        nodes.map((node, index) => (
          <EditorItem
            key={node.id}
            node={node}
            level={1}
            onUpdateText={onUpdateText}
            onAddItem={onAddItem}
            onDeleteItem={onDeleteItem}
            onIndent={onIndent}
            onOutdent={onOutdent}
            isFirst={index === 0}
            isLast={index === nodes.length - 1}
            parentIsRoot={true}
            itemToFocusId={itemToFocusId}
            onFocusHandled={onFocusHandled}
          />
        ))
      ) : (
        <div className="flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 h-full">
            <p className="text-lg mb-4">This document is empty.</p>
            <button 
                onClick={() => onAddItem(null)}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
                <PlusIcon className="w-5 h-5"/>
                <span>Add first item</span>
            </button>
        </div>
      )}
    </div>
  );
};

export default Editor;
