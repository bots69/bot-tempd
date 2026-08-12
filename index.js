const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// الآيديات المطلوبة
const CREATE_VOICE_CHANNEL_ID = '1535491760627646524'; // الآيدي اللي طلبت أن الرومات تنشأ فيه
const CONTROL_TEXT_CHANNEL_ID = '1536693109662949406';

client.on('ready', () => {
    console.log(`Bot is ready as ${client.user.tag}`);
});

// 1. نظام إنشاء الروم
client.on('voiceStateUpdate', async (oldState, newState) => {
    // عند دخول الروم الأساسي
    if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
        const guild = newState.guild;
        const member = newState.member;
        
        const channel = await guild.channels.create({
            name: `room-${member.user.username}`,
            type: ChannelType.GuildVoice,
            parent: newState.channel.parentId,
        });
        await member.voice.setChannel(channel);
    }

    // 2. نظام حذف الروم عند خروج الجميع
    if (oldState.channelId && oldState.channelId !== CREATE_VOICE_CHANNEL_ID) {
        const channel = oldState.channel;
        if (channel && channel.name.startsWith('room-') && channel.members.size === 0) {
            await channel.delete().catch(console.error);
        }
    }
});

// 3. أمر الـ Setup لإرسال الأزرار
client.on('messageCreate', async (message) => {
    if (message.content === '-setup') {
        const embed = new EmbedBuilder()
            .setTitle('لوحة التحكم بالروم')
            .setDescription('استخدم الأزرار أدناه للتحكم في غرفتك الصوتية.')
            .setColor(0x2f3136);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('temp_lock').setLabel('قفل').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('temp_unlock').setLabel('فتح').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('temp_hide').setLabel('إخفاء').setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ embeds: [embed], components: [row1] });
    }
});

// 4. معالجة الأزرار
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply({ content: 'لازم تدخل الروم أولاً!', ephemeral: true });

    if (interaction.customId === 'temp_lock') {
        await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
        interaction.reply({ content: '🔒 تم قفل الروم', ephemeral: true });
    } else if (interaction.customId === 'temp_unlock') {
        await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: true });
        interaction.reply({ content: '🔓 تم فتح الروم', ephemeral: true });
    } else if (interaction.customId === 'temp_hide') {
        await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
        interaction.reply({ content: '👁️ تم إخفاء الروم', ephemeral: true });
    }
});

const http = require('http');
http.createServer((req, res) => res.end('Alive')).listen(3000);

client.login(process.env.TOKEN);
