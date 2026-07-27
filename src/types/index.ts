/** 电表基础数据（从 Excel 导入） */
export interface Meter {
  meterNo: string   // 电能表编号（主键）
  userName: string  // 户名
  userNo: string    // 户号
  district: string  // 台区
  phone: string     // 电话
}

/** 抄表记录 */
export interface MeterRecord {
  id: number
  meterNo: string
  userName: string
  userNo: string
  district: string
  phone: string
  longitude: number
  latitude: number
  positionPhotoPath: string
  environmentPhotoPath: string
  recordTime: string
}

/** Excel 列名映射 */
export const EXCEL_COLUMN_MAP: Record<string, keyof Meter> = {
  '电能表编号': 'meterNo',
  '户名': 'userName',
  '户号': 'userNo',
  '台区': 'district',
  '电话': 'phone',
}

export const EXPECTED_COLUMNS = Object.keys(EXCEL_COLUMN_MAP)

/** 照片文件夹 */
export const PHOTO_DIRS = {
  POSITION: '抄表定位',
  ENVIRONMENT: '抄表环境',
} as const
