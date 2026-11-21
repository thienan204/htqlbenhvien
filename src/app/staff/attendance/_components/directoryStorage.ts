/**
 * HELPER QUẢN LÝ THƯ MỤC LƯU TRỮ TRÊN MÁY TÍNH
 * Sử dụng File System Access API (window.showDirectoryPicker) + IndexedDB
 * Tương thích Google Chrome, Microsoft Edge, Cốc Cốc trên Windows
 */

const DB_NAME = 'bvdk_attendance_fs_db';
const STORE_NAME = 'directory_handles';

function openFSDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB không được hỗ trợ trên trình duyệt này'));
            return;
        }
        const request = window.indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Kiểm tra trình duyệt có hỗ trợ File System Access API không
 */
export function isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Lưu DirectoryHandle vào IndexedDB
 */
export async function saveDirectoryHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await openFSDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

/**
 * Lấy DirectoryHandle đã lưu từ IndexedDB
 */
export async function getDirectoryHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
    try {
        const db = await openFSDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

/**
 * Xóa DirectoryHandle đã lưu
 */
export async function clearDirectoryHandle(key: string): Promise<void> {
    try {
        const db = await openFSDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch {
        // ignore
    }
}

/**
 * Xác thực quyền ghi vào thư mục (trình duyệt có thể hỏi lại sau khi restart trình duyệt)
 */
export async function verifyDirectoryPermission(
    handle: FileSystemDirectoryHandle,
    readWrite: boolean = true
): Promise<boolean> {
    const options: any = { mode: readWrite ? 'readwrite' : 'read' };
    if ((await (handle as any).queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await (handle as any).requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
}

/**
 * Mở hộp thoại chọn thư mục trên máy tính và lưu lại vào IndexedDB
 */
export async function pickAndSaveDirectory(key: string): Promise<{ handle: FileSystemDirectoryHandle; name: string }> {
    if (!isFileSystemAccessSupported()) {
        throw new Error('Trình duyệt không hỗ trợ chọn thư mục trực tiếp. Hệ thống sẽ chuyển sang tải file ZIP về máy tính.');
    }
    const handle = await (window as any).showDirectoryPicker({
        id: 'bvdk_attendance_export_dir',
        mode: 'readwrite',
        startIn: 'documents'
    });
    await saveDirectoryHandle(key, handle);
    return { handle, name: handle.name };
}

/**
 * Ghi trực tiếp các file Excel vào thư mục máy tính
 */
export async function writeFilesToDirectory(
    handle: FileSystemDirectoryHandle,
    files: Array<{ fileName: string; base64: string }>
): Promise<string[]> {
    const hasPermission = await verifyDirectoryPermission(handle, true);
    if (!hasPermission) {
        throw new Error('Chưa được cấp quyền ghi vào thư mục này.');
    }

    const savedFiles: string[] = [];

    for (const f of files) {
        const fileHandle = await (handle as any).getFileHandle(f.fileName, { create: true });
        const writable = await fileHandle.createWritable();

        const binaryStr = atob(f.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        await writable.write(bytes);
        await writable.close();
        savedFiles.push(f.fileName);
    }

    return savedFiles;
}

/**
 * Tải file (ZIP hoặc Excel) theo cách truyền thống
 */
export function downloadBase64File(base64: string, fileName: string, mimeType = 'application/octet-stream') {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);
}

