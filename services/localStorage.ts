
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
