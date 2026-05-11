export const memory = {
  users: [],
  menuItems: [],
  tables: [],
  orders: []
};

export function updateMemory(collection, id, ownerId, updates) {
  const item = collection.find(entry => entry.id === id && entry.ownerId === ownerId);
  if (item) Object.assign(item, updates);
  return item;
}

export function deleteMemory(collection, id, ownerId) {
  const index = collection.findIndex(entry => entry.id === id && entry.ownerId === ownerId);
  if (index === -1) return null;
  return collection.splice(index, 1)[0];
}
