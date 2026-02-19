require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

// ----------------- CLIENT -----------------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// ----------------- CONFIG -----------------
const RANKING_CHANNEL = "1473874178766671993";
const APOSTADO_CHANNEL = "1473873854232264886";
const X1_CHANNEL = "1473873994674606231";
const SIMU_CHANNEL = "1465842384586670254";

const SIMU_PERMITIDO = "1453126709447754010";
const STAFF_IDS = ["1452822476949029001", "1452822605773148312"];
const RANKING_FILE = "./ranking.json";

// ----------------- UTILS -----------------
function carregarRanking() {
  if (!fs.existsSync(RANKING_FILE)) return {};
  return JSON.parse(fs.readFileSync(RANKING_FILE, "utf-8"));
}

function salvarRanking(ranking) {
  fs.writeFileSync(RANKING_FILE, JSON.stringify(ranking, null, 2));
}

function atualizarRanking(vencedorIds, viceIds) {
  const ranking = carregarRanking();
  for (const id of vencedorIds) {
    if (!ranking[id]) ranking[id] = { nome: `<@${id}>`, "#1": 0, "#2": 0 };
    ranking[id]["#1"] += 1;
  }
  for (const id of viceIds) {
    if (!ranking[id]) ranking[id] = { nome: `<@${id}>`, "#1": 0, "#2": 0 };
    ranking[id]["#2"] += 1;
  }
  salvarRanking(ranking);
}

function criarEmbedRanking() {
  const ranking = carregarRanking();
  const rankingArray = Object.entries(ranking).map(([id, data]) => ({
    id,
    nome: data.nome,
    "#1": data["#1"],
    "#2": data["#2"],
  }));
  rankingArray.sort((a, b) => {
    if (b["#1"] === a["#1"]) return b["#2"] - a["#2"];
    return b["#1"] - a["#1"];
  });
  let desc = "";
  rankingArray.forEach((p, i) => {
    const pos = String(i + 1).padStart(2, "0");
    desc += `#${pos}  ${p.nome}   ${p["#1"]}   ${p["#2"]}\n`;
  });
  return new EmbedBuilder()
    .setTitle("🏆 Ranking Individual")
    .setDescription(desc)
    .setColor(10181046)
    .setFooter({ text: "Atualizado automaticamente após cada partida/final" });
}

// ----------------- COMANDOS -----------------
const commands = [
  new SlashCommandBuilder().setName("parceria").setDescription("Criar parceria com modal").toJSON(),
  new SlashCommandBuilder().setName("ranking").setDescription("Exibe o ranking atualizado").toJSON(),
  new SlashCommandBuilder().setName("simu").setDescription("Criar um Simu/Copa").toJSON(),
  new SlashCommandBuilder().setName("x1").setDescription("Criar X1").toJSON(),
  new SlashCommandBuilder().setName("apostado").setDescription("Criar X1 Apostado").toJSON()
];

// ----------------- REGISTRO -----------------
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log("Comandos registrados!");
  } catch (error) {
    console.error(error);
  }
})();

// ----------------- READY -----------------
client.once("ready", () => console.log(`Bot online como ${client.user.tag}`));

// ----------------- INTERAÇÕES -----------------
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName, channelId, member, user, guild } = interaction;

    // ----------------- PARCERIA -----------------
    if (commandName === "parceria") {
      const modal = new ModalBuilder().setCustomId("modal_parceria").setTitle("Nova Parceria");

      const nome = new TextInputBuilder().setCustomId("nome_cla").setLabel("Nome do clã").setStyle(TextInputStyle.Short).setRequired(true);
      const fechou = new TextInputBuilder().setCustomId("quem_fechou").setLabel("Parceria fechada por").setStyle(TextInputStyle.Short).setRequired(true);
      const imagem = new TextInputBuilder().setCustomId("url_imagem").setLabel("URL da imagem").setStyle(TextInputStyle.Short).setRequired(true);
      const link = new TextInputBuilder().setCustomId("link_servidor").setLabel("Link do servidor").setStyle(TextInputStyle.Short).setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(fechou),
        new ActionRowBuilder().addComponents(imagem),
        new ActionRowBuilder().addComponents(link)
      );
      return interaction.showModal(modal);
    }

    // ----------------- RANKING -----------------
    if (commandName === "ranking") {
      if (channelId !== RANKING_CHANNEL) return interaction.reply({ content: "Este comando só pode ser usado no canal de Ranking.", ephemeral: true });
      return interaction.reply({ embeds: [criarEmbedRanking()] });
    }

    // ----------------- APOSTADO -----------------
    if (commandName === "apostado") {
      if (channelId !== APOSTADO_CHANNEL) return interaction.reply({ content: "Este comando só pode ser usado no canal de Apostado.", ephemeral: true });
      // Função de criação de canal + botão entrar, declarar vencedor
      return interaction.reply({ content: "Sistema de X1 Apostado pronto para implementar lógica de partida.", ephemeral: true });
    }

    // ----------------- X1 -----------------
    if (commandName === "x1") {
      if (channelId !== X1_CHANNEL) return interaction.reply({ content: "Este comando só pode ser usado no canal de X1.", ephemeral: true });
      return interaction.reply({ content: "Sistema de X1 pronto para implementar lógica de partida.", ephemeral: true });
    }

    // ----------------- SIMU -----------------
    if (commandName === "simu") {
      if (channelId !== SIMU_CHANNEL) return interaction.reply({ content: "Este comando só pode ser usado no canal de Simu.", ephemeral: true });
      if (!member.roles.cache.has(SIMU_PERMITIDO) && !STAFF_IDS.includes(user.id)) {
        return interaction.reply({ content: "Você não tem permissão para criar Simu.", ephemeral: true });
      }
      return interaction.reply({ content: "Sistema de Simu pronto para implementar bracket e times.", ephemeral: true });
    }
  }

  // ----------------- MODAL SUBMIT -----------------
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "modal_parceria") {
      const nome = interaction.fields.getTextInputValue("nome_cla");
      const fechou = interaction.fields.getTextInputValue("quem_fechou");
      const imagem = interaction.fields.getTextInputValue("url_imagem");
      const link = interaction.fields.getTextInputValue("link_servidor");

      const embed = new EmbedBuilder()
        .setTitle("Parceria fechada")
        .setColor(16753920)
        .setImage(imagem)
        .addFields(
          { name: "Nome do clã:", value: nome, inline: true },
          { name: "Parceria fechada por:", value: fechou, inline: true }
        );

      const botao = new ButtonBuilder().setLabel("Entre no server").setStyle(ButtonStyle.Link).setURL(link);
      return interaction.reply({ embeds: [embed], components: [{ type: 1, components: [botao] }] });
    }
  }
});

// ----------------- LOGIN -----------------
client.login(process.env.TOKEN);

