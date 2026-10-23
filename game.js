// 俄罗斯方块 - 微信小游戏入口

import { TetrisGame } from './js/tetris.js'

// 创建画布
const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')

// 初始化游戏
const game = new TetrisGame(canvas, ctx)
game.start()

// 主循环
function loop() {
  game.update()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
