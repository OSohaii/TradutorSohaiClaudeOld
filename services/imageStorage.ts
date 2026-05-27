// IndexedDB storage para imagens grandes da biblioteca
const DB_NAME = 'mangalens_library_db';
const DB_VERSION = 2;
const STORE_NAME = 'images';
const FONTS_STORE_NAME = 'fonts';

let db: IDBDatabase | null = null;

// Inicializar o banco de dados
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Erro ao abrir IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // Criar store para imagens se não existir
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }

      // Criar store para fonts (upgrade v1 -> v2)
      if (!database.objectStoreNames.contains(FONTS_STORE_NAME)) {
        database.createObjectStore(FONTS_STORE_NAME, { keyPath: 'name' });
      }
    };
  });
};

// Salvar imagem no IndexedDB
export const saveImage = async (id: string, imageUrl: string, maskDataUrl?: string, translatedImageUrl?: string): Promise<void> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put({
      id,
      imageUrl,
      maskDataUrl: maskDataUrl || null,
      translatedImageUrl: translatedImageUrl || null,
      savedAt: Date.now()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Erro ao salvar imagem:', request.error);
      reject(request.error);
    };
  });
};

// Carregar imagem do IndexedDB
export const loadImage = async (id: string): Promise<{imageUrl: string, maskDataUrl?: string, translatedImageUrl?: string} | null> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        resolve({
          imageUrl: request.result.imageUrl,
          maskDataUrl: request.result.maskDataUrl || undefined,
          translatedImageUrl: request.result.translatedImageUrl || undefined
        });
      } else {
        resolve(null);
      }
    };
    
    request.onerror = () => {
      console.error('Erro ao carregar imagem:', request.error);
      reject(request.error);
    };
  });
};

// Deletar imagem do IndexedDB
export const deleteImage = async (id: string): Promise<void> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Erro ao deletar imagem:', request.error);
      reject(request.error);
    };
  });
};

// Deletar múltiplas imagens
export const deleteImages = async (ids: string[]): Promise<void> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    let completed = 0;
    let hasError = false;

    ids.forEach(id => {
      const request = store.delete(id);
      
      request.onsuccess = () => {
        completed++;
        if (completed === ids.length && !hasError) {
          resolve();
        }
      };
      
      request.onerror = () => {
        if (!hasError) {
          hasError = true;
          reject(request.error);
        }
      };
    });

    if (ids.length === 0) {
      resolve();
    }
  });
};

// Verificar se imagem existe
export const imageExists = async (id: string): Promise<boolean> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.count(IDBKeyRange.only(id));

    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => {
      console.error('Erro ao verificar imagem:', request.error);
      reject(request.error);
    };
  });
};

// Limpar todas as imagens
export const clearAllImages = async (): Promise<void> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Erro ao limpar imagens:', request.error);
      reject(request.error);
    };
  });
};

// Obter tamanho aproximado do storage
export const getStorageSize = async (): Promise<number> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.getAll();
    
    request.onsuccess = () => {
      let totalSize = 0;
      request.result.forEach(item => {
        totalSize += (item.imageUrl?.length || 0);
        totalSize += (item.maskDataUrl?.length || 0);
        totalSize += (item.translatedImageUrl?.length || 0);
      });
      // Aproximação: cada caractere = ~2 bytes
      resolve(totalSize * 2);
    };
    
    request.onerror = () => reject(request.error);
  });
};

// ---------------------------------------------------------------------------
// Font storage (IndexedDB)
// ---------------------------------------------------------------------------

export const saveFontToIDB = async (font: { name: string; value: string; data: string }): Promise<void> => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FONTS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FONTS_STORE_NAME);

    const request = store.put(font);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Erro ao salvar fonte:', request.error);
      reject(request.error);
    };
  });
};

export const loadAllFontsFromIDB = async (): Promise<Array<{ name: string; value: string; data: string }>> => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FONTS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(FONTS_STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => {
      console.error('Erro ao carregar fontes:', request.error);
      reject(request.error);
    };
  });
};

export const deleteFontFromIDB = async (name: string): Promise<void> => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FONTS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FONTS_STORE_NAME);

    const request = store.delete(name);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Erro ao deletar fonte:', request.error);
      reject(request.error);
    };
  });
};

export const clearAllFontsFromIDB = async (): Promise<void> => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FONTS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FONTS_STORE_NAME);

    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Erro ao limpar fontes:', request.error);
      reject(request.error);
    };
  });
};
