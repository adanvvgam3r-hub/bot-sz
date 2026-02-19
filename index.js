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

// Funções de Banco de Dados
function loadData(file) { 
  if (!fs.existsSync(`./${file}.json`)) fs.writeFileSync(`./${file}.json`, "{}");
  return JSON.parse(fs.readFileSync(`./${file}.json`, "utf8") || "{}"); 
}
function saveData(file, data) { fs.writeFileSync(`./${file}.json`, JSON.stringify(data, null, 2)); }

const commands = [
  new SlashCommandBuilder().setName("ranking").setDescription("Ver o ranking de Simu"),
  new SlashCommandBuilder()
    .setName("simu")
    .setDescription("Criar uma Simulação/Copa")
    .addStringOption(opt => opt.setName("mapa").setDescription("Mapa da Simu").setRequired(true))
    .addIntegerOption(opt => opt.setName("vagas").setDescription("Total de participantes").setRequired(true))
    .addStringOption(opt => opt.setName("tipo").setDescription("Tipo").addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}).setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => { try { await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands }); } catch (e) { console.error(e); } })();

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ranking") {
      const data = loadData("database");
      const sorted = Object.entries(data).sort((a, b) => b.v - a.v).slice(0, 10);
      let table = "POS  JOGADOR                     #1   #2\n------------------------------------------\n";
      sorted.forEach(([id, stats], i) => {
        const user = client.users.cache.get(id);
        const name = (user ? user.username : "Desconhecido").substring(0, 20);
        table += `${(i+1).toString().padEnd(5)}${name.padEnd(25)}${stats.v.toString().padEnd(5)}${stats.d}\n`;
      });
      return interaction.reply({ embeds: });
    }

    if (interaction.commandName === "simu") {
      if (!interaction.member.roles.cache.has(IDS.ROLES.ORGANIZADOR)) return interaction.reply({ content: "Sem permissão!", ephemeral: true });
      const mapa = interaction.options.getString("mapa"), vagas = interaction.options.getInteger("vagas"), tipo = interaction.options.getString("tipo");
      
      const embed = new EmbedBuilder()
        .setTitle(`🏆 NOVA SIMU ${tipo}`)
        .setColor("Purple")
        .addFields(
            { name: "🗺️ Mapa", value: mapa, inline: true }, 
            { name: "👥 Vagas", value: `0/${vagas}`, inline: true }, 
            { name: "🎮 Tipo", value: tipo, inline: true }, 
            { name: "📝 Participantes", value: "*Ninguém inscrito*" }
        );

      const row1 = new ActionRowBuilder();
      if (tipo === "1v1") {
        row1.addComponents(new ButtonBuilder().setCustomId(`in_1v1_${interaction.id}`).setLabel("Inscrever-se").setStyle(ButtonStyle.Primary));
      } else {
        for (let i = 0; i < Math.min(4, Math.ceil(vagas/2)); i++) {
          row1.addComponents(new ButtonBuilder().setCustomId(`tm_${String.fromCharCode(65+i)}_${interaction.id}`).setLabel(`Time ${String.fromCharCode(65+i)}`).setStyle(ButtonStyle.Secondary));
        }
      }
      const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`out_simu_${interaction.id}`).setLabel("Sair").setStyle(ButtonStyle.Danger));

      await interaction.reply({ embeds: [embed], components: [row1, row2] });
      const copas = loadData("copas");
      copas[interaction.id] = { vagas, tipo, mapa, players: [], teams: {} };
      saveData("copas", copas);
    }
  }

  if (interaction.isButton()) {
    const [action, param, copaId] = interaction.customId.split("_");
    const idReal = copaId || param;
    const copas = loadData("copas");
    const copa = copas[idReal];
    if (!copa) return;

    await interaction.deferUpdate();

    if (action === "out") {
      copa.players = copa.players.filter(id => id !== interaction.user.id);
      Object.keys(copa.teams).forEach(t => copa.teams[t] = (copa.teams[t] || []).filter(id => id !== interaction.user.id));
    } else if (action === "in") {
      if (copa.players.length < copa.vagas && !copa.players.includes(interaction.user.id)) copa.players.push(interaction.user.id);
    } else if (action === "tm") {
      if (!copa.teams[param]) copa.teams[param] = [];
      if (copa.teams[param].length < 2 && !copa.teams[param].includes(interaction.user.id)) {
        Object.keys(copa.teams).forEach(t => copa.teams[t] = copa.teams[t].filter(id => id !== interaction.user.id));
        copa.teams[param].push(interaction.user.id);
      }
    }

    saveData("copas", copas);

    let listaStr = copa.tipo === "1v1" 
      ? copa.players.map((id, i) => `**${i+1}.** <@${id}>`).join("\n")
      : Object.entries(copa.teams).map(([t, m]) => `**Time ${t}:** ${m.map(id => `<@${id}>`).join(", ") || "*Vazio*"}`).join("\n");

    const total = copa.tipo === "1v1" ? copa.players.length : Object.values(copa.teams).flat().length;
    const newEmbed = EmbedBuilder.from(interaction.message.embeds).setFields(
      { name: "🗺️ Mapa", value: copa.mapa, inline: true },
      { name: "👥 Vagas", value: `${total}/${copa.vagas}`, inline: true },
      { name: "🎮 Tipo", value: copa.tipo, inline: true },
      { name: "📝 Participantes", value: listaStr || "*Ninguém inscrito*" }
    );

    await interaction.message.edit({ embeds: [newEmbed] });
  }
});

client.login(process.env.TOKEN);
