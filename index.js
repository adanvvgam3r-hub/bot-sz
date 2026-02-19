require("dotenv").config();
const fs = require("fs");
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, 
  ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits
} = require("discord.js");

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

const IDS = {
  CHANNELS: { RANKING: "1473874178766671993", APOSTADO: "1473873854232264886", X1: "1473873994674606231", SIMU: "1465842384586670254" },
  ROLES: { STAFF: "1452822476949029001", DONO: "1452822605773148312", ORGANIZADOR: "1453126709447754010" }
};

const copasAtivas = new Map();

const commands = [
  new SlashCommandBuilder().setName("ranking").setDescription("Ver o ranking de Simu"),
  new SlashCommandBuilder()
    .setName("simu")
    .setDescription("Criar uma Simulação/Copa")
    .addStringOption(opt => opt.setName("mapa").setDescription("Mapa da Simu").setRequired(true))
    .addIntegerOption(opt => opt.setName("vagas").setDescription("Total de participantes (ex: 4, 8)").setRequired(true))
    .addStringOption(opt => opt.setName("tipo").setDescription("Tipo de jogo").addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}).setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => { try { await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands }); } catch (e) { console.error(e); } })();

function updateRank(userId, win) {
  let data = JSON.parse(fs.readFileSync("./database.json", "utf8") || "{}");
  if (!data[userId]) data[userId] = { v: 0, d: 0 };
  if (win) data[userId].v += 1; else data[userId].d += 1;
  fs.writeFileSync("./database.json", JSON.stringify(data, null, 2));
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ranking") {
      let data = JSON.parse(fs.readFileSync("./database.json", "utf8") || "{}");
      let sorted = Object.entries(data).sort((a, b) => b[1].v - a[1].v).slice(0, 10);
      let table = "POS  JOGADOR                     #1   #2\n------------------------------------------\n";
      sorted.forEach(([id, stats], i) => {
        const user = client.users.cache.get(id);
        const name = (user ? user.username : "Desconhecido").substring(0, 20);
        table += `${(i+1).toString().padEnd(5)}${name.padEnd(25)}${stats.v.toString().padEnd(5)}${stats.d}\n`;
      });
      await interaction.reply({ embeds: });
    }

    if (interaction.commandName === "simu") {
      if (!interaction.member.roles.cache.has(IDS.ROLES.ORGANIZADOR)) return interaction.reply({ content: "Sem permissão!", ephemeral: true });
      const mapa = interaction.options.getString("mapa"), vagas = interaction.options.getInteger("vagas"), tipo = interaction.options.getString("tipo");
      
      const embed = new EmbedBuilder()
        .setTitle(`🏆 NOVA SIMU ${tipo}`)
        .setColor("Purple")
        .addFields({ name: "🗺️ Mapa", value: mapa, inline: true }, { name: "👥 Vagas", value: `0/${vagas}`, inline: true }, { name: "📝 Participantes", value: "*Ninguém inscrito*" });

      const rows = [];
      if (tipo === "1v1") {
        rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`inscrever_1v1_${interaction.id}`).setLabel("Inscrever-se").setStyle(ButtonStyle.Primary)));
      } else {
        const row1 = new ActionRowBuilder();
        for (let i = 0; i < Math.ceil(vagas/2); i++) {
          row1.addComponents(new ButtonBuilder().setCustomId(`team_${String.fromCharCode(65+i)}_${interaction.id}`).setLabel(`Time ${String.fromCharCode(65+i)}`).setStyle(ButtonStyle.Secondary));
        }
        rows.push(row1);
      }
      rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`sair_simu_${interaction.id}`).setLabel("Sair da Simu").setStyle(ButtonStyle.Danger)));

      const msg = await interaction.reply({ embeds: [embed], components: rows, fetchReply: true });
      copasAtivas.set(interaction.id, { vagas, tipo, mapa, players: {}, teams: {} });
    }
  }

  if (interaction.isButton()) {
    const parts = interaction.customId.split("_");
    const action = parts[0], param = parts[1], copaId = parts[2];
    const copa = copasAtivas.get(copaId);
    if (!copa) return;

    // SAIR
    if (action === "sair") {
      delete copa.players[interaction.user.id];
      Object.keys(copa.teams).forEach(t => copa.teams[t] = copa.teams[t].filter(id => id !== interaction.user.id));
      await interaction.reply({ content: "Você saiu!", ephemeral: true });
    }

    // ENTRAR 1V1
    if (action === "inscrever") {
      if (Object.keys(copa.players).length >= copa.vagas) return interaction.reply({ content: "Lotado!", ephemeral: true });
      copa.players[interaction.user.id] = true;
      await interaction.reply({ content: "Inscrito!", ephemeral: true });
    }

    // ENTRAR TIME (2V2)
    if (action === "team") {
      if (!copa.teams[param]) copa.teams[param] = [];
      if (copa.teams[param].length >= 2) return interaction.reply({ content: "Time cheio!", ephemeral: true });
      
      // Remove de outros times antes de entrar no novo
      Object.keys(copa.teams).forEach(t => copa.teams[t] = copa.teams[t].filter(id => id !== interaction.user.id));
      copa.teams[param].push(interaction.user.id);
      await interaction.reply({ content: `Entrou no Time ${param}!`, ephemeral: true });
    }

    // ATUALIZAR EMBED
    let listaStr = "";
    if (copa.tipo === "1v1") {
      listaStr = Object.keys(copa.players).map((id, i) => `**${i+1}.** <@${id}>`).join("\n");
    } else {
      listaStr = Object.entries(copa.teams).map(([t, members]) => `**Time ${t}:** ${members.map(m => `<@${m}>`).join(", ") || "*Vazio*"}`).join("\n");
    }

    const total = copa.tipo === "1v1" ? Object.keys(copa.players).length : Object.values(copa.teams).flat().length;
    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
      { name: "🗺️ Mapa", value: copa.mapa, inline: true },
      { name: "👥 Vagas", value: `${total}/${copa.vagas}`, inline: true },
      { name: "🎮 Tipo", value: copa.tipo, inline: true },
      { name: "📝 Participantes", value: listaStr || "*Ninguém inscrito*" }
    );
    await interaction.message.edit({ embeds: [newEmbed] });

    // START SE LOTAR
    if (total >= copa.vagas) {
        await interaction.channel.send("🚨 **Simu Lotada! Criando canais...**");
        // Lógica de sorteio de canais aqui...
        copasAtivas.delete(copaId);
    }
  }

  // BOTÕES DE VENCEDOR (MANTIDOS DA VERSÃO ANTERIOR)
  if (interaction.customId.startsWith("vencedor_")) {
    if (!interaction.member.roles.cache.has(IDS.ROLES.STAFF)) return interaction.reply({ content: "Só Staff!", ephemeral: true });
    const [_, winId, loseId] = interaction.customId.split("_");
    updateRank(winId, true); updateRank(loseId, false);
    await interaction.reply("Resultado salvo!");
    setTimeout(() => interaction.channel.delete(), 3000);
  }
});

client.login(process.env.TOKEN);
