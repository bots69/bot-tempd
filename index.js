const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

const CREATE_VOICE_CHANNEL_ID = '1536689417136119888';
const PARENT_CATEGORY_ID = '1535491760627646524';
const roomOwners = new Map();

client.on('ready', () => {
    console.log(`Bot is ready as ${client.user.tag}!`);
});

// 1. نظام إنشاء وحذف الرومات المؤقتة
client.on('voiceStateUpdate', async (oldState, newState) => {
    // إنشاء روم عند دخول الروم الأساسي
    if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
        const channel = await newState.guild.channels.create({
            name: `chanell ${newState.member.user.username}`,
            type: ChannelType.GuildVoice,
            parent: PARENT_CATEGORY_ID,
        });
        roomOwners.set(channel.id, newState.member.id);
        await newState.member.voice.setChannel(channel);
    }

    // حذف الروم عند خروج آخر شخص (يعتمد على الـ ID لكي يعمل حتى لو تم تغيير الاسم)
    if (oldState.channelId && oldState.channelId !== CREATE_VOICE_CHANNEL_ID) {
        const channel = oldState.channel;
        if (channel && roomOwners.has(channel.id) && channel.members.size === 0) {
            roomOwners.delete(channel.id);
            await channel.delete().catch(() => {});
        }
    }
});

// 2. أمر إرسال لوحة التحكم
client.on('messageCreate', async (msg) => {
    if (msg.content === '-setup' || msg.content === '!setup') {
        const embed = new EmbedBuilder()
            .setTitle('Temp Control')
            .setDescription('للتحكم بالروم اضغط على الأزرار')
            .setColor(0x2f3136);
        
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rename').setLabel('تغيير الاسم').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('transfer').setLabel('نقل الملكية').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('limit').setLabel('حد الروم').setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lock').setLabel('قفل الروم').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('unlock').setLabel('فتح الروم').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('hide').setLabel('اخفاء الروم').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('unhide').setLabel('اظهار الروم').setStyle(ButtonStyle.Secondary)
        );
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ban').setLabel('منع').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('allow').setLabel('السماح').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('kick').setLabel('طرد عضو').setStyle(ButtonStyle.Secondary)
        );
        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mute').setLabel('ميوت').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('unmute').setLabel('فك ميوت').setStyle(ButtonStyle.Secondary)
        );

        await msg.channel.send({ embeds: [embed], components: [row1, row2, row3, row4] });
    }
});

// 3. نظام الأزرار والتحكم الكامل
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const channel = i.member.voice.channel;
    
    // التحقق أن المستخدم داخل الروم وأنه مالك الروم
    if (!channel || roomOwners.get(channel.id) !== i.user.id) {
        return i.reply({ content: '❌ هذا ليس رومك أو لست متصلاً به!', ephemeral: true });
    }

    const reply = (text) => i.reply({ content: text, ephemeral: true });

    // قفل الروم
    if (i.customId === 'lock') {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: false });
        reply('🔒 تم قفل الروم.');
    } 
    // فتح الروم
    else if (i.customId === 'unlock') {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: true });
        reply('🔓 تم فتح الروم.');
    } 
    // إخفاء الروم
    else if (i.customId === 'hide') {
        await channel.permissionOverwrites.edit(i.guild.id, { ViewChannel: false });
        reply('👁️‍🗨️ تم اخفاء الروم.');
    } 
    // إظهار الروم
    else if (i.customId === 'unhide') {
        await channel.permissionOverwrites.edit(i.guild.id, { ViewChannel: true });
        reply('👁️ تم اظهار الروم.');
    } 
    // تغيير الاسم
    else if (i.customId === 'rename') {
        reply('📝 اكتب الاسم الجديد للروم في الشات:');
        const col = i.channel.createMessageCollector({ filter: m => m.author.id === i.user.id, time: 20000 });
        col.on('collect', async m => {
            await m.delete().catch(() => {});
            await channel.setName(m.content);
            i.followUp({ content: '✅ تم تغيير الاسم بنجاح.', ephemeral: true });
            col.stop();
        });
    } 
    // نقل الملكية
    else if (i.customId === 'transfer') {
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
    // حد الروم
    else if (i.customId === 'limit') {
        reply('🎧 اكتب حد الروم (رقم بين 1 و 50):');
        const col = i.channel.createMessageCollector({ filter: m => m.author.id === i.user.id, time: 20000 });
        col.on('collect', async m => {
            await m.delete().catch(() => {});
            const limit = parseInt(m.content);
            if (isNaN(limit)) return i.followUp({ content: '❌ رقم غير صحيح.', ephemeral: true });
            if (limit > 50) return i.followUp({ content: '❌ أعلى حد للروم هو 50.', ephemeral: true });
            
            await channel.setUserLimit(limit);
            i.followUp({ content: `✅ تم ضبط الحد إلى ${limit}`, ephemeral: true });
            col.stop();
        });
    }
    // منع / طرد / ميوت / فك ميوت / السماح
    else if (['ban', 'allow', 'kick', 'mute', 'unmute'].includes(i.customId)) {
        reply('⚠️ ارفق منشن الشخص لتنفيذ الإجراء عليه:');
        const col = i.channel.createMessageCollector({ filter: m => m.author.id === i.user.id, time: 20000 });
        col.on('collect', async m => {
            const member = m.mentions.members.first();
            await m.delete().catch(() => {});
            if (!member) return i.followUp({ content: '❌ منشن غير صحيح.', ephemeral: true });

            if (i.customId === 'ban') {
                await channel.permissionOverwrites.edit(member.id, { Connect: false });
                i.followUp({ content: '✅ تم منع العضو من دخول الروم.', ephemeral: true });
            } else if (i.customId === 'allow') {
                await channel.permissionOverwrites.edit(member.id, { Connect: null });
                i.followUp({ content: '✅ تم السماح للعضو بالدخول.', ephemeral: true });
            } else if (i.customId === 'kick') {
                if (member.voice.channelId === channel.id) {
                    await member.voice.disconnect();
                    i.followUp({ content: '✅ تم طرد العضو من الروم.', ephemeral: true });
                } else {
                    i.followUp({ content: '❌ العضو ليس داخل رومك.', ephemeral: true });
                }
            } else if (i.customId === 'mute') {
                await channel.permissionOverwrites.edit(member.id, { Speak: false });
                i.followUp({ content: '✅ تم إعطاء ميوت للعضو في الروم.', ephemeral: true });
            } else if (i.customId === 'unmute') {
                await channel.permissionOverwrites.edit(member.id, { Speak: null });
                i.followUp({ content: '✅ تم فك الميوت عن العضو.', ephemeral: true });
            }
            col.stop();
        });
    }
});

// 4. تشغيل سيرفر الويب الوهمي لبقاء البوت يعمل 24/7 على Render
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('I am alive!');
}).listen(3000);

client.login(process.env.TOKEN);
