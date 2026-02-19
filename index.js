require("dotenv").config();
const fs = require("fs");
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, 
  ButtonStyle, ChannelType, PermissionFlagsBits
} = require("discord.js");

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

// CONFIGURAÇÃO DE IDS (Conforme solicitado)
const IDS = {
  CHANNELS: {
    RANKING: "1473874178766671993",
    APOSTADO: "1473873854232264886",
    X1: "1473873994674606231",
    SIMU: "1465842384586670254"
  },
  ROLES: {
    STAFF: "1452822476949029001",
    DONO: "1452822605773148312",
    ORGANIZADOR: "1453126709447754010"
  }
};

// REGISTRO DE COMANDOS
const commands = [
  new SlashCommandBuilder().setName("parceria").setDescription("Criar parceria com modal"),
  new SlashCommandBuilder().setName("xcla").setDescription("Registrar resultado de X-Clã"),
  new SlashCommandBuilder()
    .setName("x1")
    .setDescription("Criar um desafio X1")
    .addStringOption(opt => opt.setName("mapa").setDescription("Qual o mapa?").setRequired(true))
    .addUserOption(opt => opt.setName("oponente").setDescription("Desafiar alguém específico")),
  new SlashCommandBuilder()
    .setName("apostado")
    .setDescription("Criar um desafio Apostado")
    .addStringOption(opt => opt.setName("mapa").setDescription("Qual o mapa?").setRequired(true))
    .addStringOption(opt => opt.setName("valor").setDescription("Valor da aposta (R$)").setRequired(true))
    .addUserOption(opt => opt.setName("oponente").setDescription("Desafiar alguém específico")),
  new SlashCommandBuilder().setName("ranking").setDescription("Ver o ranking de Simu"),
  new SlashCommandBuilder()
    .setName("simu")
    .setDescription("Criar uma Simulação/Copa")
    .addStringOption(opt => opt.setName("mapa").setDescription("Mapa da Simu").setRequired(true))
    .addIntegerOption(opt => opt.setName("vagas").setDescription("Total de participantes (ex: 4, 8, 16)").setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log("✅ Comandos registrados com sucesso!");
  } catch (e) { console.error(e); }
})();

// FUNÇÃO DE RANKING
function updateRank(userId, win) {
  if (!fs.existsSync("./database.json")) fs.writeFileSync("./database.json", "{}");
  let data = JSON.parse(fs.readFileSync("./database.json", "utf8"));
  if (!data[userId]) data[userId] = { v: 0, d: 0 };
  if (win) data[userId].v += 1; else data[userId].d += 1;
  fs.writeFileSync("./database.json", JSON.stringify(data, null, 2));
}

client.once("ready", () => console.log(`🚀 Bot online: ${client.user.tag}`));

client.on("interactionCreate", async (interaction) => {

  // 1. TRATAMENTO DE COMANDOS SLASH
  if (interaction.isChatInputCommand()) {
    
    // --- X1 & APOSTADO ---
    if (interaction.commandName === "x1" || interaction.commandName === "apostado") {
      const isApostado = interaction.commandName === "apostado";
      const canalCerto = isApostado ? IDS.CHANNELS.APOSTADO : IDS.CHANNELS.X1;
      if (interaction.channelId !== canalCerto) return interaction.reply({ content: `Use em <#${canalCerto}>`, ephemeral: true });

      const mapa = interaction.options.getString("mapa");
      const oponente = interaction.options.getUser("oponente");
      const valor = isApostado ? interaction.options.getString("valor") : "0";

      const embed = new EmbedBuilder()
        .setTitle(isApostado ? "💰 NOVO APOSTADO" : "⚔️ NOVO X1")
        .setColor(isApostado ? "Gold" : "Blue")
        .addFields({ name: "Mapa", value: mapa, inline: true }, { name: "Desafiante", value: interaction.user.toString(), inline: true });
      if (isApostado) embed.addFields({ name: "Aposta", value: `R$ ${valor}`, inline: true });

      const btn = new ButtonBuilder()
        .setCustomId(`aceitar_${interaction.user.id}_${oponente?.id || "aberto"}_${valor}`)
        .setLabel(oponente ? `Aceitar de ${interaction.user.username}` : "Entrar no X1")
        .setStyle(ButtonStyle.Success);

      await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
    }

    // --- RANKING ---
    if (interaction.commandName === "ranking") {
      let data = JSON.parse(fs.readFileSync("./database.json", "utf8"));
      let sorted = Object.entries(data).sort((a, b) => b[1].v - a[1].v).slice(0, 10);
      let txt = sorted.map((u, i) => `${i+1}º <@${u[0]}> - 🏆 ${u[1].v} | 💀 ${u[1].d}`).join("\n");
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("📊 Ranking Simu").setDescription(txt || "Vazio").setColor("Gold")] });
    }

    // --- PARCERIA E X-CLÃ (SEUS ORIGINAIS) ---
    if (interaction.commandName === "parceria" || interaction.commandName === "xcla") {
       // ... (Aqui vai a lógica dos seus modais que você já tem)
       // Coloquei um aviso simples para encurtar o código, mas você pode colar seus modais aqui.
       await interaction.reply({ content: "Abra o modal de parceria/xclã aqui.", ephemeral: true });
    }
  }

  // 2. TRATAMENTO DE BOTÕES (X1 / ACEITAR)
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("aceitar_")) {
      const [_, criadorId, oponenteId, valor] = interaction.customId.split("_");

      if (oponenteId !== "aberto" && interaction.user.id !== oponenteId) return interaction.reply({ content: "Não é para você!", ephemeral: true });
      if (interaction.user.id === criadorId) return interaction.reply({ content: "Você não pode aceitar seu próprio desafio!", ephemeral: true });

      const channel = await interaction.guild.channels.create({
        name: `🥊-partida-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: criadorId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: IDS.ROLES.STAFF, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: IDS.ROLES.DONO, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`vencedor_${criadorId}_${interaction.user.id}_${valor}`).setLabel("Vitória AD1").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`vencedor_${interaction.user.id}_${criadorId}_${valor}`).setLabel("Vitória AD2").setStyle(ButtonStyle.Primary)
      );

      await channel.send({ content: `⚔️ **Partida Iniciada!**\nAD1: <@${criadorId}>\nAD2: <@${interaction.user.id}>\n\n*Apenas Staff pode finalizar.*`, components: [row] });
      await interaction.update({ content: `✅ Desafio aceito! Canal: <#${channel.id}>`, embeds: [], components: [] });
    }

    // 3. DECLARAR VENCEDOR (APENAS STAFF)
    if (interaction.customId.startsWith("vencedor_")) {
      if (!interaction.member.roles.cache.has(IDS.ROLES.STAFF) && !interaction.member.roles.cache.has(IDS.ROLES.DONO)) {
        return interaction.reply({ content: "Sem permissão!", ephemeral: true });
      }

      const [_, winId, loseId, valor] = interaction.customId.split("_");
      updateRank(winId, true);
      updateRank(loseId, false);

      const msg = valor !== "0" ? `<@${winId}> ganhou R$ ${valor}!` : `<@${winId}> venceu o X1!`;
      await client.channels.cache.get(valor !== "0" ? IDS.CHANNELS.APOSTADO : IDS.CHANNELS.X1).send(`🏆 **FIM DE JOGO:** ${msg}`);
      
      await interaction.reply("Registrado! Deletando em 5s...");
      setTimeout(() => interaction.channel.delete(), 5000);
    }
  }
});

// ANTI-CRASH (Essencial para não cair)
process.on('unhandledRejection', (reason, promise) => { console.error('Erro detectado:', reason); });

client.login(process.env.TOKEN);
