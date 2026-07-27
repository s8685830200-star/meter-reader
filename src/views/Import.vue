<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showToast, showLoadingToast, closeToast } from 'vant'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { importMeters, getMeterCount } from '@/services/storage'
import { parseExcelToMeters, generateTemplateBuffer } from '@/services/excel'

const importedCount = ref(0)
const importing = ref(false)
const lastImportInfo = ref<{ total: number; success: number; failed: number; errors: string[] } | null>(null)

onMounted(async () => { importedCount.value = await getMeterCount() })

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['xlsx', 'xls'].includes(ext)) { showToast('请选择 Excel 文件'); return }
  importing.value = true; lastImportInfo.value = null
  showLoadingToast({ message: '正在解析导入...', forbidClick: true, duration: 0 })
  try {
    const buffer = await file.arrayBuffer()
    const result = parseExcelToMeters(buffer)
    lastImportInfo.value = result
    if (result.meters.length > 0) {
      await importMeters(result.meters)
      importedCount.value = result.success
      showToast(`成功导入 ${result.success} 条`)
    }
    if (result.errors.length > 0) showToast({ message: `导入完成：成功 ${result.success}，失败 ${result.failed}`, duration: 3000 })
  } catch { showToast('文件读取失败') }
  finally { closeToast(); importing.value = false; input.value = '' }
}

async function downloadTemplate() {
  showLoadingToast({ message: '生成模板...', forbidClick: true, duration: 0 })
  try {
    const buffer = generateTemplateBuffer()
    const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1]
      await Filesystem.writeFile({ path: '抄表工具模板.xlsx', data: base64, directory: Directory.Data })
      showToast('模板已保存')
    }
    reader.readAsDataURL(blob)
  } catch { showToast('生成失败') }
  finally { closeToast() }
}
</script>

<template>
  <div class="import-page">
    <van-sticky><van-nav-bar title="数据导入" :border="true" /></van-sticky>
    <div class="section">
      <van-cell-group inset><van-cell title="已导入电表数量" :value="`${importedCount} 条`" /></van-cell-group>
    </div>
    <div class="section">
      <div class="section-title">导入电表数据</div>
      <van-cell-group inset class="instruction-card">
        <van-cell title="Excel 格式要求" />
        <van-cell title="必需列" label="电能表编号、户名、户号、台区、电话" />
        <van-cell title="文件格式" label=".xlsx 或 .xls" />
        <van-cell title="注意事项" label="导入会覆盖现有数据" />
      </van-cell-group>
      <div class="import-actions">
        <van-button type="primary" icon="plus" size="large" round :loading="importing">
          选择 Excel 文件
          <input type="file" accept=".xlsx,.xls" class="file-input-hidden" @change="handleFileSelect" />
        </van-button>
        <van-button plain hairline type="primary" icon="description" size="large" round @click="downloadTemplate" class="template-btn">下载 Excel 模板</van-button>
      </div>
    </div>
    <div v-if="lastImportInfo" class="section">
      <div class="section-title">导入结果</div>
      <van-cell-group inset>
        <van-cell title="总计" :value="`${lastImportInfo.total} 条`" />
        <van-cell title="成功" :value="`${lastImportInfo.success} 条`" value-class="text-success" />
        <van-cell title="失败" :value="`${lastImportInfo.failed} 条`" value-class="text-danger" />
      </van-cell-group>
      <van-cell-group v-if="lastImportInfo.errors.length > 0" inset class="error-list">
        <van-cell title="错误详情" />
        <van-cell v-for="(err, idx) in lastImportInfo.errors.slice(0, 10)" :key="idx" :value="err" />
      </van-cell-group>
    </div>
    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
.import-page { min-height: 100%; padding-bottom: 20px; }
.section { padding: 12px 16px 0; }
.section-title { font-size: 14px; font-weight: 600; color: #323233; margin-bottom: 8px; padding-left: 10px; border-left: 3px solid #1989fa; }
.import-actions { padding: 16px 0; position: relative; }
.file-input-hidden { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.template-btn { margin-top: 12px; }
.text-success { color: #07c160; }
.text-danger { color: #ee0a24; }
.error-list { margin-top: 12px; }
.bottom-spacer { height: 60px; }
</style>
