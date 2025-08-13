# Discord 同意書フォームBot & Webサーバー

Discordのスレッド作成時に、自動で動的なWebフォームを生成・回答・集計する一連のシステムです。サーバーの不安定な状況も考慮し、後から手動でフォームを発行する機能も採用しています。

このプロジェクトは、Node.jsをベースに、Discord.js (Bot)、Express (Webサーバー)、SQLite (データベース) を使用して構築されています。



## 主な機能 ✨
* **自動フォーム発行** 環境変数で指定されたフォーラムチャンネル内でスレッドが作成されると自動でフォームURLを送信します。
* **手動フォーム発行**: Discordのスレッド内で `/form` コマンドを実行することで、そのスレッド専用のフォームURLを生成します。
* **動的なフォーム構築**: Webの管理者ページ (`/admin`) から、フォームの質問項目（一行テキスト、複数行テキスト、ラジオボタン）を自由に設定・変更できます。
* **回答の保存と編集**: ユーザーの回答はSQLiteデータベースに保存され、同じURLに再アクセスすることで内容の編集が可能です。
* **結果の自動通知**: フォームが送信されると、元のDiscordスレッドに整形されたEmbed（埋め込み）メッセージで回答内容が通知されます。
* **モダンなUI**: Discordの雰囲気に合わせた、ダークテーマで見やすいWebデザイン。



---
## 必要なもの

* [Node.js](https://nodejs.org/) (v18.x 以上を推奨)
* npm (Node.jsに付属)

---
## セットアップ手順 🚀

1.  **リポジトリをクローン**
    ```bash
    git clone [https://github.com/IBA-HOK/discord_doui.git](https://github.com/IBA-HOK/discord_doui.git)
    cd discord_doui
    ```

2.  **依存関係をインストール**
    ```bash
    npm install
    ```

3.  **Discord Botの準備**
    1.  [Discord Developer Portal](https://discord.com/developers/applications)でアプリケーションを作成します。
    2.  「Bot」タブでBotユーザーを作成し、「**Reset Token**」ボタンから**ボットトークン**をコピーします。
    3.  「General Information」ページで「**APPLICATION ID**」をコピーします。

4.  **.envファイルの設定**
    プロジェクトのルートに `.env` という名前のファイルを作成し、以下の内容を記述・編集してください。

    ```.env
    # Discord Botのトークン
    DISCORD_BOT_TOKEN="ここにボットトークンを貼り付け"
    
    # DiscordアプリケーションのID
    DISCORD_APP_ID="ここにAPPLICATION IDを貼り付け"
    
    # Botが反応するフォーラムチャンネルのID
    FORUM_CHANNEL_ID="ここにフォーラムチャンネルのIDを貼り付け"
    
    # ユーザーがアクセスするWebサーバーの公開URL (ポート番号なし)
    # ローカルで試す場合: URL="http://localhost:8000"
    # 本番環境の場合: URL="[https://your-domain.com](https://your-domain.com)"
    URL="http://localhost:8000"
    
    # 内部でリッスンするポート番号 (任意)
    PORT=8000
    ```

5.  **スラッシュコマンドの登録**
    以下のコマンドを**一度だけ**実行して、`/form` コマンドをDiscordに登録します。
    ```bash
    node deploy-commands.js
    ```

6.  **アプリケーションの起動**
    以下のコマンドで、BotとWebサーバーを同時に起動します。
    ```bash
    node index.js
    ```
    コンソールに「Webサーバーが起動しました」と「Discord Botとしてログインしました」の両方が表示されれば成功です。

---
## 使い方 📝

1.  **管理者: フォームの設営**
    * ブラウザで管理者ページ（例: `http://localhost:8000/admin`）にアクセスします。
    * 「項目を追加」ボタンで質問を追加し、種類や選択肢を設定して「フォームを保存」します。

2.  **ユーザー: フォームの発行と回答**
    * 環境変数で指定したフォーラム内にチャンネルを作成、またはそれ以外のスレッドではチャット欄で `/form` と入力し、コマンドを実行します。
    * Botがそのスレッド専用のフォームURLを返信します。
    * ユーザーはそのURLにアクセスし、フォームに回答・送信します。
    * 回答が完了すると、元のスレッドに結果が通知されます。



---
## プロジェクト構成
