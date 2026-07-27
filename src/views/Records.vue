<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showToast, showConfirmDialog, showLoadingToast, closeToast } from 'vant'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { getAllRecords, deleteRecord, clearRecords, getRecordCount } from '@/services/storage'
import { recordsToExcelBuffer } from '@/services/excel'
import type { MeterRecord } from '@/types'

const records = ref<MeterRecord[]>([])
const loading = ref(false)
const exporting = ref(false)
const recordCount = ref(0)

async function loadRecords() {
  loading.value = true
  records.value = await getAllRecords()
  recordCount.value = records.value.length
  loading.value = false
}
onMounted(loadRecords)

async function exportRecords() {
  if (records.value.length === 0) { showToast('暂无记录'); return }
  exporting.value = true
  showLoadingToast({ message: '正在生成...', forbidClick: true, duration: 0 })
  try {
    const buffer = recordsToExcelBuffer(records.value)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const timestamp = new Date().toISOString().slice(0, 10)
      const fileName = `抄表记录_${timestamp}.xlsx`
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Data })
      closeToast(); showToast('Excel 已生成')
      const confirmed = await showConfirmDialog({ title: '导出成功', message: `文件 "${fileName}" 已保存，是否分享？`, confirmButtonText: '分享', cancelButtonText: '关闭' })
      if (confirmed) await Share.share({ title: '抄表记录', files: [fileName] })
    }
    reader.readAsDataURL(new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  } catch { closeToast(); showToast('导出失败') }
  finally { exporting.value = false }
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
</script>

<template>
  <div class="records-page">
    <van-sticky><van-nav-bar title="抄表记录" :border="true" /></van-sticky>
    <div class="section">
      <van-cell-group inset><van-cell title="抄表记录数" :value="`${recordCount} 条`" /></van-cell-group>
      <div class="record-actions">
        <van-button type="primary" icon="records" size="large" round :loading="exporting" :disabled="records.length === 0" @click="exportRecords">导出为 Excel</van-button>
        <van-button v-if="records.length > 0" plain hairline type="danger" icon="delete" size="large" round @click="handleClearAll" class="clear-btn">清空全部记录</van-button>
      </div>
    </div>
    <div class="section">
      <div class="section-title">记录列表</div>
      <van-pull-refresh v-model="loading" @refresh="loadRecords">
        <van-list v-model:loading="loading" :finished="true" finished-text="没有更多了">
          <van-swipe-cell v-for="record in records" :key="record.id">
            <van-cell-group inset class="record-card">
              <van-cell :title="record.meterNo" :label="record.userName" :value="formatTime(record.recordTime)" />
              <van-cell title="户号" :value="record.userNo" />
              <van-cell title="台区" :value="record.district" />
              <van-cell title="电话" :value="record.phone" />
              <van-cell v-if="record.longitude && record.latitude" title="GPS" :value="`${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`" />
              <van-cell v-if="record.positionPhotoPath" title="定位照" :value="record.positionPhotoPath" />
              <van-cell v-if="record.environmentPhotoPath" title="环境照" :value="record.environmentPhotoPath" />
            </van-cell-group>
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
    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
.records-page { min-height: 100%; padding-bottom: 20px; }
.section { padding: 12px 16px 0; }
.section-title { font-size: 14px; font-weight: 600; color: #323233; margin-bottom: 8px; padding-left: 10px; border-left: 3px solid #1989fa; }
.record-actions { padding: 16px 0; }
.clear-btn { margin-top: 12px; }
.record-card { margin-bottom: 8px; }
.delete-button { height: 100%; }
.bottom-spacer { height: 60px; }
</style>
