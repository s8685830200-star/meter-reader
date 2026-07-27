<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import type { Meter, MeterRecord } from '@/types'
import { getMeter, searchMeters, saveRecord } from '@/services/storage'
import { savePositionPhoto, saveEnvironmentPhoto } from '@/services/camera'
import { captureAndScan } from '@/services/scanner'
import { capturePhoto } from '@/services/camera'
import { getCurrentPosition, getCurrentPositionCoarse, checkLocationPermission, requestLocationPermission } from '@/services/gps'
import { cancelCapture } from '@/services/fileInput'

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

// --- Photos (cached in memory until save) ---
const positionPhotoBase64 = ref('')
const environmentPhotoBase64 = ref('')
const takingPositionPhoto = ref(false)
const takingEnvironmentPhoto = ref(false)

// --- Save ---
const saving = ref(false)

// --- Search handlers ---
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
}

// --- Capture: meter barcode + position photo (merged) ---
async function captureMeterPhoto() {
  takingPositionPhoto.value = true
  try {
    const { barcode, base64 } = await captureAndScan()
    positionPhotoBase64.value = base64
    showToast('电表照已拍摄')

    if (barcode) {
      // Always put barcode in search input
      searchQuery.value = barcode
      // Try to auto-match meter
      const meter = await getMeter(barcode)
      if (meter) {
        selectMeter(meter)
        showToast('条码识别成功，已匹配电表')
      } else {
        // Trigger fuzzy search with the barcode
        const results = await searchMeters(barcode)
        if (results.length > 0) {
          searchResults.value = results
          showSearchResults.value = true
          showToast('请从匹配结果中选择')
        } else {
          showToast('未找到该电表，请核对编号后手动搜索')
        }
      }
    } else {
      showToast('未识别到条码，请手动输入编号')
    }
  } catch (e: any) {
    const msg = e?.message || '拍照失败'
    if (msg !== '用户取消拍照') showToast(msg)
  } finally {
    takingPositionPhoto.value = false
  }
}

// --- Capture: environment photo ---
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

// --- GPS ---
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
    } catch { showToast('GPS 定位失败，请检查系统位置服务是否开启') }
  } finally { gpsLoading.value = false }
}

// --- Save ---
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

    // Save photos with meter-based filenames
    if (positionPhotoBase64.value) {
      posPath = await savePositionPhoto(m.userName, m.userNo, m.meterNo, positionPhotoBase64.value)
    }
    if (environmentPhotoBase64.value) {
      envPath = await saveEnvironmentPhoto(m.userName, m.userNo, m.meterNo, environmentPhotoBase64.value)
    }

    const record: MeterRecord = {
      id: Date.now(),
      meterNo: m.meterNo,
      userName: m.userName,
      userNo: m.userNo,
      district: m.district,
      phone: m.phone,
      longitude: longitude.value,
      latitude: latitude.value,
      positionPhotoPath: posPath,
      environmentPhotoPath: envPath,
      recordTime: new Date().toISOString(),
    }
    await saveRecord(record)
    showToast('抄表记录已保存')
    clearMeter()
  } catch (e: any) {
    showToast(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onUnmounted(() => { cancelCapture(); if (searchTimer) clearTimeout(searchTimer) })
</script>

<template>
  <div class="home-page">
    <van-sticky><van-nav-bar title="抄表" :border="true" /></van-sticky>

    <!-- ===== 拍摄按钮区 ===== -->
    <div class="section">
      <div class="section-title">现场拍摄</div>
      <div class="capture-actions">
        <van-button
          type="primary"
          icon="photograph"
          size="large"
          round
          block
          :loading="takingPositionPhoto"
          @click="captureMeterPhoto"
        >
          {{ positionPhotoBase64 ? '✓ 已拍摄电表条码' : '📷 拍摄电表条码' }}
        </van-button>
        <van-button
          type="warning"
          icon="photograph"
          size="large"
          round
          block
          :loading="takingEnvironmentPhoto"
          class="capture-btn-spacing"
          @click="captureEnvPhoto"
        >
          {{ environmentPhotoBase64 ? '✓ 已拍摄现场环境' : '📸 拍摄现场环境' }}
        </van-button>
      </div>
      <div class="capture-hint">
        点击"拍摄电表条码"自动识别条码和匹配户号
      </div>
    </div>

    <!-- ===== 手动搜索区 ===== -->
    <div class="section">
      <div class="section-title">查找电表</div>
      <van-search
        v-model="searchQuery"
        placeholder="手动输入电表编号查找"
        :loading="isSearching"
        @update:model-value="onSearchInput"
        @clear="searchResults = []; showSearchResults = false"
      />
      <van-cell-group v-if="showSearchResults && searchResults.length > 0" inset>
        <van-cell
          v-for="item in searchResults"
          :key="item.meterNo"
          :title="item.meterNo"
          :label="`${item.userName} · ${item.district}`"
          is-link
          @click="selectMeter(item)"
        />
      </van-cell-group>
    </div>

    <!-- ===== 电表信息 ===== -->
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

    <!-- ===== GPS + 保存 ===== -->
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
        <van-button
          type="success"
          size="large"
          round
          block
          :loading="saving"
          icon="records"
          @click="saveMeterRecord"
        >
          保存抄表记录
        </van-button>
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
.bottom-spacer { height: 60px; }
</style>
