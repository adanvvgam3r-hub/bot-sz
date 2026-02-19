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
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

// ═════════════════════════════════════════════════════════════════════
// ========================= CONFIGURAÇÕES =========================
// ═════════════════════════════════════════════════════════════════════

const CHANNELS = {
  RANKING: "1473874178766671993",
  APOSTADO: "1473873854232264886",
  X1: "1473873994674606231",
  SIMU: "1465842384586670254",
};

const ROLES = {
  SIMU_PERMITIDO: "1453126709447754010",
};

const STAFF = {
  OWNER: "1452822476949029001",
  STAFF: "1452822605773148312",
  IDS: ["1452822476949029001", "1452822605773148312"],
};

const FILES = {
  RANKING: "./ranking.json",
  MATCHES: "./matches.json",
  TOURNAMENTS: "./tournaments.json",
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

// ═════════════════════════════════════════════════════════════════════
// ========================= UTILS - RANKING =========================
// ═════════════════════════════════════════════════════════════════════

function carregarRanking() {
  if (!fs.existsSync(FILES.RANKING)) return {};
  return JSON.parse(fs.readFileSync(FILES.RANKING, "utf-8"));
}

function salvarRanking(ranking) {
  fs.writeFileSync(FILES.RANKING, JSON.stringify(ranking, null, 2));
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

  let desc = "```\nPOS  JOGADOR                    #1  #2\n";
  rankingArray.forEach((p, i) => {
    const pos = String(i + 1).padStart(2, "0");
    desc += `${pos}   ${p.nome.padEnd(25)} ${String(p["#1"]).padStart(2)} ${String(p["#2"]).padStart(2)}\n`;
  });
  desc += "```";

  return new EmbedBuilder()
    .setTitle("🏆 Ranking Simu")
    .setDescription(desc || "Sem dados ainda")
    .setColor(10181046)
    .setFooter({ text: "Atualizado automaticamente após cada final de Simu" });
}

// ═════════════════════════════════════════════════════════════════════
// ========================= UTILS - MATCHES ==========================
// ═════════════════════════════════════════════════════════════════════

function carregarMatches() {
  if (!fs.existsSync(FILES.MATCHES)) return {};
  return JSON.parse(fs.readFileSync(FILES.MATCHES, "utf-8"));
}

function salvarMatches(matches) {
  fs.writeFileSync(FILES.MATCHES, JSON.stringify(matches, null, 2));
}

function criarMatchId() {
  return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ═════════════════════════════════════════════════════════════════════
// ========================= UTILS - TOURNAMENT =======================
// ═════════════════════════════════════════════════════════════════════

function carregarTournaments() {
  if (!fs.existsSync(FILES.TOURNAMENTS)) return {};
  return JSON.parse(fs.readFileSync(FILES.TOURNAMENTS, "utf-8"));
}

function salvarTournaments(tournaments) {
  fs.writeFileSync(FILES.TOURNAMENTS, JSON.stringify(tournaments, null, 2));
}

function criarTournamentId() {
  return `tour_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ═════════════════════════════════════════════════════════════════════
// ========================= X1 & APOSTADO ============================
// ═════════════════════════════════════════════════════════════════════

async function criarX1(interaction, isApostado = false) {
  const { user, member, guild, channelId } = interaction;
  const canalCorreto = isApostado ? CHANNELS.APOSTADO : CHANNELS.X1;

  if (channelId !== canalCorreto) {
    return interaction.reply({
      content: `Este comando só pode ser usado em <#${canalCorreto}>.`,
      ephemeral: true,
    });
  }

  // Criar Modal
  const modal = new ModalBuilder()
    .setCustomId(`modal_${isApostado ? "apostado" : "x1"}_${user.id}`)
    .setTitle(isApostado ? "Criar X1 Apostado" : "Criar X1");

  const mapa = new TextInputBuilder()
    .setCustomId("mapa")
    .setLabel("Mapa")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const jogarCom = new TextInputBuilder()
    .setCustomId("jogar_com")
    .setLabel("Jogar com alguém específico? (sim/não)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(mapa), new ActionRowBuilder().addComponents(jogarCom));

  if (isApostado) {
    const valor = new TextInputBuilder()
      .setCustomId("valor")
      .setLabel("Valor apostado (R$)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(valor));
  }

  return interaction.showModal(modal);
}

async function processarX1Modal(interaction, isApostado = false) {
  const { user, guild, channel } = interaction;
  const mapa = interaction.fields.getTextInputValue("mapa");
  const jogarCom = interaction.fields.getTextInputValue("jogar_com").toLowerCase();
  const valor = isApostado ? interaction.fields.getTextInputValue("valor") : null;

  const matchId = criarMatchId();
  const matches = carregarMatches();

  matches[matchId] = {
    tipo: isApostado ? "apostado" : "x1",
    criador: user.id,
    mapa,
    valor: isApostado ? parseFloat(valor) : 0,
    jogador2: null,
    status: "pendente",
    canalPrivado: null,
    criadoEm: new Date().toISOString(),
  };

  salvarMatches(matches);

  // Se escolher jogar com alguém
  if (jogarCom === "sim") {
    const dmEmbed = new EmbedBuilder()
      .setTitle(`${isApostado ? "🎰 X1 Apostado" : "🎮 X1"} convite`)
      .setDescription(`<@${user.id}> quer jogar um ${isApostado ? "X1 Apostado" : "X1"}!`)
      .addFields(
        { name: "Mapa", value: mapa, inline: true },
        isApostado ? { name: "Valor", value: `R$ ${valor}`, inline: true } : null
      )
      .setColor(isApostado ? 16753920 : 3066993);

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`x1_aceitar_${matchId}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`x1_recusar_${matchId}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      content: "Mencione o jogador que deseja desafiar:",
      ephemeral: true,
    });
  } else {
    // Qualquer um pode entrar
    const embed = new EmbedBuilder()
      .setTitle(isApostado ? "🎰 X1 Apostado" : "🎮 X1")
      .setDescription(`<@${user.id}> criou um ${isApostado ? "X1 Apostado" : "X1"}!`)
      .addFields(
        { name: "Mapa", value: mapa, inline: true },
        isApostado ? { name: "Valor", value: `R$ ${valor}`, inline: true } : null
      )
      .setColor(isApostado ? 16753920 : 3066993);

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`x1_entrar_${matchId}`)
        .setLabel("Entrar no X1")
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ embeds: [embed], components: [botoes] });
  }
}

async function criarCanalPrivadoX1(guild, matchId, isApostado = false) {
  const matches = carregarMatches();
  const match = matches[matchId];

  if (!match) return null;

  const permissoes = [
    {
      id: match.criador,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    },
    {
      id: match.jogador2,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    },
    {
      id: STAFF.OWNER,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages],
    },
    {
      id: STAFF.STAFF,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages],
    },
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
  ];

  const canal = await guild.channels.create({
    name: `${isApostado ? "apostado" : "x1"}-${match.criador.substring(0, 5)}`,
    type: ChannelType.GuildText,
    permissionOverwrites: permissoes,
  });

  const embed = new EmbedBuilder()
    .setTitle(isApostado ? "🎰 X1 Apostado" : "🎮 X1")
    .addFields(
      { name: "Mapa", value: match.mapa },
      { name: "AD1", value: `<@${match.criador}>`, inline: true },
      { name: "AD2", value: `<@${match.jogador2}>`, inline: true },
      isApostado ? { name: "Valor", value: `R$ ${match.valor}` } : null
    )
    .setColor(isApostado ? 16753920 : 3066993);

  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`x1_vencedor_ad1_${matchId}`)
      .setLabel("AD1 Venceu")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`x1_vencedor_ad2_${matchId}`)
      .setLabel("AD2 Venceu")
      .setStyle(ButtonStyle.Danger)
  );

  await canal.send({ embeds: [embed], components: [botoes] });

  matches[matchId].canalPrivado = canal.id;
  salvarMatches(matches);

  return canal;
}

async function finalizarX1(interaction, matchId, vencedorAd) {
  const matches = carregarMatches();
  const match = matches[matchId];

  if (!match) return;

  // Verificar se é Staff/Dono
  if (!STAFF.IDS.includes(interaction.user.id)) {
    return interaction.reply({
      content: "Apenas Staff/Dono pode declarar vencedor.",
      ephemeral: true,
    });
  }

  const vencedorId = vencedorAd === 1 ? match.criador : match.jogador2;
  const perdedorId = vencedorAd === 1 ? match.jogador2 : match.criador;

  // Atualizar ranking se for Simu (não aplicável aqui, mas estruturado para possível expansão)
  // Aqui seria usado se X1/Apostado tivessem ranking específico

  // Enviar mensagem no canal original
  const canalOrigem = await interaction.guild.channels.fetch(match.canalOrigem || CHANNELS.X1);
  const embed = new EmbedBuilder()
    .setTitle("🏆 Resultado")
    .setDescription(`<@${vencedorId}> venceu contra <@${perdedorId}>`)
    .addFields({ name: "Mapa", value: match.mapa });

  if (match.tipo === "apostado") {
    embed.addFields({ name: "Ganho", value: `<@${vencedorId}> ganhou R$ ${match.valor}` });
  }

  embed.setColor(5763719);

  if (canalOrigem) {
    await canalOrigem.send({ embeds: [embed] });
  }

  // Deletar canal privado
  const canalPrivado = await interaction.guild.channels.fetch(match.canalPrivado);
  if (canalPrivado) {
    await canalPrivado.delete();
  }

  delete matches[matchId];
  salvarMatches(matches);

  return interaction.reply({
    content: "✅ Match finalizado e canal removido.",
    ephemeral: true,
  });
}

// ═════════════════════════════════════════════════════════════════════
// ========================= SIMU / COPA / BRACKET ====================
// ═════════════════════════════════════════════════════════════════════

async function criarSimu(interaction) {
  const { user, member, guild, channelId } = interaction;

  if (channelId !== CHANNELS.SIMU) {
    return interaction.reply({
      content: `Este comando só pode ser usado em <#${CHANNELS.SIMU}>.`,
      ephemeral: true,
    });
  }

  if (!member.roles.cache.has(ROLES.SIMU_PERMITIDO) && !STAFF.IDS.includes(user.id)) {
    return interaction.reply({
      content: "Você não tem permissão para criar Simu.",
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder().setCustomId(`modal_simu_${user.id}`).setTitle("Criar Simu/Copa");

  const organizador = new TextInputBuilder()
    .setCustomId("organizador")
    .setLabel("Organizador")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const jogo = new TextInputBuilder()
    .setCustomId("jogo")
    .setLabel("Jogo")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const versao = new TextInputBuilder()
    .setCustomId("versao")
    .setLabel("Versão")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const mapa = new TextInputBuilder()
    .setCustomId("mapa")
    .setLabel("Mapa")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const tipoJogo = new TextInputBuilder()
    .setCustomId("tipo_jogo")
    .setLabel("Tipo (1v1, 2v2, 3v3, 4v4)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const qtdParticipantes = new TextInputBuilder()
    .setCustomId("qtd_participantes")
    .setLabel("Quantidade de participantes")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(organizador),
    new ActionRowBuilder().addComponents(jogo),
    new ActionRowBuilder().addComponents(versao),
    new ActionRowBuilder().addComponents(mapa),
    new ActionRowBuilder().addComponents(tipoJogo),
    new ActionRowBuilder().addComponents(qtdParticipantes)
  );

  return interaction.showModal(modal);
}

async function processarSimuModal(interaction) {
  const { user, guild } = interaction;
  const organizador = interaction.fields.getTextInputValue("organizador");
  const jogo = interaction.fields.getTextInputValue("jogo");
  const versao = interaction.fields.getTextInputValue("versao");
  const mapa = interaction.fields.getTextInputValue("mapa");
  const tipoJogo = interaction.fields.getTextInputValue("tipo_jogo");
  const qtdParticipantes = parseInt(interaction.fields.getTextInputValue("qtd_participantes"));

  const tournamentId = criarTournamentId();
  const tournaments = carregarTournaments();

  tournaments[tournamentId] = {
    organizador,
    jogo,
    versao,
    mapa,
    tipoJogo,
    qtdParticipantes,
    criador: user.id,
    times: {},
    canais: [],
    bracket: null,
    status: "inscricao",
    criadoEm: new Date().toISOString(),
  };

  salvarTournaments(tournaments);

  // Criar canais dos times
  const qtdTimes = calcularQtdTimes(qtdParticipantes, tipoJogo);
  const canais = [];

  for (let i = 1; i <= qtdTimes; i++) {
    const canal = await guild.channels.create({
      name: `time-${i}`,
      type: ChannelType.GuildText,
      parent: null, // Você pode usar uma categoria se desejar
    });

    const embed = new EmbedBuilder()
      .setTitle(`⚽ Time ${i}`)
      .setDescription(`Clique em Entrar para se juntar ao time ${i}`)
      .setColor(3066993);

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`simu_entrar_${tournamentId}_${i}`)
        .setLabel("Entrar")
        .setStyle(ButtonStyle.Success)
    );

    await canal.send({ embeds: [embed], components: [botoes] });
    canais.push(canal.id);
  }

  tournaments[tournamentId].canais = canais;
  salvarTournaments(tournaments);

  const embed = new EmbedBuilder()
    .setTitle("✅ Simu Criada")
    .setDescription(`Simu "${organizador}" criada com sucesso!`)
    .addFields(
      { name: "Jogo", value: jogo },
      { name: "Versão", value: versao },
      { name: "Mapa", value: mapa },
      { name: "Tipo", value: tipoJogo },
      { name: "Participantes", value: String(qtdParticipantes) }
    )
    .setColor(5763719);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

function calcularQtdTimes(qtdParticipantes, tipoJogo) {
  const [playersPorTime] = tipoJogo.match(/\d/).map(Number);
  return qtdParticipantes / playersPorTime;
}

// ═════════════════════════════════════════════════════════════════════
// ========================= SLASH COMMANDS ===========================
// ═════════════════════════════════════════════════════════════════════

const commands = [
  new SlashCommandBuilder().setName("parceria").setDescription("Criar parceria com modal").toJSON(),
  new SlashCommandBuilder().setName("ranking").setDescription("Exibe o ranking atualizado").toJSON(),
  new SlashCommandBuilder().setName("simu").setDescription("Criar um Simu/Copa").toJSON(),
  new SlashCommandBuilder().setName("x1").setDescription("Criar X1").toJSON(),
  new SlashCommandBuilder().setName("apostado").setDescription("Criar X1 Apostado").toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log("✅ Comandos registrados!");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos:", error);
  }
})();

// ═════════════════════════════════════════════════════════════════════
// ========================= READY ====================================
// ═════════════════════════════════════════════════════════════════════

client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

// ═════════════════════════════════════════════════════════════════════
// ========================= INTERACTION HANDLER ========================
// ═════════════════════════════════════════════════════════════════════

client.on("interactionCreate", async (interaction) => {
  // ───────── SLASH COMMANDS ─────────
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === "parceria") {
      const modal = new ModalBuilder().setCustomId("modal_parceria").setTitle("Nova Parceria");

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

      return interaction.showModal(modal);
    }

    if (commandName === "ranking") {
      if (interaction.channelId !== CHANNELS.RANKING) {
        return interaction.reply({
          content: `Este comando só pode ser usado em <#${CHANNELS.RANKING}>.`,
          ephemeral: true,
        });
      }
      return interaction.reply({ embeds: [criarEmbedRanking()] });
    }

    if (commandName === "x1") {
      return criarX1(interaction, false);
    }

    if (commandName === "apostado") {
      return criarX1(interaction, true);
    }

    if (commandName === "simu") {
      return criarSimu(interaction);
    }
  }

  // ───────── MODAL SUBMIT ─────────
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

      return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(botao)] });
    }

    // X1 / Apostado Modal
    if (interaction.customId.startsWith("modal_x1_") || interaction.customId.startsWith("modal_apostado_")) {
      const isApostado = interaction.customId.startsWith("modal_apostado_");
      return processarX1Modal(interaction, isApostado);
    }

    // Simu Modal
    if (interaction.customId.startsWith("modal_simu_")) {
      return processarSimuModal(interaction);
    }
  }

  // ───────── BUTTON INTERACTIONS ─────────
  if (interaction.isButton()) {
    const { customId, user, guild } = interaction;

    // X1 Entrar
    if (customId.startsWith("x1_entrar_")) {
      const matchId = customId.replace("x1_entrar_", "");
      const matches = carregarMatches();
      const match = matches[matchId];

      if (!match) {
        return interaction.reply({ content: "Match não encontrado.", ephemeral: true });
      }

      if (user.id === match.criador) {
        return interaction.reply({ content: "Você não pode entrar no seu próprio X1.", ephemeral: true });
      }

      match.jogador2 = user.id;
      salvarMatches(matches);

      await criarCanalPrivadoX1(guild, matchId, match.tipo === "apostado");

      return interaction.reply({
        content: `✅ <@${user.id}> entrou no X1! Canal privado criado.`,
        ephemeral: false,
      });
    }

    // X1 Declarar Vencedor
    if (customId.startsWith("x1_vencedor_")) {
      const parts = customId.split("_");
      const vencedorAd = parts[2] === "ad1" ? 1 : 2;
      const matchId = parts.slice(3).join("_");

      return finalizarX1(interaction, matchId, vencedorAd);
    }

    // Simu Entrar Time
    if (customId.startsWith("simu_entrar_")) {
      const [, , tournamentId, timeIndex] = customId.split("_");
      const tournaments = carregarTournaments();
      const tournament = tournaments[tournamentId];

      if (!tournament) {
        return interaction.reply({ content: "Simu não encontrada.", ephemeral: true });
      }

      if (!tournament.times[timeIndex]) {
        tournament.times[timeIndex] = [];
      }

      const tamanhoTime = parseInt(tournament.tipoJogo[0]);
      if (tournament.times[timeIndex].length >= tamanhoTime) {
        return interaction.reply({
          content: "Este time está cheio. Escolha outro time.",
          ephemeral: true,
        });
      }

      tournament.times[timeIndex].push(user.id);
      salvarTournaments(tournaments);

      return interaction.reply({
        content: `✅ <@${user.id}> entrou no Time ${timeIndex}!`,
        ephemeral: true,
      });
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
// ========================= LOGIN =====================================
// ═════════════════════════════════════════════════════════════════════

client.login(process.env.TOKEN);
