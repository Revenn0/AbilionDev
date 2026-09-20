export type KvLike = {
  get(key: string, type: "json"): Promise<unknown>
  put(key: string, value: string): Promise<void>
  delete?(key: string): Promise<void>
}

export function memoryKv(initial: Record<string, unknown> = {}): KvLike {
  const data = { ...initial }
  return {
    async get(key) {
      return key in data ? data[key] : null
    },
    async put(key, value) {
      data[key] = JSON.parse(value) as unknown
    },
    async delete(key) {
      delete data[key]
    },
  }
}
