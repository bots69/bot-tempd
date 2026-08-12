const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

const CREATE_VOICE_CHANNEL_ID = '1536689417136119888';
const PARENT_CATEGORY_ID = '1535491760627646524';
const ADMIN_ROLE_ID = '1535375782736560128';
const TARGET_ROOM_ID = '1536693109662949406'; // الروم المحدد فقط لحذف الرسائل وقفل الشات
const SECRET_WORD = 'كلمة_السر'; // ضع الكلمة المطلوبة هنا
const roomOwners = new Map();
const activeCollectors = new Map();

client.on('ready', () => {
    console.log(`Bot is ready as ${client.user.tag}`);
});

// نظام مراقبة الرسائل: مخصص حصرياً للروم المحدد لحذف الرسالة وقفل الشات نهائياً
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    if (msg.channel.id === TARGET_ROOM_ID) {
        if (msg.content.trim() === SECRET_WORD) {
            try {
                // 1. حذف رسالة العضو فوراً
                await msg.delete().catch(() => {});
            } catch (error) {}

            try {
                // 2. إزالة أية صلاحيات مخصصة وإغلاق الروم تماماً
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

// نظام إنشاء وحذف الرومات المؤقتة
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
        const channel = await newState.guild.channels.create({
            name: `channel ${newState.member.user.username}`,
            type: ChannelType.GuildVoice,
            parent: PARENT_CATEGORY_ID,
        });
        roomOwners.set(channel.id, newState.member.id);
        await newState.member.voice.setChannel(channel);
    }

    if (oldState.channelId && oldState.channelId !== CREATE_VOICE_CHANNEL_ID) {
        const channel = oldState.channel;
        if (channel && roomOwners.has(channel.id) && channel.members.size === 0) {
            roomOwners.delete(channel.id);
            activeCollectors.delete(channel.id);
            await channel.delete().catch(() => {});
        }
    }
});

// نظام الأزرار والتحكم الكامل
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
        // فتح الشات مؤقتاً لتلقي كتابة المستخدم
        await i.channel.permissionOverwrites.edit(i.user.id, { SendMessages: true }).catch(() => {});

        if (i.customId === 'rename') {
            reply('اكتب الاسم الجديد للروم');
        } else if (i.customId === 'transfer') {
            reply('ارفق منشن الشخص الذي تريد نقل الملكية له');
        } else if (i.customId === 'limit') {
            reply('اكتب حد الروم');
        } else {
            reply('ارفق منشن الشخص');
        }

        const col = i.channel.createMessageCollector({ filter: m => m.author.id === i.user.id, time: 20000 });
        activeCollectors.set(i.user.id, col);

        col.on('collect', async m => {
            await m.delete().catch(() => {});

            // حذف صلاحية الكتابة وتفريغها تماماً (لتعود إلى وضع الشرطة / الحياد) فور كتابة الرسالة
            await channel.permissionOverwrites.delete(i.user.id).catch(() => {});

            if (i.customId === 'rename') {
                await channel.setName(m.content);
                i.followUp({ content: 'تم تغيير الاسم', ephemeral: true });
            } 
            else if (i.customId === 'transfer') {
                const member = m.mentions.members.first();
                if (!member) {
                    i.followUp({ content: 'منشن غير صحيح', ephemeral: true });
                } else if (!channel.members.has(member.id)) {
                    i.followUp({ content: 'الشخص ليس برومك', ephemeral: true });
                } else {
                    roomOwners.set(channel.id, member.id);
                    i.followUp({ content: 'تم نقل الملكية', ephemeral: true });
                }
            } 
            else if (i.customId === 'limit') {
                const limit = parseInt(m.content);
                if (isNaN(limit)) {
                    i.followUp({ content: 'رقم غير صحيح', ephemeral: true });
                } else if (limit > 50) {
                    i.followUp({ content: 'اعلى حد 50', ephemeral: true });
                } else {
                    await channel.setUserLimit(limit);
                    if (channel.members.size > limit) {
                        const membersArray = Array.from(channel.members.values());
                        const ownerId = roomOwners.get(channel.id);
                        const extraMembers = membersArray.filter(m => m.id !== ownerId);
                        while (channel.members.size > limit && extraMembers.length > 0) {
                            const randomIndex = Math.floor(Math.random() * extraMembers.length);
                            const randomMember = extraMembers.splice(randomIndex, 1)[0];
                            await randomMember.voice.disconnect().catch(() => {});
                        }
                    }
                    i.followUp({ content: 'تم ضبط الحد', ephemeral: true });
                }
            }
            else {
                const member = m.mentions.members.first();
                if (!member) {
                    i.followUp({ content: 'منشن غير صحيح', ephemeral: true });
                } else {
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
                        } else {
                            i.followUp({ content: 'الشخص ليس برومك', ephemeral: true });
                        }
                    } else if (i.customId === 'mute') {
                        await channel.permissionOverwrites.edit(member.id, { Speak: false });
                        i.followUp({ content: 'تم اعطاء ميوت', ephemeral: true });
                    } else if (i.customId === 'unmute') {
                        await channel.permissionOverwrites.edit(member.id, { Speak: null });
                        i.followUp({ content: 'تم فك الميوت', ephemeral: true });
                    }
                }
            }

            activeCollectors.delete(i.user.id);
            col.stop();
        });

        // إذا انتهى الوقت (20 ثانية) ولم يتم إرسال شيء، قم بحذف الصلاحية أيضاً
        col.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await channel.permissionOverwrites.delete(i.user.id).catch(() => {});
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
