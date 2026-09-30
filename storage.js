/* IndexedDB has room for embedded scene images; legacy text projects still load. */
const QuestStorage = (() => {
  let database;
  function open() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('macroquest', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('projects');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Хранилище занято другой вкладкой'));
    });
    return database;
  }
  async function read(key = 'current') {
    if(globalThis.__TAURI__){const raw=await __TAURI__.core.invoke('read_record',{key});return raw===null?undefined:JSON.parse(raw);}
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function write(project, key = 'current') {
    return writeMany([[key,project]]);
  }
  async function writeMany(entries) {
    if(globalThis.__TAURI__)return __TAURI__.core.invoke('write_records',{entries:entries.map(([k,v])=>[k,JSON.stringify(v)])});
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      for(const [key,value] of entries)tx.objectStore('projects').put(value,key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Сохранение прервано'));
    });
  }
  async function download(name,content,type='application/json') {
    if(globalThis.__TAURI__)return __TAURI__.core.invoke('export_file',{name,content});
    const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return true;
  }
  return {read, write, writeMany, download};
})();
