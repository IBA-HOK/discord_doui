// deploy-commands.js
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'form',
        description: 'このスレッドに対するフォームURLを発行します。'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log('スラッシュコマンドの登録を開始します...');
        
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_APP_ID),
            { body: commands },
        );

        console.log('スラッシュコマンドの登録が正常に完了しました。');
    } catch (error) {
        console.error(error);
    }
})();
