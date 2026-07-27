import * as XLSX from 'xlsx'
import type { Meter, MeterRecord } from '@/types'
import { EXCEL_COLUMN_MAP, EXPECTED_COLUMNS } from '@/types'

export interface ImportResult {
  total: number
  success: number
  failed: number
  errors: string[]
  meters: Meter[]
}

export function parseExcelToMeters(buffer: ArrayBuffer): ImportResult {
  const result: ImportResult = { total: 0, success: 0, failed: 0, errors: [], meters: [] }
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { ...result, errors: ['未找到工作表'] }
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
    result.total = jsonData.length
    const headers = Object.keys(jsonData[0] || {})
    const matched = headers.filter((h) => EXPECTED_COLUMNS.includes(h))
    if (matched.length === 0) {
      return { ...result, errors: [`需要列: ${EXPECTED_COLUMNS.join('、')}，实际表头: ${headers.join('、')}`] }
    }
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i]
      const meter: Partial<Meter> = {} as any
      for (const [header, field] of Object.entries(EXCEL_COLUMN_MAP)) {
        (meter as any)[field] = (row[header] ?? '').toString().trim()
      }
      if (!meter.meterNo) {
        result.failed++
        result.errors.push(`第 ${i + 2} 行：电表编号为空`)
        continue
      }
      result.meters.push(meter as Meter)
      result.success++
    }
  } catch (err) {
    result.errors.push(`解析失败: ${err instanceof Error ? err.message : String(err)}`)
  }
  return result
}

export function recordsToExcelBuffer(records: MeterRecord[]): Uint8Array {
  const data = records.map((r) => ({
    '电能表编号': r.meterNo,
    '户名': r.userName,
    '户号': r.userNo,
    '台区': r.district,
    '电话': r.phone,
    '经度': r.longitude,
    '纬度': r.latitude,
    '定位照路径': r.positionPhotoPath,
    '环境照路径': r.environmentPhotoPath,
    '记录时间': r.recordTime,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 40 }, { wch: 22 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '抄表记录')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

export function generateTemplateBuffer(): Uint8Array {
  const data = [{
    '电能表编号': '示例: 123456789012',
    '户名': '示例: 张三',
    '户号': '示例: 户-2024-0001',
    '台区': '示例: A区-3号台区',
    '电话': '示例: 13800138000',
  }]
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 15 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '电表基础数据')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}
