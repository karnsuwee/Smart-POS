export function normalizeDoc(doc) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    ...obj,
    id: String(obj._id || obj.id),
    _id: undefined,
    ownerId: String(obj.ownerId)
  };
}
