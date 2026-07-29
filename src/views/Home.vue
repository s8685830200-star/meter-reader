<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import type { Meter, MeterRecord } from '@/types'
import { getMeter, searchMeters, saveRecord } from '@/services/storage'
import { capturePhoto } from '@/services/camera'
import { saveToGallery } from '@/services/gallery'
import { startLiveScan, stopLiveScan } from '@/services/scanner'
import { getCurrentPosition, getCurrentPositionCoarse, checkLocationPermission, requestLocationPermission } from '@/services/gps'
import { cancelCapture } from '@/services/fileInput'

const searchQuery = ref('')
const searchResults = ref<Meter[]>([])
const selectedMeter = ref<Meter | null>(null)
const showSearchResults = ref(false)
const isSearching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const latitude = ref(0)
const longitude = ref(0)
const gpsAcquired = ref(false)
const gpsLoading = ref(false)

const scanActive = ref(false)
const saving = ref(false)
const lastSaveInfo = ref('')

// Manual search

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
  lastSaveInfo.value = ''
}

// GPS

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

// Silent GPS - requests permission if needed, no toasts
async function acquireGpsSilent(): Promise<boolean> {
  try {
    if (!(await checkLocationPermission())) {
      await requestLocationPermission()
      await new Promise(r => setTimeout(r, 500))
    }
    const pos = await getCurrentPosition(10000)
    latitude.value = pos.latitude; longitude.value = pos.longitude; gpsAcquired.value = true
    return true
  } catch {
    try {
      const pos = await getCurrentPositionCoarse()
      latitude.value = pos.latitude; longitude.value = pos.longitude; gpsAcquired.value = true
      return true
    } catch { return false }
  }
}

// Scan barcode: match DB, auto GPS, confirm save

async function startScan() {
  scanActive.value = true
  try {
    const barcode = await startLiveScan()
    searchQuery.value = barcode

    // Try exact match, then strip trailing chars
    let meter = await getMeter(barcode)
    if (!meter && barcode.length > 4) {
      for (let strip = 1; strip <= 3; strip++) {
        const truncated = barcode.slice(0, -strip)
        meter = await getMeter(truncated)
        if (meter) {
          searchQuery.value = truncated
          break
        }
      }
    }

    if (!meter) {
      const results = await searchMeters(barcode)
      if (results.length > 0) {
        searchResults.value = results
        showSearchResults.value = true
        showToast('未精确匹配，请从列表中选择')
      } else {
        showToast('未找到该电表，请核对编号')
      }
      return
    }

    // Auto GPS - now requests permission if needed
    const gpsOk = await acquireGpsSilent()
    const gpsText = gpsOk
      ? latitude.value.toFixed(6) + ', ' + longitude.value.toFixed(6)
      : '未获取到'

    const confirmed = await showConfirmDialog({
      title: '保存抄表记录？',
      message: '电表编号: ' + meter.meterNo + '\n户名: ' + meter.userName + '\n户号: ' + meter.userNo + '\n台区: ' + meter.district + '\nGPS: ' + gpsText,
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })

    if (!confirmed) return

    saving.value = true
    const record: MeterRecord = {
      id: Date.now(),
      meterNo: meter.meterNo, userName: meter.userName, userNo: meter.userNo,
      district: meter.district, phone: meter.phone,
      longitude: longitude.value, latitude: latitude.value,
      positionPhotoPath: '',
      environmentPhotoPath: '',
      recordTime: new Date().toISOString(),
    }
    await saveRecord(record)
    showToast('抄表记录已保存')
    lastSaveInfo.value = meter.meterNo + ' / ' + meter.userName
    clearMeter()

  } catch (err: any) {
    const msg = err?.message || '扫码取消'
    if (msg !== '扫码取消' && msg !== '用户取消扫码') showToast(msg)
  } finally {
    scanActive.value = false
    saving.value = false
  }
}

// Scene photo: camera -> confirm -> save to album

const takingPhoto = ref(false)

async function captureScenePhoto() {
  takingPhoto.value = true
  try {
    const { file, base64 } = await capturePhoto()

    const confirmed = await showConfirmDialog({
      title: '保存照片？',
      message: '将照片保存到系统相册"抄表现场环境"文件夹',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })

    if (!confirmed) return

    const fileName = '现场_' + Date.now() + '.jpg'
    const ok = await saveToGallery(base64, '抄表现场环境', fileName)
    if (ok) {
      showToast('照片已保存到系统相册')
    } else {
      showToast('保存到相册失败，请在 Records 页面查看')
    }
  } catch (e: any) {
    const msg = e?.message || '拍照失败'
    if (msg !== '用户取消拍照') showToast(msg)
  } finally {
    takingPhoto.value = false
  }
}

// Manual save (for search-based flow)

async function saveMeterRecord() {
  if (!selectedMeter.value) { showToast('请先选择电表'); return }
  if (!gpsAcquired.value) {
    const confirmed = await showConfirmDialog({ title: '提示', message: '尚未获取 GPS 位置，是否继续保存？' })
    if (!confirmed) return
  }

  saving.value = true
  try {
    const m = selectedMeter.value
    const record: MeterRecord = {
      id: Date.now(),
      meterNo: m.meterNo, userName: m.userName, userNo: m.userNo,
      district: m.district, phone: m.phone,
      longitude: longitude.value, latitude: latitude.value,
      positionPhotoPath: '',
      environmentPhotoPath: '',
      recordTime: new Date().toISOString(),
    }
    await saveRecord(record)
    showToast('抄表记录已保存')
    lastSaveInfo.value = m.meterNo + ' / ' + m.userName
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

    <div class="section">
      <div class="section-title">操作</div>
      <div class="action-buttons">
        <van-button type="primary" icon="scan" size="large" round block :loading="scanActive" @click="startScan">
          {{ scanActive ? '对准条码自动识别...' : '扫描电表条码' }}
        </van-button>
        <van-button type="warning" icon="photograph" size="large" round block plain hairline :loading="takingPhoto" class="btn-spacing" @click="captureScenePhoto">
          拍摄现场照片
        </van-button>
      </div>
      <div class="action-hint">扫描电表条码：自动匹配 定位 确认保存</div>
    </div>

    <div v-if="lastSaveInfo" class="section">
      <van-cell-group inset>
        <van-cell title="上次保存" :value="lastSaveInfo" />
      </van-cell-group>
    </div>

    <div class="section">
      <div class="section-title">查找电表</div>
      <van-search v-model="searchQuery" placeholder="手动输入电表编号查找" :loading="isSearching" @update:model-value="onSearchInput" @clear="searchResults = []; showSearchResults = false" />
      <van-cell-group v-if="showSearchResults && searchResults.length > 0" inset>
        <van-cell v-for="item in searchResults" :key="item.meterNo" :title="item.meterNo" :label="item.userName + ' . ' + item.district" is-link @click="selectMeter(item)" />
      </van-cell-group>
    </div>

    <div v-if="selectedMeter" class="section">
      <div class="section-title">
        电表信息 {{ selectedMeter.userName }}
        <van-button size="mini" type="default" @click="clearMeter" style="float:right">更换</van-button>
      </div>
      <van-cell-group inset>
        <van-field label="电能表编号" :model-value="selectedMeter.meterNo" readonly />
        <van-field label="户名" :model-value="selectedMeter.userName" readonly />
        <van-field label="户号" :model-value="selectedMeter.userNo" readonly />
        <van-field label="台区" :model-value="selectedMeter.district" readonly />
        <van-field label="电话" :model-value="selectedMeter.phone" readonly />
      </van-cell-group>
      <div class="save-row">
        <van-button v-if="!gpsAcquired" type="primary" size="small" :loading="gpsLoading" @click="acquireGps">获取位置</van-button>
        <span v-else class="gps-text">{{ latitude.toFixed(6) }}, {{ longitude.toFixed(6) }}</span>
        <van-button type="success" round :loading="saving" icon="records" @click="saveMeterRecord">保存记录</van-button>
      </div>
    </div>

    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
.home-page { min-height: 100%; padding-bottom: 20px; }
.section { padding: 12px 16px 0; }
.section-title { font-size: 14px; font-weight: 600; color: #323233; margin-bottom: 8px; padding-left: 10px; border-left: 3px solid #1989fa; }
.action-buttons { margin-bottom: 4px; }
.btn-spacing { margin-top: 10px; }
.action-hint { font-size: 12px; color: #969799; text-align: center; margin-top: 6px; margin-bottom: 8px; }
.gps-text { color: #07c160; font-size: 12px; margin-right: 12px; }
.save-row { margin-top: 12px; display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.bottom-spacer { height: 60px; }
</style>