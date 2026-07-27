<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const active = ref(0)

const tabRoutes = [
  { name: 'Home', icon: 'home-o', title: '抄表' },
  { name: 'Import', icon: 'descending', title: '数据导入' },
  { name: 'Records', icon: 'records', title: '记录导出' },
]

watch(
  () => route.name,
  (name) => {
    const idx = tabRoutes.findIndex((t) => t.name === name)
    if (idx >= 0) active.value = idx
  },
  { immediate: true },
)

function onTabChange(index: number) {
  const target = tabRoutes[index]
  if (target) {
    router.push({ name: target.name })
  }
}
</script>

<template>
  <div class="app-container">
    <div class="app-content">
      <router-view />
    </div>
    <van-tabbar v-model="active" @change="onTabChange" active-color="#1989fa" border>
      <van-tabbar-item
        v-for="tab in tabRoutes"
        :key="tab.name"
        :icon="tab.icon"
      >
        {{ tab.title }}
      </van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f7f8fa;
  -webkit-font-smoothing: antialiased;
}
#app { width: 100%; height: 100%; }
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.app-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
