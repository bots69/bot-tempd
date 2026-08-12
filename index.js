const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

const CREATE_VOICE_CHANNEL_ID = '1536689417136119888';
const PARENT_CATEGORY_ID = '1535491760627646524';
const roomOwners = new Map();

client.on('ready', () => console.log('Bot is ready!'));

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
        const channel = await newState.guild.channels.create({
            name: `chanell ${newState.member.user.username}`,
            type: ChannelType.GuildVoice,
            parent: PARENT_CATEGORY_ID,
        });
        roomOwners.set(channel.id, newState.member.id);
        await newState.member.voice.setChannel(channel);
    }
    if (oldState.channelId && oldState.channelId !== CREATE_VOICE_CHANNEL_ID) {
        const channel = oldState.channel;
        if (channel && channel.name.startsWith('chanell') && channel.members.size === 0) {
            roomOwners.delete(channel.id);
            await channel.delete().catch(() => {});
        }
    }
});

client.on('messageCreate', async (msg) => {
    if (msg.content === '-setup') {
        const embed = new EmbedBuilder().setTitle('Temp Control').setDescription('للتحكم بالروم اضغط على الازرار').setColor(0x2f3136);
        
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

client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const channel = i.member.voice.channel;
    if (!channel || roomOwners.get(channel.id) !== i.user.id) {
        return i.reply({ content: 'انت مو برومك!', ephemeral: true });
    }

    const reply = (text) => i.reply({ content: text, ephemeral: true });

    if (i.customId === 'lock') {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: false });
        reply('تم قفل الروم');
    } else if (i.customId === 'unlock') {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: true });
        reply('تم فتح الروم');
    } else if (i.customId === 'hide') {
        await channel.permissionOverwrites.edit(i.guild.id, { ViewChannel: false });
        reply('تم اخفاء الروم');
    } else if (i.customId === 'unhide') {
        await channel.permissionOverwrites.edit(i.guild.id, { ViewChannel: true });
        reply('تم اظهار الروم');
    } else if (i.customId === 'rename') {
        reply('اكتب الاسم الجديد للروم');
        const col = i.channel.createMessageCollector({ filter: m => m.author.id === i.user.id, time: 20000 });
        col.on('collect', async m => {
            await m.delete();
            await channel.setName(m.content);
            i.followUp({ content: 'تم تغيير الاسم', ephemeral: true });
            col.stop();
        });
    }
    // يمكن تكرار نفس منطق الـ messageCollector لبقية الأزرار (ban, mute, transfer...)
});

const http = require('http');
http.createServer((req, res) => res.end('Alive')).listen(3000);
client.login(process.env.TOKEN);
