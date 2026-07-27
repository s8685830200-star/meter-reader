import localforage from 'localforage'
import type { Meter, MeterRecord } from '@/types'

const meterStore = localforage.createInstance({
  name: 'meter-reader',
  storeName: 'meters',
})

const recordStore = localforage.createInstance({
  name: 'meter-reader',
  storeName: 'records',
})

let metersCache: Meter[] | null = null
let recordsCache: MeterRecord[] | null = null

function invalidateMetersCache() { metersCache = null }
function invalidateRecordsCache() { recordsCache = null }

/** 导入全量电表数据（先清空再写入） */
export async function importMeters(meters: Meter[]): Promise<number> {
  const keys = await meterStore.keys()
  await Promise.all(keys.map((k) => meterStore.removeItem(k)))
  await Promise.all(meters.map((m) => meterStore.setItem(m.meterNo, m)))
  invalidateMetersCache()
  return meters.length
}

/** 通过电表编号精确查询 */
export async function getMeter(meterNo: string): Promise<Meter | null> {
  return meterStore.getItem<Meter>(meterNo)
}

/** 模糊搜索电表编号（子串匹配） */
export async function searchMeters(query: string): Promise<Meter[]> {
  if (!query.trim()) return []
  const all = await getAllMeters()
  const q = query.trim().toLowerCase()
  return all.filter((m) => m.meterNo.toLowerCase().includes(q))
}

/** 获取所有电表 */
export async function getAllMeters(): Promise<Meter[]> {
  if (metersCache) return metersCache
  const meters: Meter[] = []
  await meterStore.iterate<Meter, void>((value) => { meters.push(value) })
  metersCache = meters
  return meters
}

export async function getMeterCount(): Promise<number> {
  const all = await getAllMeters()
  return all.length
}

/** 保存一条抄表记录 */
export async function saveRecord(record: MeterRecord): Promise<void> {
  await recordStore.setItem(String(record.id), record)
  invalidateRecordsCache()
}

/** 获取所有抄表记录（按时间降序） */
export async function getAllRecords(): Promise<MeterRecord[]> {
  if (recordsCache) return recordsCache
  const records: MeterRecord[] = []
  await recordStore.iterate<MeterRecord, void>((value) => { records.push(value) })
  records.sort((a, b) => b.id - a.id)
  recordsCache = records
  return records
}

export async function deleteRecord(id: number): Promise<void> {
  await recordStore.removeItem(String(id))
  invalidateRecordsCache()
}

export async function clearRecords(): Promise<void> {
  const keys = await recordStore.keys()
  await Promise.all(keys.map((k) => recordStore.removeItem(k)))
  invalidateRecordsCache()
}

export async function getRecordCount(): Promise<number> {
  const all = await getAllRecords()
  return all.length
}
