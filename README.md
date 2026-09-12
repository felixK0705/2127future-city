# 2127 未来都市デザイナー（合成版）

政策設計器と未来シミュレーターを、単一の React 19 + TypeScript + Vite アプリとして統合した展示用 Web 体験です。サイト本体は日本語単語系です。

## 参照元から受け継いだもの

- 政策設計器：5政策、五つの連続指標、レーダー、集合データ、都市通信、PNG、共有 URL、API サーバー。
- 未来シミュレーター：四つの内部判定軸、16類型、固定文案、決定的 RNG、Canvas2D 等距ジオラマ、時間移動、市民番号。
- PixiJS と Three.js は使用していません。参照プロジェクトへの実行時依存もありません。

## 起動

```bash
npm install
npm run dev
```

本番相当：

```bash
npm run build
npm start
```

確認用：

```bash
npm run verify
npm run preview
```

`.env.example` を `.env` にコピーすると OpenAI を任意で利用できます。

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
PORT=4173
```

鍵が無い場合、または15秒以内に応答しない場合も、決定的に組み立てた日本語の展示稿で最後まで体験できます。鍵は Vite のサーバー側と `server.mjs` だけが読み、クライアントへ公開しません。

## 二層スコア

### 五つの都市指標

環境、自由、公平、利便性、文化的多様性を50から開始し、選んだ政策の効果を加算して0〜100へ収めます。上位二つを「得たもの」、下位二つを「手放したもの」とします。効果値は政策設計器と同一です。

### 16類型

内部だけで使う四つの二値軸を、各軸の主政策（重み2）と移動政策（重み1）から判定します。画面、PNG、共有 URL には内部軸名・極コード・類型 ID を出しません。

| 政策 | 選択肢 | 内部 lean |
|---|---|---|
| エネルギー（主：成長、重み2） | solar-commons | growth -1, power -1, openness +1 |
|  | fusion-grid | growth +1, power +1, governance -1 |
|  | energy-ration | growth -1, governance -1, power +1 |
| 移動（副、重み1） | walkable-cells | growth -1, governance +1 |
|  | autonomous-flow | governance -1, power +1 |
|  | free-transit | openness +1, power -1 |
| 法（主：統治、重み2） | predictive-law | governance -1, power +1, openness -1 |
|  | citizen-jury | governance +1, power -1, openness +1 |
|  | personal-contract | governance +1, power -1 |
| 教育（主：権力、重み2） | ai-tutor | power +1, governance -1 |
|  | learning-commons | power -1, openness +1 |
|  | universal-curriculum | power +1, openness -1 |
| 文化（主：開放、重み2） | living-archives | openness +1, growth -1 |
|  | algorithmic-culture | openness -1, power +1 |
|  | open-festival | openness +1, governance +1, power -1 |

主軸の判定には対応する主政策の lean と移動政策の lean を使います。その他の lean も政策データに保持し、説明・拡張用の意味を失わないようにしています。

## 決定性

`npm run verify` は243通りを列挙し、次を検証します。

- 全組み合わせで内部軸が0にならない。
- 16類型がすべて少なくとも一度現れる。
- 指標、類型、街区、静的説明、市民番号を再計算しても同じになる。
- 表示用の静的成果物に内部 ID と誤った年号が混ざらない。

現在の結果：243/243成功、0軸なし、16/16類型到達、非決定的成果物0件。

## 手動確認

- [x] 375px とデスクトップで intro を表示し、日本語のみであることを確認。
- [x] 5問を順に選び、選択数とレーダーが更新されることを確認。
- [x] 時間移動（省略可能）後に Canvas2D ジオラマと類型称号が出ることを確認。
- [x] 静的因果説明と、鍵なし時の日本語都市通信を確認。
- [x] 集合人数、平均、政策割合、同じ種類の人数を確認。
- [x] 都市名、双面カード、市民番号、訪問日、PNG 用データを確認。
- [x] 五政策と都市名だけの共有 URL から同じ記念品へ直接復元できることを確認。
- [x] 反省画面から再設計できることを確認。
- [x] Canvas が使えない場合と `prefers-reduced-motion` で SVG 静止画へ退避する実装を確認。
- [x] `npm run verify` と `npm run build` を実行。

オフライン時は Google Fonts の取得だけが省略され、端末の日本語フォントへフォールバックします。アプリ本体、ジオラマ、展示稿、集計、PNG はネットワーク無しで動作します。
