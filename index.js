const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// --- 基本設定 ---
const PORT = 8000;
const DB_DIR = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'database.db');
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const TARGET_FORUM_ID = process.env.FORUM_CHANNEL_ID;
const MY_URL = process.env.URL;

const app = express();
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
let db; 

async function initializeDatabase() {
    try {
        await fs.mkdir(DB_DIR, { recursive: true });
        const database = await open({ filename: DB_PATH, driver: sqlite3.Database });
        await database.exec(`
            CREATE TABLE IF NOT EXISTS fields ( id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, type TEXT NOT NULL, options TEXT, field_order INTEGER NOT NULL );
            CREATE TABLE IF NOT EXISTS answers ( id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id TEXT NOT NULL, field_id INTEGER NOT NULL, value TEXT NOT NULL, FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE );
            CREATE TABLE IF NOT EXISTS submissions ( id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' );
        `);
        console.log('✅ データベースの準備が完了しました。');
        return database;
    } catch (error) {
        console.error('❌ データベースの初期化に失敗しました:', error);
        process.exit(1);
    }
}

// --- Discord Bot イベントハンドラ ---
discordClient.once(Events.ClientReady, c => {
    console.log(`✅ Discord Bot (${c.user.tag}) としてログインしました。`);
    console.log(`📡 監視対象フォーラムID: ${TARGET_FORUM_ID}`);
    console.log('------------------------------------');
});

// [変更点] スレッド作成時: data.jsonの代わりに直接DBに書き込む
discordClient.on(Events.ThreadCreate, async thread => {
    if (thread.parentId === TARGET_FORUM_ID) {
        const uniqueId = crypto.randomUUID();
        const accessUrl = `http://${MY_URL}:${PORT}/agreement/${uniqueId}`;

        try {
            // submissionsテーブルに直接INSERT
            await db.run('INSERT INTO submissions (id, thread_id) VALUES (?, ?)', uniqueId, thread.id);
            console.log(`💾 DBにIDペアを保存しました: { ${uniqueId}: ${thread.id} }`);

            const messageContent = `スレッドの作成ありがとうございます！\n` +
                                   `以下のURLにアクセスして、手続きを開始してください。\n\n` +
                                   `**URL:** ${accessUrl}`;
            await thread.send(messageContent);
            console.log(`スレッド「${thread.name}」にURLを送信しました。`);

        } catch (error) {
            console.error('❌ スレッド作成処理中にエラー:', error);
        }
    }
});
discordClient.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'form') {
        // スレッド内で実行されたか確認
        if (!interaction.channel.isThread()) {
            await interaction.reply({ content: 'このコマンドはスレッド内でのみ実行できます。', ephemeral: true });
            return;
        }

        const threadId = interaction.channelId;

        try {
            // 既にこのスレッド用のフォームが存在するかチェック
            const existingSubmission = await db.get('SELECT * FROM submissions WHERE thread_id = ?', threadId);
            if (existingSubmission) {
                const existingUrl = `http://${MY_URL}:${PORT}/agreement/${existingSubmission.id}`;
                await interaction.reply({ content: `このスレッドには既にフォームが発行されています。\n**URL:** ${existingUrl}`, ephemeral: true });
                return;
            }

            // 新しいIDとURLを生成
            const uniqueId = crypto.randomUUID();
            const accessUrl = `http://${MY_URL}:${PORT}/agreement/${uniqueId}`;

            // DBにIDのペアを保存
            await db.run('INSERT INTO submissions (id, thread_id) VALUES (?, ?)', uniqueId, threadId);
            
            const replyMessage = `フォームのURLを発行しました。\n` +
                                 `以下のURLから手続きを開始してください。\n\n` +
                                 `**URL:** ${accessUrl}`;

            await interaction.reply({ content: replyMessage });
            console.log(`✅ 手動でフォームを発行しました (Thread ID: ${threadId})`);

        } catch (error) {
            console.error('❌ /form コマンドの処理中にエラー:', error);
            await interaction.reply({ content: 'フォームの発行中にエラーが発生しました。', ephemeral: true });
        }
    }
});

// --- Express ミドルウェア設定 ---
app.set('view engine', 'ejs');
app.use(express.static('public')); // [追加] この行を追加
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Express ルート定義 ---

// 管理者ページ
app.get('/admin', async (req, res) => {
    const fields = await db.all('SELECT * FROM fields ORDER BY field_order');
    res.render('admin', { fields: fields || [] });
});
app.post('/admin/form', async (req, res) => {
    // (この部分は長いため、前回のコードから変更ありません)
    const { label, type, options } = req.body;
    try {
        await db.run('BEGIN TRANSACTION');
        await db.run('DELETE FROM fields');
        if (label) {
            const labels = Array.isArray(label) ? label : [label];
            for (let i = 0; i < labels.length; i++) {
                const currentType = Array.isArray(type) ? type[i] : type;
                const currentOptions = Array.isArray(options) ? options[i] : options;
                const optionsJson = currentType === 'radio' ? JSON.stringify(currentOptions.split(',').map(s => s.trim())) : null;
                await db.run('INSERT INTO fields (label, type, options, field_order) VALUES (?, ?, ?, ?)', labels[i], currentType, optionsJson, i);
            }
        }
        await db.run('COMMIT');
        res.redirect('/admin');
    } catch (error) {
        await db.run('ROLLBACK');
        res.status(500).send('フォームの保存に失敗しました。');
    }
});

// ユーザー向けフォームページ
app.get('/agreement/:uniqueId', async (req, res) => {
    const { uniqueId } = req.params;
    try {
        // [変更点] data.jsonの代わりにsubmissionsテーブルを直接参照
        const submission = await db.get('SELECT * FROM submissions WHERE id = ?', uniqueId);
        if (!submission) {
            return res.status(404).send('無効なURLです。');
        }

        const fields = await db.all('SELECT * FROM fields ORDER BY field_order');
        const answers = await db.all('SELECT * FROM answers WHERE submission_id = ?', uniqueId);
        res.render('form', { fields, answers, message: null });
    } catch (error) {
        res.status(500).send('ページの表示中にエラーが発生しました。');
    }
});
app.post('/agreement/:uniqueId', async (req, res) => {
    // (この部分は長いため、前回のコードから変更ありません)
    const { uniqueId } = req.params;
    const submittedAnswers = req.body;
    try {
        await db.run('BEGIN TRANSACTION');
        await db.run('DELETE FROM answers WHERE submission_id = ?', uniqueId);
        for (const fieldId in submittedAnswers) {
            await db.run('INSERT INTO answers (submission_id, field_id, value) VALUES (?, ?, ?)', uniqueId, fieldId, submittedAnswers[fieldId]);
        }
        await db.run('UPDATE submissions SET status = ? WHERE id = ?', 'completed', uniqueId);
        await db.run('COMMIT');
        
        const submission = await db.get('SELECT thread_id FROM submissions WHERE id = ?', uniqueId);
        await notifyDiscord(submission.thread_id, submittedAnswers);
        
        res.render('thanks');
    } catch (error) {
        await db.run('ROLLBACK');
        res.status(500).send('回答の送信中にエラーが発生しました。');
    }
});


// --- Discord通知機能 ---
async function notifyDiscord(threadId, answers) {
    try {
        const thread = await discordClient.channels.fetch(threadId);
        if (!thread || !thread.isTextBased()) return;
        const fields = await db.all('SELECT id, label FROM fields ORDER BY field_order');
        const embedFields = fields.map(field => ({ name: field.label, value: `- ${answers[field.id]}` || '(未回答)', inline: false }));
        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('📝 フォームの回答が提出されました').addFields(embedFields).setTimestamp();
        await thread.send({ embeds: [embed] });
        console.log(`✅ Discordスレッドに通知を送信しました (ID: ${threadId})`);
    } catch (error) {
        console.error('❌ Discordへの通知送信中にエラーが発生しました:', error);
    }
}


// --- アプリケーション起動 ---
async function main() {
    if (!BOT_TOKEN || !TARGET_FORUM_ID) {
        console.error('エラー: .envファイルに DISCORD_BOT_TOKEN と FORUM_CHANNEL_ID を設定してください。');
        return;
    }
    
    db = await initializeDatabase();      // データベースを準備
    await discordClient.login(BOT_TOKEN); // Botをログインさせる
    
    app.listen(PORT, () => {              // Webサーバーを起動
        console.log(`✅ Webサーバーが http://localhost:${PORT} で起動しました。`);
        console.log(`🔑 管理者ページ: http://localhost:${PORT}/admin`);
    });
}

main(); // 実行
