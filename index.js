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
// ========================= BRACKET SYSTEM ===========================
// ═════════════════════════════════════════════════════════════════════

function gerarBracketAutomatico(times, tipoJogo) {
  /**
   * Gera bracket automático baseado no tipo de jogo
   * 1v1: C1 vs C16, C2 vs C15, C3 vs C14...
   * 2v2, 3v3, 4v4: mesma lógica
   */

  const timesArray = Object.entries(times)
    .filter(([_, players]) => players && players.length > 0)
    .map(([idx, players]) => ({
      id: idx,
      players: players,
    }));

  if (timesArray.length < 2) {
    return [];
  }

  // Gerar bracket de forma espelhada (C1 vs Última, C2 vs Penúltima, etc)
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

function gerarProximaFase(vencedores, tipoJogo) {
  /**
   * Gera a próxima fase baseada nos vencedores
   */
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
  const { user, guild, channel } = interaction;
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
    status: "pendente",
    canalPrivado: null,
    canalOrigem: channel.id,
    criadoEm: new Date().toISOString(),
  };

  salvarMatches(matches);

  // Embed com botões Sim/Não
  const embed = new EmbedBuilder()
    .setTitle(isApostado ? "🎰 X1 Apostado" : "🎮 X1")
    .setDescription(`<@${user.id}> criou um ${isApostado ? "X1 Apostado" : "X1"}!`)
    .addFields(
      { name: "Mapa", value: mapa, inline: true },
      isApostado ? { name: "Valor", value: `R$ ${valor}`, inline: true } : null
    )
    .setColor(isApostado ? 16753920 : 3066993);

  const botoesEscolha = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`x1_sim_${matchId}`)
      .setLabel("Sim (desafiar alguém)")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`x1_nao_${matchId}`)
      .setLabel("Não (aberto para todos)")
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({ embeds: [embed], components: [botoesEscolha] });
}

// Quando clica em SIM - pedir menção
async function handleX1Sim(interaction, matchId) {
  const matches = carregarMatches();
  const match = matches[matchId];

  if (!match) {
    return interaction.reply({ content: "Match não encontrado.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_x1_mencionar_${matchId}`)
    .setTitle("Mencionar Jogador");

  const mencao = new TextInputBuilder()
    .setCustomId("mencao")
    .setLabel("Mencione o jogador ou cole o ID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("@jogador ou 123456789");

  modal.addComponents(new ActionRowBuilder().addComponents(mencao));

  return interaction.showModal(modal);
}

// Processar menção e enviar DM
async function processarMencaoX1(interaction, matchId) {
  const mencaoText = interaction.fields.getTextInputValue("mencao").trim();
  const matches = carregarMatches();
  const match = matches[matchId];

  if (!match) {
    return interaction.reply({ content: "Match não encontrado.", ephemeral: true });
  }

  // Extrair ID da menção
  let targetId = mencaoText.replace(/[<@!>]/g, "");

  if (!targetId || targetId === match.criador) {
    return interaction.reply({
      content: "ID inválido ou você não pode desafiar a si mesmo.",
      ephemeral: true,
    });
  }

  match.jogador2 = targetId;
  matches[matchId].status = "convite_enviado";
  salvarMatches(matches);

  // Enviar DM para o jogador
  try {
    const user = await interaction.client.users.fetch(targetId);
    const dmEmbed = new EmbedBuilder()
      .setTitle(match.tipo === "apostado" ? "🎰 X1 Apostado" : "🎮 X1 Convite")
      .setDescription(`<@${match.criador}> quer jogar um ${match.tipo === "apostado" ? "X1 Apostado" : "X1"}!`)
      .addFields(
        { name: "Mapa", value: match.mapa, inline: true },
        match.tipo === "apostado" ? { name: "Valor", value: `R$ ${match.valor}`, inline: true } : null
      )
      .setColor(match.tipo === "apostado" ? 16753920 : 3066993);

    const botoesResposta = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`x1_aceitar_${matchId}`)
        .setLabel("Aceitar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`x1_recusar_${matchId}`)
        .setLabel("Recusar")
        .setStyle(ButtonStyle.Danger)
    );

    await user.send({ embeds: [dmEmbed], components: [botoesResposta] });

    return interaction.reply({
      content: `✅ Convite enviado para <@${targetId}>!`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Erro ao enviar DM:", error);
    return interaction.reply({
      content: "Não consegui enviar DM para este jogador.",
      ephemeral: true,
    });
  }
}

// Quando clica em NÃO - criar botão de entrar
async function handleX1Nao(interaction, matchId) {
  const matches = carregarMatches();
  const match = matches[matchId];

  if (!match) {
    return interaction.reply({ content: "Match não encontrado.", ephemeral: true });
  }

  matches[matchId].status = "aberto";
  salvarMatches(matches);

  const embed = new EmbedBuilder()
    .setTitle(match.tipo === "apostado" ? "🎰 X1 Apostado" : "🎮 X1")
    .setDescription(`<@${match.criador}> abriu um ${match.tipo === "apostado" ? "X1 Apostado" : "X1"}!`)
    .addFields(
      { name: "Mapa", value: match.mapa, inline: true },
      match.tipo === "apostado" ? { name: "Valor", value: `R$ ${match.valor}`, inline: true } : null
    )
    .setColor(match.tipo === "apostado" ? 16753920 : 3066993);

  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`x1_entrar_${matchId}`)
      .setLabel("Entrar no X1")
      .setStyle(ButtonStyle.Success)
  );

  // Editar a mensagem original
  await interaction.update({ embeds: [embed], components: [botoes] });
}

// Aceitar convite
async function handleX1Aceitar(interaction, matchId) {
  const matches = carregarMatches();
  const match = matches[matchId];

  if (!match) {
    return interaction.reply({ content: "Match não encontrado.", ephemeral: true });
  }

  if (interaction.user.id !== match.jogador2) {
    return interaction.reply({
      content: "Este convite não é para você.",
      ephemeral: true,
    });
  }

  matches[matchId].status = "aceito";
  salvarMatches(matches);

  const guild = interaction.guild || (await interaction.client.guilds.fetch(process.env.GUILD_ID));
  await criarCanalPrivadoX1(guild, matchId, match.tipo === "apostado");

  return interaction.reply({
    content: `✅ Você aceitou o desafio! Canal privado criado.`,
    ephemeral: true,
  });
}

// Recusar convite
async function handleX1Recusar(interaction, matchId) {
  const matches = carregarMatches();
  const match = matches[matchId];

  if (!match) {
    return interaction.reply({ content: "Match não encontrado.", ephemeral: true });
  }

  if (interaction.user.id !== match.jogador2) {
    return interaction.reply({
      content: "Este convite não é para você.",
      ephemeral: true,
    });
  }

  delete matches[matchId];
  salvarMatches(matches);

  return interaction.reply({
    content: `❌ Você recusou o desafio.`,
    ephemeral: true,
  });
}

// Entrar em X1 aberto
async function handleX1Entrar(interaction, matchId) {
  const matches = carregarMatches();
  const match = matches[matchId];

  if (!match) {
    return interaction.reply({ content: "Match não encontrado.", ephemeral: true });
  }

  if (interaction.user.id === match.criador) {
    return interaction.reply({
      content: "Você não pode entrar no seu próprio X1.",
      ephemeral: true,
    });
  }

  match.jogador2 = interaction.user.id;
  matches[matchId].status = "pronto";
  salvarMatches(matches);

  const guild = interaction.guild || (await interaction.client.guilds.fetch(process.env.GUILD_ID));
  await criarCanalPrivadoX1(guild, matchId, match.tipo === "apostado");

  return interaction.reply({
    content: `✅ <@${interaction.user.id}> entrou no X1! Canal privado criado.`,
    ephemeral: false,
  });
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

  // Criar canais dos times
  const qtdTimes = calcularQtdTimes(qtdParticipantes, tipoJogo);
  const canais = [];

  for (let i = 1; i <= qtdTimes; i++) {
    const canal = await guild.channels.create({
      name: `time-${i}-${tournamentId.substring(0, 5)}`,
      type: ChannelType.GuildText,
    });

    const embed = new EmbedBuilder()
      .setTitle(`⚽ Time ${i}`)
      .setDescription(`${tournamentId}\n\nClique em Entrar para se juntar ao time ${i}`)
      .setColor(3066993);

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`simu_entrar_${tournamentId}_${i}`)
        .setLabel("Entrar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`simu_sair_${tournamentId}_${i}`)
        .setLabel("Sair")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`simu_trocar_${tournamentId}_${i}`)
        .setLabel("Trocar de Time")
        .setStyle(ButtonStyle.Secondary)
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
      { name: "Participantes", value: String(qtdParticipantes) },
      { name: "ID", value: tournamentId, inline: false }
    )
    .setColor(5763719);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

function calcularQtdTimes(qtdParticipantes, tipoJogo) {
  const [playersPorTime] = tipoJogo.match(/\d/).map(Number);
  return qtdParticipantes / playersPorTime;
}

function verificarSimuCompleta(tournament) {
  /**
   * Verifica se todos os times estão completos
   */
  const tamanhoTime = parseInt(tournament.tipoJogo[0]);
  for (const [idx, players] of Object.entries(tournament.times)) {
    if (!players || players.length < tamanhoTime) {
      return false;
    }
  }
  return true;
}

async function iniciarBracketAutomatico(guild, tournamentId) {
  /**
   * Inicia o bracket automaticamente quando a simu enche
   */
  const tournaments = carregarTournaments();
  const tournament = tournaments[tournamentId];

  if (!tournament) {
    return;
  }

  // Gerar bracket automático
  const bracket = gerarBracketAutomatico(tournament.times, tournament.tipoJogo);
  tournament.bracket = bracket;
  tournament.status = "bracket";
  tournament.faseAtual = "oitavas";
  salvarTournaments(tournaments);

  // Criar canais das partidas
  for (const match of bracket) {
    await criarCanalPartida(guild, match.matchId, match.time1, match.time2, tournament, match.fase);
  }

  // Enviar mensagem de bracket gerado no canal de Simu
  const simuChannel = await guild.channels.fetch(CHANNELS.SIMU);
  if (simuChannel) {
    const embedBracket = new EmbedBuilder()
      .setTitle(`🏆 Bracket Gerado - ${tournament.organizador}`)
      .setDescription(`Total de ${bracket.length} partidas na fase de oitavas\n\n⚔️ **PARTIDAS:**`)
      .setColor(10181046);

    bracket.forEach((match, idx) => {
      const time1 = match.time1.players.map((id) => `<@${id}>`).join(", ");
      const time2 = match.time2.players.map((id) => `<@${id}>`).join(", ");
      embedBracket.addFields({
        name: `Partida ${idx + 1}`,
        value: `${time1} vs ${time2}`,
        inline: false,
      });
    });

    await simuChannel.send({ embeds: [embedBracket] });
  }
}

async function criarCanalPartida(guild, matchId, time1, time2, tournament, fase = "oitavas") {
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
    .setTitle(`🎮 ${fase.toUpperCase()} - Partida`)
    .addFields(
      { name: "Time 1", value: time1Str || "Vazio" },
      { name: "Time 2", value: time2Str || "Vazio" },
      { name: "Mapa", value: tournament.mapa }
    )
    .setColor(3066993);

  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`simu_vencedor_1_${matchId}`)
      .setLabel("Time 1 Venceu")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`simu_vencedor_2_${matchId}`)
      .setLabel("Time 2 Venceu")
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await canal.send({ embeds: [embed], components: [botoes] });

  // Salvar informação da partida
  const matches = carregarMatches();
  matches[matchId] = {
    tipo: "simu",
    tournamentId: tournament.organizador,
    time1: time1.players,
    time2: time2.players,
    status: "pendente",
    canalPartida: canal.id,
    criadoEm: new Date().toISOString(),
  };
  salvarMatches(matches);

  return canal;
}

async function finalizarPartidaSimu(interaction, matchId, timeVencedor) {
  const matches = carregarMatches();
  const tournaments = carregarTournaments();

  if (!matches[matchId]) {
    return interaction.reply({ content: "Match não encontrado.", ephemeral: true });
  }

  // Verificar Staff
  if (!STAFF.IDS.includes(interaction.user.id)) {
    return interaction.reply({
      content: "Apenas Staff/Dono pode declarar vencedor.",
      ephemeral: true,
    });
  }

  const match = matches[matchId];

  // Encontrar o torneio
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
    return interaction.reply({ content: "Torneio não encontrado.", ephemeral: true });
  }

  // Encontrar a partida no bracket
  let bracketMatch = tournament.bracket.find((m) => m.matchId === matchId);

  if (!bracketMatch) {
    return interaction.reply({ content: "Partida não encontrada no bracket.", ephemeral: true });
  }

  // Definir vencedor
  bracketMatch.vencedor = timeVencedor === 1 ? bracketMatch.time1 : bracketMatch.time2;
  bracketMatch.status = "finalizada";

  // Atualizar ranking
  const vencedorIds = bracketMatch.vencedor.players;
  const timePerded = timeVencedor === 1 ? bracketMatch.time2 : bracketMatch.time1;
  const viceIds = timePerded.players;

  atualizarRanking(vencedorIds, viceIds);

  // Verificar se fase foi concluída
  const partidasNaFase = tournament.bracket.filter((m) => m.fase === tournament.faseAtual);
  const partidasFinalizadas = partidasNaFase.filter((m) => m.status === "finalizada");

  let mensagemResultado = `🏆 Time ${timeVencedor} venceu!\n\n`;
  mensagemResultado += `**Vencedores:** ${vencedorIds.map((id) => `<@${id}>`).join(", ")}\n`;
  mensagemResultado += `**Vice:** ${viceIds.map((id) => `<@${id}>`).join(", ")}`;

  if (partidasFinalizadas.length === partidasNaFase.length) {
    // Fase concluída
    mensagemResultado += `\n\n✅ Fase de ${tournament.faseAtual} concluída!`;

    if (partidasNaFase.length === 1 && tournament.faseAtual === "final") {
      // Torneio finalizado
      mensagemResultado += `\n🎉 **${tournament.organizador}** finalizado!`;
      tournament.status = "finalizado";

      // Criar embed com resultado final
      const embedFinal = new EmbedBuilder()
        .setTitle(`🏆 Campeões - ${tournament.organizador}`)
        .setDescription(
          `**Vencedores:**\n${vencedorIds.map((id) => `<@${id}>`).join("\n")}`
        )
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
      // Gerar próxima fase
      const proximaFase = obterProximaFase(tournament.faseAtual);
      const vencedoresOrdenados = partidasNaFase.filter((m) => m.vencedor).map((m) => m.vencedor);

      const novoBracket = gerarProximaFase(vencedoresOrdenados, tournament.tipoJogo);

      // Adicionar fase
      tournament.faseAtual = proximaFase;
      novoBracket.forEach((match) => {
        match.fase = proximaFase;
        match.status = "pendente";
        tournament.bracket.push(match);
      });

      mensagemResultado += `\n\n➡️ Próxima fase: **${proximaFase}**\nPartidas: ${novoBracket.length}`;

      // Criar canais da próxima fase
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

  // Deletar canal da partida
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

      return interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(botao)],
      });
    }

    // X1 / Apostado Modal
    if (interaction.customId.startsWith("modal_x1_") || interaction.customId.startsWith("modal_apostado_")) {
      const isApostado = interaction.customId.startsWith("modal_apostado_");
      return processarX1Modal(interaction, isApostado);
    }

    // X1 Mencionar
    if (interaction.customId.startsWith("modal_x1_mencionar_")) {
      const matchId = interaction.customId.replace("modal_x1_mencionar_", "");
      return processarMencaoX1(interaction, matchId);
    }

    // Simu Modal
    if (interaction.customId.startsWith("modal_simu_")) {
      return processarSimuModal(interaction);
    }
  }

  // ───────── BUTTON INTERACTIONS ─────────
  if (interaction.isButton()) {
    const { customId, user, guild } = interaction;

    // X1 SIM
    if (customId.startsWith("x1_sim_")) {
      const matchId = customId.replace("x1_sim_", "");
      return handleX1Sim(interaction, matchId);
    }

    // X1 NÃO
    if (customId.startsWith("x1_nao_")) {
      const matchId = customId.replace("x1_nao_", "");
      return handleX1Nao(interaction, matchId);
    }

    // X1 Entrar
    if (customId.startsWith("x1_entrar_")) {
      const matchId = customId.replace("x1_entrar_", "");
      return handleX1Entrar(interaction, matchId);
    }

    // X1 Aceitar
    if (customId.startsWith("x1_aceitar_")) {
      const matchId = customId.replace("x1_aceitar_", "");
      return handleX1Aceitar(interaction, matchId);
    }

    // X1 Recusar
    if (customId.startsWith("x1_recusar_")) {
      const matchId = customId.replace("x1_recusar_", "");
      return handleX1Recusar(interaction, matchId);
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

      if (tournament.times[timeIndex].includes(user.id)) {
        return interaction.reply({
          content: "Você já está neste time.",
          ephemeral: true,
        });
      }

      tournament.times[timeIndex].push(user.id);

      // VERIFICAR SE SIMU ESTÁ COMPLETA
      if (verificarSimuCompleta(tournament)) {
        // Iniciar bracket automaticamente
        await iniciarBracketAutomatico(guild, tournamentId);
      }

      salvarTournaments(tournaments);

      return interaction.reply({
        content: `✅ <@${user.id}> entrou no Time ${timeIndex}!`,
        ephemeral: true,
      });
    }

    // Simu Sair Time
    if (customId.startsWith("simu_sair_")) {
      const [, , tournamentId, timeIndex] = customId.split("_");
      const tournaments = carregarTournaments();
      const tournament = tournaments[tournamentId];

      if (!tournament) {
        return interaction.reply({ content: "Simu não encontrada.", ephemeral: true });
      }

      if (tournament.times[timeIndex]) {
        const idx = tournament.times[timeIndex].indexOf(user.id);
        if (idx > -1) {
          tournament.times[timeIndex].splice(idx, 1);
          salvarTournaments(tournaments);
          return interaction.reply({
            content: `✅ <@${user.id}> saiu do Time ${timeIndex}!`,
            ephemeral: true,
          });
        }
      }

      return interaction.reply({
        content: "Você não está neste time.",
        ephemeral: true,
      });
    }

    // Simu Trocar Time
    if (customId.startsWith("simu_trocar_")) {
      const [, , tournamentId, timeAtual] = customId.split("_");
      const tournaments = carregarTournaments();
      const tournament = tournaments[tournamentId];

      if (!tournament) {
        return interaction.reply({ content: "Simu não encontrada.", ephemeral: true });
      }

      // Remove do time atual
      for (let i = 1; i <= Object.keys(tournament.times).length; i++) {
        if (tournament.times[i] && tournament.times[i].includes(user.id)) {
          tournament.times[i] = tournament.times[i].filter((id) => id !== user.id);
          break;
        }
      }

      // Cria select para escolher novo time
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

    // Simu Vencedor Partida
    if (customId.startsWith("simu_vencedor_")) {
      const parts = customId.split("_");
      const timeVencedor = parts[2];
      const matchId = parts.slice(3).join("_");

      return finalizarPartidaSimu(interaction, matchId, parseInt(timeVencedor));
    }
  }

  // ───────── SELECT MENU ─────────
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("simu_select_time_")) {
      const tournamentId = interaction.customId.replace("simu_select_time_", "");
      const selectedValue = interaction.values[0];
      const [, , , novoTimeIndex] = selectedValue.split("_");

      const tournaments = carregarTournaments();
      const tournament = tournaments[tournamentId];

      if (!tournament) {
        return interaction.reply({ content: "Simu não encontrada.", ephemeral: true });
      }

      if (!tournament.times[novoTimeIndex]) {
        tournament.times[novoTimeIndex] = [];
      }

      tournament.times[novoTimeIndex].push(interaction.user.id);

      // VERIFICAR SE SIMU ESTÁ COMPLETA
      if (verificarSimuCompleta(tournament)) {
        // Iniciar bracket automaticamente
        await iniciarBracketAutomatico(interaction.guild, tournamentId);
      }

      salvarTournaments(tournaments);

      return interaction.reply({
        content: `✅ Você se mudou para o Time ${novoTimeIndex}!`,
        ephemeral: true,
      });
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
// ========================= LOGIN =====================================
// ═════════════════════════════════════════════════════════════════════

client.login(process.env.TOKEN);
