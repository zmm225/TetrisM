// 精简音频管理器：只保留俄罗斯方块需要的音效
// 从 HappyHexs-v 的 entry/music.js 裁剪而来，已移除 wx.globalData 依赖

class AudioManager {
  constructor() {
    this.enabled = true
    this.audioContexts = {}
    this.moveTimer = null
  }

  init() {
    if (!wx.createInnerAudioContext) {
      this.enabled = false
      return
    }
    this.audioContexts = {
      teris: this._create('res/music/teris.mp3'),
      move: this._create('res/music/move.mp3')
    }
  }

  _create(src) {
    const audio = wx.createInnerAudioContext()
    audio.src = src
    return audio
  }

  // 播放某音频文件的片段（从 startTime 开始，持续 duration 秒）
  _playSegment(key, startTime, duration) {
    if (!this.enabled) return
    const ctx = this.audioContexts[key]
    if (!ctx) return
    ctx.stop()
    ctx.seek(startTime)
    ctx.play()
    return setTimeout(() => ctx.stop(), duration * 1000)
  }

  // 游戏开始音效
  start2() { this._playSegment('teris', 3.7202, 3.6224) }

  // 消行音效
  clear() { this._playSegment('teris', 0, 0.7675) }

  // 下落音效
  fall() { this._playSegment('teris', 1.2558, 0.3546) }

  // 左右移动音效
  move2() { this._playSegment('teris', 2.9088, 0.1437) }

  // 旋转音效
  rotate() { this._playSegment('teris', 2.2471, 0.0807) }

  // 游戏结束音效
  gameover2() { this._playSegment('teris', 8.1276, 1.1437) }

  // 按钮移动音效（带防抖）
  move() {
    if (this.moveTimer) {
      clearTimeout(this.moveTimer)
    }
    this.moveTimer = this._playSegment('move', 0, 0.2)
  }
}

export const audioManager = new AudioManager()
