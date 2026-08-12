const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

const CREATE_VOICE_CHANNEL_ID = '1536689417136119888';
const PARENT_CATEGORY_ID = '1535491760627646524';
const roomOwners = new Map();

client.on('ready', () => console.log('Bot is ready!'));

// نظام إنشاء الروم
client.on('voiceStateUpdate', async (oldState, newState) => {
    // إنشاء
    if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
        const channel = await newState.guild.channels.create({
            name: `chanell ${newState.member.user.username}`,
            type: ChannelType.GuildVoice,
            parent: PARENT_CATEGORY_ID,
        });
        roomOwners.set(channel.id, newState.member.id);
        await newState.member.voice.setChannel(channel);
    }
    // الحذف (يعتمد على الـ ID لضمان الحذف دائماً)
    if (oldState.channelId && oldState.channelId !== CREATE_VOICE_CHANNEL_ID) {
        const channel = oldState.channel;
        if (channel && roomOwners.has(channel.id) && channel.members.size === 0) {
            roomOwners.delete(channel.id);
            await channel.delete().catch(() => {});
        }
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const channel = i.member.voice.channel;
    
    // التحقق من الملكية
    if (!channel || roomOwners.get(channel.id) !== i.user.id) {
        return i.reply({ content: '❌ هذا ليس رومك أو لست متصلاً به!', ephemeral: true });
    }

    const reply = (text) => i.reply({ content: text, ephemeral: true });

    // نظام نقل الملكية
    if (i.customId === 'transfer') {
        reply('👤 ارفق منشن الشخص الذي تريد نقل الملكية له:');
        const col = i.channel.createMessageCollector({ filter: m => m.author.id === i.user.id, time: 20000 });
        col.on('collect', async m => {
            const member = m.mentions.members.first();
            await m.delete().catch(() => {});
            if (!member) return i.followUp({ content: '❌ منشن غير صحيح.', ephemeral: true });
            if (!channel.members.has(member.id)) return i.followUp({ content: '❌ الشخص ليس داخل رومك.', ephemeral: true });
            
            roomOwners.set(channel.id, member.id);
            i.followUp({ content: `✅ تم نقل الملكية إلى ${member.user.username}`, ephemeral: true });
            col.stop();
        });
    }

    // نظام حد الروم
    else if (i.customId === 'limit') {
        reply('🎧 اكتب حد الروم (الرقم):');
        const col = i.channel.createMessageCollector({ filter: m => m.author.id === i.user.id, time: 20000 });
        col.on('collect', async m => {
            await m.delete().catch(() => {});
            const limit = parseInt(m.content);
            if (isNaN(limit)) return i.followUp({ content: '❌ منشن/رقم غير صحيح.', ephemeral: true });
            if (limit > 50) return i.followUp({ content: '❌ أعلى حد للروم هو 50.', ephemeral: true });
            
            await channel.setUserLimit(limit);
            i.followUp({ content: `✅ تم ضبط الحد إلى ${limit}`, ephemeral: true });
            col.stop();
        });
    }

    // الأزرار الأساسية (قفل/فتح/إخفاء)
    else if (i.customId === 'lock') {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: false });
        reply('🔒 تم قفل الروم.');
    } else if (i.customId === 'unlock') {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: true });
        reply('🔓 تم فتح الروم.');
    }
});

// تشغيل السيرفر للريندر
const http = require('http');
http.createServer((req, res) => res.end('Alive')).listen(3000);
client.login(process.env.TOKEN);
