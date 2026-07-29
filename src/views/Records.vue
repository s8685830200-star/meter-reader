<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showToast, showConfirmDialog, showLoadingToast, closeToast, showImagePreview } from 'vant'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { getAllRecords, deleteRecord, clearRecords, getRecordCount } from '@/services/storage'
import { recordsToExcelBuffer } from '@/services/excel'
import type { MeterRecord } from '@/types'

const records = ref<MeterRecord[]>([])
const loading = ref(false)
const exporting = ref(false)
const recordCount = ref(0)
const photoCache = ref<Record<string, string>>({})

// Detail popup
const showDetail = ref(false)
const detailRecord = ref<MeterRecord | null>(null)

async function loadRecords() {
  loading.value = true
  records.value = await getAllRecords()
  recordCount.value = records.value.length
  photoCache.value = {}
  loading.value = false
}
onMounted(loadRecords)

function openDetail(record: MeterRecord) {
  detailRecord.value = record
  showDetail.value = true
}

async function loadPhotoDataUrl(path: string): Promise<string> {
  if (photoCache.value[path]) return photoCache.value[path]
  try {
    const result = await Filesystem.readFile({ path, directory: Directory.Data })
    const dataUrl = `data:image/jpeg;base64,${result.data}`
    photoCache.value[path] = dataUrl
    return dataUrl
  } catch {
    return ''
  }
}

function viewPhoto(path: string) {
  if (!path) return
  showLoadingToast({ message: '加载中..', forbidClick: true, duration: 0 })
  loadPhotoDataUrl(path).then(dataUrl => {
    closeToast()
    if (dataUrl) {
      showImagePreview({ images: [dataUrl], closeable: true })
    } else {
      showToast('照片加载失败')
    }
  })
}

async function exportRecords() {
  if (records.value.length === 0) { showToast('暂无记录'); return }
  exporting.value = true
  showLoadingToast({ message: '正在生成...', forbidClick: true, duration: 0 })
  try {
    const buffer = recordsToExcelBuffer(records.value)
    const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const timestamp = new Date().toISOString().slice(0, 10)
    const fileName = `抄表记录_${timestamp}.xlsx`

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(blob)
    })

    await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache })
    const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
    closeToast()
    showToast('Excel 已生成')

    try {
      await Share.share({ title: '抄表记录', files: [uri] })
    } catch { /* user cancelled */ }
  } catch (e: any) {
    closeToast()
    showToast('导出失败: ' + (e?.message || ''))
  } finally {
    exporting.value = false
  }
}

async function handleDelete(record: MeterRecord) {
  const confirmed = await showConfirmDialog({ title: '确认删除', message: `确定删除 ${record.meterNo} 的记录？` })
  if (confirmed) { await deleteRecord(record.id); showToast('已删除'); loadRecords() }
}

async function handleClearAll() {
  if (records.value.length === 0) return
  const confirmed = await showConfirmDialog({ title: '确认清空', message: `确定清空全部 ${records.value.length} 条记录？` })
  if (confirmed) { await clearRecords(); showToast('已清空'); loadRecords() }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function shortMeterNo(no: string): string {
  return no.length > 6 ? '...' + no.slice(-6) : no
}
</script>

<template>
  <div class="records-page">
    <van-sticky><van-nav-bar title="抄表记录" :border="true" /></van-sticky>

    <div class="section">
      <van-cell-group inset><van-cell title="抄表记录数" :value="`${recordCount} 条`" /></van-cell-group>
      <div class="record-actions">
        <van-button type="primary" icon="share" size="large" round block :loading="exporting" :disabled="records.length === 0" @click="exportRecords">导出 Excel 并分享</van-button>
        <van-button v-if="records.length > 0" plain hairline type="danger" icon="delete" size="large" round block @click="handleClearAll" class="clear-btn">清空全部记录</van-button>
      </div>
    </div>

    <div class="section">
      <div class="section-title">记录列表</div>
      <van-pull-refresh v-model="loading" @refresh="loadRecords">
        <van-list v-model:loading="loading" :finished="true" finished-text="没有更多了">
          <van-swipe-cell v-for="record in records" :key="record.id">
            <van-cell
              center clickable
              :title="shortMeterNo(record.meterNo)"
              :label="record.userName"
              :value="record.userNo"
              is-link
              class="record-summary"
              @click="openDetail(record)"
            />
            <template #right>
              <van-button square type="danger" text="删除" class="delete-button" @click="handleDelete(record)" />
            </template>
          </van-swipe-cell>
          <van-empty v-if="records.length === 0 && !loading" description="暂无抄表记录">
            <template #image><van-icon name="records" size="64" color="#c8c9cc" /></template>
          </van-empty>
        </van-list>
      </van-pull-refresh>
    </div>

    <!-- 记录详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      round
      position="bottom"
      :style="{ maxHeight: '80vh', overflowY: 'auto' }"
    >
      <div v-if="detailRecord" class="detail-popup">
        <div class="detail-header">
          <span class="detail-title">记录详情</span>
          <van-button size="small" plain hairline @click="showDetail = false">关闭</van-button>
        </div>
        <van-cell-group inset>
          <van-field label="电能表编号" :model-value="detailRecord.meterNo" readonly />
          <van-field label="户名" :model-value="detailRecord.userName" readonly />
          <van-field label="户号" :model-value="detailRecord.userNo" readonly />
          <van-field label="台区" :model-value="detailRecord.district" readonly />
          <van-field label="电话" :model-value="detailRecord.phone" readonly />
          <van-field
            v-if="detailRecord.longitude && detailRecord.latitude"
            label="GPS"
            :model-value="`${detailRecord.latitude.toFixed(6)}, ${detailRecord.longitude.toFixed(6)}`"
            readonly
          />
          <van-field
            v-if="detailRecord.positionPhotoPath"
            label="定位照"
            is-link
            :model-value="'点击查看'"
            @click="viewPhoto(detailRecord!.positionPhotoPath)"
          />
          <van-field
            v-if="detailRecord.environmentPhotoPath"
            label="环境照"
            is-link
            :model-value="'点击查看'"
            @click="viewPhoto(detailRecord!.environmentPhotoPath)"
          />
          <van-field label="记录时间" :model-value="formatTime(detailRecord.recordTime)" readonly />
        </van-cell-group>
        <div class="detail-spacer"></div>
      </div>
    </van-popup>

    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
.records-page { min-height: 100%; padding-bottom: 20px; }
.section { padding: 12px 16px 0; }
.section-title { font-size: 14px; font-weight: 600; color: #323233; margin-bottom: 8px; padding-left: 10px; border-left: 3px solid #1989fa; }
.record-actions { padding: 16px 0; }
.clear-btn { margin-top: 12px; }
.record-summary { margin-bottom: 2px; }
.delete-button { height: 100%; }
.detail-popup { padding: 16px 0 8px; }
.detail-header { display: flex; justify-content: space-between; align-items: center; padding: 0 16px 12px; }
.detail-title { font-size: 16px; font-weight: 600; color: #323233; }
.detail-spacer { height: 20px; }
.bottom-spacer { height: 60px; }
</style>