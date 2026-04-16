import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/pdf/compress' },
    { path: '/pdf/compress',    component: () => import('../views/pdf/PdfCompress.vue') },
    { path: '/pdf/merge',       component: () => import('../views/pdf/PdfMerge.vue') },
    { path: '/pdf/split',       component: () => import('../views/pdf/PdfSplit.vue') },
    { path: '/pdf/rotate',      component: () => import('../views/pdf/PdfRotate.vue') },
    { path: '/pdf/pages',       component: () => import('../views/pdf/PdfPages.vue') },
    { path: '/pdf/compare',     component: () => import('../views/pdf/PdfCompare.vue') },
    { path: '/convert/img-to-pdf', component: () => import('../views/convert/ImgToPdf.vue') },
    { path: '/convert/pdf-to-img', component: () => import('../views/convert/PdfToImg.vue') },
    { path: '/qrcode',          component: () => import('../views/qrcode/QrCode.vue') },
    { path: '/text/hash',       component: () => import('../views/text/Hash.vue') },
    { path: '/text/diff',       component: () => import('../views/text/TextDiff.vue') },
    { path: '/text/escape',     component: () => import('../views/text/TextEscape.vue') },
    { path: '/text/json',       component: () => import('../views/text/JsonFormat.vue') },
    { path: '/image/compress',  component: () => import('../views/image/ImgCompress.vue') },
    { path: '/image/convert',   component: () => import('../views/image/ImgConvert.vue') },
  ],
})

export default router
