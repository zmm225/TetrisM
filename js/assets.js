// 图标资源加载：微信小游戏用 wx.createImage，环境不支持时标记失败交由调用方兜底
const iconCache = new Map()

export function loadIcon(src) {
  if (iconCache.has(src)) return iconCache.get(src)

  const entry = { src, image: null, ready: false, failed: false }
  iconCache.set(src, entry)

  const createImage = typeof wx !== 'undefined' && typeof wx.createImage === 'function'
    ? wx.createImage.bind(wx)
    : null

  if (!createImage) {
    entry.failed = true
    return entry
  }

  const image = createImage()
  image.onload = () => {
    // 部分平台 SVG 能触发 onload 但解不出尺寸，此时按失败处理
    entry.ready = !!(image.width > 0 && image.height > 0)
    entry.failed = !entry.ready
  }
  image.onerror = () => {
    entry.ready = false
    entry.failed = true
  }
  image.src = src
  entry.image = image

  return entry
}
