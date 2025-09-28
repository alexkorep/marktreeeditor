
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ListItemNode, AppFile, UserProfile } from './types';
import Editor from './components/Editor';
import { parseMarkdown, serializeToMarkdown } from './services/markdownParser';
import { FolderPlusIcon, SaveIcon, PlusIcon, XCircleIcon } from './components/icons';
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
    if (node.children.length > 0) {
      ids = ids.concat(flattenNodesForNavigation(node.children));
    }
  }
  return ids;
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

  const isLoggedIn = useMemo(() => !!user, [user]);

  const listFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      let userFiles: AppFile[] = [];
      if (user?.uid) {
        userFiles = await firebaseService.getDocumentsForUser(user.uid);
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
  }, [user]);

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
        setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Anonymous',
          email: firebaseUser.email || '',
          picture: firebaseUser.photoURL || '',
        });
      } else {
        setUser(null);
      }
      // listFiles will be called by the useEffect below
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    listFiles();
  }, [listFiles]);
  
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
      if (user?.uid) {
        content = await firebaseService.getDocumentContent(file.id);
      } else {
        content = await localService.getDocumentContent(file.id);
      }
      
      if (content !== null) {
        setDocContent(parseMarkdown(content));
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
      }
    } catch (e) {
      console.error("Error saving file", e);
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  }, [currentFile, docContent, user]);

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

  const onUpdateText = (id: string, text: string) => {
    const newDoc = JSON.parse(JSON.stringify(docContent));
    findAndModifyNode(newDoc, id, (node) => {
      node.text = text;
    });
    setDocContent(newDoc);
  };
  
  const onAddItem = (parentId: string | null) => {
    const newNode: ListItemNode = { id: generateId(), text: '', children: [] };
    const newDoc = JSON.parse(JSON.stringify(docContent));

    if (parentId === null) {
      newDoc.push(newNode);
    } else {
      findAndModifyNode(newDoc, parentId, (node, parent, siblings, index) => {
        if (node.children.length === 0) {
          siblings.splice(index + 1, 0, newNode);
        } else {
          node.children.unshift(newNode);
        }
      });
    }
    setDocContent(newDoc);
    setItemToFocusId(newNode.id);
  };

  const onDeleteItem = (id: string) => {
    const newDoc = JSON.parse(JSON.stringify(docContent));
    findAndModifyNode(newDoc, id, (node, parent, siblings, index) => {
        siblings.splice(index, 1);
        node.children.reverse().forEach(child => {
            siblings.splice(index, 0, child);
        });
    });
    setDocContent(newDoc);
  };
  
  const onIndent = (id: string) => {
    const newDoc = JSON.parse(JSON.stringify(docContent));
    findAndModifyNode(newDoc, id, (node, parent, siblings, index) => {
      if (index > 0) {
        const newParent = siblings[index - 1];
        const itemToMove = siblings.splice(index, 1)[0];
        newParent.children.push(itemToMove);
      }
    });
    setDocContent(newDoc);
    setItemToFocusId(id);
  };
  
  const onOutdent = (id: string) => {
    const newDoc = JSON.parse(JSON.stringify(docContent));
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
            <h2 className="text-lg font-semibold truncate">{currentFile?.name || 'No file selected'}</h2>
          </div>
          {currentFile && (
            <button onClick={saveFile} disabled={isSaving} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed">
              <SaveIcon className="w-5 h-5"/>
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          )}
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

      <TextInputDialog
        isOpen={isNewFileDialogOpen}
        onClose={() => setIsNewFileDialogOpen(false)}
        onConfirm={handleCreateNewFile}
        title="Create New Document"
        confirmText="Create"
        initialValue="New Document.md"
        placeholder="Enter file name"
      />
    </div>
  );
}
