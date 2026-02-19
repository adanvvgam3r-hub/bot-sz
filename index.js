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
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Registro do comando /parceria
const commands = [
  new SlashCommandBuilder()
    .setName("parceria")
    .setDescription("Criar parceria com modal")
    .toJSON()
];

// REST para registrar o comando na guild
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Comando /parceria registrado com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar comando:", error);
  }
})();

// Evento quando o bot está online
client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// Evento de interação
client.on("interactionCreate", async (interaction) => {

  // /parceria abre o modal
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

  // Recebendo dados do modal
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

});

// Login do bot
client.login(process.env.TOKEN);
