// 俄罗斯方块主逻辑（独立自包含版）
// 从 HappyHexs-v 的 pages/teris.js 抽取，已移除所有 wx.globalData 依赖

import { Block } from './block.js'
import { Matrix } from './matrix.js'
import { Button, ButtonManager } from './comon.js'
import { audioManager } from './audio.js'
import { loadIcon } from './assets.js'

// 单帧最大步进时间：切后台/掉帧后避免一次落下多格
const MAX_FRAME_MS = 100

// 长按连发配置：首次触发延迟、连发间隔（毫秒），action 为类方法名
const REPEAT_BUTTONS = {
  left: { delay: 180, interval: 90, action: 'moveBlockLeft' },
  right: { delay: 180, interval: 90, action: 'moveBlockRight' },
  down: { delay: 260, interval: 120, action: 'stepBlockDown' }
}

// 与 res/icon 灰色图标(#666666)协作的中性浅色主题
const THEME = {
  backgroundTop: '#F4F6F9',
  backgroundBottom: '#D9E1E8',
  surface: '#FFFFFF',
  surfaceEnd: '#E4EAF0',
  iconColor: '#5B6672',
  textPrimary: '#39434D',
  textMuted: '#6B7681',
  textValue: '#C2410C',
  accent: '#F59E0B',
  accentEnd: '#E08700',
  danger: '#E5484D',
  dangerEnd: '#C4272C'
}

// 控制按钮的图标文件（键名即 this.icons 的键，新增图标只改这里）
const ICON_SOURCES = {
  left: 'res/icon/direction-left.svg',
  right: 'res/icon/direction-right.svg',
  down: 'res/icon/direction-down.svg',
  rotate: 'res/icon/forward.svg',
  pause: 'res/icon/timeout.svg',
  play: 'res/icon/play-circle.svg'
}

export class TetrisGame {
  constructor(canvas, ctx) {
    this.canvas = canvas
    this.ctx = ctx

    // 屏幕参数
    this.pixelRatio = 1
    this.logicalWidth = 0
    this.logicalHeight = 0
    this.blockSize = 17
    this.baseSize = 0

    // 游戏对象
    this.matrix = null
    this.block = null
    this.nextBlock = null

    // 游戏状态
    this.score = 0
    this.maxScore = 0
    this.level = 1
    this.speed = 1000 // 自动下落间隔（毫秒/格）
    this.lockDelay = 500 // 落地后的锁定宽限（毫秒），期间仍可左右微调
    this.lockTimer = 0
    this.gameOver = false
    this.isPaused = false
    this.lastFrameTime = null

    // 长按连发状态
    this.repeatButton = null
    this.repeatTimer = 0
    this.repeatFired = false
    this.repeatTouchId = null

    // 图标资源（异步加载，就绪后下一帧自动生效）
    this.icons = {}

    // 按钮管理器
    this.buttonManager = new ButtonManager()
  }

  // 初始化并启动
  start() {
    // 获取设备信息(旧方法)
    // const info = wx.getSystemInfoSync()
    const win = wx.getWindowInfo() ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.pixelRatio = win.pixelRatio || 1//设备像素比
    this.logicalWidth = win.windowWidth//逻辑宽度
    this.logicalHeight = win.windowHeight//逻辑高度

    // 高清适配：设置物理像素尺寸，并缩放上下文，之后统一用逻辑坐标绘制
    this.canvas.width = this.logicalWidth * this.pixelRatio
    this.canvas.height = this.logicalHeight * this.pixelRatio
    this.ctx.scale(this.pixelRatio, this.pixelRatio)

    // 方块大小：逻辑宽度 / 17（棋盘 10 列 + 留出右侧分数区）
    this.blockSize = this.logicalWidth / 17

    // 初始化棋盘和方块
    this.matrix = new Matrix(this.blockSize)
    this.nextBlock = new Block()
    this.createNewBlock()
    this.loadGameState()

    // 自适应基础尺寸 + 一次性创建按钮（不再每帧重建）
    this.baseSize = Math.min(this.logicalWidth / 10, this.logicalHeight / 14)
    this.icons = {}
    for (const key of Object.keys(ICON_SOURCES)) {
      this.icons[key] = loadIcon(ICON_SOURCES[key])
    }
    this.layoutButtons()

    // 注册触摸事件
    this.bindTouchEvents()

    // 播放开始音效
    // audioManager.init()
    // audioManager.start2()

    // console.log('俄罗斯方块启动', this.logicalWidth, this.logicalHeight, this.blockSize)
  }

  // 主循环每帧调用，now 可传入时间戳（默认取 Date.now()）
  update(now) {
    const time = now == null ? Date.now() : now
    if (this.lastFrameTime == null) this.lastFrameTime = time

    let dt = time - this.lastFrameTime
    this.lastFrameTime = time
    if (dt < 0) dt = 0
    if (dt > MAX_FRAME_MS) dt = MAX_FRAME_MS

    if (!this.gameOver && !this.isPaused) {
      this.updateLogic(dt)
      this.updateRepeat(dt)
    } else {
      this.clearRepeat()
    }

    this.render()
  }

  // 下落逻辑（dt 为毫秒）
  updateLogic(dt) {
    if (this.canBlockMove(this.block, 0, 1)) {
      this.block.updateDown(dt, this.speed, (dy) => this.canBlockMove(this.block, 0, dy))
      this.lockTimer = this.lockDelay
      return
    }

    // 已落地：锁定宽限内仍可左右微调，超时后固化并换新块
    this.lockTimer -= dt
    if (this.lockTimer > 0) return

    this.mergeBlock()
    this.checkLines()
    this.createNewBlock()
  }

  createNewBlock() {
    this.block = this.nextBlock
    this.nextBlock = new Block()
    this.lockTimer = this.lockDelay

    if (!this.canBlockMove(this.block)) {
      this.gameOver = true
      audioManager.gameover2()
      this.saveGameState()
      wx.showModal({
        title: '游戏结束',
        content: '得分：' + this.score,
        showCancel: false,
        success: () => {
          this.resetGame()
        }
      })
    }
  }

  // ============ 渲染 ============

  render() {
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight)
    this.drawBackground()

    // 绘制游戏区域（棋盘 + 当前方块）
    this.matrix.render(this.ctx, this.block)

    // 绘制分数和等级（含"下一个"方块）
    this.renderScore()

    // 暂停遮罩最后画，保证覆盖棋盘
    this.drawPauseOverlay()
  }

  // 一次性创建/布局所有按钮（尺寸变化时再调用）
  layoutButtons() {
    this.buttonManager.clear()

    const baseSize = this.baseSize
    const buttonWidth = baseSize * 2
    const buttonHeight = baseSize
    const horizontalSpacing = baseSize
    const verticalSpacing = baseSize * 0.8

    // "重新开始"按钮 - 左上角
    this.buttonManager.addButton(
      'restart',
      baseSize * 0.5,
      baseSize,
      buttonWidth,
      buttonHeight,
      '重开',
      {
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        hoverColor: 'rgba(255, 255, 255, 0.72)',
        textColor: THEME.textPrimary,
        shadowBlur: 0,
        fontSize: Math.floor(baseSize * 0.4)
      }
    )
    // 带图标的控制按钮统一样式；fallback 为图标不可用时绘制的箭头方向
    const controlOptions = (iconKey, fallback = null) => ({
      backgroundColor: THEME.surface,
      hoverColor: THEME.surfaceEnd,
      textColor: THEME.textPrimary,
      icon: this.icons[iconKey],
      iconFallback: fallback,
      iconColor: THEME.iconColor,
      fontSize: Math.floor(baseSize * 0.45),
      shadowBlur: 0
    })

    // 暂停按钮 - 重开按钮右侧
    this.buttonManager.addButton(
      'pause',
      baseSize * 0.5 + buttonWidth + horizontalSpacing,
      baseSize,
      buttonWidth,
      buttonHeight,
      this.isPaused ? '继续' : '暂停',
      controlOptions(this.isPaused ? 'play' : 'pause')
    )

    // 控制按钮区域
    const bottomPadding = baseSize * 0.5
    const controlAreaWidth = buttonWidth * 2 + horizontalSpacing
    const controlStartX = (this.logicalWidth - controlAreaWidth) / 2
    const firstRowY = this.logicalHeight - bottomPadding - buttonHeight * 1.5 - verticalSpacing
    const secondRowY = this.logicalHeight - bottomPadding - buttonHeight

    // 左移按钮（第一排左）
    this.buttonManager.addButton('left', controlStartX - buttonWidth, firstRowY, buttonWidth, buttonHeight, '左移', controlOptions('left', 'left'))
    // 右移按钮（第一排右）
    this.buttonManager.addButton('right', controlStartX + buttonWidth, firstRowY, buttonWidth, buttonHeight, '右移', controlOptions('right', 'right'))
    // 下移按钮（第二排左）
    this.buttonManager.addButton('down', controlStartX, secondRowY, buttonWidth, buttonHeight, '下移', controlOptions('down', 'down'))
    // 旋转按钮（第二排右）：图标不可用时退回「旋转」文字，不要画成左右箭头
    this.buttonManager.addButton('rotate', controlStartX + buttonWidth * 2 + horizontalSpacing, secondRowY - buttonHeight, buttonWidth, buttonHeight * 1.5, '旋转', controlOptions('rotate'))

    this.syncPauseButton()
  }

  drawBackground() {
    const ctx = this.ctx

    // 中性浅色渐变：与灰色图标、灰色棋盘统一色系
    const gradient = ctx.createLinearGradient(0, 0, 0, this.logicalHeight)
    gradient.addColorStop(0, THEME.backgroundTop)
    gradient.addColorStop(1, THEME.backgroundBottom)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)

    // 绘制所有按钮
    this.buttonManager.drawAll(ctx)
  }

  // 暂停遮罩：必须画在棋盘之上，否则会被棋盘挡住
  drawPauseOverlay() {
    if (!this.isPaused) return

    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(31, 41, 51, 0.55)'
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)
    const pauseTextSize = this.baseSize * 0.8
    ctx.font = `bold ${pauseTextSize}px Arial`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('游戏暂停', this.logicalWidth / 2, this.logicalHeight / 2)
    ctx.restore()
  }

  renderScore() {
    const ctx = this.ctx
    ctx.save()
    ctx.font = '20px Arial'
    const X = this.logicalWidth - this.blockSize * 5
    const Y = this.blockSize * 4
    ctx.fillStyle = THEME.textPrimary
    ctx.fillText('分数：', X, Y + this.blockSize * 2)
    ctx.fillStyle = THEME.textValue
    ctx.fillText(this.score, X, Y + this.blockSize * 4)
    ctx.fillStyle = THEME.textPrimary
    ctx.fillText('等级：' + this.level, X, Y + this.blockSize * 6)
    ctx.fillText('最高分：', X, Y + this.blockSize * 8)
    ctx.fillStyle = THEME.textValue
    ctx.fillText(this.maxScore, X, Y + this.blockSize * 10)
    ctx.fillStyle = THEME.textPrimary
    ctx.fillText('下一个：', X, Y + this.blockSize * 12)
    this.renderNextBlock(X, Y + this.blockSize * 14)
    ctx.restore()
  }

  renderNextBlock(X, Y) {
    if (this.nextBlock) {
      this.nextBlock.renderNext(this.ctx, this.blockSize, X, Y)
    }
  }

  // ============ 操作 ============

  moveBlockLeft() {
    if (this.canBlockMove(this.block, -1, 0)) {
      this.block.moveLeft()
      audioManager.move2()
    }
  }

  moveBlockRight() {
    if (this.canBlockMove(this.block, 1, 0)) {
      this.block.moveRight()
      audioManager.move2()
    }
  }

  moveBlockDown() {
    let maxIndex = 0
    for (let i = 0; i <= 20; i++) {
      if (this.canBlockMove(this.block, 0, i)) {
        maxIndex = i
      } else {
        break
      }
    }
    this.block.moveDown(maxIndex)
    this.lockTimer = this.lockDelay
  }

  // 软降一格（长按下移时的连发动作）
  stepBlockDown() {
    if (this.canBlockMove(this.block, 0, 1)) {
      this.block.moveDown(1)
      this.lockTimer = this.lockDelay
    }
  }

  rotateBlock() {
    const rotatedBlock = this.block.getRotatedBlock()
    if (this.canBlockMove(rotatedBlock)) {
      this.block.rotate()
      audioManager.rotate()
    }
  }

  canBlockMove(block, offsetX = 0, offsetY = 0) {
    return this.matrix.canBlockFit(block, offsetX, offsetY)
  }

  mergeBlock() {
    this.matrix.mergeBlock(this.block)
    audioManager.fall()
  }

  checkLines() {
    const lines = this.matrix.checkLines()
    if (lines > 0) {
      this.updateScore(lines)
      audioManager.clear()
    }
  }

  updateScore(lines) {
    const scores = [0, 100, 300, 700, 1500]
    this.score += scores[lines]

    // 更新等级（每 1000 分升一级，下落加速：每级 -83ms，最快 333ms/格）
    const newLevel = Math.floor(this.score / 1000) + 1
    if (newLevel !== this.level) {
      this.level = newLevel
      this.speed = Math.max(333, 1000 - (this.level - 1) * 83)
    }

    this.saveGameState()
  }

  saveGameState() {
    if (this.maxScore < this.score) {
      this.maxScore = this.score
    }
    wx.setStorage({
      key: 'tetris_state',
      data: { maxScore: this.maxScore }
    })
  }

  loadGameState() {
    wx.getStorage({
      key: 'tetris_state',
      success: (res) => {
        const { maxScore } = res.data
        if (maxScore != null && maxScore != undefined) {
          this.maxScore = maxScore
        }
      }
    })
  }

  resetGame() {
    this.score = 0
    this.level = 1
    this.speed = 1000
    this.gameOver = false
    this.isPaused = false
    this.lockTimer = this.lockDelay
    this.clearRepeat()
    this.matrix.reset()
    this.nextBlock = new Block()
    this.createNewBlock()
    this.saveGameState()
    this.syncPauseButton()
    audioManager.start2()
  }

  pause() {
    this.isPaused = true
    this.clearRepeat()
    this.syncPauseButton()
  }

  resume() {
    this.isPaused = false
    this.syncPauseButton()
  }

  syncPauseButton() {
    const button = this.buttonManager.getButton('pause')
    if (!button) return

    // 暂停按钮同时有文字与图标，两者都要跟着状态切换
    button.text = this.isPaused ? '继续' : '暂停'
    button.options.icon = this.icons[this.isPaused ? 'play' : 'pause']
  }

  // ============ 触摸事件 ============

  bindTouchEvents() {
    if (this._onTouchStart) return

    this._onTouchStart = this.handleTouchStart.bind(this)
    this._onTouchEnd = this.handleTouchEnd.bind(this)

    wx.onTouchStart(this._onTouchStart)
    wx.onTouchEnd(this._onTouchEnd)
    wx.onTouchCancel(this._onTouchEnd)
  }

  // 销毁时移除监听，避免重复实例叠加触发
  destroy() {
    if (!this._onTouchStart) return

    wx.offTouchStart(this._onTouchStart)
    wx.offTouchEnd(this._onTouchEnd)
    wx.offTouchCancel(this._onTouchEnd)
    this._onTouchStart = null
    this._onTouchEnd = null
    this.clearRepeat()
  }

  getTouch(e) {
    const list = e.changedTouches && e.changedTouches.length ? e.changedTouches : e.touches
    return list && list.length ? list[0] : null
  }

  handleTouchStart(e) {
    const touch = this.getTouch(e)
    if (!touch) return

    const id = this.dispatchTouch(touch)
    const config = id ? REPEAT_BUTTONS[id] : null

    if (!config || this.isPaused || this.gameOver) {
      this.clearRepeat()
      return
    }

    this.repeatButton = id
    this.repeatTimer = 0
    this.repeatFired = false
    this.repeatTouchId = touch.identifier
  }

  handleTouchEnd(e) {
    // 多指操作时，只响应发起连发那根手指的抬起
    const list = e.changedTouches
    if (list && list.length && this.repeatTouchId != null) {
      if (!list.some(t => t.identifier === this.repeatTouchId)) return
    }
    this.clearRepeat()
  }

  // 分发按下事件，返回命中的按钮 id（未命中返回 null）
  dispatchTouch(touch) {
    // 重新开始按钮
    const restartButton = this.buttonManager.getButton('restart')
    if (restartButton && restartButton.isClicked(touch)) {
      this.resetGame()
      return 'restart'
    }

    // 暂停按钮
    const pauseButton = this.buttonManager.getButton('pause')
    if (pauseButton && pauseButton.isClicked(touch)) {
      if (this.isPaused) {
        this.resume()
      } else {
        this.pause()
      }
      audioManager.move()
      return 'pause'
    }

    // 暂停时不再响应移动/旋转
    if (this.isPaused) return null

    const leftButton = this.buttonManager.getButton('left')
    if (leftButton && leftButton.isClicked(touch)) {
      this.moveBlockLeft()
      return 'left'
    }

    const rightButton = this.buttonManager.getButton('right')
    if (rightButton && rightButton.isClicked(touch)) {
      this.moveBlockRight()
      return 'right'
    }

    const downButton = this.buttonManager.getButton('down')
    if (downButton && downButton.isClicked(touch)) {
      this.moveBlockDown()
      return 'down'
    }

    const rotateButton = this.buttonManager.getButton('rotate')
    if (rotateButton && rotateButton.isClicked(touch)) {
      this.rotateBlock()
      return 'rotate'
    }

    return null
  }

  // 长按连发：首次等 delay，之后按 interval 重复执行
  updateRepeat(dt) {
    if (!this.repeatButton) return

    const config = REPEAT_BUTTONS[this.repeatButton]
    if (!config) {
      this.clearRepeat()
      return
    }

    this.repeatTimer += dt
    const wait = this.repeatFired ? config.interval : config.delay
    if (this.repeatTimer < wait) return

    this.repeatTimer -= wait
    this.repeatFired = true
    this[config.action]()
  }

  clearRepeat() {
    this.repeatButton = null
    this.repeatTimer = 0
    this.repeatFired = false
    this.repeatTouchId = null
  }
}
