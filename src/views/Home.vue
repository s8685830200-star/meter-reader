<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import type { Meter, MeterRecord } from '@/types'
import { getMeter, searchMeters, saveRecord } from '@/services/storage'
import { savePositionPhoto, saveEnvironmentPhoto, capturePhoto } from '@/services/camera'
import { startLiveScan, stopLiveScan } from '@/services/scanner'
import type { ScanResult } from '@/services/scanner'
import { getCurrentPosition, getCurrentPositionCoarse, checkLocationPermission, requestLocationPermission } from '@/services/gps'
import { cancelCapture } from '@/services/fileInput'
import { getStoragePrefs, setStoragePrefs, type StorageTarget } from '@/services/storagePrefs'

const storagePrefs = ref(getStoragePrefs())

function getStorageDisplayText(target: StorageTarget): string {
  const map: Record<StorageTarget, string> = { gallery: '系统相册', external: '文件管理器', internal: 'App内' }
  return map[target] || target
}

async function changePositionStorage() {
  const opts: StorageTarget[] = ['external', 'gallery', 'internal']
  const idx = opts.indexOf(storagePrefs.value.positionPhoto)
  setStoragePrefs({ positionPhoto: opts[(idx + 1) % opts.length] })
  storagePrefs.value = getStoragePrefs()
  showToast(`电表照片 → ${getStorageDisplayText(storagePrefs.value.positionPhoto)}`)
}

async function changeEnvStorage() {
  const opts: StorageTarget[] = ['external', 'gallery', 'internal']
  const idx = opts.indexOf(storagePrefs.value.environmentPhoto)
  setStoragePrefs({ environmentPhoto: opts[(idx + 1) % opts.length] })
  storagePrefs.value = getStoragePrefs()
  showToast(`现场照片 → ${getStorageDisplayText(storagePrefs.value.environmentPhoto)}`)
}

// --- Search ---
const searchQuery = ref('')
const searchResults = ref<Meter[]>([])
const selectedMeter = ref<Meter | null>(null)
const showSearchResults = ref(false)
const isSearching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

// --- GPS ---
const latitude = ref(0)
const longitude = ref(0)
const gpsAcquired = ref(false)
const gpsLoading = ref(false)

// --- Photos ---
const positionPhotoBase64 = ref('')
const environmentPhotoBase64 = ref('')
const takingPositionPhoto = ref(false)
const takingEnvironmentPhoto = ref(false)
const lastSaveInfo = ref('')
const scanActive = ref(false)

// --- Save ---
const saving = ref(false)

async function onSearchInput(value: string) {
  if (searchTimer) clearTimeout(searchTimer)
  if (!value.trim()) { searchResults.value = []; showSearchResults.value = false; return }
  searchTimer = setTimeout(async () => {
    isSearching.value = true
    searchResults.value = await searchMeters(value)
    showSearchResults.value = searchResults.value.length > 0
    isSearching.value = false
  }, 300)
}

function selectMeter(meter: Meter) {
  selectedMeter.value = meter
  showSearchResults.value = false
  searchQuery.value = meter.meterNo
}

function clearMeter() {
  selectedMeter.value = null
  searchQuery.value = ''
  searchResults.value = []
  showSearchResults.value = false
  latitude.value = 0; longitude.value = 0; gpsAcquired.value = false
  positionPhotoBase64.value = ''; environmentPhotoBase64.value = ''
  lastSaveInfo.value = ''
}

/** Silent GPS acquisition — doesn't show toasts or request permissions interactively */
async function acquireGpsSilent(): Promise<void> {
  try {
    if (await checkLocationPermission()) {
      const pos = await getCurrentPosition(10000)
      latitude.value = pos.latitude; longitude.value = pos.longitude; gpsAcquired.value = true
      return
    }
  } catch {
    // fall through to coarse
  }
  try {
    const pos = await getCurrentPositionCoarse()
    latitude.value = pos.latitude; longitude.value = pos.longitude; gpsAcquired.value = true
  } catch {
    // GPS unavailable — save without coordinates
  }
}

// --- Scan: auto-capture photo + auto-save when meter matched ---
async function startScan() {
  scanActive.value = true
  try {
    const result: ScanResult = await startLiveScan()
    searchQuery.value = result.barcode

    const meter = await getMeter(result.barcode)
    if (meter && result.photoBase64) {
      // Auto-flow: meter matched + photo captured from scanner frame
      selectMeter(meter)
      positionPhotoBase64.value = result.photoBase64
      showToast('正在获取位置并保存...')

      // Silently acquire GPS
      await acquireGpsSilent()

      // Auto-save
      await saveMeterRecord()
      return
    }

    if (meter) {
      // Meter matched but no photo (shouldn't happen with new scanner, but handle gracefully)
      selectMeter(meter)
      showToast('扫码成功，已匹配电表')
      return
    }

    // No exact match — try fuzzy search
    const results = await searchMeters(result.barcode)
    if (results.length > 0) {
      searchResults.value = results
      showSearchResults.value = true
      showToast('请从匹配结果中选择')
    } else {
      showToast('未找到该电表，请核对编号')
    }
  } catch (err: any) {
    const msg = err?.message || '扫码取消'
    if (msg !== '扫码取消' && msg !== '用户取消扫码') showToast(msg)
  } finally {
    scanActive.value = false
  }
}

// --- Manual photo capture (fallback, when using search or for environment photo) ---
async function captureMeterPhoto() {
  takingPositionPhoto.value = true
  try {
    const { base64 } = await capturePhoto()
    positionPhotoBase64.value = base64
    showToast('电表照已拍摄')
  } catch (e: any) {
    const msg = e?.message || '拍照失败'
    if (msg !== '用户取消拍照') showToast(msg)
  } finally {
    takingPositionPhoto.value = false
  }
}

async function captureEnvPhoto() {
  takingEnvironmentPhoto.value = true
  try {
    const { base64 } = await capturePhoto()
    environmentPhotoBase64.value = base64
    showToast('环境照已拍摄')
  } catch (e: any) {
    const msg = e?.message || '拍照失败'
    if (msg !== '用户取消拍照') showToast(msg)
  } finally {
    takingEnvironmentPhoto.value = false
  }
}

async function acquireGps() {
  gpsLoading.value = true
  try {
    if (!(await checkLocationPermission())) {
      await requestLocationPermission()
      await new Promise(r => setTimeout(r, 500))
      if (!(await checkLocationPermission())) {
        showToast('请在系统设置中授予定位权限后重试')
        gpsLoading.value = false
        return
      }
    }
    const pos = await getCurrentPosition(15000)
    latitude.value = pos.latitude; longitude.value = pos.longitude; gpsAcquired.value = true
    showToast('GPS 定位成功')
  } catch {
    try {
      const pos = await getCurrentPositionCoarse()
      latitude.value = pos.latitude; longitude.value = pos.longitude; gpsAcquired.value = true
      showToast('已获取粗略位置')
    } catch { showToast('GPS 定位失败') }
  } finally { gpsLoading.value = false }
}

async function saveMeterRecord() {
  if (!selectedMeter.value) { showToast('请先选择电表'); return }
  if (!positionPhotoBase64.value && !environmentPhotoBase64.value) {
    showToast('请至少拍摄一张照片')
    return
  }
  if (!gpsAcquired.value) {
    const confirmed = await showConfirmDialog({ title: '提示', message: '尚未获取 GPS 位置，是否继续保存？' })
    if (!confirmed) return
  }

  saving.value = true
  try {
    const m = selectedMeter.value
    let posPath = ''
    let envPath = ''
    const locations: string[] = []

    // Pass GPS coordinates to embed EXIF data in photos
    const lat = latitude.value || undefined
    const lng = longitude.value || undefined

    if (positionPhotoBase64.value) {
      const r = await savePositionPhoto(m.userName, m.userNo, m.meterNo, positionPhotoBase64.value, lat, lng)
      posPath = r.savedPath
      locations.push(`电表照 → ${r.displayPath}`)
    }
    if (environmentPhotoBase64.value) {
      const r = await saveEnvironmentPhoto(m.userName, m.userNo, m.meterNo, environmentPhotoBase64.value, lat, lng)
      envPath = r.savedPath
      locations.push(`现场照 → ${r.displayPath}`)
    }

    const record: MeterRecord = {
      id: Date.now(),
      meterNo: m.meterNo, userName: m.userName, userNo: m.userNo,
      district: m.district, phone: m.phone,
      longitude: longitude.value, latitude: latitude.value,
      positionPhotoPath: posPath, environmentPhotoPath: envPath,
      recordTime: new Date().toISOString(),
    }
    await saveRecord(record)
    showToast('抄表记录已保存')
    lastSaveInfo.value = locations.join('\n')
    clearMeter()
  } catch (e: any) {
    showToast(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onUnmounted(() => { stopLiveScan(); cancelCapture(); if (searchTimer) clearTimeout(searchTimer) })
</script>

<template>
  <div class="home-page">
    <van-sticky><van-nav-bar title="抄表" :border="true" /></van-sticky>

    <!-- 扫码 + 拍照 -->
    <div class="section">
      <div class="section-title">扫码与拍照</div>
      <div class="capture-actions">
        <van-button type="primary" icon="scan" size="large" round block :loading="scanActive" @click="startScan">
          {{ scanActive ? '对准条码自动识别...' : '📲 扫描电表条码（实时）' }}
        </van-button>
        <van-button type="primary" icon="photograph" size="large" round block plain hairline :loading="takingPositionPhoto" class="capture-btn-spacing" @click="captureMeterPhoto">
          {{ positionPhotoBase64 ? '✅ 已拍摄电表照片' : '📷 拍摄电表照片' }}
        </van-button>
        <van-button type="warning" icon="photograph" size="large" round block plain hairline :loading="takingEnvironmentPhoto" class="capture-btn-spacing" @click="captureEnvPhoto">
          {{ environmentPhotoBase64 ? '✅ 已拍摄现场环境' : '📷 拍摄现场环境' }}
        </van-button>
      </div>
      <div class="capture-hint">扫描电表条码：扫码后自动拍照并保存，无需手动操作</div>
    </div>

    <!-- 存储位置 -->
    <div class="section">
      <div class="section-title">照片保存位置</div>
      <van-cell-group inset>
        <van-cell title="电表照片" is-link :value="getStorageDisplayText(storagePrefs.positionPhoto)" @click="changePositionStorage" />
        <van-cell title="现场照片" is-link :value="getStorageDisplayText(storagePrefs.environmentPhoto)" @click="changeEnvStorage" />
      </van-cell-group>
      <div v-if="lastSaveInfo" class="save-info">
        <div class="save-info-title">上次保存位置：</div>
        <div class="save-info-text">{{ lastSaveInfo }}</div>
      </div>
    </div>

    <!-- 手动搜索 -->
    <div class="section">
      <div class="section-title">查找电表</div>
      <van-search v-model="searchQuery" placeholder="手动输入电表编号查找" :loading="isSearching" @update:model-value="onSearchInput" @clear="searchResults = []; showSearchResults = false" />
      <van-cell-group v-if="showSearchResults && searchResults.length > 0" inset>
        <van-cell v-for="item in searchResults" :key="item.meterNo" :title="item.meterNo" :label="`${item.userName} · ${item.district}`" is-link @click="selectMeter(item)" />
      </van-cell-group>
    </div>

    <!-- 电表信息 -->
    <div v-if="selectedMeter" class="section">
      <div class="section-title">
        电表信息 — {{ selectedMeter.userName }}
        <van-button size="mini" type="default" @click="clearMeter" style="float:right">更换电表</van-button>
      </div>
      <van-cell-group inset>
        <van-field label="电能表编号" :model-value="selectedMeter.meterNo" readonly />
        <van-field label="户名" :model-value="selectedMeter.userName" readonly />
        <van-field label="户号" :model-value="selectedMeter.userNo" readonly />
        <van-field label="台区" :model-value="selectedMeter.district" readonly />
        <van-field label="电话" :model-value="selectedMeter.phone" readonly />
      </van-cell-group>
    </div>

    <!-- GPS + 保存 -->
    <div v-if="selectedMeter" class="section">
      <div class="section-title">完成抄表</div>
      <van-cell-group inset>
        <van-cell title="GPS 定位" center>
          <template #value>
            <van-button v-if="!gpsAcquired" type="primary" size="small" :loading="gpsLoading" @click="acquireGps">获取位置</van-button>
            <span v-else class="gps-success">{{ latitude.toFixed(6) }}, {{ longitude.toFixed(6) }}</span>
          </template>
        </van-cell>
      </van-cell-group>
      <div class="save-action">
        <van-button type="success" size="large" round block :loading="saving" icon="records" @click="saveMeterRecord">保存抄表记录</van-button>
      </div>
    </div>

    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
.home-page { min-height: 100%; padding-bottom: 20px; }
.section { padding: 12px 16px 0; }
.section-title { font-size: 14px; font-weight: 600; color: #323233; margin-bottom: 8px; padding-left: 10px; border-left: 3px solid #1989fa; }
.capture-actions { margin-bottom: 4px; }
.capture-btn-spacing { margin-top: 10px; }
.capture-hint { font-size: 12px; color: #969799; text-align: center; margin-top: 6px; margin-bottom: 8px; }
.gps-success { color: #07c160; font-size: 12px; }
.save-action { margin-top: 16px; }
.save-info { margin-top: 8px; padding: 8px 12px; background: #f7f8fa; border-radius: 6px; font-size: 12px; }
.save-info-title { color: #323233; font-weight: 600; margin-bottom: 2px; }
.save-info-text { color: #1989fa; white-space: pre-line; }
.bottom-spacer { height: 60px; }
</style>