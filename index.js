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

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// REGISTRAR O COMANDO /parceria
const commands = [
  new SlashCommandBuilder()
    .setName("parceria")
    .setDescription("Criar parceria com modal")
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("Comando /parceria registrado.");
  } catch (error) {
    console.error(error);
  }
})();

// INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  // Quando usar /parceria
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "parceria") {

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
  }

  // Quando enviar o modal
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "modal_parceria") {

      const nome = interaction.fields.getTextInputValue("nome_cla");
      const fechou = interaction.fields.getTextInputValue("quem_fechou");
      const imagem = interaction.fields.getTextInputValue("url_imagem");
      const link = interaction.fields.getTextInputValue("link_servidor");

      await interaction.reply({
        content: "",
        embeds: [
          {
            title: "Parceria fechada",
            color: -16776700,
            image: {
              url: imagem
            },
            fields: [
              {
                name: "Nome do clã:",
                value: nome,
                inline: true
              },
              {
                name: "Parceria fechada por:",
                value: fechou,
                inline: true
              }
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
  }

});

client.login(process.env.TOKEN);
