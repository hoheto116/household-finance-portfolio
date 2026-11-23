# ポートフォリオ用のサンプル

このディレクトリは**実運用システムとは独立した説明用デモ**です。家族の実データ、認証情報、API URL、LINEのチャネル情報は含みません。

- `demo-data.json`：架空の月次家計データ
- `calculation-demo.mjs`：主要な計算ルールを示す最小限のNode.jsサンプル（実アプリの計算エンジンそのものではありません）
- `monthly-demo.html`：ブラウザで開ける月次計算画面の再現HTML（実アプリとは接続しません）
- `line-flow.svg`：LINE登録→家族通知→Web計算の**説明図**（実画面キャプチャではありません）

## 試し方

```bash
node examples/calculation-demo.mjs
```

`examples/monthly-demo.html` はブラウザで直接開けます。サンプルの計算結果は振込額 **156,000円** です。

## 実アプリとの差異

本デモは構成や計算ルールの紹介が目的です。React、Cloudflare Workers、D1、R2、LINE Messaging APIは起動・接続していません。実際の画面キャプチャを掲載する場合は、テスト専用環境での再撮影または個人情報を除去した画像を別途追加します。
