
const CHAVE_MONTAGENS = "armco_montagens_v1";
const CHAVE_PECAS = "armco_pecas_v1";

let categoriaPecaAtual = "ANEL";

function lerDados(chave) {
    try {
        const dados = JSON.parse(localStorage.getItem(chave) || "[]");
        return Array.isArray(dados) ? dados : [];
    } catch {
        return [];
    }
}

function salvarDados(chave, dados) {
    try {
        localStorage.setItem(chave, JSON.stringify(dados));
        return true;
    } catch {
        return false;
    }
}

function gerarId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
}

function numeroValido(texto) {
    const normalizado = String(texto).trim().replace(",", ".");
    if (!normalizado || !/^\d+(\.\d+)?$/.test(normalizado)) {
        return null;
    }

    const numero = Number(normalizado);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function formatarNumero(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        maximumFractionDigits: 4
    });
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function dataAtual() {
    return new Date().toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

/* MENU E NAVEGAÇÃO */

function alternarMenu() {
    const sidebar = document.getElementById("sidebar");
    const fundo = document.getElementById("fundoMenu");

    const aberto = sidebar.classList.toggle("aberto");
    fundo.classList.toggle("visivel", aberto);
}

function fecharMenu() {
    document.getElementById("sidebar").classList.remove("aberto");
    document.getElementById("fundoMenu").classList.remove("visivel");
}

function irPara(pagina) {
    document.querySelectorAll(".pagina").forEach(secao => {
        secao.classList.remove("ativa");
    });

    const destino = document.getElementById(`pagina-${pagina}`);
    if (!destino) return;

    destino.classList.add("ativa");

    document.querySelectorAll(".nav-item").forEach(botao => {
        botao.classList.toggle(
            "ativo",
            botao.dataset.pagina === pagina
        );
    });

    fecharMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pagina === "historico") renderizarHistorico();
    if (pagina === "pecas") renderizarPecas();
    if (pagina === "configuracoes") atualizarResumoDados();
}

function focarFormulario() {
    irPara("inicio");

    setTimeout(() => {
        document.getElementById("formularioMontagem").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        document.getElementById("cliente").focus({
            preventScroll: true
        });
    }, 100);
}

/* QUANTIDADE DE FACAS */

document.querySelectorAll('input[name="quantidadeFacas"]').forEach(radio => {
    radio.addEventListener("change", atualizarCamposFacas);
});

function atualizarCamposFacas() {
    const quantidade = document.querySelector(
        'input[name="quantidadeFacas"]:checked'
    ).value;

    const campoInferior = document.getElementById("campoFacaInferior");
    const facaInferior = document.getElementById("facaInferior");

    campoInferior.hidden = quantidade !== "2";
    facaInferior.required = quantidade === "2";

    if (quantidade !== "2") {
        facaInferior.value = "";
    }
}

/* REGISTRO DE MONTAGENS */

document.getElementById("formMontagem").addEventListener("submit", evento => {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    const mensagem = document.getElementById("mensagemMontagem");

    const cliente = document.getElementById("cliente").value.trim();
    const largura = numeroValido(document.getElementById("largura").value);
    const espessuraTexto = document.getElementById("espessura").value.trim();
    const quantidade = document.querySelector(
        'input[name="quantidadeFacas"]:checked'
    ).value;
    const facaSuperior = document.getElementById("facaSuperior").value.trim();
    const facaInferior = document.getElementById("facaInferior").value.trim();

    mensagem.className = "mensagem";

    if (!cliente || !largura || !espessuraTexto || !facaSuperior) {
        mensagem.textContent = "Confira os campos obrigatórios e a largura.";
        mensagem.classList.add("erro");
        return;
    }

    if (quantidade === "2" && !facaInferior) {
        mensagem.textContent = "Informe a faca inferior para a montagem com duas facas.";
        mensagem.classList.add("erro");
        return;
    }

    const montagens = lerDados(CHAVE_MONTAGENS);

    montagens.unshift({
        id: gerarId(),
        cliente,
        tipoPedido: document.getElementById("tipoPedido").value,
        largura,
        espessura: espessuraTexto,
        quantidadeFacas: quantidade,
        facaSuperior,
        facaInferior: quantidade === "2" ? facaInferior : "",
        observacoes: document.getElementById("observacoes").value.trim(),
        data: dataAtual(),
        criadoEm: new Date().toISOString()
    });

    if (!salvarDados(CHAVE_MONTAGENS, montagens)) {
        mensagem.textContent = "Não foi possível salvar. Verifique o armazenamento do navegador.";
        mensagem.classList.add("erro");
        return;
    }

    formulario.reset();
    atualizarCamposFacas();

    mensagem.textContent = "Montagem registrada com sucesso!";
    mensagem.classList.add("sucesso");

    renderizarUltimasMontagens();
});

/* HISTÓRICO */

function montarCartaoMontagem(montagem, permitirExcluir = false) {
    const facas = montagem.quantidadeFacas === "2"
        ? `2 facas: superior ${escaparHTML(montagem.facaSuperior)} / inferior ${escaparHTML(montagem.facaInferior)}`
        : `1 faca: ${escaparHTML(montagem.facaSuperior)}`;

    return `
        <article class="registro">
            <div class="registro-conteudo">
                <strong>${escaparHTML(montagem.cliente)}</strong>
                <small>${escaparHTML(montagem.tipoPedido)} · ${formatarNumero(montagem.largura)} cm · Espessura: ${escaparHTML(montagem.espessura)}</small>
                <small>${facas}</small>
                <small>${escaparHTML(montagem.data)}</small>
                ${montagem.observacoes ? `<small>Obs.: ${escaparHTML(montagem.observacoes)}</small>` : ""}
            </div>
            ${permitirExcluir ? `
                <div class="registro-acoes">
                    <button class="botao-excluir" onclick="excluirMontagem('${montagem.id}')">
                        Excluir
                    </button>
                </div>
            ` : ""}
        </article>
    `;
}

function renderizarUltimasMontagens() {
    const elemento = document.getElementById("ultimasMontagens");
    const montagens = lerDados(CHAVE_MONTAGENS).slice(0, 5);

    elemento.innerHTML = montagens.length
        ? montagens.map(item => montarCartaoMontagem(item)).join("")
        : '<p class="vazio">Nenhuma montagem registrada ainda.</p>';
}

function renderizarHistorico() {
    const elemento = document.getElementById("listaHistorico");
    const busca = document.getElementById("buscaHistorico").value
        .trim().toLocaleLowerCase("pt-BR");

    const montagens = lerDados(CHAVE_MONTAGENS).filter(item => {
        const texto = [
            item.cliente,
            item.tipoPedido,
            item.largura,
            item.espessura,
            item.facaSuperior,
            item.facaInferior,
            item.observacoes
        ].join(" ").toLocaleLowerCase("pt-BR");

        return texto.includes(busca);
    });

    elemento.innerHTML = montagens.length
        ? montagens.map(item => montarCartaoMontagem(item, true)).join("")
        : '<p class="vazio">Nenhuma montagem encontrada.</p>';
}

function excluirMontagem(id) {
    if (!confirm("Deseja realmente excluir este registro de montagem?")) {
        return;
    }

    const montagens = lerDados(CHAVE_MONTAGENS).filter(item => item.id !== id);

    if (!salvarDados(CHAVE_MONTAGENS, montagens)) {
        alert("Não foi possível atualizar os registros.");
        return;
    }

    renderizarHistorico();
    renderizarUltimasMontagens();
}

/* CADASTRO DE PEÇAS */

function selecionarPeca(categoria, botao) {
    categoriaPecaAtual = categoria;
    document.getElementById("tipoPeca").value = categoria;

    document.querySelectorAll(".cartao-peca").forEach(cartao => {
        cartao.classList.remove("selecionado");
    });

    botao.classList.add("selecionado");

    const nomes = {
        ANEL: "Anéis",
        IMPULSOR: "Impulsores",
        FACA: "Facas"
    };

    document.getElementById("tituloPeca").textContent =
        `Cadastro de ${nomes[categoria]}`;

    document.getElementById("mensagemPeca").textContent = "";
    renderizarPecas();
}

document.getElementById("formPeca").addEventListener("submit", evento => {
    evento.preventDefault();

    const nome = document.getElementById("nomePeca").value.trim();
    const medida = numeroValido(document.getElementById("medidaPeca").value);
    const mensagem = document.getElementById("mensagemPeca");

    mensagem.className = "mensagem";

    if (!nome || !medida) {
        mensagem.textContent = "Informe a identificação e uma medida válida em cm.";
        mensagem.classList.add("erro");
        return;
    }

    const pecas = lerDados(CHAVE_PECAS);

    pecas.push({
        id: gerarId(),
        categoria: categoriaPecaAtual,
        nome,
        medida,
        data: dataAtual()
    });

    if (!salvarDados(CHAVE_PECAS, pecas)) {
        mensagem.textContent = "Não foi possível salvar esta peça.";
        mensagem.classList.add("erro");
        return;
    }

    document.getElementById("nomePeca").value = "";
    document.getElementById("medidaPeca").value = "";

    mensagem.textContent = "Peça cadastrada com sucesso!";
    mensagem.classList.add("sucesso");

    renderizarPecas();
});

function renderizarPecas() {
    const elemento = document.getElementById("listaPecas");
    const pecas = lerDados(CHAVE_PECAS).filter(
        peca => peca.categoria === categoriaPecaAtual
    );

    elemento.innerHTML = pecas.length
        ? pecas.map(peca => `
            <article class="registro">
                <div class="registro-conteudo">
                    <strong>${escaparHTML(peca.nome)}</strong>
                    <small>${formatarNumero(peca.medida)} cm · Cadastrada em ${escaparHTML(peca.data)}</small>
                </div>
                <div class="registro-acoes">
                    <button class="botao-excluir" onclick="excluirPeca('${peca.id}')">
                        Excluir
                    </button>
                </div>
            </article>
        `).join("")
        : '<p class="vazio">Nenhuma peça cadastrada nesta categoria.</p>';
}

function excluirPeca(id) {
    if (!confirm("Deseja realmente excluir esta peça?")) return;

    const pecas = lerDados(CHAVE_PECAS).filter(peca => peca.id !== id);

    if (!salvarDados(CHAVE_PECAS, pecas)) {
        alert("Não foi possível atualizar o cadastro.");
        return;
    }

    renderizarPecas();
}

/* CONFIGURAÇÕES */

function atualizarResumoDados() {
    const montagens = lerDados(CHAVE_MONTAGENS);
    const pecas = lerDados(CHAVE_PECAS);

    document.getElementById("resumoDados").textContent =
        `${montagens.length} montagem(ns) e ${pecas.length} peça(s) cadastrada(s).`;
}

/* INICIALIZAÇÃO */

document.getElementById("buscaHistorico").addEventListener("input", renderizarHistorico);

atualizarCamposFacas();
renderizarUltimasMontagens();
renderizarHistorico();
renderizarPecas();
atualizarResumoDados();

/* TEMA CLARO E ESCURO */

function alterarTema(tema) {
    const escuro = tema === "escuro";

    document.body.classList.toggle("tema-escuro", escuro);

    try {
        localStorage.setItem("armco_tema", escuro ? "escuro" : "claro");
    } catch (erro) {
        console.warn("Não foi possível salvar a preferência de tema.");
    }

    atualizarBotoesTema();
}

function atualizarBotoesTema() {
    const escuro = document.body.classList.contains("tema-escuro");

    const claro = document.getElementById("temaClaro");
    const dark = document.getElementById("temaEscuro");

    if (claro) {
        claro.classList.toggle("selecionado", !escuro);
        claro.setAttribute("aria-pressed", String(!escuro));
    }

    if (dark) {
        dark.classList.toggle("selecionado", escuro);
        dark.setAttribute("aria-pressed", String(escuro));
    }
}

function carregarTema() {
    let tema = "claro";

    try {
        tema = localStorage.getItem("armco_tema") || "claro";
    } catch (erro) {
        console.warn("Não foi possível recuperar a preferência de tema.");
    }

    document.body.classList.toggle("tema-escuro", tema === "escuro");
    atualizarBotoesTema();
}

carregarTema();
