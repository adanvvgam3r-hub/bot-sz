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

// ════════════════════════════════════════════════════════════��════════
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
      bracket: [],
      faseAtual: "oitavas",
      status: "inscricao",
      criadoEm: new Date().toISOString(),
    };

    salvarTournaments(tournaments);

    const qtdTimes = calcularQtdTimes(qtdParticipantes, tipoJogo);
    const canais = [];

    for (let i = 1; i <= qtdTimes; i++) {
      const canal = await guild.channels.create({
        name: `time-${i}-${tournamentId.substring(0, 5)}`,
        type: ChannelType.GuildText,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${EMOTES.TEAM} Time ${i}`)
        .setDescription(`${tournamentId}\n\n${EMOTES.ENTER} Clique em Entrar para se juntar ao time ${i}`)
        .setColor(3066993);

      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`simu_entrar_${tournamentId}_${i}`)
          .setLabel(`${EMOTES.ENTER} Entrar`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`simu_sair_${tournamentId}_${i}`)
          .setLabel(`${EMOTES.EXIT} Sair`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`simu_trocar_${tournamentId}_${i}`)
          .setLabel(`${EMOTES.VS} Trocar Time`)
          .setStyle(ButtonStyle.Secondary)
      );

      await canal.send({ embeds: [embed], components: [botoes] });
      canais.push(canal.id);

      tournaments[tournamentId].times[i] = [];
    }

    tournaments[tournamentId].canais = canais;
    salvarTournaments(tournaments);

    const embed = new EmbedBuilder()
      .setTitle(`${EMOTES.CHECK} Simu Criada`)
      .setDescription(`Simu "${organizador}" criada com sucesso!`)
      .addFields(
        { name: `${EMOTES.PLAY} Jogo`, value: jogo },
        { name: `${EMOTES.INFO} Versão`, value: versao },
        { name: `${EMOTES.INFO} Mapa`, value: mapa },
        { name: `${EMOTES.VS} Tipo`, value: tipoJogo },
        { name: `${EMOTES.BRACKET} Participantes`, value: `${0}/${qtdParticipantes}` },
        { name: `${EMOTES.INFO} ID`, value: tournamentId, inline: false }
      )
      .setColor(5763719);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error("Erro ao processar Simu modal:", error);
    return interaction.reply({
      content: `${EMOTES.EXIT} Erro ao criar Simu. Tente novamente.`,
      ephemeral: true,
    });
  }
}

function calcularQtdTimes(qtdParticipantes, tipoJogo) {
  const [playersPorTime] = tipoJogo.match(/\d/).map(Number);
  return qtdParticipantes / playersPorTime;
}

function verificarSimuCompleta(tournament) {
  const tamanhoTime = parseInt(tournament.tipoJogo[0]);
  for (const [idx, players] of Object.entries(tournament.times)) {
    if (!players || players.length < tamanhoTime) {
      return false;
    }
  }
  return true;
}

async function iniciarBracketAutomatico(guild, tournamentId) {
  try {
    const tournaments = carregarTournaments();
    const tournament = tournaments[tournamentId];

    if (!tournament) {
      return;
    }

    const bracket = gerarBracketAutomatico(tournament.times, tournament.tipoJogo);
    tournament.bracket = bracket;
    tournament.status = "bracket";
    tournament.faseAtual = "oitavas";
    salvarTournaments(tournaments);

    for (const match of bracket) {
      await criarCanalPartida(guild, match.matchId, match.time1, match.time2, tournament, match.fase);
    }

    const simuChannel = await guild.channels.fetch(CHANNELS.SIMU);
    if (simuChannel) {
      const embedBracket = new EmbedBuilder()
        .setTitle(`${EMOTES.BRACKET} Bracket Gerado - ${tournament.organizador}`)
        .setDescription(`Total de ${bracket.length} partidas na fase de oitavas\n\n${EMOTES.VS} **PARTIDAS:**`)
        .setColor(10181046);

      bracket.forEach((match, idx) => {
        const time1 = match.time1.players.map((id) => `<@${id}>`).join(", ");
        const time2 = match.time2.players.map((id) => `<@${id}>`).join(", ");
        embedBracket.addFields({
          name: `Partida ${idx + 1}`,
          value: `${time1} ${EMOTES.VS} ${time2}`,
          inline: false,
        });
      });

      await simuChannel.send({ embeds: [embedBracket] });
    }
  } catch (error) {
    console.error("Erro ao iniciar bracket:", error);
  }
}

async function criarCanalPartida(guild, matchId, time1, time2, tournament, fase = "oitavas") {
  try {
    const permissoes = [
      ...time1.players.map((id) => ({
        id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      })),
      ...time2.players.map((id) => ({
        id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      })),
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
      name: `${fase}-${matchId.substring(0, 8)}`,
      type: ChannelType.GuildText,
      permissionOverwrites: permissoes,
    });

    const time1Str = time1.players.map((id) => `<@${id}>`).join(", ");
    const time2Str = time2.players.map((id) => `<@${id}>`).join(", ");

    const embed = new EmbedBuilder()
      .setTitle(`${EMOTES.PLAY} ${fase.toUpperCase()} - Partida`)
      .addFields(
        { name: `${EMOTES.TEAM} Time 1`, value: time1Str || "Vazio" },
        { name: `${EMOTES.TEAM} Time 2`, value: time2Str || "Vazio" },
        { name: `${EMOTES.INFO} Mapa`, value: tournament.mapa }
      )
      .setColor(3066993);

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`simu_vencedor_1_${matchId}`)
        .setLabel(`${EMOTES.WIN} Time 1 Venceu`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`simu_vencedor_2_${matchId}`)
        .setLabel(`${EMOTES.WIN} Time 2 Venceu`)
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({ embeds: [embed], components: [botoes] });

    const matches = carregarMatches();
    matches[matchId] = {
      tipo: "simu",
      tournamentId: tournamentId,
      time1: time1.players,
      time2: time2.players,
      status: "pendente",
      canalPartida: canal.id,
      fase: fase,
      criadoEm: new Date().toISOString(),
    };
    salvarMatches(matches);

    return canal;
  } catch (error) {
    console.error("Erro ao criar canal partida:", error);
  }
}

async function finalizarPartidaSimu(interaction, matchId, timeVencedor) {
  try {
    const matches = carregarMatches();
    const tournaments = carregarTournaments();

    if (!matches[matchId]) {
      return interaction.reply({ content: `${EMOTES.EXIT} Match não encontrado.`, ephemeral: true });
    }

    if (!STAFF.IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: `${EMOTES.EXIT} Apenas Staff/Dono pode declarar vencedor.`,
        ephemeral: true,
      });
    }

    const match = matches[matchId];

    let tournament = null;
    let tournamentId = null;
    for (const [tId, t] of Object.entries(tournaments)) {
      if (t.bracket.some((b) => b.matchId === matchId)) {
        tournament = t;
        tournamentId = tId;
        break;
      }
    }

    if (!tournament) {
      return interaction.reply({ content: `${EMOTES.EXIT} Torneio não encontrado.`, ephemeral: true });
    }

    let bracketMatch = tournament.bracket.find((m) => m.matchId === matchId);

    if (!bracketMatch) {
      return interaction.reply({ content: `${EMOTES.EXIT} Partida não encontrada no bracket.`, ephemeral: true });
    }

    bracketMatch.vencedor = timeVencedor === 1 ? bracketMatch.time1 : bracketMatch.time2;
    bracketMatch.status = "finalizada";

    const vencedorIds = bracketMatch.vencedor.players;
    const timePerded = timeVencedor === 1 ? bracketMatch.time2 : bracketMatch.time1;
    const viceIds = timePerded.players;

    atualizarRanking(vencedorIds, viceIds);

    const partidasNaFase = tournament.bracket.filter((m) => m.fase === tournament.faseAtual);
    const partidasFinalizadas = partidasNaFase.filter((m) => m.status === "finalizada");

    let mensagemResultado = `${EMOTES.WIN} Time ${timeVencedor} venceu!\n\n`;
    mensagemResultado += `**Vencedores:** ${vencedorIds.map((id) => `<@${id}>`).join(", ")}\n`;
    mensagemResultado += `**Vice:** ${viceIds.map((id) => `<@${id}>`).join(", ")}`;

    if (partidasFinalizadas.length === partidasNaFase.length) {
      mensagemResultado += `\n\n${EMOTES.CHECK} Fase de ${tournament.faseAtual} concluída!`;

      if (partidasNaFase.length === 1 && tournament.faseAtual === "final") {
        mensagemResultado += `\n🎉 **${tournament.organizador}** finalizado!`;
        tournament.status = "finalizado";

        const embedFinal = new EmbedBuilder()
          .setTitle(`${EMOTES.WIN} Campeões - ${tournament.organizador}`)
          .setDescription(`**Vencedores:**\n${vencedorIds.map((id) => `<@${id}>`).join("\n")}`)
          .addFields({
            name: "Vice-Campeões",
            value: viceIds.map((id) => `<@${id}>`).join("\n"),
          })
          .setColor(10181046);

        const simuChannel = await interaction.guild.channels.fetch(CHANNELS.SIMU);
        if (simuChannel) {
          await simuChannel.send({ embeds: [embedFinal] });
        }
      } else if (partidasFinalizadas.length === partidasNaFase.length) {
        const proximaFase = obterProximaFase(tournament.faseAtual);
        const vencedoresOrdenados = partidasNaFase.filter((m) => m.vencedor).map((m) => m.vencedor);

        const novoBracket = gerarProximaFase(vencedoresOrdenados);

        tournament.faseAtual = proximaFase;
        novoBracket.forEach((match) => {
          match.fase = proximaFase;
          match.status = "pendente";
          tournament.bracket.push(match);
        });

        mensagemResultado += `\n\n➡️ Próxima fase: **${proximaFase}**\nPartidas: ${novoBracket.length}`;

        for (const match of novoBracket) {
          await criarCanalPartida(
            interaction.guild,
            match.matchId,
            match.time1,
            match.time2,
            tournament,
            proximaFase
          );
        }
      }
    }

    salvarTournaments(tournaments);

    try {
      const canal = await interaction.guild.channels.fetch(interaction.channelId);
      if (canal) {
        await canal.delete();
      }
    } catch (error) {
      console.error("Erro ao deletar canal:", error);
    }

    return interaction.reply({
      content: mensagemResultado,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Erro ao finalizar partida:", error);
    return interaction.reply({
      content: `${EMOTES.EXIT} Erro ao finalizar. Tente novamente.`,
      ephemeral: true,
    });
  }
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
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
      body: commands,
    });
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

      return interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(botao)],
      });
    }

    if (interaction.customId.startsWith("modal_x1_") || interaction.customId.startsWith("modal_apostado_")) {
      const isApostado = interaction.customId.startsWith("modal_apostado_");
      return processarX1Modal(interaction, isApostado);
    }

    if (interaction.customId.startsWith("modal_simu_")) {
      return processarSimuModal(interaction);
    }
  }

  if (interaction.isButton()) {
    const { customId, user, guild } = interaction;

    if (customId.startsWith("x1_entrar_")) {
      const matchId = customId.replace("x1_entrar_", "");
      return handleX1Entrar(interaction, matchId);
    }

    if (customId.startsWith("x1_vencedor_")) {
      const parts = customId.split("_");
      const vencedorAd = parts[2] === "ad1" ? 1 : 2;
      const matchId = parts.slice(3).join("_");
      return finalizarX1(interaction, matchId, vencedorAd);
    }

    if (customId.startsWith("simu_entrar_")) {
      const [, , tournamentId, timeIndex] = customId.split("_");
      const tournaments = carregarTournaments();
      const tournament = tournaments[tournamentId];

      if (!tournament) {
        return interaction.reply({ content: `${EMOTES.EXIT} Simu não encontrada.`, ephemeral: true });
      }

      if (!tournament.times[timeIndex]) {
        tournament.times[timeIndex] = [];
      }

      const tamanhoTime = parseInt(tournament.tipoJogo[0]);
      if (tournament.times[timeIndex].length >= tamanhoTime) {
        return interaction.reply({
          content: `${EMOTES.EXIT} Este time está cheio. Escolha outro time.`,
          ephemeral: true,
        });
      }

      if (tournament.times[timeIndex].includes(user.id)) {
        return interaction.reply({
          content: `${EMOTES.EXIT} Você já está neste time.`,
          ephemeral: true,
        });
      }

      tournament.times[timeIndex].push(user.id);

      if (verificarSimuCompleta(tournament)) {
        await iniciarBracketAutomatico(guild, tournamentId);
      }

      salvarTournaments(tournaments);

      return interaction.reply({
        content: `${EMOTES.CHECK} <@${user.id}> entrou no Time ${timeIndex}!`,
        ephemeral: true,
      });
    }

    if (customId.startsWith("simu_sair_")) {
      const [, , tournamentId, timeIndex] = customId.split("_");
      const tournaments = carregarTournaments();
      const tournament = tournaments[tournamentId];

      if (!tournament) {
        return interaction.reply({ content: `${EMOTES.EXIT} Simu não encontrada.`, ephemeral: true });
      }

      if (tournament.times[timeIndex]) {
        const idx = tournament.times[timeIndex].indexOf(user.id);
        if (idx > -1) {
          tournament.times[timeIndex].splice(idx, 1);
          salvarTournaments(tournaments);
          return interaction.reply({
            content: `${EMOTES.CHECK} <@${user.id}> saiu do Time ${timeIndex}!`,
            ephemeral: true,
          });
        }
      }

      return interaction.reply({
        content: `${EMOTES.EXIT} Você não está neste time.`,
        ephemeral: true,
      });
    }

    if (customId.startsWith("simu_trocar_")) {
      const [, , tournamentId] = customId.split("_");
      const tournaments = carregarTournaments();
      const tournament = tournaments[tournamentId];

      if (!tournament) {
        return interaction.reply({ content: `${EMOTES.EXIT} Simu não encontrada.`, ephemeral: true });
      }

      for (let i = 1; i <= Object.keys(tournament.times).length; i++) {
        if (tournament.times[i] && tournament.times[i].includes(user.id)) {
          tournament.times[i] = tournament.times[i].filter((id) => id !== user.id);
          break;
        }
      }

      const options = [];
      for (let i = 1; i <= Object.keys(tournament.times).length; i++) {
        const tamanhoTime = parseInt(tournament.tipoJogo[0]);
        const jogosNoTime = tournament.times[i] ? tournament.times[i].length : 0;
        const disponivel = jogosNoTime < tamanhoTime;

        options.push({
          label: `Time ${i} (${jogosNoTime}/${tamanhoTime})`,
          value: `simu_escolher_time_${tournamentId}_${i}`,
          default: false,
          disabled: !disponivel,
        });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`simu_select_time_${tournamentId}`)
        .setPlaceholder("Escolha um time")
        .addOptions(options);

      return interaction.reply({
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
    }

    if (customId.startsWith("simu_vencedor_")) {
      const parts = customId.split("_");
      const timeVencedor = parts[2];
      const matchId = parts.slice(3).join("_");

      return finalizarPartidaSimu(interaction, matchId, parseInt(timeVencedor));
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("simu_select_time_")) {
      const tournamentId = interaction.customId.replace("simu_select_time_", "");
      const selectedValue = interaction.values[0];
      const [, , , novoTimeIndex] = selectedValue.split("_");

      const tournaments = carregarTournaments();
      const tournament = tournaments[tournamentId];

      if (!tournament) {
        return interaction.reply({ content: `${EMOTES.EXIT} Simu não encontrada.`, ephemeral: true });
      }

      if (!tournament.times[novoTimeIndex]) {
        tournament.times[novoTimeIndex] = [];
      }

      tournament.times[novoTimeIndex].push(interaction.user.id);

      if (verificarSimuCompleta(tournament)) {
        await iniciarBracketAutomatico(interaction.guild, tournamentId);
      }

      salvarTournaments(tournaments);

      return interaction.reply({
        content: `${EMOTES.CHECK} Você se mudou para o Time ${novoTimeIndex}!`,
        ephemeral: true,
      });
    }
  }
});

client.login(process.env.TOKEN);
