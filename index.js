require("dotenv").config();
const fs = require("fs");
const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, 
    EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits 
} = require("discord.js");

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const CONFIG = {
    CHANNELS: {
        RANKING: "1473874178766671993",
        APOSTADO: "1473873854232264886",
        X1: "1473873994674606231",
        PERFIL: "1452832353897681108"
    },
    ROLES: {
        STAFF: "1452822476949029001",
        DONO: "1452822605773148312"
    }
};

// --- DATABASE ---
function getData() {
    try {
        if (!fs.existsSync('./database.json')) fs.writeFileSync('./database.json', '{}');
        return JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    } catch (e) { return {}; }
}

function updateStats(userId, type, result) {
    const db = getData();
    if (!db[userId]) db[userId] = { x1_v: 0, x1_d: 0, ap_v: 0, ap_d: 0 };
    db[userId][`${type}_${result}`] += 1;
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

// --- RANKING (LOOP 2 MINUTOS) ---
async function atualizarRankingGlobal() {
    try {
        const channel = client.channels.cache.get(CONFIG.CHANNELS.RANKING);
        if (!channel) return;

        const db = getData();
        const sorted = Object.entries(db)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => (b.x1_v + b.ap_v) - (a.x1_v + a.ap_v))
            .slice(0, 10);

        const embed = new EmbedBuilder()
            .setTitle("🏆 TOP 10 RANKING GERAL")
            .setColor("#FFD700")
            .setTimestamp()
            .setDescription(sorted.map((u, i) => `**${i+1}º** <@${u.id}> — Vitórias: \`${u.x1_v + u.ap_v}\` | Derrotas: \`${u.x1_d + u.ap_d}\``).join("\n") || "Nenhum dado.");

        const messages = await channel.messages.fetch({ limit: 10 });
        const lastMsg = messages.find(m => m.author.id === client.user.id);

        if (lastMsg) await lastMsg.edit({ embeds: [embed] });
        else await channel.send({ embeds: [embed] });
    } catch (e) { console.error("Erro no ranking:", e); }
}

// --- COMANDOS ---
const commands = [
    new SlashCommandBuilder().setName("x1").setDescription("Criar desafio de X1").toJSON(),
    new SlashCommandBuilder().setName("apostado").setDescription("Criar desafio Apostado").toJSON(),
    new SlashCommandBuilder().setName("perfil").setDescription("Ver perfil").addUserOption(o => o.setName("user").setDescription("Usuário")).toJSON(),
    new SlashCommandBuilder().setName("parceria").setDescription("Criar parceria").toJSON(),
    new SlashCommandBuilder().setName("xcla").setDescription("Registrar X-Clã").toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log("Comandos OK!");
    } catch (e) { console.error(e); }
})();

// --- EVENTOS ---
client.once("ready", () => {
    console.log(`Bot online: ${client.user.tag}`);
    setInterval(atualizarRankingGlobal, 120000);
});

client.on("interactionCreate", async (interaction) => {
    
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === "perfil") {
            const target = interaction.options.getUser("user") || interaction.user;
            const s = getData()[target.id] || { x1_v: 0, x1_d: 0, ap_v: 0, ap_d: 0 };
            const embed = new EmbedBuilder()
                .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: "💰 v/d em ap:", value: `V **${s.ap_v}** | **${s.ap_d}** D`, inline: true },
                    { name: "⚔️ v/d em x1:", value: `V **${s.x1_v}** | **${s.x1_d}** D`, inline: true }
                ).setColor("#2b2d31");
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === "x1" || commandName === "apostado") {
            const modal = new ModalBuilder().setCustomId(`modal_${commandName}`).setTitle(`Novo ${commandName}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("mapa").setLabel("Mapa").setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("oponente").setLabel("ID Oponente (vazio = qualquer)").setStyle(TextInputStyle.Short).setRequired(false))
            );
            if (commandName === "apostado") modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("valor").setLabel("Valor (R$)").setStyle(TextInputStyle.Short)));
            return interaction.showModal(modal);
        }

        if (commandName === "parceria") {
            const modal = new ModalBuilder().setCustomId("modal_parceria").setTitle("Nova Parceria");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nome_cla").setLabel("Clã").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("quem_fechou").setLabel("Fechado por").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("url_imagem").setLabel("Link Imagem").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("link_servidor").setLabel("Link Servidor").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (commandName === "xcla") {
            const modal = new ModalBuilder().setCustomId("modal_xcla").setTitle("Resultado X-Clã");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("clafora").setLabel("Clã FORA").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("resultado").setLabel("CASA X FORA").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("mapa").setLabel("Mapa").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("data").setLabel("Data").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        const { customId, fields } = interaction;

        if (customId === "modal_parceria") {
            return interaction.reply({
                embeds:}],
                components: [{ type: 1, components: [{ type: 2, label: "Entre no server", style: 5, url: fields.getTextInputValue("link_servidor") }]}]
            });
        }

        if (customId === "modal_xcla") {
            return interaction.reply({ embeds: [{ title: "⚔️ Resultado de X-Clã", color: 10181046, fields: [
                { name: "🏴 Clã CASA", value: "SZ", inline: true }, { name: "🏳️ Clã FORA", value: fields.getTextInputValue("clafora"), inline: true },
                { name: "📊 Resultado", value: `CASA ${fields.getTextInputValue("resultado")} FORA` },
                { name: "🗺️ Mapa", value: fields.getTextInputValue("mapa") }, { name: "⏰ Data", value: fields.getTextInputValue("data"), inline: true }
            ]}]});
        }

        if (customId.startsWith("modal_x1") || customId.startsWith("modal_apostado")) {
            const type = customId.replace("modal_", "");
            const embed = new EmbedBuilder().setTitle(`DESAFIO ${type.toUpperCase()}`).setDescription(`**Mapa:** ${fields.getTextInputValue("mapa")}\n**Desafiante:** ${interaction.user}`).setColor("Blue");
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`aceitar_${type}_${interaction.user.id}_${fields.getTextInputValue("oponente") || "any"}`).setLabel("ENTRAR").setStyle(ButtonStyle.Primary));
            return interaction.reply({ embeds: [embed], components: [btn] });
        }
    }

    if (interaction.isButton()) {
        const [action, ...args] = interaction.customId.split("_");

        if (action === "aceitar") {
            const [type, criadorId, alvoId] = args;
            if (interaction.user.id === criadorId) return interaction.reply({ content: "Não pode entrar no seu jogo.", ephemeral: true });
            
            const canal = await interaction.guild.channels.create({
                name: `🥊-${type}-${interaction.user.username}`,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: criadorId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: CONFIG.ROLES.STAFF, allow: [PermissionFlagsBits.ViewChannel] },
                    { id: CONFIG.ROLES.DONO, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            const btns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`win_ad1_${criadorId}_${interaction.user.id}_${type}`).setLabel("Vencedor AD1").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`win_ad2_${criadorId}_${interaction.user.id}_${type}`).setLabel("Vencedor AD2").setStyle(ButtonStyle.Success)
            );
            await canal.send({ content: `<@&${CONFIG.ROLES.STAFF}>, declare o vencedor:`, components: [btns] });
            return interaction.update({ content: `✅ Canal: ${canal}`, embeds: [], components: [] });
        }

        if (action === "win") {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.STAFF) && !interaction.member.roles.cache.has(CONFIG.ROLES.DONO)) return interaction.reply({ content: "Sem permissão.", ephemeral: true });
            const [winnerKey, p1, p2, type] = args;
            updateStats(winnerKey === "ad1" ? p1 : p2, type, 'v');
            updateStats(winnerKey === "ad1" ? p2 : p1, type, 'd');
            await atualizarRankingGlobal();
            await interaction.reply("🏆 Resultado salvo! Deletando em 5s...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }
});

client.login(process.env.TOKEN);
