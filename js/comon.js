// 公共工具库：圆角矩形绘制 + 按钮系统
// 从 HappyHexs-v 的 comon.js 裁剪而来，已移除六边形游戏专属的依赖

// 辅助函数：绘制圆角矩形
export function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.arcTo(x + width, y, x + width, y + radius, radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
  ctx.lineTo(x + radius, y + height)
  ctx.arcTo(x, y + height, x, y + height - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

// 矢量箭头：图标文件不可用时兜底，保证按钮不会空白。
// 仅支持四个方向；未知方向返回 false，让调用方改用文字，避免画成误导性的箭头
const ARROW_ANGLES = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }

export function drawArrowIcon(ctx, direction, centerX, centerY, size, color = '#666666') {
  if (!(direction in ARROW_ANGLES)) return false

  const half = size / 2
  const head = size * 0.34

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(ARROW_ANGLES[direction])
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.5, size * 0.14)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-half, 0)
  ctx.lineTo(half - head * 0.5, 0)
  ctx.moveTo(half - head, -head)
  ctx.lineTo(half, 0)
  ctx.lineTo(half - head, head)
  ctx.stroke()
  ctx.restore()

  return true
}

// 按钮类
export class Button {
  constructor(id, x, y, width, height, text, options = {}) {
    this.id = id
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.text = text
    this.options = {
      backgroundColor: options.backgroundColor || '#4CAF50',
      hoverColor: options.hoverColor || '#45a049',
      textColor: options.textColor || '#FFFFFF',
      fontSize: options.fontSize || 24,
      borderRadius: options.borderRadius || 10,
      shadowBlur: options.shadowBlur === undefined ? 10 : options.shadowBlur,
      shadowColor: options.shadowColor || '#000000',
      isCircle: options.isCircle || false,
      onClick: options.onClick || null,
      // 图标：{ image, ready } 由 assets.js 的 loadIcon 返回；
      // iconFallback 为图标加载失败时绘制的矢量方向
      icon: options.icon || null,
      iconFallback: options.iconFallback || null,
      iconRatio: options.iconRatio || 0.52,
      iconColor: options.iconColor || '#666666'
    }
  }

  // 图标已就绪就画图片，否则退回矢量箭头，最后才用文字
  drawContent(ctx) {
    const { icon, iconFallback, iconRatio, iconColor } = this.options
    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2

    if (icon && icon.ready && icon.image && icon.image.width > 0) {
      const box = Math.min(this.width, this.height) * iconRatio
      const scale = Math.min(box / icon.image.width, box / icon.image.height)
      const drawWidth = icon.image.width * scale
      const drawHeight = icon.image.height * scale
      ctx.drawImage(
        icon.image,
        centerX - drawWidth / 2,
        centerY - drawHeight / 2,
        drawWidth,
        drawHeight
      )
      return
    }

    if (iconFallback) {
      const drawn = drawArrowIcon(ctx, iconFallback, centerX, centerY, Math.min(this.width, this.height) * iconRatio, iconColor)
      if (drawn) return
    }

    ctx.font = `bold ${this.options.fontSize}px Arial`
    ctx.fillStyle = this.options.textColor
    ctx.shadowColor = this.options.shadowColor
    ctx.shadowBlur = this.options.shadowBlur
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.text, centerX, centerY)
  }

  draw(ctx) {
    ctx.save()

    if (this.options.isCircle) {
      // 绘制圆形按钮
      ctx.beginPath()
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2)
      ctx.fillStyle = this.options.backgroundColor
      ctx.fill()
    } else {
      // 绘制矩形按钮
      drawRoundRect(ctx, this.x, this.y, this.width, this.height, this.options.borderRadius)

      // 创建渐变
      const gradient = ctx.createLinearGradient(
        this.x,
        this.y,
        this.x + this.width,
        this.y + this.height
      )
      gradient.addColorStop(0, this.options.backgroundColor)
      gradient.addColorStop(1, this.options.hoverColor)

      ctx.fillStyle = gradient
      ctx.fill()
    }

    // 绘制内容（图标 / 兜底箭头 / 文字）
    this.drawContent(ctx)

    ctx.restore()
  }

  isClicked(touch) {
    if (this.options.isCircle) {
      const centerX = this.x + this.width / 2
      const centerY = this.y + this.height / 2
      const distance = Math.sqrt(
        Math.pow(touch.clientX - centerX, 2) + Math.pow(touch.clientY - centerY, 2)
      )
      return distance <= this.width / 2
    }

    return touch.clientX >= this.x &&
      touch.clientX <= this.x + this.width &&
      touch.clientY >= this.y &&
      touch.clientY <= this.y + this.height
  }
}

// 按钮管理器
export class ButtonManager {
  constructor() {
    this.buttons = new Map()
  }

  addButton(id, x, y, width, height, text, options = {}) {
    const button = new Button(id, x, y, width, height, text, options)
    this.buttons.set(id, button)
    return button
  }

  removeButton(id) {
    this.buttons.delete(id)
  }

  getButton(id) {
    return this.buttons.get(id)
  }

  drawAll(ctx) {
    this.buttons.forEach(button => button.draw(ctx))
  }

  handleClick(touch) {
    this.buttons.forEach(button => {
      if (button.isClicked(touch) && button.options.onClick) {
        button.options.onClick(touch)
      }
    })
  }

  clear() {
    this.buttons.clear()
  }
}
