<source_code>
App.tsx
```

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ListItemNode, AppFile, UserProfile, DocumentViewState } from './types';
import Editor from './components/Editor';
import MarkdownDialog from './components/MarkdownDialog';
import { parseMarkdown, serializeToMarkdown } from './services/markdownParser';
import { FolderPlusIcon, SaveIcon, PlusIcon, XCircleIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from './components/icons';
import { firebaseConfig } from './services/firebaseConfig';
import * as firebaseService from './services/firebase';
import * as localService from './services/localStorage';
import { User } from 'firebase/auth';
import TextInputDialog from './components/TextInputDialog';

const findAndModifyNode = <T, >(nodes: ListItemNode[], targetId: string, callback: (node: ListItemNode, parent: ListItemNode | null, siblings: ListItemNode[], index: number) => T): T | null => {
  const stack: { node: ListItemNode, parent: ListItemNode | null, siblings: ListItemNode[], index: number }[] = nodes.map((node, index) => ({ node, parent: null, siblings: nodes, index }));
  
  while (stack.length > 0) {
    const { node, parent, siblings, index } = stack.shift()!;
    if (node.id === targetId) {
      return callback(node, parent, siblings, index);
    }
    node.children.forEach((child, childIndex) => {
      stack.push({ node: child, parent: node, siblings: node.children, index: childIndex });
    });
  }
  return null;
};

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const flattenNodesForNavigation = (nodes: ListItemNode[]): string[] => {
  let ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0 && !node.isCollapsed) {
      ids = ids.concat(flattenNodesForNavigation(node.children));
    }
  }
  return ids;
};

const collectCollapsedPaths = (nodes: ListItemNode[], basePath: number[] = []): number[][] => {
  const paths: number[][] = [];

  nodes.forEach((node, index) => {
    const currentPath = [...basePath, index];
    if (node.isCollapsed) {
      paths.push(currentPath);
    }

    if (node.children.length > 0) {
      paths.push(...collectCollapsedPaths(node.children, currentPath));
    }
  });

  return paths;
};

const applyCollapsedState = (nodes: ListItemNode[], collapsedPaths: number[][]): ListItemNode[] => {
  const collapsedSet = new Set(collapsedPaths.map(path => path.join('.')));

  const traverse = (items: ListItemNode[], parentPath: number[] = []): ListItemNode[] =>
    items.map((item, index) => {
      const currentPath = [...parentPath, index];
      const pathKey = currentPath.join('.');
      const isCollapsed = collapsedSet.has(pathKey);

      return {
        ...item,
        isCollapsed,
        children: traverse(item.children, currentPath),
      };
    });

  return traverse(nodes);
};

export default function App() {
  const [docContent, setDocContent] = useState<ListItemNode[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [files, setFiles] = useState<AppFile[]>([]);
  const [currentFile, setCurrentFile] = useState<AppFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [itemToFocusId, setItemToFocusId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [importMarkdownText, setImportMarkdownText] = useState('');
  const [exportMarkdownText, setExportMarkdownText] = useState('');
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<AppFile | null>(null);

  const isLoggedIn = useMemo(() => !!user, [user]);

  const cloneDocContent = useCallback(() => {
    return JSON.parse(JSON.stringify(docContent)) as ListItemNode[];
  }, [docContent]);

  const persistLocalViewState = useCallback((nodes: ListItemNode[]) => {
    if (!user?.uid && currentFile) {
      const viewState: DocumentViewState = {
        collapsedPaths: collectCollapsedPaths(nodes),
      };
      void localService.updateDocumentViewState(currentFile.id, viewState);
    }
  }, [currentFile, user]);

  const listFiles = useCallback(async (targetUser: UserProfile | null = user) => {
    setIsLoading(true);
    try {
      let userFiles: AppFile[] = [];
      if (targetUser?.uid) {
        userFiles = await firebaseService.getDocumentsForUser(targetUser.uid);
      } else {
        userFiles = await localService.getDocuments();
      }
      setFiles(userFiles);
      setStatusMessage(null);
    } catch (error) {
      console.error("Error listing files:", error);
      setFiles([]);
      setStatusMessage({
        type: 'error',
        text: 'Unable to load your documents. Please verify your Firebase configuration or try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.apiKey) {
        setConfigError(`Configuration Error: Firebase credentials are not set. Please edit the 'services/firebaseConfig.ts' file with your project's configuration.`);
        setIsLoading(false);
        return;
    }

    const unsubscribe = firebaseService.onAuthChange((firebaseUser: User | null) => {
      setCurrentFile(null);
      setDocContent([]);

      if (firebaseUser) {
        const nextUser: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Anonymous',
          email: firebaseUser.email || '',
          picture: firebaseUser.photoURL || '',
        };
        setUser(nextUser);
        listFiles(nextUser);
      } else {
        setUser(null);
        listFiles(null);
      }
    });

    return () => unsubscribe();
  }, [listFiles]);

  useEffect(() => {
    listFiles();
  }, [listFiles]);

  useEffect(() => {
    setExportMarkdownText(serializeToMarkdown(docContent));
  }, [docContent]);
  
  const handleLogin = async () => {
    try {
      await firebaseService.signInWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseService.signOutUser();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };
  
  const openNewFileDialog = () => {
    setIsNewFileDialogOpen(true);
  };

  const openImportMarkdownDialog = () => {
    setImportMarkdownText(serializeToMarkdown(docContent));
    setIsImportDialogOpen(true);
  };

  const openExportMarkdownDialog = () => {
    setExportMarkdownText(serializeToMarkdown(docContent));
    setIsExportDialogOpen(true);
  };

  const handleImportMarkdown = (markdown: string) => {
    const trimmed = markdown.trim();

    if (!trimmed) {
      setDocContent([]);
      setStatusMessage({
        type: 'info',
        text: 'Document cleared from imported markdown. Remember to save your changes.',
      });
      setImportMarkdownText('');
      setItemToFocusId(null);
      return true;
    }

    const parsedNodes = parseMarkdown(markdown);

    if (parsedNodes.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'No headings (#) were found in the pasted markdown. Please ensure each heading starts with the # symbol.',
      });
      return false;
    }

    setDocContent(parsedNodes);
    const serialized = serializeToMarkdown(parsedNodes);
    setImportMarkdownText(serialized);
    setExportMarkdownText(serialized);
    setItemToFocusId(parsedNodes[0].id);
    setStatusMessage({
      type: 'info',
      text: 'Markdown imported successfully. Remember to save your changes.',
    });
    return true;
  };

  const handleMarkdownCopySuccess = () => {
    setStatusMessage({
      type: 'info',
      text: 'Markdown copied to clipboard.',
    });
  };

  const handleCreateNewFile = async (fileName: string) => {
    if (!fileName) return;

    setIsLoading(true);
    try {
      const initialContent = `# ${fileName.replace(/\.md$/, '')}`;
      let newFileId: string;
      if (user?.uid) {
        newFileId = await firebaseService.createDocument(user.uid, fileName, initialContent);
      } else {
        newFileId = await localService.createDocument(fileName, initialContent);
      }
      await listFiles();
      openFile({ id: newFileId, name: fileName });
      setStatusMessage(null);
    } catch (e) {
      console.error("Error creating file", e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setStatusMessage({
        type: 'error',
        text: `Failed to create the document. Ensure Cloud Firestore is enabled and that the authenticated user has write access. (${errorMessage})`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openFile = async (file: AppFile) => {
    setIsLoading(true);
    try {
      let content: string | null;
      let viewState: DocumentViewState | null = null;
      if (user?.uid) {
        content = await firebaseService.getDocumentContent(file.id);
      } else {
        content = await localService.getDocumentContent(file.id);
        viewState = await localService.getDocumentViewState(file.id);
      }

      if (content !== null) {
        const parsedNodes = parseMarkdown(content);
        const nodesWithState = viewState
          ? applyCollapsedState(parsedNodes, viewState.collapsedPaths)
          : parsedNodes;
        setDocContent(nodesWithState);
        setCurrentFile(file);
      } else {
        console.error("File not found or content is empty, creating from template.");
        const templateContent = `# ${file.name.replace(/\.md$/, '')}\n## Welcome\nStart editing here!`;
        setDocContent(parseMarkdown(templateContent));
        setCurrentFile(file);
      }
      setSidebarOpen(false);
    } catch (e) {
      console.error("Error opening file", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFile = useCallback(async () => {
    if (!currentFile) return;
    setIsSaving(true);
    try {
      const markdownContent = serializeToMarkdown(docContent);
      if (user?.uid) {
        await firebaseService.updateDocument(currentFile.id, markdownContent);
      } else {
        await localService.updateDocument(currentFile.id, markdownContent);
        await localService.updateDocumentViewState(currentFile.id, {
          collapsedPaths: collectCollapsedPaths(docContent),
        });
      }
    } catch (e) {
      console.error("Error saving file", e);
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  }, [currentFile, docContent, user]);

  useEffect(() => {
    if (!currentFile || user?.uid) {
      return;
    }

    const timeoutId = setTimeout(() => {
      saveFile();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [currentFile, docContent, saveFile, user]);

  useEffect(() => {
    if (!currentFile || !user?.uid) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void saveFile();
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [currentFile, docContent, saveFile, user]);

  const deleteFile = async (file: AppFile) => {
    if (!window.confirm(`Are you sure you want to delete "${file.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      if (user?.uid) {
        await firebaseService.deleteDocument(file.id);
      } else {
        await localService.deleteDocument(file.id);
      }
      
      if (currentFile?.id === file.id) {
        setCurrentFile(null);
        setDocContent([]);
      }
      
      await listFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleRenameFile = async (newName: string) => {
    const targetFile = fileToRename || currentFile;
    if (!targetFile) {
      return;
    }

    try {
      if (user?.uid) {
        await firebaseService.renameDocument(targetFile.id, newName);
      } else {
        await localService.renameDocument(targetFile.id, newName);
      }

      setFiles(prev => prev.map(file => file.id === targetFile.id ? { ...file, name: newName } : file));
      if (currentFile?.id === targetFile.id) {
        setCurrentFile({ ...currentFile, name: newName });
      }
      setStatusMessage(null);
    } catch (error) {
      console.error('Error renaming file:', error);
      setStatusMessage({
        type: 'error',
        text: 'Unable to rename the document. Please try again.',
      });
    } finally {
      setIsRenameDialogOpen(false);
      setFileToRename(null);
      await listFiles();
    }
  };

  const onUpdateText = (id: string, text: string) => {
    const newDoc = cloneDocContent();
    findAndModifyNode(newDoc, id, (node) => {
      node.text = text;
    });
    setDocContent(newDoc);
  };

  const onAddItem = (parentId: string | null) => {
    const newNode: ListItemNode = { id: generateId(), text: '', isCollapsed: false, children: [] };
    const newDoc = cloneDocContent();

    if (parentId === null) {
      newDoc.push(newNode);
    } else {
      findAndModifyNode(newDoc, parentId, (node, parent, siblings, index) => {
        if (node.children.length === 0) {
          siblings.splice(index + 1, 0, newNode);
        } else {
          node.isCollapsed = false;
          node.children.unshift(newNode);
        }
      });
    }
    setDocContent(newDoc);
    setItemToFocusId(newNode.id);
    persistLocalViewState(newDoc);
  };

  const onDeleteItem = (id: string) => {
    const newDoc = cloneDocContent();
    findAndModifyNode(newDoc, id, (node, parent, siblings, index) => {
        siblings.splice(index, 1);
        node.children.reverse().forEach(child => {
            siblings.splice(index, 0, child);
        });
    });
    setDocContent(newDoc);
    persistLocalViewState(newDoc);
  };

  const onIndent = (id: string) => {
    const newDoc = cloneDocContent();
    findAndModifyNode(newDoc, id, (node, parent, siblings, index) => {
      if (index > 0) {
        const newParent = siblings[index - 1];
        const itemToMove = siblings.splice(index, 1)[0];
        newParent.isCollapsed = false;
        newParent.children.push(itemToMove);
      }
    });
    setDocContent(newDoc);
    setItemToFocusId(id);
    persistLocalViewState(newDoc);
  };

  const onOutdent = (id: string) => {
    const newDoc = cloneDocContent();
    findAndModifyNode(newDoc, id, (node, parent, siblings, index) => {
      if (parent) {
        findAndModifyNode(newDoc, parent.id, (greatGrandParent, grandParent, parentSiblings, parentIndex) => {
          const itemToMove = siblings.splice(index, 1)[0];
          parentSiblings.splice(parentIndex + 1, 0, itemToMove);
          // also move children of the moved item
          const childrenToMove = siblings.splice(index);
          itemToMove.children.push(...childrenToMove);
        });
      }
    });
    setDocContent(newDoc);
    setItemToFocusId(id);
    persistLocalViewState(newDoc);
  };

  const onToggleCollapse = (id: string) => {
    const newDoc = cloneDocContent();
    findAndModifyNode(newDoc, id, (node) => {
      node.isCollapsed = !node.isCollapsed;
    });
    setDocContent(newDoc);
    persistLocalViewState(newDoc);
  };

  const onFocusHandled = () => {
    setItemToFocusId(null);
  };

  const flattenedIds = useMemo(() => flattenNodesForNavigation(docContent), [docContent]);

  const onNavigateFocus = (currentId: string, direction: 'up' | 'down') => {
    const currentIndex = flattenedIds.indexOf(currentId);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex >= 0 && nextIndex < flattenedIds.length) {
      setItemToFocusId(flattenedIds[nextIndex]);
    }
  };

  if (configError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
        <div className="max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Configuration Error</h2>
          <p className="text-slate-600 dark:text-slate-300">{configError}</p>
          <p className="text-sm text-slate-500 mt-4">The application cannot connect to Firebase without valid credentials.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen font-sans bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <aside className={`absolute md:relative z-20 md:z-auto w-64 md:w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-full flex flex-col transition-transform transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Docs</h1>
          <button onClick={openNewFileDialog} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
            <FolderPlusIcon className="w-6 h-6"/>
          </button>
        </div>

        <nav className="flex-grow overflow-y-auto p-2">
          {isLoading && files.length === 0 ? <p className="p-2 text-slate-500">Loading...</p> 
          : files.length > 0 ? (
            <ul>
              {files.map(file => (
                <li key={file.id} className="group flex items-center pr-1">
                  <button onClick={() => openFile(file)} className={`flex-grow text-left px-3 py-2 rounded-md truncate ${currentFile?.id === file.id ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                    {file.name}
                  </button>
                  <button onClick={() => deleteFile(file)} title={`Delete ${file.name}`} className="flex-shrink-0 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    <XCircleIcon className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex-grow flex items-center justify-center p-4 text-center text-slate-500">
                <p className="text-sm">{isLoggedIn ? 'No documents found in the cloud.' : 'No local documents found.'}<br/>Create one to get started!</p>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          {user ? (
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                    <img src={user.picture} alt="User" className="w-8 h-8 rounded-full" />
                    <span className="text-sm font-medium truncate">{user.name}</span>
                </div>
                <button onClick={handleLogout} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Logout</button>
            </div>
          ) : (
            <button onClick={handleLogin} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors">
              Login with Google
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen">
        <header className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center p-3 md:p-4">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden mr-3 p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
            {currentFile ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setFileToRename(currentFile);
                    setIsRenameDialogOpen(true);
                  }}
                  className="text-lg font-semibold truncate hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                  title="Rename document"
                >
                  {currentFile.name}
                </button>
                <button
                  onClick={() => deleteFile(currentFile)}
                  className="p-1.5 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-400"
                  title="Delete document"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h2 className="text-lg font-semibold truncate">No file selected</h2>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={openImportMarkdownDialog}
              className="flex items-center space-x-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700/40 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              type="button"
              onClick={openExportMarkdownDialog}
              disabled={docContent.length === 0}
              className={`flex items-center space-x-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium transition-colors ${docContent.length === 0 ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-700/30 dark:text-slate-500' : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700/40 dark:text-slate-200 dark:hover:bg-slate-700'}`}
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {currentFile && (
              <button onClick={saveFile} disabled={isSaving} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed">
                <SaveIcon className="w-5 h-5"/>
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            )}
          </div>
        </header>

        {statusMessage && (
          <div
            className={`mx-3 md:mx-4 mt-3 rounded-md border px-4 py-3 text-sm font-medium ${
              statusMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-900/40 dark:text-red-200'
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
            }`}
            role={statusMessage.type === 'error' ? 'alert' : 'status'}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="flex-grow overflow-hidden bg-white dark:bg-slate-800/50">
          {currentFile ? (
            <Editor
              nodes={docContent}
              onUpdateText={onUpdateText} 
              onAddItem={onAddItem}
              onDeleteItem={onDeleteItem}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onNavigateFocus={onNavigateFocus}
              onToggleCollapse={onToggleCollapse}
              itemToFocusId={itemToFocusId}
              onFocusHandled={onFocusHandled}
            />
          ) : (
            <div className="flex flex-col h-full items-center justify-center text-slate-500 p-8 text-center">
              <h3 className="text-2xl font-semibold mb-2">Welcome!</h3>
              <p className="max-w-md mb-6">{isLoggedIn ? 'Select a document to start editing, or create a new one.' : 'You are working offline. Your documents are saved in this browser.'}</p>
              <button onClick={openNewFileDialog} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  <PlusIcon className="w-5 h-5"/>
                  <span>Create New Document</span>
              </button>
              {!isLoggedIn && (
                <p className="max-w-md mt-8 text-sm">
                  <button onClick={handleLogin} className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Log in</button>
                  {' '}to sync your documents to the cloud.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <MarkdownDialog
        isOpen={isImportDialogOpen}
        title="Import markdown"
        description="Paste markdown headings to replace the current document outline. Existing content will be overwritten when you import."
        confirmText="Import"
        initialValue={importMarkdownText}
        placeholder="# Heading"
        onClose={() => setIsImportDialogOpen(false)}
        onConfirm={handleImportMarkdown}
      />

      <MarkdownDialog
        isOpen={isExportDialogOpen}
        title="Export markdown"
        description="Copy the markdown representation of the current document."
        initialValue={exportMarkdownText}
        readOnly
        cancelText={null}
        onClose={() => setIsExportDialogOpen(false)}
        showCopyButton={docContent.length > 0}
        onCopySuccess={handleMarkdownCopySuccess}
      />

      <TextInputDialog
        isOpen={isNewFileDialogOpen}
        onClose={() => setIsNewFileDialogOpen(false)}
        onConfirm={handleCreateNewFile}
        title="Create New Document"
        confirmText="Create"
        initialValue="New Document.md"
        placeholder="Enter file name"
      />
      <TextInputDialog
        isOpen={isRenameDialogOpen}
        onClose={() => {
          setIsRenameDialogOpen(false);
          setFileToRename(null);
        }}
        onConfirm={handleRenameFile}
        title="Rename Document"
        confirmText="Rename"
        initialValue={fileToRename?.name || currentFile?.name || ''}
        placeholder="Enter new file name"
      />
    </div>
  );
}
```

index.html
```
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/icons/marktree-icon.svg" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#2563eb" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="apple-touch-icon" href="/icons/marktree-maskable.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hierarchical Markdown Editor</title>
  <script src="https://cdn.tailwindcss.com"></script>
<script type="importmap">
{
  "imports": {
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.1.1/",
    "react/": "https://aistudiocdn.com/react@^19.1.1/",
    "react": "https://aistudiocdn.com/react@^19.1.1",
    "firebase/app": "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
    "firebase/auth": "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js",
    "firebase/firestore": "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js",
    "firebase/": "https://aistudiocdn.com/firebase@^12.3.0/"
  }
}
</script>
</head>
<body class="bg-slate-100 dark:bg-slate-900">
  <div id="root"></div>
  <script type="module" src="/index.tsx"></script>
</body>
</html>
```

index.tsx
```

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
```

metadata.json
```
{
  "name": "Hierarchical Markdown Editor",
  "description": "An application to edit text documents as hierarchical, unnumbered lists. Documents are saved to Google Drive in a special markdown format where list levels are denoted by '#', '##', etc.",
  "requestFramePermissions": []
}
```

package.json
```
{
  "name": "hierarchical-markdown-editor",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "firebase": "^12.3.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0",
    "vitest": "^4.1.8"
  }
}
```

tsconfig.json
```
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "types": [
      "node"
    ],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

types.ts
```
export interface ListItemNode {
  id: string;
  text: string;
  isCollapsed: boolean;
  children: ListItemNode[];
}

export interface AppFile {
  id: string;
  name: string;
}

export interface DocumentViewState {
  collapsedPaths: number[][];
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  picture: string;
}
```

vite.config.ts
```
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const basePath = (() => {
      const raw = env.VITE_BASE_PATH ?? env.BASE_PATH;
      if (!raw) {
        return '/';
      }

      const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
      return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
    })();

    return {
      base: basePath,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        environment: 'node',
        include: ['services/**/*.test.ts'],
      },
    };
});
```

components/Editor.tsx
```

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
  onNavigateFocus: (id: string, direction: 'up' | 'down') => void;
  onToggleCollapse: (id: string) => void;
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
    onNavigateFocus,
    onToggleCollapse,
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
            onNavigateFocus={onNavigateFocus}
            onToggleCollapse={onToggleCollapse}
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
```

components/EditorItem.tsx
```

import React, { useRef, useEffect } from 'react';
import { ListItemNode } from '../types';
import { TrashIcon, ArrowRightIcon, ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon } from './icons';

interface EditorItemProps {
  node: ListItemNode;
  level: number;
  onUpdateText: (id: string, text: string) => void;
  onAddItem: (parentId: string | null) => void;
  onDeleteItem: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onNavigateFocus: (id: string, direction: 'up' | 'down') => void;
  onToggleCollapse: (id: string) => void;
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
  onToggleCollapse,
  isFirst,
  isLast,
  parentIsRoot,
  itemToFocusId,
  onFocusHandled,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children.length > 0;

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
        {hasChildren ? (
          <button
            onClick={() => onToggleCollapse(node.id)}
            title={node.isCollapsed ? 'Expand children' : 'Collapse children'}
            className="flex-shrink-0 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
            aria-label={node.isCollapsed ? 'Expand children' : 'Collapse children'}
          >
            {node.isCollapsed ? (
              <ChevronRightIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-6" />
        )}
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
      {hasChildren && !node.isCollapsed && (
        <div style={{ paddingLeft: `1.5rem` }} className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700 ml-3"></div>
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
              onToggleCollapse={onToggleCollapse}
              isFirst={index === 0}
              isLast={index === node.children.length - 1}
              parentIsRoot={false}
              itemToFocusId={itemToFocusId}
              onFocusHandled={onFocusHandled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EditorItem;
```

components/MarkdownDialog.tsx
```
import React, { useEffect, useRef, useState } from 'react';

interface MarkdownDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string | null;
  initialValue?: string;
  placeholder?: string;
  readOnly?: boolean;
  onClose: () => void;
  onConfirm?: (value: string) => boolean | void;
  showCopyButton?: boolean;
  onCopySuccess?: () => void;
}

const MarkdownDialog: React.FC<MarkdownDialogProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  initialValue = '',
  placeholder = '',
  readOnly = false,
  onClose,
  onConfirm,
  showCopyButton = false,
  onCopySuccess,
}) => {
  const [value, setValue] = useState(initialValue);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setCopyStatus(null);
      setTimeout(() => {
        if (!readOnly) {
          textareaRef.current?.focus();
        } else {
          textareaRef.current?.select();
        }
      }, 50);
    }
  }, [initialValue, isOpen, readOnly]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (!onConfirm) {
      onClose();
      return;
    }

    const result = onConfirm(value);
    if (result !== false) {
      onClose();
    }
  };

  const handleCopy = async () => {
    if (typeof navigator === 'undefined') {
      setCopyStatus('Clipboard API is unavailable.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus('Copied to clipboard.');
      onCopySuccess?.();
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (error) {
      console.error('Failed to copy markdown', error);
      setCopyStatus('Failed to copy. Try copying manually.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="markdown-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <h2 id="markdown-dialog-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className="h-64 w-full resize-none rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showCopyButton && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Copy to clipboard
              </button>
              {copyStatus && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{copyStatus}</span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            {cancelText !== null && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {cancelText}
              </button>
            )}
            {onConfirm ? (
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {confirmText}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownDialog;
```

components/TextInputDialog.tsx
```
import React, { useState, useEffect, useRef } from 'react';

interface TextInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (inputValue: string) => void;
  title: string;
  confirmText?: string;
  initialValue?: string;
  placeholder?: string;
}

const TextInputDialog: React.FC<TextInputDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmText = 'Confirm',
  initialValue = '',
  placeholder = '',
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue || 'New Document.md');
      // Auto-focus the input when the dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <h2 id="dialog-title" className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">{title}</h2>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="File name"
        />
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextInputDialog;
```

components/icons.tsx
```

import React from 'react';

export const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

export const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

export const ArrowRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </svg>
);


export const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
  </svg>
);

export const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
  </svg>
);

export const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);

export const SaveIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338A2.25 2.25 0 0 0 17.088 3.75H15M12 3.75v12.75m0 0-3-3m3 3 3-3M3.75 6.75h16.5" />
  </svg>
);

export const FolderPlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
);

export const XCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

export const ArrowDownTrayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 10.5 12 15m0 0 4.5-4.5M12 15V3" />
  </svg>
);

export const ArrowUpTrayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V6A2.25 2.25 0 0 1 5.25 3.75h13.5A2.25 2.25 0 0 1 21 6v2.25M7.5 13.5 12 9m0 0 4.5 4.5M12 9v11.25" />
  </svg>
);
```

public/manifest.webmanifest
```
{
  "name": "Marktree Editor",
  "short_name": "Marktree",
  "description": "Create and manage hierarchical markdown documents, online and offline.",
  "start_url": ".",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/icons/marktree-icon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    },
    {
      "src": "/icons/marktree-maskable.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "maskable"
    }
  ]
}
```

public/sw.js
```
const CACHE_NAME = 'marktree-editor-cache-v1';
const PRE_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/marktree-icon.svg',
  '/icons/marktree-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRE_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestURL = new URL(request.url);

  if (requestURL.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(request);

        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.type === 'opaque')
        ) {
          cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (request.mode === 'navigate') {
          const fallback = await cache.match('/index.html');
          if (fallback) {
            return fallback;
          }
        }

        throw error;
      }
    })
  );
});
```

services/firebase.ts
```

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { AppFile } from '../types';
import { firebaseConfig } from './firebaseConfig';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  return signInWithPopup(auth, provider);
};

export const signOutUser = () => {
  return signOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

const documentsCollection = collection(db, 'documents');

export const getDocumentsForUser = async (userId: string): Promise<AppFile[]> => {
  const q = query(documentsCollection, where('ownerId', '==', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
  }));
};

export const getDocumentContent = async (docId: string): Promise<string | null> => {
    const docRef = doc(db, 'documents', docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data().content;
    } else {
        return null;
    }
};

export const createDocument = async (userId: string, fileName: string, content: string): Promise<string> => {
    const docRef = await addDoc(documentsCollection, {
        name: fileName,
        content: content,
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

export const updateDocument = (docId: string, content: string) => {
    const docRef = doc(db, 'documents', docId);
    return updateDoc(docRef, {
        content: content,
        updatedAt: serverTimestamp()
    });
};

export const deleteDocument = (docId: string) => {
    const docRef = doc(db, 'documents', docId);
    return deleteDoc(docRef);
};

export const renameDocument = (docId: string, name: string) => {
    const docRef = doc(db, 'documents', docId);
    return updateDoc(docRef, {
        name,
        updatedAt: serverTimestamp(),
    });
};
```

services/firebaseConfig.ts
```
// IMPORTANT: Replace these placeholder values with your actual Firebase project configuration.
// For security reasons, this file should NOT be committed to version control. 
// Add it to your .gitignore file.

export const firebaseConfig = {
    apiKey: "AIzaSyAxKc13OxOGFvLBNRi3Pjz6UQXq_QF9Veg",
    authDomain: "marktreeeditor.firebaseapp.com",
    projectId: "marktreeeditor",
    storageBucket: "marktreeeditor.firebasestorage.app",
    messagingSenderId: "299399315065",
    appId: "1:299399315065:web:0367407b349a2b408d1ea8",
    measurementId: "G-NEDT8798X9"
  };
```

services/localStorage.ts
```

import { AppFile, DocumentViewState } from '../types';

const FILE_INDEX_KEY = 'marktree_local_files_index';
const FILE_CONTENT_PREFIX = 'marktree_local_file_';
const FILE_VIEWSTATE_PREFIX = 'marktree_local_viewstate_';

const generateId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper to read the file index
const getFileIndex = (): AppFile[] => {
  try {
    const indexJson = localStorage.getItem(FILE_INDEX_KEY);
    return indexJson ? JSON.parse(indexJson) : [];
  } catch (e) {
    console.error("Failed to parse local file index:", e);
    return [];
  }
};

// Helper to write the file index
const setFileIndex = (index: AppFile[]) => {
  localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(index));
};

// --- Exported Functions ---

export const getDocuments = async (): Promise<AppFile[]> => {
  return Promise.resolve(getFileIndex());
};

export const getDocumentContent = async (docId: string): Promise<string | null> => {
  return Promise.resolve(localStorage.getItem(`${FILE_CONTENT_PREFIX}${docId}`));
};

export const createDocument = async (fileName: string, content: string): Promise<string> => {
  const index = getFileIndex();
  const newFile: AppFile = {
    id: generateId(),
    name: fileName,
  };
  
  index.unshift(newFile); // Add to the top of the list
  setFileIndex(index);
  
  localStorage.setItem(`${FILE_CONTENT_PREFIX}${newFile.id}`, content);
  
  return Promise.resolve(newFile.id);
};

export const updateDocument = async (docId: string, content: string): Promise<void> => {
  localStorage.setItem(`${FILE_CONTENT_PREFIX}${docId}`, content);
  return Promise.resolve();
};

export const deleteDocument = async (docId: string): Promise<void> => {
  let index = getFileIndex();
  index = index.filter(file => file.id !== docId);
  setFileIndex(index);
  localStorage.removeItem(`${FILE_CONTENT_PREFIX}${docId}`);
  localStorage.removeItem(`${FILE_VIEWSTATE_PREFIX}${docId}`);
  return Promise.resolve();
};

export const getDocumentViewState = async (docId: string): Promise<DocumentViewState | null> => {
  const stored = localStorage.getItem(`${FILE_VIEWSTATE_PREFIX}${docId}`);
  if (!stored) {
    return Promise.resolve(null);
  }

  try {
    return Promise.resolve(JSON.parse(stored));
  } catch (error) {
    console.error('Failed to parse document view state', error);
    return Promise.resolve(null);
  }
};

export const updateDocumentViewState = async (docId: string, state: DocumentViewState): Promise<void> => {
  localStorage.setItem(`${FILE_VIEWSTATE_PREFIX}${docId}`, JSON.stringify(state));
  return Promise.resolve();
};

export const renameDocument = async (docId: string, name: string): Promise<void> => {
  const index = getFileIndex().map(file =>
    file.id === docId ? { ...file, name } : file
  );
  setFileIndex(index);
  return Promise.resolve();
};
```

services/markdownParser.test.ts
```
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
```

services/markdownParser.ts
```

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
```

.github/workflows/deploy.yml
```
name: Deploy to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm install

      - name: Build site
        run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

</source_code>