import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import Home from '@/views/Home.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  {
    path: '/home',
    name: 'Home',
    component: Home,
    meta: { title: '抄表' },
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('@/views/Import.vue'),
    meta: { title: '导入数据' },
  },
  {
    path: '/records',
    name: 'Records',
    component: () => import('@/views/Records.vue'),
    meta: { title: '抄表记录' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
