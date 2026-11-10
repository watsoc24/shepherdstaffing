/** Copy only allow-listed keys. Never spread request bodies into the database. */
export function pick<T extends Record<string, unknown>, K extends readonly (keyof T)[]>(obj: T, keys: K): Pick<T, K[number]> {
  const out = {} as Pick<T, K[number]>;
  for (const k of keys) if (obj[k] !== undefined) (out as Record<keyof T, unknown>)[k] = obj[k];
  return out;
}
