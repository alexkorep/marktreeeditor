
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
