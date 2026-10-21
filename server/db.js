import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { seedData } from './seed.js';

// A small JSON-file store. Everything lives in memory and every change is
// written to disk atomically (write temp file, then rename). This is plenty
// for a small shop; swapping it for Postgres/SQLite later only means
// re-implementing this file.
export function createDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'db.json');

  let data;
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    data = seedData();
  }
  data.settings = { ...seedData().settings, ...data.settings };
  for (const key of ['products', 'orders', 'requests']) data[key] ??= [];

  let writing = Promise.resolve();
  const persist = () => {
    const snapshot = JSON.stringify(data, null, 2);
    writing = writing.then(async () => {
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, snapshot);
      await fs.promises.rename(tmp, file);
    }).catch((err) => console.error('Could not save data to disk', err));
    return writing;
  };
  persist();

  const collection = (name) => ({
    all: () => data[name],
    get: (id) => data[name].find((row) => row.id === id),
    find: (pred) => data[name].find(pred),
    insert(row) {
      const now = new Date().toISOString();
      const record = { id: randomUUID(), createdAt: now, updatedAt: now, ...row };
      data[name].unshift(record);
      persist();
      return record;
    },
    update(id, patch) {
      const row = data[name].find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: new Date().toISOString() });
      persist();
      return row;
    },
    remove(id) {
      const index = data[name].findIndex((r) => r.id === id);
      if (index === -1) return false;
      data[name].splice(index, 1);
      persist();
      return true;
    },
  });

  return {
    products: collection('products'),
    orders: collection('orders'),
    requests: collection('requests'),
    getSettings: () => data.settings,
    updateSettings(patch) {
      Object.assign(data.settings, patch);
      persist();
      return data.settings;
    },
    flush: () => writing,
  };
}
