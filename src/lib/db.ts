import { openDB, DBSchema } from 'idb';
import { HosoRecord } from './xml';

interface ExtendedHosoRecord extends HosoRecord {
    sourceFile: string;
}

interface XmlReaderDB extends DBSchema {
    records: {
        key: string;
        value: ExtendedHosoRecord;
    };
}

const DB_NAME = 'xml-reader-db';
const STORE_NAME = 'records';

export async function initDB() {
    return openDB<XmlReaderDB>(DB_NAME, 3, {
        upgrade(db, oldVersion, newVersion, transaction) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
            }
        },
    });
}

export async function saveRecordsToDB(records: ExtendedHosoRecord[]) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear existing before adding new (or merge? requests says F5 shouldn't lose data. usually implies session persistence. 
    // If they upload new files, it usually appends in current UI. 
    // Let's implement 'put' to update or add. 
    // However, if we want to sync state exactly, we might want to clear and set. 
    // But clearing might be slow if we just added one file. 
    // For now, let's just clear and bulk add to ensure exact state match with React state, 
    // or optimized approach: 
    // Actually, saving the whole state `records` is safest to ensure what user sees is what is stored.
    // If simple "upload" adds to state, we should probably just save the new ones? 
    // But the `records` state in `XmlReader` is the source of truth. 
    // Let's try to clear and put all for simplicity/correctness first, optimization later if needed.

    await store.clear();
    for (const record of records) {
        await store.put(record);
    }
    await tx.done;
}

export async function addRecordsToDB(records: ExtendedHosoRecord[]) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Efficiently add multiple records in one transaction
    await Promise.all(records.map(record => store.put(record)));

    await tx.done;
}

export async function loadRecordsFromDB(): Promise<ExtendedHosoRecord[]> {
    const db = await initDB();
    return db.getAll(STORE_NAME);
}

export async function clearDB() {
    const db = await initDB();
    await db.clear(STORE_NAME);
}
