
/* =========================================
   ARMCO MONTAGEM LC25
   CONFIGURAÇÃO E ARMAZENAMENTO
========================================= */

const CHAVES = {
  montagens: "armco_montagens_v1",
  pecas: "armco_pecas_v1",
  tema: "armco_tema"
};

const $ = id => document.getElementById(id);

let montagemAtual = null;
let categoriaAtual = "ANEL";
let indisponiveisBusca = new Set();
let gruposImpulsores = [];
let reducaoAtual = null;
let combinacaoImpulsorAutomatica = null;

function lerLista(chave) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function salvarLista(chave, dados) {
  localStorage.setItem(chave, JSON.stringify(dados));
}

function numero(valor) {
  if (typeof valor === "number") return valor;

  const texto = String(valor ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  return texto === "" ? NaN : Number(texto);
}

function formatar(valor, casas = 3) {
  if (!Number.isFinite(Number(valor))) return "—";

  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: casas
  });
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
}

function novoId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function nomeCategoria(categoria) {
  return ({
    ANEL: "Anel",
    IMPULSOR: "Impulsor",
    FACA: "Faca"
  })[categoria] || categoria;
}

/* =========================================
   TEMA
========================================= */

function aplicarTema() {
  const tema = localStorage.getItem(CHAVES.tema) || "escuro";

  document.body.classList.toggle("dark", tema === "escuro");

  const texto = tema === "escuro"
    ? "☀️ Tema claro"
    : "🌑 Tema preto";

  if ($("themeToggle")) $("themeToggle").textContent = texto;
  if ($("themeToggleConfig")) $("themeToggleConfig").textContent = texto;
}

function alternarTema() {
  const atual = document.body.classList.contains("dark")
    ? "escuro"
    : "claro";

  localStorage.setItem(
    CHAVES.tema,
    atual === "escuro" ? "claro" : "escuro"
  );

  aplicarTema();
}

$("themeToggle")?.addEventListener("click", alternarTema);
$("themeToggleConfig")?.addEventListener("click", alternarTema);

/* =========================================
   NAVEGAÇÃO
========================================= */

function abrirPagina(nome) {
  document.querySelectorAll(".page").forEach(pagina => {
    pagina.classList.remove("active");
  });

  $("page-" + nome)?.classList.add("active");

  document.querySelectorAll("[data-page]").forEach(botao => {
    botao.classList.toggle("active", botao.dataset.page === nome);
  });

  document.body.classList.remove("menu-open");

  if (nome === "historico") atualizarHistorico();
  if (nome === "ferramentais") atualizarFerramentais();
  if (nome === "inicio") atualizarUltimasMontagens();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(botao => {
  botao.addEventListener("click", () => abrirPagina(botao.dataset.page));
});

document.querySelectorAll("[data-goto]").forEach(botao => {
  botao.addEventListener("click", () => abrirPagina(botao.dataset.goto));
});

$("atalhoNova")?.addEventListener("click", () => {
  abrirPagina("inicio");
  $("formSection")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

$("menuToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("menu-open");
});

$("closeMenu")?.addEventListener("click", () => {
  document.body.classList.remove("menu-open");
});

$("overlay")?.addEventListener("click", () => {
  document.body.classList.remove("menu-open");
});

/* =========================================
   FOLGAS
========================================= */

function obterFolga(espessura, folgaManual) {
  if (Math.abs(espessura - 1.00) < 0.000001) {
    const escolha = numero(folgaManual);
    return escolha === 0.30 || escolha === 0.35
      ? escolha
      : null;
  }

  const faixas = [
    [0.15, 0.35, 0.05],
    [0.40, 0.55, 0.10],
    [0.60, 0.70, 0.15],
    [0.75, 0.85, 0.20],
    [0.90, 0.95, 0.25]
  ];

  const faixa = faixas.find(([min, max]) =>
    espessura >= min - 0.000001 &&
    espessura <= max + 0.000001
  );

  return faixa ? faixa[2] : null;
}

$("espessura")?.addEventListener("input", () => {
  const espessura = numero($("espessura").value);

  $("wrapFolgaManual").hidden =
    !(Number.isFinite(espessura) &&
      Math.abs(espessura - 1.00) < 0.000001);
});

/* =========================================
   FACAS
========================================= */

function atualizarCampoSegundaFaca() {
  const quantidade = document.querySelector(
    'input[name="qtdFacas"]:checked'
  )?.value || "1";

  $("wrapFacaInferior").hidden = quantidade !== "2";
  $("facaInferior").required = false;
}

document.querySelectorAll('input[name="qtdFacas"]').forEach(radio => {
  radio.addEventListener("change", atualizarCampoSegundaFaca);
});

/* =========================================
   CADASTRO DE FERRAMENTAIS
========================================= */

function normalizarPeca(peca) {
  return {
    ...peca,
    id: peca.id || novoId(),
    categoria: String(peca.categoria || peca.tipo || "ANEL").toUpperCase(),
    medida: numero(peca.medida ?? peca.largura),
    identificacao: String(peca.identificacao || peca.nome || ""),
    indisponivel: Boolean(peca.indisponivel)
  };
}

function obterPecas(categoria = "TODOS") {
  return lerLista(CHAVES.pecas)
    .map(normalizarPeca)
    .filter(p => Number.isFinite(p.medida) && p.medida > 0)
    .filter(p => categoria === "TODOS" || p.categoria === categoria);
}

function pecasDisponiveis(categoria) {
  return obterPecas(categoria).filter(p =>
    !p.indisponivel &&
    !indisponiveisBusca.has(String(p.id))
  );
}

document.querySelectorAll("[data-category]").forEach(botao => {
  botao.addEventListener("click", () => {
    categoriaAtual = botao.dataset.category;

    document.querySelectorAll("[data-category]").forEach(item => {
      item.classList.toggle("selected", item === botao);
    });

    $("tituloCadastro").textContent =
      "Cadastrar " + ({
        ANEL: "anel",
        IMPULSOR: "impulsor",
        FACA: "faca"
      })[categoriaAtual];

    $("mensagemFerramental").textContent = "";
  });
});

$("formFerramental")?.addEventListener("submit", evento => {
  evento.preventDefault();

  const medida = numero($("medidaFerramental").value);
  const identificacao = $("nomeFerramental").value.trim();

  if (!Number.isFinite(medida) || medida <= 0) {
    $("mensagemFerramental").textContent =
      "Informe uma medida válida e maior que zero.";
    return;
  }

  const pecas = lerLista(CHAVES.pecas);

  const duplicada = pecas.some(peca => {
    const p = normalizarPeca(peca);

    return p.categoria === categoriaAtual &&
      Math.abs(p.medida - medida) < 0.0001 &&
      p.identificacao === identificacao;
  });

  if (duplicada) {
    $("mensagemFerramental").textContent =
      "Essa peça com a mesma identificação já está cadastrada.";
    return;
  }

  pecas.push({
    id: novoId(),
    categoria: categoriaAtual,
    medida,
    identificacao,
    indisponivel: false,
    criadoEm: new Date().toISOString()
  });

  salvarLista(CHAVES.pecas, pecas);
  $("formFerramental").reset();

  $("mensagemFerramental").textContent =
    "Ferramental cadastrado com sucesso.";

  atualizarFerramentais();
  atualizarDisponibilidade();
});

$("filtroCategoria")?.addEventListener("change", atualizarFerramentais);
$("buscaFerramental")?.addEventListener("input", atualizarFerramentais);

function atualizarFerramentais() {
  const area = $("listaFerramentais");
  if (!area) return;

  const filtro = $("filtroCategoria").value;
  const busca = $("buscaFerramental").value.trim().toLowerCase();

  const pecas = obterPecas(filtro)
    .filter(p =>
      `${p.medida} ${p.identificacao} ${p.categoria}`
        .toLowerCase().includes(busca)
    )
    .sort((a, b) =>
      a.categoria.localeCompare(b.categoria) || a.medida - b.medida
    );

  if (!pecas.length) {
    area.innerHTML = '<p class="empty">Nenhum ferramental encontrado.</p>';
    return;
  }

  area.innerHTML = pecas.map(p => `
    <article class="record-item">
      <strong>${escapar(nomeCategoria(p.categoria))} · ${formatar(p.medida)} cm</strong>
      <div class="record-meta">${escapar(p.identificacao || "Sem identificação")}</div>
      <div class="record-actions">
        <button class="small-btn danger" data-excluir-peca="${escapar(p.id)}">
          Excluir
        </button>
      </div>
    </article>
  `).join("");

  area.querySelectorAll("[data-excluir-peca]").forEach(botao => {
    botao.addEventListener("click", () => {
      if (!confirm("Deseja excluir este ferramental?")) return;

      const id = botao.dataset.excluirPeca;

      salvarLista(
        CHAVES.pecas,
        lerLista(CHAVES.pecas).filter(p => String(p.id) !== String(id))
      );

      atualizarFerramentais();
      atualizarDisponibilidade();
    });
  });
}

/* =========================================
   CÁLCULO DO CANTO
========================================= */

/*
  Canto = medida do anel escolhido + metade da folga.

  Exceção:
  Se a folga for 0,05 cm, acrescentar mais 0,05 cm.

  Anel 10,00 + folga 0,05 = canto 10,075 cm.
*/

function calcularCanto(medidaAnel, folga) {
  if (!Number.isFinite(medidaAnel) || medidaAnel <= 0) return null;
  if (!Number.isFinite(folga) || folga < 0) return null;

  let canto = medidaAnel + folga / 2;

  if (Math.abs(folga - 0.05) < 0.000001) {
    canto += 0.05;
  }

  return Math.round(canto * 10000) / 10000;
}

function atualizarRotuloCanto() {
  const campo = $("canto");
  if (!campo) return;

  const rotulo = document.querySelector('label[for="canto"]');

  if (rotulo) {
    rotulo.textContent = "Medida do anel para cálculo do canto (cm)";
  }

  campo.placeholder = "Ex.: 10,00";
  campo.min = "0";
  campo.step = "any";
}

/* =========================================
   LER E VALIDAR MONTAGEM
========================================= */

function lerMontagem() {
  const cliente = $("cliente").value.trim();
  const largura = numero($("largura").value);
  const espessura = numero($("espessura").value);

  const qtdFacas = Number(
    document.querySelector('input[name="qtdFacas"]:checked')?.value || 1
  );

  const folga = obterFolga(espessura, $("folgaManual").value);

  if (!cliente) throw new Error("Informe o cliente ou a etapa.");

  if (!Number.isFinite(largura) || largura <= 0) {
    throw new Error("Informe uma largura válida.");
  }

  if (!Number.isFinite(espessura) || espessura <= 0) {
    throw new Error("Informe uma espessura válida.");
  }

  if (folga === null) {
    throw new Error("Não há folga definida para essa espessura. Confira a tabela.");
  }

  if (!$("cabecote").value) {
    throw new Error("Selecione o cabeçote.");
  }

  if (!$("facaSuperior").value.trim()) {
    throw new Error("Informe a primeira faca.");
  }

  const medidaAnel = numero($("canto").value);

  if (!Number.isFinite(medidaAnel) || medidaAnel <= 0) {
    throw new Error("Informe a medida válida do anel que será utilizado.");
  }

  const cantoCalculado = calcularCanto(medidaAnel, folga);

  if (cantoCalculado === null) {
    throw new Error("Não foi possível calcular o canto.");
  }

  return {
    id: novoId(),
    data: new Date().toISOString(),
    cliente,
    largura,
    espessura,
    folga,
    tipoPedido: $("tipoPedido").value,
    cabecote: $("cabecote").value,
    qtdFacas,
    facaSuperior: $("facaSuperior").value.trim(),
    facaInferior: qtdFacas === 2 ? $("facaInferior").value.trim() : "",
    medidaAnel,
    canto: cantoCalculado,
    cantoCalculado,
    observacoes: $("observacoes").value.trim()
  };
}

$("formMontagem")?.addEventListener("submit", evento => {
  evento.preventDefault();

  try {
    montagemAtual = lerMontagem();

    indisponiveisBusca.clear();
    gruposImpulsores = [];
    reducaoAtual = null;
    combinacaoImpulsorAutomatica = null;

    $("mensagemMontagem").textContent = "";
    $("mensagemResultado").textContent = "";
    $("buscaIndisponivel").value = "";
    $("filtroIndisponivel").value = "TODOS";
    $("aneisEscolhidos").value = "";
    $("impulsoresEscolhidos").value = "";
    $("reducaoEscolhida").value = "";
    $("observacaoResultado").value = "";

    abrirPagina("resultados");
    mostrarResumo();
    atualizarDisponibilidade();
    gerarCombinacoes();
  } catch (erro) {
    $("mensagemMontagem").textContent = erro.message;
  }
});

/* =========================================
   RESUMO
========================================= */

function mostrarResumo() {
  const m = montagemAtual;
  if (!m) return;

  const dados = [
    ["Cliente / etapa", m.cliente],
    ["Largura solicitada", formatar(m.largura) + " cm"],
    ["Espessura", formatar(m.espessura) + " cm"],
    ["Folga calculada", formatar(m.folga) + " cm"],
    ["Tipo de pedido", m.tipoPedido],
    ["Cabeçote", m.cabecote],
    ["Primeira faca", m.facaSuperior],
    [
      "Segunda faca",
      m.qtdFacas === 2 ? (m.facaInferior || "Não informada") : "Não utilizada"
    ],
    ["Medida do anel utilizado", formatar(m.medidaAnel) + " cm"],
    ["Canto calculado", formatar(m.cantoCalculado) + " cm"]
  ];

  $("resultadoResumo").innerHTML = dados.map(([titulo, valor]) => `
    <div class="summary-cell">
      <small>${escapar(titulo)}</small>
      <strong>${escapar(valor)}</strong>
    </div>
  `).join("") + (
    m.observacoes ? `<p>${escapar(m.observacoes)}</p>` : ""
  );
}

/* =========================================
   DISPONIBILIDADE TEMPORÁRIA
========================================= */

function atualizarDisponibilidade() {
  const area = $("listaDisponibilidade");
  if (!area) return;

  const categoria = $("filtroIndisponivel").value;
  const busca = $("buscaIndisponivel").value.trim().toLowerCase();

  const pecas = obterPecas(categoria).filter(p =>
    `${p.categoria} ${p.medida} ${p.identificacao}`
      .toLowerCase().includes(busca)
  );

  if (!pecas.length) {
    area.innerHTML = '<p class="empty">Nenhuma peça cadastrada para esta pesquisa.</p>';
    return;
  }

  area.innerHTML = pecas.map(p => {
    const marcada =
      p.indisponivel || indisponiveisBusca.has(String(p.id));

    return `
      <label class="availability-item">
        <input type="checkbox" data-indisponivel="${escapar(p.id)}"
          ${marcada ? "checked" : ""}>
        <span>
          <strong>${escapar(nomeCategoria(p.categoria))} · ${formatar(p.medida)} cm</strong>
          <small>${escapar(p.identificacao || "Sem identificação")} ·
            ${marcada ? "Indisponível" : "Disponível"}</small>
        </span>
      </label>
    `;
  }).join("");

  area.querySelectorAll("[data-indisponivel]").forEach(campo => {
    campo.addEventListener("change", () => {
      const id = String(campo.dataset.indisponivel);

      if (campo.checked) indisponiveisBusca.add(id);
      else indisponiveisBusca.delete(id);

      const descricao = campo.closest(".availability-item").querySelector("small");
      const peca = obterPecas("TODOS").find(p => String(p.id) === id);

      descricao.textContent =
        `${peca?.identificacao || "Sem identificação"} · ` +
        `${campo.checked ? "Indisponível" : "Disponível"}`;
    });
  });
}

$("buscaIndisponivel")?.addEventListener("input", atualizarDisponibilidade);
$("filtroIndisponivel")?.addEventListener("change", atualizarDisponibilidade);

/* =========================================
   MOTOR DE COMBINAÇÕES
========================================= */

function contarMedidasDiferentes(pecas) {
  return new Set(pecas.map(p => Math.round(p.medida * 10000))).size;
}

function compararCombinacoes(a, b) {
  const diferencaMedidas =
    contarMedidasDiferentes(a.pecas) - contarMedidasDiferentes(b.pecas);

  if (diferencaMedidas !== 0) return diferencaMedidas;
  if (a.quantidade !== b.quantidade) return a.quantidade - b.quantidade;

  return Math.abs(a.soma - a.alvo) - Math.abs(b.soma - b.alvo);
}

function encontrarCombinacoes(categoria, alvo, limite = 8, maxPecas = 8) {
  if (!Number.isFinite(alvo) || alvo <= 0) return [];

  const pecas = pecasDisponiveis(categoria)
    .filter(p => p.medida > 0)
    .sort((a, b) => a.medida - b.medida);

  const resultados = [];
  const selecionadas = [];
  let visitas = 0;

  const maxVisitas = 250000;
  const alvoInteiro = Math.round(alvo * 10000);

  const medidas = pecas.map(peca => ({
    peca,
    valor: Math.round(peca.medida * 10000)
  }));

  function buscar(inicio, somaInteira) {
    visitas++;
    if (visitas > maxVisitas) return;

    if (selecionadas.length > 0 && somaInteira === alvoInteiro) {
      const lista = [...selecionadas];

      resultados.push({
        pecas: lista,
        soma: lista.reduce((total, p) => total + p.medida, 0),
        quantidade: lista.length,
        alvo
      });

      return;
    }

    if (somaInteira >= alvoInteiro || selecionadas.length >= maxPecas) {
      return;
    }

    for (let i = inicio; i < medidas.length; i++) {
      if (visitas > maxVisitas) return;

      const item = medidas[i];
      if (somaInteira + item.valor > alvoInteiro) continue;

      selecionadas.push(item.peca);
      buscar(i + 1, somaInteira + item.valor);
      selecionadas.pop();
    }
  }

  buscar(0, 0);

  const unicas = new Map();

  resultados.forEach(opcao => {
    const chave = opcao.pecas.map(p => String(p.id)).sort().join("|");
    if (!unicas.has(chave)) unicas.set(chave, opcao);
  });

  return [...unicas.values()].sort(compararCombinacoes).slice(0, limite);
}

function textoCombinacao(opcao) {
  return opcao.pecas.map(p =>
    `${formatar(p.medida)} cm` +
    (p.identificacao ? ` (${p.identificacao})` : "")
  ).join(" + ");
}

function esconderEscolhaManualDeReducao() {
  const campo = $("reducaoEscolhida");
  if (!campo) return;

  const envoltorio = campo.closest(".field");

  if (envoltorio) {
    envoltorio.hidden = true;
  } else {
    campo.hidden = true;
  }
}

$("recalcular")?.addEventListener("click", gerarCombinacoes);

/* =========================================
   ESCOLHA AUTOMÁTICA DOS IMPULSORES
========================================= */

function escolherMelhorImpulsor() {
  const candidatos = [];

  gruposImpulsores.forEach(grupo => {
    grupo.opcoes.forEach(opcao => {
      candidatos.push({
        grupo,
        opcao,
        pecas: opcao.pecas,
        quantidade: opcao.quantidade,
        soma: opcao.soma,
        alvo: grupo.alvo,
        reducao: grupo.reducao
      });
    });
  });

  candidatos.sort((a, b) => {
    const prioridade = compararCombinacoes(a, b);
    if (prioridade !== 0) return prioridade;
    return a.reducao - b.reducao;
  });

  if (!candidatos.length) {
    combinacaoImpulsorAutomatica = null;
    reducaoAtual = null;
    $("reducaoEscolhida").value = "";
    $("impulsoresEscolhidos").value = "";
    return null;
  }

  combinacaoImpulsorAutomatica = candidatos[0];
  reducaoAtual = candidatos[0].reducao;

  $("reducaoEscolhida").value = String(reducaoAtual);
  $("impulsoresEscolhidos").value =
    textoCombinacao(combinacaoImpulsorAutomatica.opcao);

  return combinacaoImpulsorAutomatica;
}

/* =========================================
   GERAR RESULTADOS
========================================= */

function gerarCombinacoes() {
  if (!montagemAtual) return;

  esconderEscolhaManualDeReducao();

  const aneis = pecasDisponiveis("ANEL");

  $("opcoesAneis").innerHTML = `
    <div class="notice warning">
      <strong>Medida-alvo dos anéis pendente.</strong>
      A regra de produção da medida-alvo ainda precisa ser confirmada.
      Não será presumida uma combinação incorreta.
    </div>
    <p class="muted">Anéis cadastrados e disponíveis: ${aneis.length}</p>
  `;

  gruposImpulsores = [0.10, 0.15, 0.20].map(reducao => {
    const alvo = Math.round(
      (montagemAtual.largura - reducao) * 10000
    ) / 10000;

    return {
      reducao,
      alvo,
      opcoes: alvo > 0
        ? encontrarCombinacoes("IMPULSOR", alvo, 30, 8)
        : []
    };
  });

  escolherMelhorImpulsor();
  mostrarCombinacoesImpulsores();
  atualizarMetricas();
}

function mostrarCombinacoesImpulsores() {
  const area = $("opcoesImpulsores");
  const disponiveis = pecasDisponiveis("IMPULSOR");

  if (!disponiveis.length) {
    area.innerHTML = '<p class="empty">Nenhum impulsor disponível no cadastro.</p>';
    return;
  }

  const melhor = combinacaoImpulsorAutomatica;

  if (!melhor) {
    area.innerHTML = `
      <div class="notice warning">
        <strong>Nenhuma combinação exata encontrada.</strong>
        O sistema testou largura − 0,10 cm, largura − 0,15 cm
        e largura − 0,20 cm. Confira o cadastro e a disponibilidade.
      </div>
    `;
    return;
  }

  let html = `
    <div class="notice">
      <strong>Melhor combinação selecionada automaticamente</strong>
      <p>${escapar(textoCombinacao(melhor.opcao))}</p>
      <p>
        Alvo: ${formatar(melhor.alvo)} cm ·
        ${melhor.quantidade} peça(s) ·
        ${contarMedidasDiferentes(melhor.pecas)} medida(s) diferente(s)
      </p>
    </div>
    <h3>Outras combinações encontradas</h3>
  `;

  gruposImpulsores.forEach(grupo => {
    html += `
      <div class="option-card">
        <div class="option-title">
          <strong>Alvo ${formatar(grupo.alvo)} cm</strong>
          <span class="badge">Redução ${formatar(grupo.reducao)} cm</span>
        </div>
    `;

    if (!grupo.opcoes.length) {
      html += "<p>Nenhuma soma exata encontrada para este alvo.</p>";
    } else {
      html += grupo.opcoes.map(opcao => {
        const selecionada =
          grupo.reducao === melhor.reducao &&
          opcao.pecas.map(p => String(p.id)).sort().join("|") ===
          melhor.opcao.pecas.map(p => String(p.id)).sort().join("|");

        return `
          <div class="option-pieces">
            ${selecionada ? "<strong>✓ Selecionada automaticamente:</strong> " : ""}
            ${escapar(textoCombinacao(opcao))}
            <p>
              Soma: ${formatar(opcao.soma)} cm ·
              ${opcao.quantidade} peça(s) ·
              ${contarMedidasDiferentes(opcao.pecas)} medida(s) diferente(s)
            </p>
          </div>
        `;
      }).join("");
    }

    html += "</div>";
  });

  area.innerHTML = html;
}

/* =========================================
   MÉTRICAS E CÁLCULOS
========================================= */

function obterMedidaNumericaFaca(valor) {
  const medida = numero(valor);
  return Number.isFinite(medida) && medida > 0 ? medida : null;
}

function atualizarMetricas() {
  if (!montagemAtual) return;

  const m = montagemAtual;

  const alvoImpulsor = Number.isFinite(reducaoAtual)
    ? Math.round((m.largura - reducaoAtual) * 10000) / 10000
    : null;

  const medidaFaca = obterMedidaNumericaFaca(m.facaSuperior);

  const contraCorte = medidaFaca === null
    ? null
    : Math.round(
        (m.largura - (2 * medidaFaca) - m.folga) * 10000
      ) / 10000;

  $("metricasResultado").innerHTML = `
    <div class="metric">
      <small>Largura solicitada</small>
      <strong>${formatar(m.largura)} cm</strong>
    </div>

    <div class="metric">
      <small>Folga calculada</small>
      <strong>${formatar(m.folga)} cm</strong>
    </div>

    <div class="metric">
      <small>Alvo do impulsor</small>
      <strong>${alvoImpulsor === null
        ? "Não encontrado"
        : formatar(alvoImpulsor) + " cm"}</strong>
      <div class="metric-note">Definido automaticamente pelo sistema.</div>
    </div>

    <div class="metric">
      <small>Contra-corte</small>
      <strong>${contraCorte === null
        ? "Pendente"
        : formatar(contraCorte) + " cm"}</strong>
      <div class="metric-note">
        ${contraCorte === null
          ? "Informe a medida numérica da primeira faca para calcular."
          : "Largura − (2 × faca) − folga."}
      </div>
    </div>

    <div class="metric">
      <small>Medida do anel</small>
      <strong>${formatar(m.medidaAnel)} cm</strong>
    </div>

    <div class="metric">
      <small>Canto calculado</small>
      <strong>${formatar(m.cantoCalculado)} cm</strong>
      <div class="metric-note">
        Anel + metade da folga; com folga de 0,05 cm,
        acrescenta-se mais 0,05 cm.
      </div>
    </div>
  `;

  $("alertaCalculos").textContent =
    "O canto foi calculado usando a medida do anel informada. " +
    "A combinação dos anéis continua pendente até a confirmação " +
    "da medida-alvo de produção. Os impulsores são selecionados automaticamente.";
}

/* =========================================
   VOLTAR E SALVAR
========================================= */

$("voltarEdicao")?.addEventListener("click", () => {
  abrirPagina("inicio");
  $("formSection")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

$("confirmarMontagem")?.addEventListener("click", () => {
  if (!montagemAtual) {
    $("mensagemResultado").textContent = "Não há montagem para salvar.";
    return;
  }

  const aneis = $("aneisEscolhidos").value.trim();
  const impulsores = $("impulsoresEscolhidos").value.trim();

  if (!aneis || !impulsores) {
    $("mensagemResultado").textContent =
      "Informe os anéis utilizados. Se não usou algum, escreva Nenhum.";
    return;
  }

  const registro = {
    ...montagemAtual,
    aneisEscolhidos: aneis,
    impulsoresEscolhidos: impulsores,
    reducaoImpulsores: reducaoAtual,
    observacaoResultado: $("observacaoResultado").value.trim(),
    status: "Salva"
  };

  const historico = lerLista(CHAVES.montagens);
  historico.unshift(registro);
  salvarLista(CHAVES.montagens, historico);

  montagemAtual = null;

  atualizarHistorico();
  atualizarUltimasMontagens();
  abrirPagina("historico");
});

/* =========================================
   HISTÓRICO
========================================= */

function dataLegivel(data) {
  if (!data) return "Data não informada";

  const dataObj = new Date(data);

  return Number.isNaN(dataObj.getTime())
    ? String(data)
    : dataObj.toLocaleString("pt-BR");
}

function atualizarHistorico() {
  const area = $("listaHistorico");
  if (!area) return;

  const busca = $("buscaHistorico").value.trim().toLowerCase();

  const registros = lerLista(CHAVES.montagens).filter(registro =>
    JSON.stringify(registro).toLowerCase().includes(busca)
  );

  if (!registros.length) {
    area.innerHTML = '<p class="empty">Nenhuma montagem encontrada.</p>';
    return;
  }

  area.innerHTML = registros.map(registro => {
    const medidaAnel = registro.medidaAnel;
    const cantoCalculado = registro.cantoCalculado ?? registro.canto;

    return `
      <article class="record-item">
        <strong>${escapar(registro.cliente || "Montagem")}</strong>
        <div class="record-meta">${escapar(dataLegivel(registro.data))}</div>
        <div class="record-meta">
          Largura: ${escapar(registro.largura)} cm ·
          Espessura: ${escapar(registro.espessura)} cm ·
          Folga: ${escapar(registro.folga)} cm
        </div>
        <div class="record-meta">Cabeçote: ${escapar(registro.cabecote || "—")}</div>

        ${medidaAnel !== undefined
          ? `<div class="record-meta">Medida do anel: ${escapar(medidaAnel)} cm</div>`
          : ""}

        <div class="record-meta">
          Canto calculado: ${escapar(cantoCalculado ?? "—")} cm
        </div>
        <div class="record-meta">
          Anéis: ${escapar(registro.aneisEscolhidos || registro.aneis || "—")}
        </div>
        <div class="record-meta">
          Impulsores: ${escapar(registro.impulsoresEscolhidos || registro.impulsores || "—")}
        </div>
        <div class="record-meta">
          Facas: ${escapar(registro.facaSuperior || "—")}
          ${registro.facaInferior
            ? " / segunda: " + escapar(registro.facaInferior)
            : ""}
        </div>

        ${registro.observacoes
          ? `<div class="record-meta">Observações: ${escapar(registro.observacoes)}</div>`
          : ""}

        ${registro.observacaoResultado
          ? `<div class="record-meta">Escolha: ${escapar(registro.observacaoResultado)}</div>`
          : ""}

        <div class="record-actions">
          <button class="small-btn danger"
            data-excluir-registro="${escapar(registro.id)}">
            Excluir registro
          </button>
        </div>
      </article>
    `;
  }).join("");

  area.querySelectorAll("[data-excluir-registro]").forEach(botao => {
    botao.addEventListener("click", () => {
      if (!confirm("Deseja excluir esta montagem do histórico?")) return;

      const id = botao.dataset.excluirRegistro;

      salvarLista(
        CHAVES.montagens,
        lerLista(CHAVES.montagens).filter(r => String(r.id) !== String(id))
      );

      atualizarHistorico();
      atualizarUltimasMontagens();
    });
  });
}

$("buscaHistorico")?.addEventListener("input", atualizarHistorico);

function atualizarUltimasMontagens() {
  const area = $("ultimasMontagens");
  if (!area) return;

  const registros = lerLista(CHAVES.montagens).slice(0, 5);

  if (!registros.length) {
    area.innerHTML = '<p class="empty">Nenhuma montagem registrada ainda.</p>';
    return;
  }

  area.innerHTML = registros.map(registro => `
    <article class="record-item">
      <strong>${escapar(registro.cliente || "Montagem")}</strong>
      <div class="record-meta">${escapar(dataLegivel(registro.data))}</div>
      <div class="record-meta">
        ${escapar(registro.largura)} cm ·
        ${escapar(registro.cabecote || "Cabeçote não informado")}
      </div>
      <div class="record-meta">
        Canto: ${escapar(
          registro.cantoCalculado ?? registro.canto ?? "—"
        )} cm
      </div>
    </article>
  `).join("");
}

/* =========================================
   BACKUP JSON
========================================= */

$("exportarDados")?.addEventListener("click", () => {
  const backup = {
    exportadoEm: new Date().toISOString(),
    montagens: lerLista(CHAVES.montagens),
    pecas: lerLista(CHAVES.pecas),
    tema: localStorage.getItem(CHAVES.tema) || "escuro"
  };

  const arquivo = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");

  link.href = url;
  link.download = "backup-armco-montagem.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  $("mensagemConfiguracoes").textContent =
    "Backup exportado. Guarde o arquivo em local seguro.";
});

/* =========================================
   INICIALIZAÇÃO
========================================= */

function iniciarSistema() {
  if (!localStorage.getItem(CHAVES.montagens)) {
    salvarLista(CHAVES.montagens, []);
  }

  if (!localStorage.getItem(CHAVES.pecas)) {
    salvarLista(CHAVES.pecas, []);
  }

  aplicarTema();
  atualizarRotuloCanto();
  atualizarCampoSegundaFaca();
  esconderEscolhaManualDeReducao();
  atualizarHistorico();
  atualizarUltimasMontagens();
  atualizarFerramentais();
}

iniciarSistema();
