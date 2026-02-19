require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

// Criando o client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Comandos a registrar
const commands = [
  new SlashCommandBuilder()
    .setName("parceria")
    .setDescription("Criar parceria com modal")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("xcla")
    .setDescription("Registrar resultado de X-Clã")
    .toJSON()
];

// REST para registrar comandos na guild
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Comandos registrados com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar comandos:", error);
  }
})();

// Evento ready
client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// Evento de interação
client.on("interactionCreate", async (interaction) => {

  // =========================
  // /parceria
  // =========================
  if (interaction.isChatInputCommand() && interaction.commandName === "parceria") {
    const modal = new ModalBuilder()
      .setCustomId("modal_parceria")
      .setTitle("Nova Parceria");

    const nome = new TextInputBuilder()
      .setCustomId("nome_cla")
      .setLabel("Nome do clã")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const fechou = new TextInputBuilder()
      .setCustomId("quem_fechou")
      .setLabel("Parceria fechada por")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const imagem = new TextInputBuilder()
      .setCustomId("url_imagem")
      .setLabel("URL da imagem")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const link = new TextInputBuilder()
      .setCustomId("link_servidor")
      .setLabel("Link do servidor")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nome),
      new ActionRowBuilder().addComponents(fechou),
      new ActionRowBuilder().addComponents(imagem),
      new ActionRowBuilder().addComponents(link)
    );

    await interaction.showModal(modal);
  }

  // =========================
  // /xcla
  // =========================
  if (interaction.isChatInputCommand() && interaction.commandName === "xcla") {
    const modal = new ModalBuilder()
      .setCustomId("modal_xcla")
      .setTitle("Registrar X-Clã");

    const clafora = new TextInputBuilder()
      .setCustomId("clafora")
      .setLabel("Nome do clã FORA")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const resultado = new TextInputBuilder()
      .setCustomId("resultado")
      .setLabel("Resultado (CASA X FORA)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const mapa = new TextInputBuilder()
      .setCustomId("mapa")
      .setLabel("Mapa da partida")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const data = new TextInputBuilder()
      .setCustomId("data")
      .setLabel("Data da partida")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(clafora),
      new ActionRowBuilder().addComponents(resultado),
      new ActionRowBuilder().addComponents(mapa),
      new ActionRowBuilder().addComponents(data)
    );

    await interaction.showModal(modal);
  }

  // =========================
  // Recebendo modal de /parceria
  // =========================
  if (interaction.isModalSubmit() && interaction.customId === "modal_parceria") {
    const nome = interaction.fields.getTextInputValue("nome_cla");
    const fechou = interaction.fields.getTextInputValue("quem_fechou");
    const imagem = interaction.fields.getTextInputValue("url_imagem");
    const link = interaction.fields.getTextInputValue("link_servidor");

    await interaction.reply({
      content: "",
      embeds: [
        {
          title: "Parceria fechada",
          color: 0xFF9900,
          image: { url: imagem },
          fields: [
            { name: "Nome do clã:", value: nome, inline: true },
            { name: "Parceria fechada por:", value: fechou, inline: true }
          ]
        }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: "Entre no server",
              style: 5,
              url: link
            }
          ]
        }
      ]
    });
  }

  // =========================
  // Recebendo modal de /xcla
  // =========================
  if (interaction.isModalSubmit() && interaction.customId === "modal_xcla") {
    const clafora = interaction.fields.getTextInputValue("clafora");
    const resultado = interaction.fields.getTextInputValue("resultado");
    const mapa = interaction.fields.getTextInputValue("mapa");
    const data = interaction.fields.getTextInputValue("data");

    await interaction.reply({
      embeds: [
        {
          title: "⚔️ Resultado de X-Clã",
          color: 10181046,
          footer: { text: "Registro oficial da partida" },
          fields: [
            { name: "🏴 Clã CASA", value: "SZ", inline: true },
            { name: "🏳️ Clã FORA", value: clafora, inline: true },
            { name: "📊 Resultado", value: `CASA ${resultado} FORA` },
            { name: "🗺️ Mapa", value: mapa },
            { name: "⏰ Data", value: data, inline: true }
          ]
        }
      ]
    });
  }

});

// Login do bot
client.login(process.env.TOKEN);
