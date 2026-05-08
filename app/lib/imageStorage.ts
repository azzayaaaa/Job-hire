export async function compressImageFile(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
) {
  const dataUrl = await readFileAsDataUrl(file);
  return compressImageDataUrl(dataUrl, options);
}

export async function compressImageDataUrl(
  dataUrl: string,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
) {
  const { maxWidth = 900, maxHeight = 900, quality = 0.78 } = options;
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function safeSetLocalStorage(key: string, value: string): Promise<boolean> {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      localStorage.removeItem(key);
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        // Fallback to IndexedDB
        try {
          await saveToIndexedDB(key, value);
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }
}

function saveToIndexedDB(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("userProfiles", 2);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles");
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("profiles", "readwrite");
      const store = transaction.objectStore("profiles");
      store.put(value, key);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

export function loadFromIndexedDB(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open("userProfiles", 2);
    
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("profiles")) {
        resolve(null);
        return;
      }
      
      const transaction = db.transaction("profiles", "readonly");
      const store = transaction.objectStore("profiles");
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };
    
    request.onerror = () => resolve(null);
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
