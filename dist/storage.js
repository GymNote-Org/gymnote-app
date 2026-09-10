import { validateDays } from './model.js';
let connection;
export async function openDatabase() {
  connection = await new Promise((resolve, reject) => {
    const request = indexedDB.open('gymnote', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('days', { keyPath: 'date' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('다른 GYMNOTE 창을 닫고 다시 시도해 주세요.'));
  });
  connection.onversionchange = () => connection.close();
  return loadDays();
}
export function loadDays() {
  return new Promise((resolve, reject) => {
    const tx = connection.transaction('days', 'readonly');
    const request = tx.objectStore('days').getAll();
    tx.oncomplete = () => { try { resolve(validateDays(request.result)); } catch(e) { reject(e); } };
    tx.onabort = () => reject(tx.error);
  });
}
export function saveDays(days) {
  return new Promise((resolve, reject) => {
    const tx = connection.transaction('days', 'readwrite');
    const store = tx.objectStore('days');
    for (const day of days) store.put(day);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('기기에 저장하지 못했어요.'));
  });
}
