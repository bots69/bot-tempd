const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// أرقام الآيديات المطلوبة بدقة
const CREATE_VOICE_CHANNEL_ID = '1536689417136119888';
const CONTROL_TEXT_CHANNEL_ID = '1536693109662949406';

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Bot is ready.`);

    // إرسال لوحة التحكم تلقائياً في الروم المحدد بمجرد تشغيل البوت
    try {
        const textChannel = await client.channels.fetch(CONTROL_TEXT_CHANNEL_ID);
        if (textChannel && textChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setTitle('Temp Control')
                .setDescription('للتحكم بالروم الضغط على الازار')
                .setColor(0x2f3136);

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('temp_rename').setLabel('تغير الاسم').setEmoji('👤').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('temp_transfer').setLabel('نقل الملكية').setEmoji('✍️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('temp_limit').setLabel('حد الروم').setEmoji('🎧').setStyle(ButtonStyle.Secondary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('temp_lock').setLabel('قفل الروم').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('temp_unlock').setLabel('فتح الروم').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('temp_hide').setLabel('اخفاء الروم').setEmoji('👁️‍🗨️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('temp_unhide').setLabel('اظهار الروم').setEmoji('👁️').setStyle(ButtonStyle.Secondary)
            );

            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('temp_ban').setLabel('منع').setEmoji('👤').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('temp_allow').setLabel('السماح').setEmoji('👤').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('temp_kick').setLabel('طرد عضو').setEmoji('🚪').setStyle(ButtonStyle.Secondary)
            );

            const row4 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('temp_mute').setLabel('ميوت').setEmoji('🎤').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('temp_unmute').setLabel('فك ميوت').setEmoji('🎙️').setStyle(ButtonStyle.Secondary)
            );

            await textChannel.send({
                embeds: [embed],
                components: [row1, row2, row3, row4]
            });
            console.log('تم إرسال لوحة التحكم تلقائياً في الروم المحدد بنجاح.');
        }
    } catch (error) {
        console.error('فشل إرسال اللوحة تلقائياً:', error);
    }
});

// نظام إنشاء الروم الصوتي تلقائياً عند دخول الآيدي المحدد
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
            const member = newState.member;
            const guild = newState.guild;

            const channel = await guild.channels.create({
                name: `room-${member.user.username}`,
                type: ChannelType.GuildVoice,
                parent: newState.channel.parentId,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.Connect],
                    },
                    {
                        id: member.id,
                        allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers],
                    },
                ],
            });

            await member.voice.setChannel(channel);
        }
    } catch (error) {
        console.error('خطأ أثناء إنشاء الروم الصوتي:', error);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '-setup' || message.content === '!setup') {
        const embed = new EmbedBuilder()
            .setTitle('Temp Control')
            .setDescription('للتحكم بالروم الضغط على الازار')
            .setColor(0x2f3136);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('temp_rename').setLabel('تغير الاسم').setEmoji('👤').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('temp_transfer').setLabel('نقل الملكية').setEmoji('✍️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('temp_limit').setLabel('حد الروم').setEmoji('🎧').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('temp_lock').setLabel('قفل الروم').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('temp_unlock').setLabel('فتح الروم').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('temp_hide').setLabel('اخفاء الروم').setEmoji('👁️‍🗨️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('temp_unhide').setLabel('اظهار الروم').setEmoji('👁️').setStyle(ButtonStyle.Secondary)
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('temp_ban').setLabel('منع').setEmoji('👤').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('temp_allow').setLabel('السماح').setEmoji('👤').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('temp_kick').setLabel('طرد عضو').setEmoji('🚪').setStyle(ButtonStyle.Secondary)
        );

        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('temp_mute').setLabel('ميوت').setEmoji('🎤').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('temp_unmute').setLabel('فك ميوت').setEmoji('🎙️').setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({
            embeds: [embed],
            components: [row1, row2, row3, row4]
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
        return interaction.reply({ content: 'يجب أن تكون داخل روم صوتي لكي تستخدم أزرار التحكم!', ephemeral: true });
    }

    try {
        if (interaction.customId === 'temp_lock') {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
            await interaction.reply({ content: '🔒 تم قفل الروم بنجاح.', ephemeral: true });
        } 
        else if (interaction.customId === 'temp_unlock') {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
            await interaction.reply({ content: '🔓 تم فتح الروم بنجاح.', ephemeral: true });
        } 
        else if (interaction.customId === 'temp_hide') {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
            await interaction.reply({ content: '👁️‍🗨️ تم اخفاء الروم بنجاح.', ephemeral: true });
        } 
        else if (interaction.customId === 'temp_unhide') {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true });
            await interaction.reply({ content: '👁️ تم اظهار الروم بنجاح.', ephemeral: true });
        }
        else if (interaction.customId === 'temp_mute') {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Speak: false });
            await interaction.reply({ content: '🎤 تم عمل ميوت للروم.', ephemeral: true });
        }
        else if (interaction.customId === 'temp_unmute') {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Speak: true });
            await interaction.reply({ content: '🎙️ تم فك الميوت عن الروم.', ephemeral: true });
        }
        else {
            await interaction.reply({ content: 'تم استلام طلبك وجاري معالجته.', ephemeral: true });
        }
    } catch (error)  {
        console.error(error);
        await interaction.reply({ content: 'حدث خطأ أثناء تنفيذ الأمر، تأكد أن البوت يملك صلاحيات كافية.', ephemeral: true });
    }
});

client.login(process.env.TOKEN);
