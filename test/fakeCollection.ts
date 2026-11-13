import type { CollectionReference } from "@google-cloud/firestore";

export interface FakeCollection {
  ref: CollectionReference;
  writes: string[];
}

/**
 * Minimal in-memory stand-in for a Firestore CollectionReference that records
 * every write-ish call, so tests can assert the guard stopped them.
 */
export const fakeCollection = (id: string, docs: Array<Record<string, unknown>> = []): FakeCollection => {
  const writes: string[] = [];
  const snapshot = (items: Array<Record<string, unknown>>) => ({
    empty: items.length === 0,
    size: items.length,
    forEach: (fn: (doc: unknown) => void) =>
      items.forEach((data, i) =>
        fn({
          id: `${id}-${i}`,
          data: () => data,
          ref: { update: async () => void writes.push("update") },
        }),
      ),
  });
  const ref = {
    id,
    get: async () => snapshot(docs),
    add: async (data: Record<string, unknown>) => {
      writes.push("add");
      docs.push(data);
    },
    where: (field: string, _op: string, value: unknown) => ({
      get: async () => snapshot(docs.filter((d) => d[field] === value)),
    }),
    doc: () => ({ delete: async () => void writes.push("delete") }),
  };
  return { ref: ref as unknown as CollectionReference, writes };
};
