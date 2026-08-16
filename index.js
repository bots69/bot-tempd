const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, AuditLogEvent } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildVoiceStates
    ]
});

const CREATE_VOICE_CHANNEL_ID = '1536689417136119888';
const PARENT_CATEGORY_ID = '1535491760627646524';
const ADMIN_ROLE_ID = '1535375782736560128';
const TARGET_ROOM_ID = '1536693109662949406'; // الروم المحدد لحذف الرسائل وقفل الشات
const LOG_ROOM_ID = '1536977594702888960'; // روم سجلات الدخول والخروج الصوتي
const DISCONNECT_LOG_ROOM_ID = '1537003891286347828'; // روم سجلات السحب والدفن القديمة
const CUSTOM_LOG_ROOM_ID = '1537032400561905674'; // الروم الجديد المخصص لسجلات الميوت والدفن الخ
const SECRET_WORD = 'كلمة_السر'; // ضع الكلمة المطلوبة هنا

const roomOwners = new Map();
const activeCollectors = new Map();

client.on('ready', () => {
    console.log(`Bot is ready as ${client.user.tag}`);
});

// نظام مراقبة الرسائل
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    if (msg.channel.id === TARGET_ROOM_ID) {
        if (msg.content.trim() === SECRET_WORD) {
            try { await msg.delete().catch(() => {}); } catch (error) {}
            try {
                await msg.channel.permissionOverwrites.delete(msg.author.id).catch(() => {});
                await msg.channel.permissionOverwrites.edit(msg.author.id, {
                    ViewChannel: false,
                    SendMessages: false
                });
                if (msg.member && msg.member.voice && msg.member.voice.channelId === msg.channel.id) {
                    await msg.member.voice.disconnect().catch(() => {});
                }
            } catch (error) {}
            return;
        }
    }

    if (msg.content === '-setup' || msg.content === '!setup') {
        if (!msg.member || !msg.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return msg.react('❌').catch(() => {});
        }

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

// نظام تتبع الحالة الصوتية
client.on('voiceStateUpdate', async (oldState, newState) => {
    // 1. إنشاء روم مؤقت
    if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
        const channel = await newState.guild.channels.create({
            name: `channel ${newState.member.user.username}`,
            type: ChannelType.GuildVoice,
            parent: PARENT_CATEGORY_ID,
        });
        roomOwners.set(channel.id, newState.member.id);
        await newState.member.voice.setChannel(channel);
    }

    // 2. حذف الروم المؤقت إذا أصبح فارغاً
    if (oldState.channelId && oldState.channelId !== CREATE_VOICE_CHANNEL_ID) {
        const channel = oldState.channel;
        if (channel && roomOwners.has(channel.id) && channel.members.size === 0) {
            roomOwners.delete(channel.id);
            activeCollectors.delete(channel.id);
            await channel.delete().catch(() => {});
        }
    }

    const logChannel = await newState.guild.channels.fetch(LOG_ROOM_ID).catch(() => {});
    const disconnectLogChannel = await newState.guild.channels.fetch(DISCONNECT_LOG_ROOM_ID).catch(() => {});
    const customLogChannel = await newState.guild.channels.fetch(CUSTOM_LOG_ROOM_ID).catch(() => {});

    const member = newState.member;
    const currentChannel = newState.channel || oldState.channel;

    // أ) مراقبة الميوت / فك الميوت
    if (customLogChannel && oldState.serverMute !== newState.serverMute) {
        let actionBy = null;
        try {
            const fetchedLogs = await newState.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberUpdate });
            const auditLog = fetchedLogs.entries.find(entry => entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 8000));
            if (auditLog) actionBy = auditLog.executor;
        } catch (e) {}

        if (actionBy) {
            const isMuted = newState.serverMute;
            const embed = new EmbedBuilder()
                .setAuthor({ name: actionBy.tag, iconURL: actionBy.displayAvatarURL() })
                .setTitle(isMuted ? 'Mute Member' : 'UnMute Member')
                .setDescription(`**To :** <@${member.id}>\n**By :** <@${actionBy.id}>\n**In :** ${currentChannel ? `<#${currentChannel.id}>` : 'me'}`)
                .setColor(0x2f3136)
                .setTimestamp();

            await customLogChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    // ب) مراقبة الدفن (Deaf)
    if (customLogChannel && oldState.serverDeaf !== newState.serverDeaf) {
        let actionBy = null;
        try {
            const fetchedLogs = await newState.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberUpdate });
            const auditLog = fetchedLogs.entries.find(entry => entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 8000));
            if (auditLog) actionBy = auditLog.executor;
        } catch (e) {}

        if (actionBy) {
            const isDeaf = newState.serverDeaf;
            const embed = new EmbedBuilder()
                .setAuthor({ name: actionBy.tag, iconURL: actionBy.displayAvatarURL() })
                .setTitle(isDeaf ? 'Deafed Member' : 'UnDeafed Member')
                .setDescription(`**To :** <@${member.id}>\n**By :** <@${actionBy.id}>\n**In :** ${currentChannel ? `<#${currentChannel.id}>` : '.'}`)
                .setColor(0x2f3136)
                .setTimestamp();

            await customLogChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    // ج) مراقبة السحب والطرد من الروم
    if (disconnectLogChannel && oldState.channelId && !newState.channelId) {
        let disconnectedBy = null;
        const leftChannel = oldState.channel;

        try {
            const fetchedLogs = await newState.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberDisconnect });
            const auditLog = fetchedLogs.entries.find(entry => entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 8000));
            if (auditLog) disconnectedBy = auditLog.executor;
        } catch (e) {}

        if (disconnectedBy) {
            const membersText = leftChannel && leftChannel.members.size > 0 
                ? Array.from(leftChannel.members.values()).map(m => `<@${m.id}>`).join('\n')
                : 'No Members In\nChannel';

            const embed = new EmbedBuilder()
                .setAuthor({ name: disconnectedBy.tag, iconURL: disconnectedBy.displayAvatarURL() })
                .setTitle('Disconnect Member')
                .setDescription(`**To :** <@${member.id}>\n**By :** <@${disconnectedBy.id}>\n**From :** ${leftChannel ? `<#${leftChannel.id}>` : '#unknown'}\n**Members :**\n${membersText}`)
                .setColor(0x2f3136)
                .setTimestamp();

            await disconnectLogChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    // د) مراقبة نقل الأعضاء (Move)
    if (disconnectLogChannel && oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        let executorTag = member.user.tag;
        let executorAvatar = member.user.displayAvatarURL();
        let movedBy = member;

        try {
            const fetchedLogs = await newState.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberMove });
            const auditLog = fetchedLogs.entries.find(entry => entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 8000));
            if (auditLog) {
                movedBy = auditLog.executor;
                executorTag = movedBy.tag;
                executorAvatar = movedBy.displayAvatarURL();
            }
        } catch (e) {}

        const embed = new EmbedBuilder()
            .setAuthor({ name: executorTag, iconURL: executorAvatar })
            .setTitle('Move Member')
            .setDescription(`**To :** <@${member.id}>\n**By :** <@${movedBy.id}>\n**From :** <#${oldState.channelId}>\n**To :** <#${newState.channelId}>`)
            .setColor(0x2f3136)
            .setTimestamp();

        await disconnectLogChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // هـ) سجلات الدخول والخروج العامة
    if (logChannel && !oldState.channelId && newState.channelId) {
        const joinedChannel = newState.channel;
        const otherMembers = Array.from(joinedChannel.members.values()).filter(m => m.id !== member.id).map(m => `<@${m.id}>`);
        const membersText = otherMembers.length > 0 ? otherMembers.join('\n') : `No Members In\nChannel`;

        const embed = new EmbedBuilder()
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTitle('Join Channel')
            .setDescription(`**User :** <@${member.id}>\n**To :** <#${joinedChannel.id}>\n**Members :**\n${membersText}`)
            .setColor(0x2f3136)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    if (logChannel && oldState.channelId && !newState.channelId) {
        const leftChannel = oldState.channel;
        let membersText = 'No Members In\nChannel';
        if (leftChannel) {
            const remainingMembers = Array.from(leftChannel.members.values()).map(m => `<@${m.id}>`);
            if (remainingMembers.length > 0) membersText = remainingMembers.join('\n');
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTitle('Leave Channel')
            .setDescription(`**User :** <@${member.id}>\n**From :** ${leftChannel ? `<#${leftChannel.id}>` : '#unknown'}\n**Members :**\n${membersText}`)
            .setColor(0x2f3136)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});

// نظام الأزرار والتفاعل
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const channel = i.member.voice.channel;
    
    const hasAdminRole = i.member.roles.cache.has(ADMIN_ROLE_ID);
    const isOwner = channel && roomOwners.get(channel.id) === i.user.id;

    if (!channel || (!isOwner && !hasAdminRole)) {
        return i.reply({ content: 'هذا ليس رومك أو لست متصلا به', ephemeral: true });
    }

    if (activeCollectors.has(i.user.id)) {
        const oldCollector = activeCollectors.get(i.user.id);
        oldCollector.stop();
        activeCollectors.delete(i.user.id);
    }

    const reply = (text) => i.reply({ content: text, ephemeral: true });

    if (i.customId === 'lock') {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: false });
        reply('تم قفل الروم');
    } 
    else if (i.customId === 'unlock') {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: true });
        reply('تم فتح الروم');
    } 
    else if (i.customId === 'hide') {
        await channel.permissionOverwrites.edit(i.guild.id, { ViewChannel: false });
        reply('تم اخفاء الروم');
    } 
    else if (i.customId === 'unhide') {
        await channel.permissionOverwrites.edit(i.guild.id, { ViewChannel: true });
        reply('تم اظهار الروم');
    } 
    else if (['rename', 'transfer', 'limit', 'ban', 'allow', 'kick', 'mute', 'unmute'].includes(i.customId)) {
        await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: true }).catch(() => {});

        if (i.customId === 'rename') reply('اكتب الاسم الجديد للروم');
        else if (i.customId === 'transfer') reply('ارفق منشن الشخص الذي تريد نقل الملكية له');
        else if (i.customId === 'limit') reply('اكتب حد الروم');
        else reply('ارفق منشن الشخص');

        const col = i.channel.createMessageCollector({ filter: m => m.author.id === i.user.id, time: 20000 });
        activeCollectors.set(i.user.id, col);

        col.on('collect', async m => {
            await m.delete().catch(() => {});
            await i.channel.permissionOverwrites.delete(i.user.id).catch(() => {});

            if (i.customId === 'rename') {
                await channel.setName(m.content);
                i.followUp({ content: 'تم تغيير الاسم', ephemeral: true });
            } 
            else if (i.customId === 'transfer') {
                const member = m.mentions.members.first();
                if (!member) i.followUp({ content: 'منشن غير صحيح', ephemeral: true });
                else if (!channel.members.has(member.id)) i.followUp({ content: 'الشخص ليس برومك', ephemeral: true });
                else {
                    roomOwners.set(channel.id, member.id);
                    i.followUp({ content: 'تم نقل الملكية', ephemeral: true });
                }
            } 
            else if (i.customId === 'limit') {
                const limit = parseInt(m.content);
                if (isNaN(limit)) i.followUp({ content: 'رقم غير صحيح', ephemeral: true });
                else if (limit > 50) i.followUp({ content: 'اعلى حد 50', ephemeral: true });
                else {
                    await channel.setUserLimit(limit);
                    i.followUp({ content: 'تم ضبط الحد', ephemeral: true });
                }
            }
            else {
                const member = m.mentions.members.first();
                if (!member) i.followUp({ content: 'منشن غير صحيح', ephemeral: true });
                else {
                    if (i.customId === 'ban') {
                        await channel.permissionOverwrites.edit(member.id, { Connect: false });
                        i.followUp({ content: 'تم منع الشخص', ephemeral: true });
                    } else if (i.customId === 'allow') {
                        await channel.permissionOverwrites.edit(member.id, { Connect: null });
                        i.followUp({ content: 'تم السماح للشخص', ephemeral: true });
                    } else if (i.customId === 'kick') {
                        if (member.voice.channelId === channel.id) {
                            await member.voice.disconnect();
                            i.followUp({ content: 'تم طرد العضو', ephemeral: true });
                        } else i.followUp({ content: 'الشخص ليس برومك', ephemeral: true });
                    } else if (i.customId === 'mute') {
                        await member.voice.setMute(true).catch(() => {});
                        i.followUp({ content: 'تم اعطاء ميوت', ephemeral: true });
                    } else if (i.customId === 'unmute') {
                        await member.voice.setMute(false).catch(() => {});
                        i.followUp({ content: 'تم فك الميوت', ephemeral: true });
                    }
                }
            }

            activeCollectors.delete(i.user.id);
            col.stop();
        });

        col.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await i.channel.permissionOverwrites.delete(i.user.id).catch(() => {});
                activeCollectors.delete(i.user.id);
            }
        });
    }
});

const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('I am alive');
}).listen(3000);

client.login(process.env.TOKEN);
