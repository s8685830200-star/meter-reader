<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { showToast, showConfirmDialog, showLoadingToast, closeToast } from 'vant'
import type { Meter, MeterRecord } from '@/types'
import { getMeter, searchMeters, saveRecord } from '@/services/storage'
import { takePositionPhoto, takeEnvironmentPhoto } from '@/services/camera'
import { getCurrentPosition, getCurrentPositionCoarse, checkLocationPermission, requestLocationPermission } from '@/services/gps'
import { startScanner, stopScanner } from '@/services/scanner'

const searchQuery = ref('')
const searchResults = ref<Meter[]>([])
const selectedMeter = ref<Meter | null>(null)
const showSearchResults = ref(false)
const isSearching = ref(false)
const showScanner = ref(false)
const scanModeActive = ref(false)
const latitude = ref(0)
const longitude = ref(0)
const gpsAcquired = ref(false)
const gpsLoading = ref(false)
const positionPhotoPath = ref('')
const environmentPhotoPath = ref('')
const takingPositionPhoto = ref(false)
const takingEnvironmentPhoto = ref(false)
const saving = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function onSearchInput(value: string) {
  if (searchTimer) clearTimeout(searchTimer)
  if (!value.trim()) { searchResults.value = []; showSearchResults.value = false; return }
  searchTimer = setTimeout(async () => {
    isSearching.value = true
    const results = await searchMeters(value)
    searchResults.value = results
    showSearchResults.value = results.length > 0
    isSearching.value = false
  }, 300)
}

function selectMeter(meter: Meter) {
  selectedMeter.value = meter
  showSearchResults.value = false
  searchQuery.value = meter.meterNo
  latitude.value = 0; longitude.value = 0; gpsAcquired.value = false
  positionPhotoPath.value = ''; environmentPhotoPath.value = ''
}

async function startScan() {
  scanModeActive.value = true; showScanner.value = true
  await startScanner(
    async (code: string) => {
      showScanner.value = false; scanModeActive.value = false
      searchQuery.value = code
      const meter = await getMeter(code)
      if (meter) { selectMeter(meter); showToast('扫码成功') }
      else {
        const results = await searchMeters(code)
        if (results.length > 0) { searchResults.value = results; showSearchResults.value = true; showToast('请从匹配结果中选择') }
        else showToast('未找到该电表信息')
      }
    },
    (e) => { if (e) console.warn(e) },
  )
}

function cancelScan() { stopScanner(); showScanner.value = false; scanModeActive.value = false }

async function acquireGps() {
  gpsLoading.value = true
  try {
    if (!(await checkLocationPermission())) await requestLocationPermission()
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

async function capturePositionPhoto() {
  if (!selectedMeter.value) return
  takingPositionPhoto.value = true
  try { positionPhotoPath.value = await takePositionPhoto(selectedMeter.value.userName, selectedMeter.value.userNo, selectedMeter.value.meterNo); showToast('定位照已保存') }
  catch { showToast('拍照失败') }
  finally { takingPositionPhoto.value = false }
}

async function captureEnvironmentPhoto() {
  if (!selectedMeter.value) return
  takingEnvironmentPhoto.value = true
  try { environmentPhotoPath.value = await takeEnvironmentPhoto(selectedMeter.value.userName, selectedMeter.value.userNo, selectedMeter.value.meterNo); showToast('环境照已保存') }
  catch { showToast('拍照失败') }
  finally { takingEnvironmentPhoto.value = false }
}

async function saveMeterRecord() {
  if (!selectedMeter.value) { showToast('请先选择电表'); return }
  if (!gpsAcquired.value) {
    const confirmed = await showConfirmDialog({ title: '提示', message: '尚未获取 GPS 位置，是否继续保存？' })
    if (!confirmed) return
  }
  saving.value = true
  try {
    const record: MeterRecord = {
      id: Date.now(), meterNo: selectedMeter.value.meterNo, userName: selectedMeter.value.userName,
      userNo: selectedMeter.value.userNo, district: selectedMeter.value.district, phone: selectedMeter.value.phone,
      longitude: longitude.value, latitude: latitude.value, positionPhotoPath: positionPhotoPath.value,
      environmentPhotoPath: environmentPhotoPath.value, recordTime: new Date().toISOString(),
    }
    await saveRecord(record)
    showToast('抄表记录已保存')
    selectedMeter.value = null; searchQuery.value = ''
    latitude.value = 0; longitude.value = 0; gpsAcquired.value = false
    positionPhotoPath.value = ''; environmentPhotoPath.value = ''
  } catch { showToast('保存失败') }
  finally { saving.value = false }
}

onUnmounted(() => { if (scanModeActive.value) stopScanner(); if (searchTimer) clearTimeout(searchTimer) })
</script>

<template>
  <div class="home-page">
    <van-sticky><van-nav-bar title="抄表" :border="true" /></van-sticky>

    <div class="section">
      <div class="section-title">查询电表</div>
      <div v-if="!showScanner" class="scan-action">
        <van-button type="primary" icon="scan" size="large" round :loading="scanModeActive" @click="startScan">扫描电表条码</van-button>
      </div>
      <div v-if="showScanner" class="scanner-container">
        <div id="qr-scanner-element" class="scanner-view"></div>
        <van-button type="default" size="small" @click="cancelScan">取消扫码</van-button>
      </div>
      <van-search v-model="searchQuery" placeholder="手动输入电表编号" :loading="isSearching" @update:model-value="onSearchInput" @clear="searchResults = []; showSearchResults = false; selectedMeter = null" />
      <van-cell-group v-if="showSearchResults && searchResults.length > 0" inset>
        <van-cell v-for="item in searchResults" :key="item.meterNo" :title="item.meterNo" :label="`${item.userName} · ${item.district}`" is-link @click="selectMeter(item)" />
      </van-cell-group>
    </div>

    <div v-if="selectedMeter" class="section">
      <div class="section-title">电表信息</div>
      <van-cell-group inset>
        <van-field label="电能表编号" :model-value="selectedMeter.meterNo" readonly />
        <van-field label="户名" :model-value="selectedMeter.userName" readonly />
        <van-field label="户号" :model-value="selectedMeter.userNo" readonly />
        <van-field label="台区" :model-value="selectedMeter.district" readonly />
        <van-field label="电话" :model-value="selectedMeter.phone" readonly />
      </van-cell-group>
    </div>

    <div v-if="selectedMeter" class="section">
      <div class="section-title">现场记录</div>
      <van-cell-group inset>
        <van-cell title="GPS 定位" center>
          <template #value>
            <van-button v-if="!gpsAcquired" type="primary" size="small" :loading="gpsLoading" @click="acquireGps">获取位置</van-button>
            <span v-else class="gps-success">{{ latitude.toFixed(6) }}, {{ longitude.toFixed(6) }}</span>
          </template>
        </van-cell>
      </van-cell-group>
      <div class="photo-actions">
        <van-button type="primary" icon="photograph" :loading="takingPositionPhoto" :disabled="!!positionPhotoPath" block plain hairline @click="capturePositionPhoto">{{ positionPhotoPath ? '✓ 定位照已拍' : '拍摄定位照（电表正面）' }}</van-button>
        <van-button type="warning" icon="photograph" :loading="takingEnvironmentPhoto" :disabled="!!environmentPhotoPath" block plain hairline @click="captureEnvironmentPhoto" class="photo-btn-spacing">{{ environmentPhotoPath ? '✓ 环境照已拍' : '拍摄环境照（接线/空开）' }}</van-button>
      </div>
      <div class="save-action">
        <van-button type="success" size="large" round :loading="saving" :disabled="!selectedMeter" icon="records" @click="saveMeterRecord">保存抄表记录</van-button>
      </div>
    </div>
    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
.home-page { min-height: 100%; padding-bottom: 20px; }
.section { padding: 12px 16px 0; }
.section-title { font-size: 14px; font-weight: 600; color: #323233; margin-bottom: 8px; padding-left: 10px; border-left: 3px solid #1989fa; }
.scan-action { margin-bottom: 8px; }
.scanner-container { text-align: center; margin-bottom: 12px; }
.scanner-view { width: 100%; height: 200px; background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 8px; }
.photo-actions { margin-top: 12px; padding: 0 16px; }
.photo-btn-spacing { margin-top: 8px; }
.gps-success { color: #07c160; font-size: 12px; }
.save-action { margin: 20px 16px 0; }
.bottom-spacer { height: 60px; }
</style>
