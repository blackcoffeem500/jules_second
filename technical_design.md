# Technical Design Document

## 1. 技術スタック
- **Language:** Javascript
- **UI Framework:** HTML5 Canvas
- **Graphics:** HTML5 Canvas
- **State Management:** None
- **Concurrency:** None

## 2. クラス設計
### Data Models
- `Ball`: 座標、速度、半径を保持。
- `Paddle`: 座標、幅、高さを保持。
- `Block`: 座標、耐久度、色を保持。
- `GameState`: ゲームの進行状況（Playing, Won, Lost, etc.）を保持。

### Components
- `GameViewModel`: 1/60秒ごとに状態を更新する `update()` 関数を持つ。
- `CollisionEngine`: 衝突判定の計算ロジックを分離。
- `GameScreen`: Canvasを用いてStateを描画する。

## 3. ゲームループの実装
`LaunchedEffect` 内で `withFrameNanos` を使用して、ディスプレイのリフレッシュレートに同期したループを構築する。

```kotlin
while (isActive) {
    withFrameNanos { frameTime ->
        viewModel.update(frameTime)
    }
}
