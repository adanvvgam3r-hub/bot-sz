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

// --- DATABASE HELPERS ---
function getData() {
    try {
        return JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    } catch (e) { return {}; }
}

function updateStats(userId, type, result) {
    const db = getData();
    if (!db[userId]) db[userId] = { x1_v: 0, x1_d: 0, ap_v: 0, ap_d: 0 };
    db[userId][`${type}_${result}`] += 1;
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

// --- RANKING AUTO-UPDATE ---
async function atualizarRankingGlobal() {
    const channel = client.channels.cache.get(CONFIG.CHANNELS.RANKING);
    if (!channel) return;

    const db = getData();
    const sorted = Object.entries(db)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.x1_v + b.ap_v) - (a.x1_v + a.ap_v)) // Ordena por total de vitórias
        .slice(0, 10);

    const embed = new EmbedBuilder()
        .setTitle("🏆 TOP 10 RANKING GERAL (X1 & AP)")
        .setColor("#FFD700")
        .setTimestamp()
        .setDescription(sorted.map((u, i) => `**${i+1}º** <@${u.id}> — Vitórias: \`${u.x1_v + u.ap_v}\` | Derrotas: \`${u.x1_d + u.ap_d}\``).join("\n") || "Nenhum dado registrado.");

    const messages = await channel.messages.fetch({ limit: 5 });
    const lastMsg = messages.find(m => m.author.id === client.user.id);

    if (lastMsg) await lastMsg.edit({ embeds: [embed] });
    else await channel.send({ embeds: [embed] });
}

// --- SLASH COMMANDS SETUP ---
const commands = [
    new SlashCommandBuilder().setName("x1").setDescription("Criar desafio de X1").toJSON(),
    new SlashCommandBuilder().setName("apostado").setDescription("Criar desafio Apostado").toJSON(),
    new SlashCommandBuilder().setName("perfil").setDescription("Ver perfil de um jogador")
        .addUserOption(opt => opt.setName("user").setDescription("Usuário para ver perfil")).toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log("Comandos registrados com sucesso!");
    } catch (e) { console.error(e); }
})();

// --- EVENTOS ---
client.once("ready", () => {
    console.log(`Bot logado como ${client.user.tag}`);
    atualizarRankingGlobal(); // Atualiza ao ligar
});

client.on("interactionCreate", async (interaction) => {
    
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
        const { commandName, channelId } = interaction;

        if (commandName === "perfil") {
            if (channelId !== CONFIG.CHANNELS.PERFIL) return interaction.reply({ content: "Use no canal de perfil.", ephemeral: true });
            const target = interaction.options.getUser("user") || interaction.user;
            const s = getData()[target.id] || { x1_v: 0, x1_d: 0, ap_v: 0, ap_d: 0 };

            const embed = new EmbedBuilder()
                .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
                .setThumbnail(target.displayAvatarURL())
                .setColor("#2b2d31")
                .addFields(
                    { name: "💰 v/d em ap:", value: `V **${s.ap_v}** | **${s.ap_d}** D`, inline: true },
                    { name: "⚔️ v/d em x1:", value: `V **${s.x1_v}** | **${s.x1_d}** D`, inline: true }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === "x1" || commandName === "apostado") {
            const validChannel = commandName === "x1" ? CONFIG.CHANNELS.X1 : CONFIG.CHANNELS.APOSTADO;
            if (channelId !== validChannel) return interaction.reply({ content: `Use este comando em <#${validChannel}>.`, ephemeral: true });

            const modal = new ModalBuilder().setCustomId(`modal_${commandName}`).setTitle(`Novo ${commandName}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("mapa").setLabel("Qual o Mapa?").setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("oponente").setLabel("ID do Oponente (vazio = qualquer um)").setStyle(TextInputStyle.Short).setRequired(false))
            );
            if (commandName === "apostado") {
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("valor").setLabel("Valor da Aposta (R$)").setStyle(TextInputStyle.Short)));
            }
            return interaction.showModal(modal);
        }
    }

    // 2. RECEBIMENTO DE MODAIS
    if (interaction.isModalSubmit()) {
        const type = interaction.customId.replace("modal_", "");
        const mapa = interaction.fields.getTextInputValue("mapa");
        const oponenteId = interaction.fields.getTextInputValue("oponente");
        const valor = type === "apostado" ? interaction.fields.getTextInputValue("valor") : null;

        const embed = new EmbedBuilder()
            .setTitle(type === "x1" ? "⚔️ NOVO DESAFIO X1" : "💰 NOVO DESAFIO APOSTADO")
            .setDescription(`**Desafiante:** ${interaction.user}\n**Mapa:** \`${mapa}\`${valor ? `\n**Valor:** \`R$ ${valor}\`` : ""}\n\n${oponenteId ? `**Foco:** <@${oponenteId}>` : "Qualquer um pode aceitar!"}`)
            .setColor(type === "x1" ? "Blue" : "Gold");

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aceitar_${type}_${interaction.user.id}_${oponenteId || "any"}`).setLabel("ACEITAR DESAFIO").setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [btn] });
    }

    // 3. BOTÃO DE ACEITAR
    if (interaction.isButton() && interaction.customId.startsWith("aceitar_")) {
        const [, type, criadorId, alvoId] = interaction.customId.split("_");

        if (interaction.user.id === criadorId) return interaction.reply({ content: "Você não pode se auto-desafiar.", ephemeral: true });
        if (alvoId !== "any" && interaction.user.id !== alvoId) return interaction.reply({ content: "Este desafio foi feito para outra pessoa.", ephemeral: true });

        // Criar Canal Privado
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

        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`win_ad1_${criadorId}_${interaction.user.id}_${type}`).setLabel("Vencedor AD1").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`win_ad2_${criadorId}_${interaction.user.id}_${type}`).setLabel("Vencedor AD2").setStyle(ButtonStyle.Success)
        );

        await canal.send({ content: `<@&${CONFIG.ROLES.STAFF}>`, embeds: [new EmbedBuilder().setTitle("PARTIDA INICIADA").setDescription(`**AD1:** <@${criadorId}>\n**AD2:** ${interaction.user}`).setColor("Green")], components: [botoes] });
        await interaction.update({ content: `✅ Desafio aceito! Canal criado: ${canal}`, embeds: [], components: [] });
    }

    // 4. DECLARAR VENCEDOR (STAFF)
    if (interaction.isButton() && interaction.customId.startsWith("win_")) {
        if (!interaction.member.roles.cache.has(CONFIG.ROLES.STAFF) && !interaction.member.roles.cache.has(CONFIG.ROLES.DONO)) {
            return interaction.reply({ content: "Apenas Staff ou Dono!", ephemeral: true });
        }

        const [, winnerKey, p1, p2, type] = interaction.customId.split("_");
        const winId = winnerKey === "ad1" ? p1 : p2;
        const lossId = winnerKey === "ad1" ? p2 : p1;

        updateStats(winId, type, 'v');
        updateStats(lossId, type, 'd');
        await atualizarRankingGlobal();

        const logChan = client.channels.cache.get(type === "x1" ? CONFIG.CHANNELS.X1 : CONFIG.CHANNELS.APOSTADO);
        if (logChan) logChan.send(`🏁 **Resultado Registrado!**\n🏆 Vencedor: <@${winId}>\n💀 Perdedor: <@${lossId}>`);

        await interaction.reply("✅ Vitória registrada no ranking e banco de dados. Deletando canal...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(process.env.TOKEN);
