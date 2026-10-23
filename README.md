# 俄罗斯方块小游戏（TetrisM）

## 玩法
经典俄罗斯方块：左右移动、旋转、快速下落、消行得分、等级加速、暂停、最高分记录。

## 目录结构
```
TetrisM/
├── game.js              # 入口：创建画布 + 主循环
├── game.json            # 小游戏配置（竖屏）
├── project.config.json  # 微信开发者工具配置
├── js/
│   ├── tetris.js        # 主逻辑（TetrisGame 调度 + Game 纯逻辑）
│   ├── block.js         # 方块类（7 种形状）
│   ├── matrix.js        # 棋盘类（碰撞/消行/渲染）
│   ├── comon.js         # 公共工具（Button/ButtonManager）
│   └── audio.js         # 精简音频管理器
└── res/music/           # 音效（teris.mp3 / move.mp3）
```
