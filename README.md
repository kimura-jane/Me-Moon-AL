
# FiNANCiE AL 対象 照会（静的版）

- サーバー不要。GitHub Pages で動く。
- データは `data/members.json` を編集して更新（slug/username/als）。
- 検索は slug か username。入力は NFKC 正規化・小文字化・先頭 @ 除去で照合。

## 構造
```
.
├─ index.html
├─ assets/
│  ├─ style.css
│  ├─ app.js
│  └─ logo.jpg
└─ data/
   └─ members.json
```

## members.json 仕様
```json
{
  "meta": {"updated": "YYYY-MM-DD"},
  "members": [
    {"slug": "yamada_taro", "username": "山田太郎", "als": ["チャージ確定", "NFT早押し"]},
    {"slug": "suzuki_hanako", "username": "鈴木花子", "als": ["挨拶早押し①"]}
  ]
}
```
- `als` は 9種類の中から複数可：
  - チャージ確定 / チャージ早押し / 企画確定 / 企画早押し / NFT確定 / NFT早押し / 挨拶確定 / 挨拶早押し② / 挨拶早押し①

## デプロイ
1. このフォルダを GitHub リポジトリ直下へ。
2. Settings → Pages → Branch を `main` / `/root` に設定。
3. 反映後、`?q=slug` でクエリ指定して直接照会リンクを共有可能。
