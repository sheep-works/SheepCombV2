# Parser ロジックの一本化と ShuttleCore のフロー化

現在、単にファイルから文字列を対訳で抽出する SimpleParser と、高度な構造化を行う SheepShuttle が混在している状態です。
当初はこれで問題ないと考えていましたが、やはり一本化をしたいです。

そのためのフローを考えました。修正をお願いします。

## SheepShuttle の現状
SheepShuttle はファイルを取り込み、fromFiles で直接、ShWvData 形式に変換している。
この処理を SimpleParser 経由でいったんテキストを抽出し、それに対して構造化ができるようにしたい。

## 目標となるSheepShuttleの構造

### サブクラス構造

以下のように複数のサブクラスを持つ、オーケストレーターとしたい。

SheepShuttle
├─ ShuttleParser       ：ファイルからテキストを抽出し、TranslationPair[] とファイル情報（ShWvFileInfo）を返す。XLF等の構造化ファイルの場合は isSub の判定もここで行う。
├─ ShuttleProcessor    ：構築中。TranslationPair[] に対し、フィルタやクレンジングを行い、ユーザーの欲しい形式に調整する。
├─ ShuttleConverter    ：TranslationPair[] と ShWvFileInfo[] をもとに、ShWvData 形式に変換する。この際、タグ保護（{@idx}）の処理も行う。
├─ ShuttleAnalyzer     ：現在のShWvDifferの役割。ShWvData[] をもとに、TMとTBの分析を行う。
├─ ShuttleManager      ：ShWvData[] をよりシンプルなJSON（TM用など）に変換する。現在のexportAsTmなどをまとめて持っておく。
├─ ShuttleBuilder      ：ShWvData[] と元のXLFライクファイルをもとに、訳文となるXLFファイルを生成する。現在のxliffExporter.tsの役割。
└─ ShuttleAPI          ：構築中。HTTPリクエストを処理するためのメソッドを持つ予定。

### 保持するステート

- SheepShuttle.units: TranslationUnit[]
- SheepShuttle.files: ShWvFileInfo[]
- SheepShuttle.data: ShWvData

SheepShuttle.units は現在の各download系メソッドのように、これだけでも出力できるようにしておく。

### 処理の流れ

以下のように各サブクラスを組み合わせて、様々なニーズに対応する。

#### 対訳ファイルから抽出

SheepShuttle.ShttleParser.parse()

#### 対訳ファイルから抽出してフィルタ

SheepShuttle.ShttleParser.parse()
-> SheepShuttle.ShuttleProcessor.filter()

#### 対訳ファイルからShWvDataを生成

SheepShuttle.ShttleParser.parse()
-> SheepShuttle.ShuttleProcessor.filter()
-> SheepShuttle.ShuttleConverter.convert()
-> SheepShuttle.ShuttleAnalyzer.analyze()

#### 対訳ファイルからShWvDataを生成し、さらに変換

SheepShuttle.ShttleParser.parse()
-> SheepShuttle.ShuttleProcessor.filter()
-> SheepShuttle.ShuttleConverter.fromUnits()
-> SheepShuttle.ShuttleAnalyzer.analyze()
-> SheepShuttle.ShuttleManager.manage()

#### ShWvData(JSON)を直接読み込む

SheepShuttle.ShuttleConverter.fromFile()

#### ShWvData(JSON)を直接読み込んで再解析

SheepShuttle.ShuttleConverter.fromFile()
-> SheepShuttle.ShuttleAnalyzer.analyze()

#### ShWvData(JSON)を直接読み込んで変換

SheepShuttle.ShuttleConverter.fromFile()
-> SheepShuttle.ShuttleManager.manage()

## 外部からの呼び出し

CLIもWEBアプリも、呼び出し用のapiを用意して、SheepShuttleクラスをつくり、これを経由して各種処理を実現する。

## タスク

- [x] SheepShuttle.ShuttleParser の作成
    - [x] ShuttleParser.parse() の戻り値を Segment[] から TranslationPair[] へと変更
    - [x] ShuttleParser.parse() で ShWvFileInfo[] を返せるように
    - [x] XLFライクファイルの場合は、ここでの抽出段階で isSub による分割処理を行う。
- [x] SheepShuttle.ShuttleProcessor.filter() の実装（(units: TranslationPair[]) => TranslationPair[]）
- [x] SheepShuttle.ShuttleConverter の実装
    - [x] fromUnits() の実装
        - [x] この段階でタグ保護（{@idx}形式への置換と placeholders への格納）を行う。
    - [x] fromShwvJsonFile() の実装（既存のShWvData JSONを読み込み、ステートに保持する）
- [x] SheepShuttle.ShuttleAnalyzer.analyze() の実装（WASM連携を含む）
- [x] SheepShuttle.ShuttleManager.manage() の実装（各exportメソッドの集約）
- [x] SheepShuttle.ShuttleBuilder.build() の実装（ShWvData を受け取り XLIFF を生成）