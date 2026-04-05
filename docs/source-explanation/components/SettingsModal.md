# マスタ設定画面

> 対応ソースコード: `src/components/SettingsModal.jsx`

## このファイルの役割

このファイルは、アプリの「マスタ設定」という大きな窓口です。学校の時間割を作るための基本的な情報（教科、先生、クラス、AIの設定など）を登録・編集する場所です。

「学校の教科書で言えば、目次や索引のようなもの」と考えてください。時間割を作る前に、ここでまず学校全体の基本情報を整理しておく必要があります。

---

## 主な機能

このモーダル（ポップアップ窓）には **6つのタブ**があります。

### タブ①：教科・連動ルール

- **何をするか**: 学校で教える教科（国語、算数、体育など）を登録し、各学年で何時間分の授業が必要か設定します。また、通常学級と特別支援学級で異なる教科を配置するルールを登録します

- **具体的な操作**:
  1. **教科の追加**: 「新しい教科を入力」の欄に教科名を入力して「追加」ボタンを押す
  2. **規定時数の設定**: 表の各欄に、その学年に必要な授業時数を入力します
     - 例：「1年通常」の国語は週8時間、「1年特支」の国語は週6時間…など
  3. **連続日数の上限**: 同じ教科が何日も続かないように上限を設定します
     - 例：「同じ教科は3日連続まで」という制約
  4. **特支連動ルール**: 通常学級に「図工」を配置したとき、自動的に特別支援学級では「生活」に置き換わる…といった「置き換え規則」を登録します
     - ソースコード: 行364-388
     - 関連ファイル: [useTimetableStore.md#addmappingrule](../store/useTimetableStore.md#addmappingrule---特支連動ルールを追加する)

- **ソースコード**: 行313-390

---

### タブ②：クラス編成

- **何をするか**: 学校全体のクラス構成を登録します。「1年A組、1年B組、2年A組…」など、実際に存在するクラスを登録することで、後で時間割表を作るときに「どのクラスに授業を配置するか」を決められます

- **具体的な操作**:
  1. **学年を選択**: ドロップダウンから「1年」「2年」「3年」を選ぶ
  2. **クラス名を入力**: 「A組」「B組」など、クラス名を入力
  3. **特支枠かどうかを選択**: 普通のクラスか、特別支援学級かを選ぶ
  4. **クラス追加ボタンを押す**: 新しいクラスが一覧に追加されます
  5. **既存クラスの削除**: 各クラスの横の「✕」ボタンで削除できます
     - **注意**: クラスを削除すると、そのクラスに既に配置した授業データも消えます

- **ソースコード**: 行392-432
- **関連ファイル**: [useTimetableStore.md#addclass](../store/useTimetableStore.md#addclass---クラスを追加する)

---

### タブ③：教員リスト

- **何をするか**: 学校の先生の情報（名前、担当教科、対象学年、配置不可な時間）を登録・編集します

- **具体的な操作**:
  1. **新しい先生の登録**:
     - 「教員名」: 先生の名前を入力（例：山田太郎）
     - 「担当教科」: カンマで区切って教科を入力（例：国語, 書写）
     - 「対象学年」: カンマで区切って学年を入力（例：1,2 = 1年と2年を担当）
     - 「教員追加」ボタンを押す
  
  2. **先生の情報を編集**:
     - 登録済みの先生名の横の「編集」ボタンを押す
     - 弾き出された編集フォームで名前・教科・対象学年を修正
     - 「保存」ボタンで確定
  
  3. **先生の配置不可時間を設定**:
     - 先生名をクリックして「▼ スケジュール設定」を開く
     - 出張や会議などで授業を配置できない時間をクリック
     - 赤色（✕）に変わった時間は配置不可になります
     - 白色（○）は配置可
     - ソースコード: 行524-573
  
  4. **先生を削除**: 先生名の横の「削除」ボタン
     - ソースコード: 行435-736

- **教員グループ**: 道徳や総合のように複数の先生で一緒に授業を受け持つ場合、グループを作成できます
  - **グループ名**: 「1年道徳グループ」など
  - **メンバー**: グループに入れる先生を複数選択
  - **グループの順序を変更**: 上下矢印（▲▼）でグループの順番を並べ替え
  - ソースコード: 行581-736
  - 関連ファイル: [useTimetableStore.md#addteachergroup](../store/useTimetableStore.md#addteachergroup---教員グループを作成する)

- **ソースコード**: 行435-736

---

### タブ④：合同クラス

このタブには2つの異なる「合同」の機能があります。

#### ④-1：合同クラス（同一学年の複数クラスが一緒に授業）

- **何をするか**: 同じ学年の2つ以上のクラスを「合同クラス」として登録します
  - 例：「1年のA組とB組は音楽を合同で受ける」という設定
  
- **具体的な操作**:
  1. **学年を選択**: ドロップダウンから学年を選ぶ
  2. **合同にするクラスを複数選択**: チェックボックスで複数クラスを選ぶ（最低2つ以上）
  3. **合同クラスを登録**ボタンを押す
  
  4. **分割教科の設定**:
     - 登録済みの合同クラスに対して、「分割教科」を指定できます
     - **分割教科**＝その教科だけは各クラスで別々の先生を配置する
     - 例：「A組とB組は合同だけど、体育だけは別々の先生がやる」という場合、「体育」を分割教科として登録

- **ソースコード**: 行738-819
- **関連ファイル**: 
  - [useTimetableStore.md#addclassgroup](../store/useTimetableStore.md#addclassgroup---合同クラスを登録する)
  - [useTimetableStore.md#addsplitsubject](../store/useTimetableStore.md#addsplitsubject---分割教科を追加する)

#### ④-2：複数学年合同授業（異なる学年のクラスが一緒に授業）

- **何をするか**: 「1年A組と3年B組で一緒に体育をする」など、異なる学年のクラスが同じ時間に同じ教科を受ける場合を登録します

- **具体的な操作**:
  1. **授業名** (任意): 「合同体育」など、後で見てわかりやすい名前を入力
  2. **教科**: ドロップダウンから教科を選ぶ
  3. **週あたりコマ数**: その授業が1週間に何時間あるか（1～10）を入力
  4. **参加クラス**: 全学年から該当するクラスをチェック（最低2クラス以上）
  5. **複数学年合同授業を登録**ボタンを押す

- **ソースコード**: 行820-891
- **関連ファイル**: 
  - [useTimetableStore.md#addcrossgradegroup](../store/useTimetableStore.md#addcrossgradegroup---複数学年合同授業を登録する)

---

### タブ⑤：抱き合わせ

- **何をするか**: 同じ学年の2つのクラスで「この教科が配置されたら、必ずもう一方のクラスにはこの教科を置く」という「セット関係」を登録します

- **具体的な操作**:
  1. **学年を選択**
  2. **クラスAと教科A、クラスBと教科Bを選択**:
     - 例：「A組に国語を置いたら、B組には社会を置く」
  3. **登録**ボタンを押す
  4. **表示される記号「⇔」は双方向**: つまり、「A組に国語を置いたときはB組に社会、逆にB組に社会を置いたときはA組に国語」という意味です

- **実践例**:
  - 「A組に国語を配置」→ ソルバーが自動的に「B組に社会も配置」する
  - 複数の教科のペアを作ることで、より自然な時間割ができます

- **ソースコード**: 行895-965
- **関連ファイル**: [useTimetableStore.md#addsubjectpairing](../store/useTimetableStore.md#addsubjectpairing---抱き合わせ教科を追加する)

---

### タブ⑥：AI設定（ローカルLLM）

- **何をするか**: AIを使って時間割を自動生成・レビューするための設定をします
  - **Ollama** というローカルAIエンジンの接続先を設定
  - インターネットに一切データを送らず、パソコン内だけで処理されるため、安心です

- **具体的な操作**:
  1. **Ollamaエンドポイント URL**: 
     - Ollama をインストールしたパソコンの URL を入力
     - 通常は `http://localhost:11434`
  
  2. **使用するモデル**: ドロップダウンから AI モデルを選択
     - 「Gemma 3」（推奨）など複数から選べます
     - 推奨モデルには「(推奨)」マークが付いています
  
  3. **接続テスト＆保存**: 
     - 「🔌 接続テスト＆保存」ボタンで、実際に Ollama に接続できるか確認して設定を保存
     - 成功するとチェックマークが表示されます
  
  4. **保存のみ**: 
     - テストなしで設定だけ保存したいときは「💾 保存のみ」ボタン
     - ボタンを押す前に URL とモデルを入力しておく必要があります
  
  5. **現在の設定状態**:
     - 画面下部に「今どのエンドポイントをどのモデルで使っているか」が表示されます

- **インストール方法**:
  - `https://ollama.com` から Ollama をダウンロード・インストール
  - ターミナルで `ollama pull gemma3` などを実行してモデルをダウンロード

- **ソースコード**: 行968-1038
- **関連ファイル**: [localLLM.md#testollamaconnection](../lib/localLLM.md#testollamaconnection---接続をテストする)

---

## データの流れ

1. ユーザーが「マスタ設定」ボタンを押す → SettingsModal が表示される
2. 各タブで教科・先生・クラス・AIの情報を入力・編集する
3. 入力データは [useTimetableStore](../store/useTimetableStore.md) に保存される
4. 時間割表を作るときにこのデータが使われる

---

## 関連するファイル

- [useTimetableStore.md](../store/useTimetableStore.md) — マスタ設定データの保存と管理
  - [addSubject](../store/useTimetableStore.md#addsubject---教科を追加する)
  - [removeSubject](../store/useTimetableStore.md#removesubject---教科を削除する)
  - [updateRequiredHours](../store/useTimetableStore.md#updaterequiredhours---規定時数を更新する)
  - [updateSubjectConstraint](../store/useTimetableStore.md#updatesubjectconstraint---教科の連続日数制限を更新する)
  - [addMappingRule](../store/useTimetableStore.md#addmappingrule---特支連動ルールを追加する)
  - [removeMappingRule](../store/useTimetableStore.md#removemappingrule---特支連動ルールを削除する)
  - [addClass](../store/useTimetableStore.md#addclass---クラスを追加する)
  - [removeClass](../store/useTimetableStore.md#removeclass---クラスを削除する)
  - [addTeacher](../store/useTimetableStore.md#addteacher---先生を追加する)
  - [updateTeacher](../store/useTimetableStore.md#updateteacher---先生の情報を更新する)
  - [removeTeacher](../store/useTimetableStore.md#removeteacher---先生を削除する)
  - [addTeacherGroup](../store/useTimetableStore.md#addteachergroup---教員グループを作成する)
  - [updateTeacherGroup](../store/useTimetableStore.md#updateteachergroup---教員グループを更新する)
  - [removeTeacherGroup](../store/useTimetableStore.md#removeteachergroup---教員グループを削除する)
  - [moveTeacherGroup](../store/useTimetableStore.md#moveteachergroup---教員グループの順序を変更する)
  - [addClassGroup](../store/useTimetableStore.md#addclassgroup---合同クラスを登録する)
  - [removeClassGroup](../store/useTimetableStore.md#removeclassgroup---合同クラスを削除する)
  - [addSplitSubject](../store/useTimetableStore.md#addsplitsubject---分割教科を追加する)
  - [removeSplitSubject](../store/useTimetableStore.md#removesplitsubject---分割教科を削除する)
  - [addCrossGradeGroup](../store/useTimetableStore.md#addcrossgradegroup---複数学年合同授業を登録する)
  - [removeCrossGradeGroup](../store/useTimetableStore.md#removecrossgradegroup---複数学年合同授業を削除する)
  - [addSubjectPairing](../store/useTimetableStore.md#addsubjectpairing---抱き合わせ教科を追加する)
  - [removeSubjectPairing](../store/useTimetableStore.md#removesubjectpairing---抱き合わせ教科を削除する)

- [localLLM.md](../lib/localLLM.md) — ローカルLLM(Ollama)の接続テスト

- [条件設定画面](./ConstraintsModal.md) — 別の大型モーダル。こちらはより細かい「制約」（固定コマ、施設の制限など）を設定します

- [AI支援パネル](./AIAssistPanel.md) — AIを使ったレビュー・自動生成はこちらのパネルで実行
