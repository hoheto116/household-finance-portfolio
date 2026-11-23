# 実装コードの抜粋（応募用）

このディレクトリには、実運用している家計管理アプリのリポジトリから取得した**実装ファイルのコピー**を掲載しています。家族の家計データ・認証情報・画像は含みません。

| ファイル | アピールできる設計・実装 |
| --- | --- |
| [calculation-engine.ts](calculation-engine.ts) | 計算式の検証、循環参照検出、BigInt有理数演算、丸め処理、計算過程の記録 |
| [Formula.tsx](Formula.tsx) | 計算過程を日本語ラベル付きで可視化するReactコンポーネント |
| [MonthlyOverview.tsx](MonthlyOverview.tsx) | 月次処理の状態と金額を一覧化するReactコンポーネント |
| [CalculationSettings.tsx](CalculationSettings.tsx) | 再帰的な式編集UI、設定リビジョンによる更新制御 |
| [MonthlyDetails.tsx](MonthlyDetails.tsx) | 月次詳細、確定結果、証跡表示、AbortControllerによる取得制御 |
| [line-domain.ts](line-domain.ts) | LINE Webhook署名検証（HMAC-SHA256）、円金額のパース、画像形式判定 |
| [line-client.ts](line-client.ts) | LINE返信メッセージ構築、API通信、画像のサイズ・転送制御 |
| [line-notification-images.ts](line-notification-images.ts) | 非公開R2画像を期限付きトークンで配信する制御 |
| [selected-tests.test.mjs](selected-tests.test.mjs) | 認証・CSRF、式の不正入力・循環参照、LINE署名のテストを実テストから抜粋 |

## AIを活用した開発で担当したこと

課題・要件と設計方針の整理、Codexへの実装依頼、実機での確認、問題点のフィードバックと修正指示を担当しました。コードをAIに生成させたことと、コードの正しさを検証したことは区別して説明します。

## 注記

これらは**単体で起動できるサンプルアプリではありません**。元のアプリの型・コンポーネント・APIとの連携を前提としたファイルです。特にReactコンポーネントは元リポジトリのCSSや型定義を参照します。手軽に動作を確認したい場合は [examples](../examples/README.md) の独立デモを利用してください。

LINE連携の署名検証・通信・画像配信処理は掲載済みです。Webhook全体のルーティングは未掲載です。テストは元の結合テストから抜粋したもので、単独実行はできません。
