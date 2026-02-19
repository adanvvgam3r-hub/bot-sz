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
  StringSelectMenuBuilder,
} = require("discord.js");

// ═════════════════════════════════════════════════════════════════════
// ========================= CONFIGURAÇÕES =========================
// ════════════════════════════════════════════════════════════════��════

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

const EMOTES = {
  VS: "⚔️",
  WIN: "🏆",
  PLAY: "🎮",
  BET: "🎰",
  ENTER: "➡️",
  EXIT: "❌",
  CHECK: "✅",
  INFO: "ℹ️",
  BRACKET: "🗂️",
  TEAM: "⚽",
  WAIT: "⏳",
  NEXT: "▶️",
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
// ========================= UTILS - FILE OPERATIONS =================
// ═════════════════════════════════════════════════════════════════════

function carregarRanking() {
  try {
    if (!fs.existsSync(FILES.RANKING)) return {};
    return JSON.parse(fs.readFileSync(FILES.RANKING, "utf-8"));
  } catch (error) {
    console.error("Erro ao carregar ranking:", error);
    return {};
  }
}

function salvarRanking(ranking) {
  try {
    fs.writeFileSync(FILES.RANKING, JSON.stringify(ranking, null, 2));
  } catch (error) {
    console.error("Erro ao salvar ranking:", error);
  }
}

function carregarMatches() {
  try {
    if (!fs.existsSync(FILES.MATCHES)) return {};
    return JSON.parse(fs.readFileSync(FILES.MATCHES, "utf-8"));
  } catch (error) {
    console.error("Erro ao carregar matches:", error);
    return {};
  }
}

function salvarMatches(matches) {
  try {
    fs.writeFileSync(FILES.MATCHES, JSON.stringify(matches, null, 2));
  } catch (error) {
    console.error("Erro ao salvar matches:", error);
  }
}

function carregarTournaments() {
  try {
    if (!fs.existsSync(FILES.TOURNAMENTS)) return {};
    return JSON.parse(fs.readFileSync(FILES.TOURNAMENTS, "utf-8"));
  } catch (error) {
    console.error("Erro ao carregar tournaments:", error);
    return {};
  }
}

function salvarTournaments(tournaments) {
  try {
    fs.writeFileSync(FILES.TOURNAMENTS, JSON.stringify(tournaments, null, 2));
  } catch (error) {
    console.error("Erro ao salvar tournaments:", error);
  }
}

// ═════════════════════════════════════════════════════════════════════
// ========================= UTILS - RANKING ==========================
// ═════════════════════════════════════════════════════════════════════

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
// ========================= UTILS - IDs ==============================
// ═════════════════════════════════════════════════════════════════════

function criarMatchId() {
  return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function criarTournamentId() {
  return `tour_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ═════════════════════════════════════════════════════════════════════
// ========================= BRACKET SYSTEM ===========================
// ═════════════════════════════════════════════════════════════════════

function gerarBracketAutomatico(times, tipoJogo) {
  const timesArray = Object.entries(times)
    .filter(([_, players]) => players && players.length > 0)
    .map(([idx, players]) => ({
      id: idx,
      players: players,
    }));

  if (timesArray.length < 2) {
    return [];
  }

  const bracket = [];
  let left = 0;
  let right = timesArray.length - 1;

  while (left < right) {
    bracket.push({
      matchId: criarMatchId(),
      time1: timesArray[left],
      time2: timesArray[right],
      vencedor: null,
      fase: "oitavas",
      status: "pendente",
    });
    left++;
    right--;
  }

  return bracket;
}

function gerarProximaFase(vencedores) {
  if (vencedores.length < 2) {
    return [];
  }

  const proximaBracket = [];
  for (let i = 0; i < vencedores.length; i += 2) {
    if (vencedores[i + 1]) {
      proximaBracket.push({
        matchId: criarMatchId(),
        time1: vencedores[i],
        time2: vencedores[i + 1],
        vencedor: null,
        status: "pendente",
      });
    }
  }

  return proximaBracket;
}

function obterProximaFase(faseAtual) {
  const fases = ["oitavas", "quartas", "semis", "final"];
  const idx = fases.indexOf(faseAtual);
  return idx < fases.length - 1 ? fases[idx + 1] : "final";
}

// ═════════════════════════════════════════════════════════════════════
// ========================= X1 & APOSTADO ============================
// ═════════════════════════════════════════════════════════════════════

async function criarX1(interaction, isApostado = false) {
  const { user, channelId } = interaction;
  const canalCorreto = isApostado ? CHANNELS.APOSTADO : CHANNELS.X1;

  if (channelId !== canalCorreto) {
    return interaction.reply({
      content: `Este comando só pode ser usado em <#${canalCorreto}>.`,
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_${isApostado ? "apostado" : "x1"}_${user.id}_${Date.now()}`)
    .setTitle(isApostado ? "Criar X1 Apostado" : "Criar X1");

  const mapa = new TextInputBuilder()
    .setCustomId("mapa")
    .setLabel("Mapa")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(mapa));

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
  try {
    const { user, channel } = interaction;
    const mapa = interaction.fields.getTextInputValue("mapa");
    const valor = isApostado ? interaction.fields.getTextInputValue("valor") : null;

    const matchId = criarMatchId();
    const matches = carregarMatches();

    matches[matchId] = {
      tipo: isApostado ? "apostado" : "x1",
      criador: user.id,
      mapa,
      valor: isApostado ? parseFloat(valor) : 0,
      jogador2: null,
      status: "aberto",
      canalPrivado: null,
      canalOrigem: channel.id,
      criadoEm: new Date().toISOString(),
    };

    salvarMatches(matches);

    const titulo = isApostado ? `${EMOTES.BET} X1 Apostado` : `${EMOTES.PLAY} X1`;
    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .setDescription(`${EMOTES.ENTER} <@${user.id}> abriu um ${isApostado ? "X1 Apostado" : "X1"}!`)
      .addFields(
        { name: `${EMOTES.INFO} Mapa`, value: mapa, inline: true },
        isApostado ? { name: `${EMOTES.BET} Valor`, value: `R$ ${valor}`, inline: true } : null
      )
      .setColor(isApostado ? 16753920 : 3066993);

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`x1_entrar_${matchId}`)
        .setLabel(`${EMOTES.ENTER} Entrar`)
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ embeds: [embed], components: [botoes] });
  } catch (error) {
    console.error("Erro ao processar X1 modal:", error);
    return interaction.reply({
      content: `${EMOTES.EXIT} Erro ao criar X1. Tente novamente.`,
      ephemeral: true,
    });
  }
}

async function handleX1Entrar(interaction, matchId) {
  try {
    const matches = carregarMatches();
    const match = matches[matchId];

    if (!match) {
      return interaction.reply({ content: `${EMOTES.EXIT} Match não encontrado.`, ephemeral: true });
    }

    if (interaction.user.id === match.criador) {
      return interaction.reply({
        content: `${EMOTES.EXIT} Você não pode entrar no seu próprio X1.`,
        ephemeral: true,
      });
    }

    if (match.jogador2) {
      return interaction.reply({
        content: `${EMOTES.EXIT} Este X1 já está completo.`,
        ephemeral: true,
      });
    }

    match.jogador2 = interaction.user.id;
    matches[matchId].status = "pronto";
    salvarMatches(matches);

    const guild = interaction.guild || (await interaction.client.guilds.fetch(process.env.GUILD_ID));
    await criarCanalPrivadoX1(guild, matchId, match.tipo === "apostado");

    return interaction.reply({
      content: `${EMOTES.CHECK} <@${interaction.user.id}> entrou no X1! Canal privado criado.`,
      ephemeral: false,
    });
  } catch (error) {
    console.error("Erro ao entrar em X1:", error);
    return interaction.reply({
      content: `${EMOTES.EXIT} Erro ao entrar. Tente novamente.`,
      ephemeral: true,
    });
  }
}

async function criarCanalPrivadoX1(guild, matchId, isApostado = false) {
  try {
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

    const titulo = isApostado ? `${EMOTES.BET} X1 Apostado` : `${EMOTES.PLAY} X1`;
    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .addFields(
        { name: `${EMOTES.INFO} Mapa`, value: match.mapa },
        { name: `${EMOTES.VS} AD1`, value: `<@${match.criador}>`, inline: true },
        { name: `${EMOTES.VS} AD2`, value: `<@${match.jogador2}>`, inline: true },
        isApostado ? { name: `${EMOTES.BET} Valor`, value: `R$ ${match.valor}` } : null
      )
      .setColor(isApostado ? 16753920 : 3066993);

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`x1_vencedor_ad1_${matchId}`)
        .setLabel(`${EMOTES.WIN} AD1 Venceu`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`x1_vencedor_ad2_${matchId}`)
        .setLabel(`${EMOTES.WIN} AD2 Venceu`)
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({ embeds: [embed], components: [botoes] });

    matches[matchId].canalPrivado = canal.id;
    salvarMatches(matches);

    return canal;
  } catch (error) {
    console.error("Erro ao criar canal privado X1:", error);
  }
}

async function finalizarX1(interaction, matchId, vencedorAd) {
  try {
    const matches = carregarMatches();
    const match = matches[matchId];

    if (!match) return;

    if (!STAFF.IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: `${EMOTES.EXIT} Apenas Staff/Dono pode declarar vencedor.`,
        ephemeral: true,
      });
    }

    const vencedorId = vencedorAd === 1 ? match.criador : match.jogador2;
    const perdedorId = vencedorAd === 1 ? match.jogador2 : match.criador;

    const canalOrigem = await interaction.guild.channels.fetch(match.canalOrigem || CHANNELS.X1);
    const embed = new EmbedBuilder()
      .setTitle(`${EMOTES.WIN} Resultado`)
      .setDescription(`<@${vencedorId}> venceu contra <@${perdedorId}>`)
      .addFields({ name: "Mapa", value: match.mapa });

    if (match.tipo === "apostado") {
      embed.addFields({ name: `${EMOTES.BET} Ganho`, value: `<@${vencedorId}> ganhou R$ ${match.valor}` });
    }

    embed.setColor(5763719);

    if (canalOrigem) {
      await canalOrigem.send({ embeds: [embed] });
    }

    const canalPrivado = await interaction.guild.channels.fetch(match.canalPrivado);
    if (canalPrivado) {
      await canalPrivado.delete();
    }

    delete matches[matchId];
    salvarMatches(matches);

    return interaction.reply({
      content: `${EMOTES.CHECK} Match finalizado e canal removido.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Erro ao finalizar X1:", error);
    return interaction.reply({
      content: `${EMOTES.EXIT} Erro ao finalizar. Tente novamente.`,
      ephemeral: true,
    });
  }
}

// ═════════════════════════════════════════════════════════════════════
// ========================= SIMU / COPA / BRACKET ====================
// ═════════════════════════════════════════════════════════════════════

async function criarSimu(interaction) {
  const { user, member, channelId } = interaction;

  if (channelId !== CHANNELS.SIMU) {
    return interaction.reply({
      content: `Este comando só pode ser usado em <#${CHANNELS.SIMU}>.`,
      ephemeral: true,
    });
  }

  if (!member.roles.cache.has(ROLES.SIMU_PERMITIDO) && !STAFF.IDS.includes(user.id)) {
    return interaction.reply({
      content: `${EMOTES.EXIT} Você não tem permissão para criar Simu.`,
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_simu_${user.id}_${Date.now()}`)
    .setTitle("Criar Simu/Copa");

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
  try {
    const { user, guild } = interaction;
    const organizador = interaction.fields.getTextInputValue("organizador");
    const jogo = interaction.fields.getTextInputValue("jogo");
    const versao = interaction.fields.getTextInputValue("versao");
    const mapa = interaction.fields.getTextInputValue("mapa");
    const tipoJogo = interaction.fields.getTextInputValue("tipo_jogo");
    const qtdParticipantes = parseInt(interaction.fields.getTextInputValue("qtd_participantes"));

    // Validações
    if (!organizador || !jogo || !versao || !mapa || !tipoJogo || !qtdParticipantes) {
      return interaction.reply({
        content: `${EMOTES.EXIT} Todos os campos são obrigatórios.`,
        ephemeral: true,
      });
    }

    if (isNaN(qtdParticipantes) || qtdParticipantes < 2) {
      return interaction.reply({
        content: `${EMOTES.EXIT} Quantidade de participantes deve ser no mínimo 2.`,
        ephemeral: true,
      });
    }

    const tournamentId = criarTournamentId();
    const tournaments = carregarTournaments();

    // Salvar informações básicas PRIMEIRO
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
      bracket: [],
      faseAtual: "oitavas",
      status: "inscricao",
      criadoEm: new Date().toISOString(),
    };

    salvarTournaments(tournaments);

    // Mostrar resumo ANTES de criar canais
    const embed = new EmbedBuilder()
      .setTitle(`${EMOTES.WAIT} Criando Simu...`)
      .setDescription(`${EMOTES.INFO} Aguarde enquanto criamos os canais de inscrição`)
      .addFields(
        { name: `${EMOTES.PLAY} Jogo`, value: jogo },
        { name: `${EMOTES.INFO} Versão`, value: versao },
        { name: `${EMOTES.INFO} Mapa`, value: mapa },
        { name: `${EMOTES.VS} Tipo`, value: tipoJogo },
        { name: `${EMOTES.BRACKET} Total Participantes`, value: `0/${qtdParticipantes}` },
        { name: `${EMOTES.INFO} ID`, value: `\`${tournamentId}\`` }
      )
      .setColor(16776960);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Agora SIM criar os canais com delay
    setTimeout(async () => {
      try {
        const qtdTimes = calcularQtdTimes(qtdParticipantes, tipoJogo);
        const canais = [];

        for (let i = 1; i <= qtdTimes; i++) {
          try {
            const canal = await guild.channels.create({
              name: `time-${i}-${tournamentId.substring(0, 5)}`,
              type: ChannelType.GuildText,
            });

            const embedTime = new EmbedBuilder()
              .setTitle(`${EMOTES.TEAM} Time ${i}`)
              .setDescription(
                `${EMOTES.INFO} Tournament ID: \`${tournamentId}\`\n\n${EMOTES.ENTER} Clique em Entrar para se juntar`
              )
              .setColor(3066993);

            const botoes = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`simu_entrar_${tournamentId}_${i}`)
                .setLabel(`${EMOTES.ENTER} Entrar`)
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`simu_sair_${tournamentId}_${i}`)
                .setLabel(`${EMOTES.EXIT} Sair`)
                .se