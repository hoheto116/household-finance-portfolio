# 実運用画面 — 掲載準備

以下は実運用アプリの画面です。公開用画像は金額・氏名・請求書・本番URL・LINEアカウント名とアイコンをマスキングしています。計算表示の一部の0は表示形式を示すため残しています。架空データの独立デモとは異なります。

現在は画像登録待ちです。登録後にこのページとREADMEに画像を表示します。

| 画像ファイル | 画面 | 設計・実装のポイント |
| --- | --- | --- |
| line-registration.png | LINE入力・登録確認 | 確認・キャンセルを経て登録し、次の入力へ進む |
| line-notification.png | LINE通知・リッチメニュー | 家族への登録通知・証跡共有と項目別入力の入口 |
| monthly-calculation.png | Web月次計算 | 確定時の振込額と計算内訳を表示 |
| formula-editor.png | 計算式編集 | 演算と項目参照を組み合わせる再帰的な編集UI |
| custom-item.png | ユーザー項目追加 | 自動採番、区分・性質・入力方式・周期の設定 |
| family-invitation.png | 家族の招待・承認 | 24時間有効・1人限定の招待と管理者承認 |

関連実装：[計算エンジン](../showcase/calculation-engine.ts)、[計算式表示](../showcase/Formula.tsx)、[計算設定](../showcase/CalculationSettings.tsx)、[LINE通信](../showcase/line-client.ts)、[Web業務フロー](web-workflow.md)。

## 登録時の確認

- screenshots/ に上記6ファイルを登録する。LINE画像はアカウント名とアイコンも隠した修正版を使用する。
- 元画像や未加工画像を登録しない。
- 画像の表示・リンク・マスキングを確認してからREADMEへ掲載する。
