
import { Project } from '../types';
import { initialProjects } from './mockData';

const DB_NAME = 'FictosphereSystemDB';
const DB_VERSION = 2; // Incremented version to force upgrade/reset if needed

const STORES = {
  PROJECTS: 'projects',
  SETTINGS: 'settings'
};

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
        console.error("IDB Open Error:", request.error);
        reject(request.error);
    };
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      
      // Clear old stores if they exist from version 1
      if (db.objectStoreNames.contains('world')) db.deleteObjectStore('world');
      if (db.objectStoreNames.contains('events')) db.deleteObjectStore('events');
      
      if (!db.objectStoreNames.contains(STORES.PROJECTS)) db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
  });
};

export const loadAllData = async () => {
  const db = await initDB();
  return new Promise<{ projects: Project[], currentProjectId: string } | null>((resolve, reject) => {
    const tx = db.transaction([STORES.PROJECTS, STORES.SETTINGS], 'readonly');
    const pReq = tx.objectStore(STORES.PROJECTS).getAll();
    const sReq = tx.objectStore(STORES.SETTINGS).get('currentProjectId');

    tx.oncomplete = () => {
      if (!pReq.result || pReq.result.length === 0) {
        resolve(null);
      } else {
        // Ensure projects have world/events/keywords/relationDefinitions structure (migration fallback)
        const validProjects = pReq.result.map((p: any) => ({
             ...p,
             world: p.world || { id: 'default', name: 'Default World', nodes: [], edges: [] },
             events: p.events || [],
             keywords: p.keywords || [],
             relationDefinitions: p.relationDefinitions || [],
             annotations: p.annotations || {} // Added migration
        }));

        resolve({
          projects: validProjects,
          currentProjectId: sReq.result?.value || validProjects[0].id
        });
      }
    };
    tx.onerror = () => reject(tx.error);
  });
};

export const seedDB = async () => {
  const db = await initDB();
  const tx = db.transaction([STORES.PROJECTS, STORES.SETTINGS], 'readwrite');
  
  // Clean existing just in case
  tx.objectStore(STORES.PROJECTS).clear();
  
  initialProjects.forEach(p => tx.objectStore(STORES.PROJECTS).put(p));
  tx.objectStore(STORES.SETTINGS).put({ key: 'currentProjectId', value: initialProjects[0].id });

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const dbSaveProject = async (project: Project) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, 'readwrite');
    tx.objectStore(STORES.PROJECTS).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const dbDeleteProject = async (id: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, 'readwrite');
    const store = tx.objectStore(STORES.PROJECTS);
    const request = store.delete(id);
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
        console.error("IDB Transaction Error during delete:", tx.error);
        reject(tx.error);
    };
    request.onerror = () => {
        console.error("IDB Request Error during delete:", request.error);
        reject(request.error);
    };
  });
};

export const dbSaveSettings = async (currentProjectId: string) => {
  const db = await initDB();
  db.transaction(STORES.SETTINGS, 'readwrite').objectStore(STORES.SETTINGS).put({ key: 'currentProjectId', value: currentProjectId });
};
