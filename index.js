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

// CONFIGURAÇÃO DE IDS
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

// Armazenamento temporário de Copas em andamento
const copasAtivas = new Map();

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
    .addStringOption(opt => opt.setName("tipo").setDescription("Tipo de jogo").addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}).setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log("✅ Comandos e Logs sincronizados!");
  } catch (e) { console.error(e); }
})();

// FUNÇÃO DE RANKING E LOGS
function updateRank(userId, win) {
  if (!fs.existsSync("./database.json")) fs.writeFileSync("./database.json", "{}");
  let data = JSON.parse(fs.readFileSync("./database.json", "utf8"));
  if (!data[userId]) data[userId] = { v: 0, d: 0 };
  if (win) data[userId].v += 1; else data[userId].d += 1;
  fs.writeFileSync("./database.json", JSON.stringify(data, null, 2));
  console.log(`[LOG] Ranking Atualizado: Usuário ${userId} | Vitória: ${win} | Hora: ${new Date().toLocaleTimeString()}`);
}

client.once("ready", () => console.log(`🚀 Bot SZ Online: ${client.user.tag}`));

client.on("interactionCreate", async (interaction) => {

  // --- COMANDOS SLASH ---
  if (interaction.isChatInputCommand()) {
    
    // RANKING ESTILIZADO (IGUAL À IMAGEM)
    if (interaction.commandName === "ranking") {
      let data = JSON.parse(fs.readFileSync("./database.json", "utf8"));
      let sorted = Object.entries(data).sort((a, b) => b[1].v - a[1].v || a[1].d - b[1].d).slice(0, 10);

      let table = "POS  JOGADOR                     #1   #2\n";
      table += "------------------------------------------\n";

      if (sorted.length === 0) table += "Nenhum dado registrado.";
      else {
        sorted.forEach(([id, stats], i) => {
          const user = client.users.cache.get(id);
          const name = (user ? user.username : "Desconhecido").substring(0, 20);
          table += `${(i+1).toString().padEnd(5)}${name.padEnd(25)}${stats.v.toString().padEnd(5)}${stats.d}\n`;
        });
      }

      const rankEmbed = new EmbedBuilder()
        .setTitle("🏆 Ranking Simu")
        .setColor(0x8B5CF6)
        .setDescription(`\`\`\`\n${table}\n\`\`\``)
        .setFooter({ text: "Atualizado automaticamente após cada final de Simu" });

      await interaction.reply({ embeds: [rankEmbed] });
    }

    // COMANDO SIMU (GERAR COPA)
    if (interaction.commandName === "simu") {
      if (!interaction.member.roles.cache.has(IDS.ROLES.ORGANIZADOR)) return interaction.reply({ content: "Sem permissão!", ephemeral: true });
      
      const mapa = interaction.options.getString("mapa");
      const vagas = interaction.options.getInteger("vagas");
      const tipo = interaction.options.getString("tipo");

      const embed = new EmbedBuilder()
        .setTitle("🏆 NOVA COPA INICIADA")
        .setColor("Purple")
        .addFields({ name: "🗺️ Mapa", value: mapa, inline: true }, { name: "👥 Vagas", value: `0/${vagas}`, inline: true })
        .setFooter({ text: "Clique abaixo para entrar!" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`inscrever_${interaction.id}`).setLabel("Inscrever-se").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`sair_${interaction.id}`).setLabel("Sair").setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      copasAtivas.set(interaction.id, { vagas, participantes: [], msgId: msg.id });
      console.log(`[LOG] Simu criada por ${interaction.user.tag} às ${new Date().toLocaleTimeString()}`);
    }

    // X1 E APOSTADO
    if (interaction.commandName === "x1" || interaction.commandName === "apostado") {
        const isApostado = interaction.commandName === "apostado";
        const mapa = interaction.options.getString("mapa");
        const oponente = interaction.options.getUser("oponente");
        const valor = isApostado ? interaction.options.getString("valor") : "0";

        const btn = new ButtonBuilder()
          .setCustomId(`aceitar_${interaction.user.id}_${oponente?.id || "aberto"}_${valor}`)
          .setLabel("Aceitar Desafio")
          .setStyle(ButtonStyle.Success);

        await interaction.reply({ 
            embeds: [new EmbedBuilder().setTitle(isApostado ? "💰 APOSTADO" : "⚔️ X1").setDescription(`Mapa: ${mapa}\nDesafiante: ${interaction.user}`).setColor("Blue")],
            components: [new ActionRowBuilder().addComponents(btn)] 
        });
    }
  }

  // --- BOTÕES ---
  if (interaction.isButton()) {
    // Inscrição Simu
    if (interaction.customId.startsWith("inscrever_") || interaction.customId.startsWith("sair_")) {
      const [acao, idCopa] = interaction.customId.split("_");
      const copa = copasAtivas.get(idCopa);
      if (!copa) return interaction.reply({ content: "Copa expirada.", ephemeral: true });

      if (acao === "inscrever") {
        if (copa.participantes.includes(interaction.user.id)) return interaction.reply({ content: "Já inscrito!", ephemeral: true });
        copa.participantes.push(interaction.user.id);
      } else {
        copa.participantes = copa.participantes.filter(id => id !== interaction.user.id);
      }

      await interaction.reply({ content: "Lista atualizada!", ephemeral: true });

      // Se lotar, gera Brackets
      if (copa.participantes.length >= copa.vagas) {
        const sorteados = [...copa.participantes].sort(() => Math.random() - 0.5);
        await interaction.channel.send("🚨 **Copa Lotada! Criando salas de confronto...**");
        
        for (let i = 0; i < sorteados.length; i += 2) {
            const p1 = sorteados[i], p2 = sorteados[i+1];
            if (!p2) break;
            const ch = await interaction.guild.channels.create({
                name: `🏆-simu-partida`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: p1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: p2, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: IDS.ROLES.STAFF, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`vencedor_${p1}_${p2}_0`).setLabel("Vencedor AD1").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`vencedor_${p2}_${p1}_0`).setLabel("Vencedor AD2").setStyle(ButtonStyle.Success)
            );
            await ch.send({ content: `Confronto: <@${p1}> vs <@${p2}>`, components: [row] });
        }
        copasAtivas.delete(idCopa);
      }
    }

    // Declaração de Vencedor (Staff)
    if (interaction.customId.startsWith("vencedor_")) {
      if (!interaction.member.roles.cache.has(IDS.ROLES.STAFF)) return interaction.reply({ content: "Só Staff!", ephemeral: true });
      const [_, winId, loseId, valor] = interaction.customId.split("_");
      updateRank(winId, true);
      updateRank(loseId, false);
      await interaction.reply("Resultado salvo! Canal fechando...");
      setTimeout(() => interaction.channel.delete(), 5000);
    }

    // Aceitar X1/Apostado
    if (interaction.customId.startsWith("aceitar_")) {
        const [_, criador, oponente, valor] = interaction.customId.split("_");
        if (oponente !== "aberto" && interaction.user.id !== oponente) return;
        
        const ch = await interaction.guild.channels.create({
            name: `🥊-x1-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: criador, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: IDS.ROLES.STAFF, allow: [PermissionFlagsBits.ViewChannel] }
            ]
        });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vencedor_${criador}_${interaction.user.id}_${valor}`).setLabel("Vitória AD1").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`vencedor_${interaction.user.id}_${criador}_${valor}`).setLabel("Vitória AD2").setStyle(ButtonStyle.Primary)
        );
        await ch.send({ content: `Iniciado! AD1: <@${criador}> vs AD2: ${interaction.user}`, components: [row] });
        await interaction.update({ content: "Desafio Aceito!", components: [] });
    }
  }
});

process.on('unhandledRejection', e => console.error('Erro:', e));
client.login(process.env.TOKEN);
