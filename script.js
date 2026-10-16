/* ARMCO MONTAGEM LC25 — cálculos e consulta de ferramentais
   Dados anteriores preservados nas mesmas chaves do localStorage. */
'use strict';

const CHAVES = {
  montagens: 'armco_montagens_v1',
  pecas: 'armco_pecas_v1',
  tema: 'armco_tema'
};
// Protege a inicialização em alguns visualizadores e prévias de arquivos no celular.
// Quando o navegador bloqueia localStorage, as funções continuam disponíveis,
// mas os dados ficam só nesta sessão e o operador é avisado visivelmente.
let armazenamentoPersistente = true;
const armazenamento = (() => {
  try {
    const store = window.localStorage;
    const chaveTeste = '__armco_teste_armazenamento__';
    store.setItem(chaveTeste, '1');
    store.removeItem(chaveTeste);
    return store;
  } catch (erro) {
    armazenamentoPersistente = false;
    const memoria = new Map();
    return {
      getItem: chave => memoria.has(String(chave)) ? memoria.get(String(chave)) : null,
      setItem: (chave, valor) => memoria.set(String(chave), String(valor)),
      removeItem: chave => memoria.delete(String(chave))
    };
  }
})();
const $ = id => document.getElementById(id);
const arred = n => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
const inteiro = n => Math.round(Number(n) * 10000);
const igualdade = (a, b) => Math.abs(Number(a) - Number(b)) < 0.000001;
const numero = valor => {
  if (typeof valor === 'number') return valor;
  const texto = String(valor ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return texto ? Number(texto) : NaN;
};
const formatar = (valor, casas = 4) => Number.isFinite(Number(valor))
  ? Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: casas })
  : '—';
const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, x => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[x]);
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const nomeCategoria = c => ({ ANEL: 'Anel', IMPULSOR: 'Impulsor', FACA: 'Faca' }[c] || c);
const lerLista = chave => {
  try { const valor = JSON.parse(armazenamento.getItem(chave) || '[]'); return Array.isArray(valor) ? valor : []; }
  catch { return []; }
};
const salvarLista = (chave, lista) => armazenamento.setItem(chave, JSON.stringify(lista));
const normalizarPeca = p => ({
  ...p,
  id: String(p.id || novoId()),
  categoria: String(p.categoria || p.tipo || 'ANEL').toUpperCase(),
  medida: numero(p.medida ?? p.largura),
  identificacao: String(p.identificacao || p.nome || ''),
  indisponivel: Boolean(p.indisponivel),
  ultimoCaso: Boolean(p.ultimoCaso)
});

let montagemAtual = null;
let categoriaAtual = 'ANEL';
let quantidadeCadastro = 1;
let numeroLinhasTiras = 0;
let excluidosTemporarios = new Map(); // indisponibilidade apenas nesta consulta
let opcoesTopo = [], opcoesInferior = [], opcoesImpulsores = [];
let selecionadaTopo = null, selecionadaInferior = null, selecionadaImpulsor = null;
let filtroReducao = 'TODAS';

function obterPecas(categoria = 'TODOS') {
  return lerLista(CHAVES.pecas).map(normalizarPeca)
    .filter(p => ['ANEL', 'IMPULSOR', 'FACA'].includes(p.categoria) && p.medida > 0 && Number.isFinite(p.medida))
    .filter(p => categoria === 'TODOS' || p.categoria === categoria);
}
const chaveGrupo = p => `${p.categoria}|${inteiro(p.medida)}`;
function pecasDisponiveis(categoria = 'TODOS', bloqueados = new Set()) {
  const grupos = new Map();
  obterPecas(categoria).filter(p => !p.indisponivel && !bloqueados.has(String(p.id)))
    .forEach(p => {
      const chave = chaveGrupo(p);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(p);
    });
  return [...grupos.entries()].flatMap(([chave, pecas]) => {
    pecas.sort((a, b) => a.identificacao.localeCompare(b.identificacao));
    const retirar = Math.min(pecas.length, excluidosTemporarios.get(chave) || 0);
    return pecas.slice(0, pecas.length - retirar);
  });
}
function salvarPecas(pecas) {
  salvarLista(CHAVES.pecas, pecas);
  atualizarFerramentais();
  atualizarDisponibilidade();
  atualizarListaFacas();
  if (montagemAtual) gerarCombinacoes();
}

/* TEMA E NAVEGAÇÃO */
function aplicarTema() {
  const escuro = (armazenamento.getItem(CHAVES.tema) || 'escuro') === 'escuro';
  document.body.classList.toggle('dark', escuro);
  const texto = escuro ? '☀️ Tema claro' : '🌑 Tema preto';
  if ($('themeToggle')) $('themeToggle').textContent = texto;
  if ($('themeToggleConfig')) $('themeToggleConfig').textContent = texto;
}
function alternarTema() {
  armazenamento.setItem(CHAVES.tema, document.body.classList.contains('dark') ? 'claro' : 'escuro');
  aplicarTema();
}
$('themeToggle')?.addEventListener('click', alternarTema);
$('themeToggleConfig')?.addEventListener('click', alternarTema);
function abrirPagina(nome) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${nome}`));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === nome));
  document.body.classList.remove('menu-open');
  if (nome === 'historico') atualizarHistorico();
  if (nome === 'ferramentais') atualizarFerramentais();
  if (nome === 'inicio') atualizarUltimasMontagens();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => abrirPagina(b.dataset.page)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => abrirPagina(b.dataset.goto)));
$('atalhoNova')?.addEventListener('click', () => {
  abrirPagina('inicio');
  $('formSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('menuToggle')?.addEventListener('click', () => document.body.classList.add('menu-open'));
$('closeMenu')?.addEventListener('click', () => document.body.classList.remove('menu-open'));
$('overlay')?.addEventListener('click', () => document.body.classList.remove('menu-open'));

/* FOLGAS E FACAS */
function obterFolga(espessura, folgaManual) {
  if (igualdade(espessura, 1)) {
    const valor = numero(folgaManual);
    return igualdade(valor, .30) || igualdade(valor, .35) ? valor : null;
  }
  for (const [min, max, folga] of [[.15,.35,.05],[.40,.55,.10],[.60,.70,.15],[.75,.85,.20],[.90,.95,.25]]) {
    if (espessura >= min - .000001 && espessura <= max + .000001) return folga;
  }
  return null;
}
function atualizarFolga() {
  const input = $('wrapFolgaManual');
  if (input) input.hidden = !igualdade(numero($('espessura')?.value), 1);
}
$('espessura')?.addEventListener('input', atualizarFolga);
function atualizarCampoSegundaFaca() {
  const duas = document.querySelector('input[name="qtdFacas"]:checked')?.value === '2';
  $('wrapFacaInferior').hidden = !duas;
  $('facaInferior').required = duas;
}
document.querySelectorAll('input[name="qtdFacas"]').forEach(r => r.addEventListener('change', atualizarCampoSegundaFaca));
function atualizarListaFacas() {
  if (!$('listaMedidasFacas')) return;
  const medidas = [...new Set(pecasDisponiveis('FACA').map(p => inteiro(p.medida)))].sort((a,b) => a-b);
  $('listaMedidasFacas').innerHTML = medidas.map(v => `<option value="${formatar(v/10000)}"></option>`).join('');
}
function calcularCanto(medidaAnel, folga, cabecote) {
  // Regra informada para o cabeçote grande com folga de 0,05 cm:
  // 50,00 + 0,025 + 0,05 + 2,00 = 52,075 cm.
  // Para outras folgas no cabeçote grande, +2,00 ainda precisa de confirmação.
  const adicionalFolga = igualdade(folga, .05) ? .05 : 0;
  const adicionalCabecoteGrande = cabecote === 'Grande' && igualdade(folga, .05) ? 2 : 0;
  return arred(medidaAnel + folga/2 + adicionalFolga + adicionalCabecoteGrande);
}
// Remover do canto superior TODO o ajuste usado por causa da folga.
// Folga 0,05: (0,05 / 2) + 0,05 = 0,075 cm.
// Exemplo cabeçote Grande: 52,075 - 0,075 = 52,00; menos 2 facas 5,00 = 42,00.
const calcularInferior = (cima, folga, faca1) => {
  const ajusteFolga = folga/2 + (igualdade(folga, .05) ? .05 : 0);
  return arred(cima - ajusteFolga - 2*faca1);
};
const calcularContracorte = (largura, faca, folga) => arred(largura - 2*faca - folga);

/* LARGURAS DINÂMICAS */
function criarLinhaTira(valores = {}) {
  numeroLinhasTiras++;
  const id = numeroLinhasTiras;
  const linha = document.createElement('div');
  linha.className = 'form-row linha-tira';
  linha.dataset.linha = id;
  linha.innerHTML = `
    <div class="field"><label for="larguraTira${id}">Largura da tira ${id} (cm)</label>
      <input id="larguraTira${id}" class="largura-tira" inputmode="decimal" type="text" placeholder="Ex.: 90" value="${escapar(valores.largura ?? '')}"></div>
    <div class="field"><label for="qtdTira${id}">Quantidade</label>
      <div class="tira-qtd-wrap"><input id="qtdTira${id}" class="qtd-tira" type="number" min="1" step="1" placeholder="Ex.: 1" value="${escapar(valores.quantidade ?? '')}">
      <button class="small-btn remover-tira" type="button" aria-label="Remover esta largura" title="Remover largura">×</button></div></div>`;
  $('linhasTiras').appendChild(linha);
  linha.querySelector('.remover-tira').addEventListener('click', () => {
    if (document.querySelectorAll('.linha-tira').length <= 3) {
      linha.querySelectorAll('input').forEach(c => c.value = '');
    } else linha.remove();
  });
}
function iniciarTiras(valores = []) {
  $('linhasTiras').innerHTML = '';
  numeroLinhasTiras = 0;
  const count = Math.max(3, valores.length);
  for (let i = 0; i < count; i++) criarLinhaTira(valores[i] || {});
}
$('adicionarLargura')?.addEventListener('click', () => criarLinhaTira());
function lerTiras() {
  const resultado = [];
  document.querySelectorAll('.linha-tira').forEach(linha => {
    const larguraTxt = linha.querySelector('.largura-tira').value.trim();
    const qtdTxt = linha.querySelector('.qtd-tira').value.trim();
    if (!larguraTxt && !qtdTxt) return;
    const largura = numero(larguraTxt), quantidade = numero(qtdTxt);
    if (!Number.isFinite(largura) || largura <= 0 || !Number.isInteger(quantidade) || quantidade < 1) {
      throw new Error('Em larguras diferentes, informe largura positiva e quantidade inteira em cada linha utilizada.');
    }
    resultado.push({ largura, quantidade });
  });
  return resultado;
}

/* CADASTRO E ESTOQUE */
function atualizarQtdCadastro() { $('quantidadeFerramental').textContent = String(quantidadeCadastro); }
$('diminuirQuantidade')?.addEventListener('click', () => { quantidadeCadastro = Math.max(1, quantidadeCadastro - 1); atualizarQtdCadastro(); });
$('aumentarQuantidade')?.addEventListener('click', () => { quantidadeCadastro = Math.min(999, quantidadeCadastro + 1); atualizarQtdCadastro(); });
document.querySelectorAll('[data-category]').forEach(b => b.addEventListener('click', () => {
  categoriaAtual = b.dataset.category;
  document.querySelectorAll('[data-category]').forEach(el => el.classList.toggle('selected', el === b));
  $('tituloCadastro').textContent = `Cadastrar ${nomeCategoria(categoriaAtual).toLowerCase()}`;
  $('mensagemFerramental').textContent = '';
}));
function proximaIdentificacao(categoria, pecas) {
  const prefixo = ({ANEL:'A',IMPULSOR:'I',FACA:'F'})[categoria];
  const usadas = new Set(pecas.filter(p => String(p.categoria).toUpperCase() === categoria)
    .map(p => String(p.identificacao || '').toUpperCase()));
  let num = 1;
  while (usadas.has(prefixo + String(num).padStart(3,'0'))) num++;
  return prefixo + String(num).padStart(3,'0');
}
$('formFerramental')?.addEventListener('submit', evento => {
  evento.preventDefault();
  const medida = numero($('medidaFerramental').value);
  const nome = $('nomeFerramental').value.trim();
  if (!Number.isFinite(medida) || medida <= 0) { $('mensagemFerramental').textContent = 'Digite uma medida maior que zero.'; return; }
  const pecas = lerLista(CHAVES.pecas);
  if (quantidadeCadastro === 1 && nome && pecas.map(normalizarPeca).some(p => p.categoria === categoriaAtual && p.identificacao.toLowerCase() === nome.toLowerCase())) {
    $('mensagemFerramental').textContent = 'Esta identificação já existe na categoria. Deixe em branco para gerar um código automático.';
    return;
  }
  for (let i=0; i<quantidadeCadastro; i++) {
    const identificacao = quantidadeCadastro === 1 && nome ? nome : proximaIdentificacao(categoriaAtual,pecas);
    pecas.push({ id:novoId(), categoria:categoriaAtual, medida:arred(medida), identificacao,
      ultimoCaso:$('ultimoCasoFerramental').checked, indisponivel:false, criadoEm:new Date().toISOString() });
  }
  const cadastrados = quantidadeCadastro;
  quantidadeCadastro = 1;
  atualizarQtdCadastro();
  $('formFerramental').reset();
  salvarPecas(pecas);
  $('mensagemFerramental').textContent = `${cadastrados} peça(s) cadastrada(s) com sucesso.`;
});
$('filtroCategoria')?.addEventListener('change', atualizarFerramentais);
$('buscaFerramental')?.addEventListener('input', atualizarFerramentais);
function gruposPecas(filtro, busca='') {
  const grupos = new Map();
  obterPecas(filtro).forEach(p => { const k = chaveGrupo(p); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); });
  return [...grupos.entries()]
    .filter(([,ps]) => ps.some(p => `${nomeCategoria(p.categoria)} ${formatar(p.medida)} ${p.medida} ${p.identificacao}`.toLowerCase().includes(busca.toLowerCase())))
    .sort((a,b) => a[1][0].categoria.localeCompare(b[1][0].categoria) || a[1][0].medida-b[1][0].medida);
}
function atualizarFerramentais() {
  const area = $('listaFerramentais'); if (!area) return;
  const grupos = gruposPecas($('filtroCategoria').value, $('buscaFerramental').value.trim());
  if (!grupos.length) { area.innerHTML = '<p class="empty">Nenhum ferramental encontrado.</p>'; return; }
  area.innerHTML = grupos.map(([k,ps]) => {
    const p = ps[0], ultimo = ps.every(x => x.ultimoCaso);
    const codigos = ps.map(x => `${x.identificacao || x.id.slice(-6)}${x.indisponivel ? ' (indisponível)' : ''}`).join(', ');
    return `<article class="record-item tool-group">
      <div class="tool-top"><div><strong>${nomeCategoria(p.categoria)} · ${formatar(p.medida)} cm</strong>
      <div class="record-meta">${escapar(codigos)}</div></div>
      <div class="quantity-control"><button data-menos="${escapar(k)}" type="button" aria-label="Remover uma peça">−</button>
      <output>${ps.length}</output><button data-mais="${escapar(k)}" type="button" aria-label="Adicionar uma peça">+</button></div></div>
      <label class="radio-label preference-choice"><input type="checkbox" data-preferencia="${escapar(k)}" ${ultimo?'checked':''}>
      Usar apenas em último caso</label>
    </article>`;
  }).join('');
  area.querySelectorAll('[data-mais]').forEach(b => b.addEventListener('click', () => {
    const [cat,med] = b.dataset.mais.split('|');
    const pecas = lerLista(CHAVES.pecas);
    const presentes = pecas.map(normalizarPeca).filter(p => chaveGrupo(p) === b.dataset.mais);
    pecas.push({ id:novoId(),categoria:cat,medida:Number(med)/10000,identificacao:proximaIdentificacao(cat,pecas),
      ultimoCaso:presentes.every(p=>p.ultimoCaso), indisponivel:false,criadoEm:new Date().toISOString() });
    salvarPecas(pecas);
  }));
  area.querySelectorAll('[data-menos]').forEach(b => b.addEventListener('click', () => {
    const pecas = lerLista(CHAVES.pecas);
    const mesmos = pecas.map(normalizarPeca).filter(p => chaveGrupo(p) === b.dataset.menos);
    const remover = mesmos.find(p=>!p.indisponivel) || mesmos[mesmos.length-1];
    if (!remover) return;
    salvarPecas(pecas.filter(p => String(p.id) !== String(remover.id)));
  }));
  area.querySelectorAll('[data-preferencia]').forEach(input => input.addEventListener('change', () => {
    const pecas = lerLista(CHAVES.pecas);
    pecas.forEach(p => { if (chaveGrupo(normalizarPeca(p)) === input.dataset.preferencia) p.ultimoCaso = input.checked; });
    salvarPecas(pecas);
  }));
}

/* EXCLUSÃO TEMPORÁRIA PARA O CÁLCULO */
function atualizarDisponibilidade() {
  const area = $('listaDisponibilidade'); if (!area) return;
  const grupos = gruposPecas($('filtroIndisponivel').value, $('buscaIndisponivel').value.trim());
  if (!grupos.length) { area.innerHTML = '<p class="empty">Nenhum ferramental encontrado.</p>'; return; }
  area.innerHTML = grupos.map(([k,ps]) => {
    const livres = ps.filter(p=>!p.indisponivel).length;
    const bloqueados = Math.min(livres, excluidosTemporarios.get(k) || 0);
    const ativo = livres-bloqueados;
    return `<div class="availability-item"><span class="availability-description"><strong>${escapar(nomeCategoria(ps[0].categoria))} · ${formatar(ps[0].medida)} cm</strong>
      <small>${ps.length} cadastrada(s) · ${ps.length-livres} bloqueada(s) no cadastro</small></span>
      <div class="quantity-control"><button type="button" data-bloquear="${escapar(k)}" ${ativo===0?'disabled':''} aria-label="Diminuir disponíveis">−</button>
      <output>${ativo} / ${livres}</output><button type="button" data-liberar="${escapar(k)}" ${bloqueados===0?'disabled':''} aria-label="Aumentar disponíveis">+</button></div>
      </div>`;
  }).join('');
  area.querySelectorAll('[data-bloquear]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.bloquear;
    excluidosTemporarios.set(k,(excluidosTemporarios.get(k)||0)+1);
    atualizarDisponibilidade(); gerarCombinacoes();
  }));
  area.querySelectorAll('[data-liberar]').forEach(b => b.addEventListener('click', () => {
    const k=b.dataset.liberar;
    excluidosTemporarios.set(k,Math.max(0,(excluidosTemporarios.get(k)||0)-1));
    atualizarDisponibilidade(); gerarCombinacoes();
  }));
}
$('buscaIndisponivel')?.addEventListener('input', atualizarDisponibilidade);
$('filtroIndisponivel')?.addEventListener('change', atualizarDisponibilidade);
$('recalcular')?.addEventListener('click', gerarCombinacoes);

/* MOTOR DE COMBINAÇÕES — estoque físico limitado e somas exatas */
function contarMedidasDiferentes(lista) { return new Set(lista.map(p => inteiro(p.medida))).size; }
function pontuacaoOpcao(opcao) {
  return [opcao.pecas.filter(p=>p.ultimoCaso).length, opcao.pecas.length, contarMedidasDiferentes(opcao.pecas)];
}
function compararOpcoes(a, b) {
  const aP = pontuacaoOpcao(a), bP = pontuacaoOpcao(b);
  for (let i = 0; i < aP.length; i++) if (aP[i] !== bP[i]) return aP[i]-bP[i];
  return (a.reducao || 0) - (b.reducao || 0);
}
function enumerarCombinacoes(pecas, alvo, limite = 150) {
  if (!Number.isFinite(alvo) || alvo <= 0 || !pecas.length) return {opcoes:[],limitado:false};
  const grupos = new Map();
  pecas.forEach(p => {
    const k = inteiro(p.medida);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  });
  const itens = [...grupos.entries()].map(([valor, pecas]) => ({ valor, pecas })).sort((a,b)=>b.valor-a.valor);
  const alvoInt = inteiro(alvo), maxVal=itens[0].valor, minVal=itens[itens.length-1].valor;
  const qtdTotal = pecas.length;
  const minimo = Math.max(1,Math.ceil(alvoInt/maxVal));
  const maximo = Math.min(qtdTotal,Math.floor(alvoInt/minVal));
  const resultados=[], escolhas=new Array(itens.length).fill(0);
  let nos = 0, limitado = false;
  const limiteNos = 900000;
  function limitesRestantes(i, quantidade) {
    let faltam = quantidade, maxSoma=0;
    for(let j=i;j<itens.length && faltam>0;j++) {
      const n = Math.min(faltam,itens[j].pecas.length);
      maxSoma += n*itens[j].valor;
      faltam -= n;
    }
    if (faltam>0) return null;
    faltam=quantidade;
    let minSoma=0;
    for(let j=itens.length-1;j>=i && faltam>0;j--) {
      const n=Math.min(faltam,itens[j].pecas.length);
      minSoma += n*itens[j].valor;
      faltam -= n;
    }
    return { minSoma, maxSoma };
  }
  function buscar(i, faltamPecas, faltamMedida) {
    if (resultados.length>=limite) {limitado=true; return;}
    if (++nos>limiteNos) {limitado=true; return;}
    if (faltamPecas===0) {
      if (faltamMedida===0) {
        const lista=itens.flatMap((g,j)=>g.pecas.slice(0,escolhas[j]));
        resultados.push({pecas:lista, soma:arred(alvo), alvo:arred(alvo), quantidade:lista.length});
      }
      return;
    }
    if(i>=itens.length || faltamMedida<=0) return;
    const bounds = limitesRestantes(i, faltamPecas);
    if(!bounds || faltamMedida<bounds.minSoma || faltamMedida>bounds.maxSoma) return;
    const grupo=itens[i];
    const maxN=Math.min(grupo.pecas.length,faltamPecas,Math.floor(faltamMedida/grupo.valor));
    for(let n=maxN;n>=0;n--) {
      escolhas[i]=n;
      buscar(i+1,faltamPecas-n,faltamMedida-n*grupo.valor);
      if(limitado) break;
    }
    escolhas[i]=0;
  }
  for (let quantidade=minimo; quantidade<=maximo; quantidade++) {
    buscar(0,quantidade,alvoInt);
    if (limitado) break;
  }
  resultados.sort(compararOpcoes);
  return { opcoes:resultados, limitado };
}
function encontrarCombinacoes(categoria, alvo, bloqueados = new Set()) {
  if (!Number.isFinite(alvo) || alvo<=0) return {opcoes:[],limitado:false};
  const pecas = pecasDisponiveis(categoria,bloqueados);
  if (categoria === 'ANEL') {
    const preferenciais = pecas.filter(p=>!p.ultimoCaso);
    const resultPreferencial = enumerarCombinacoes(preferenciais,alvo);
    if (resultPreferencial.opcoes.length || resultPreferencial.limitado) return resultPreferencial;
  }
  return enumerarCombinacoes(pecas,alvo);
}
const textoCombinacao = op => op.pecas.map(p => `${formatar(p.medida)} cm${p.identificacao ? ` (${p.identificacao})` : ''}`).join(' + ');
const chaveOpcao = op => op?.pecas.map(p => String(p.id)).sort().join('|') || '';
function cardOpcao(op, i, tipo, selecionada) {
  return `<button class="option-card option-button ${selecionada?'recommended':''}" data-escolher="${tipo}" data-indice="${i}" type="button" aria-pressed="${selecionada}">
    <div class="option-title"><strong>${selecionada?'✓ Escolhida · ':'Opção '+(i+1)+' · '}${op.pecas.length} peça(s)</strong>
      ${op.reducao ? `<span class="badge">Redução ${formatar(op.reducao)} cm</span>` : ''}</div>
    <div class="option-pieces">${escapar(textoCombinacao(op))}</div>
    <p>Soma: ${formatar(op.soma)} cm · ${contarMedidasDiferentes(op.pecas)} medida(s) diferente(s)${op.pecas.some(p=>p.ultimoCaso)?' · Último caso':''}</p>
  </button>`;
}
function renderizarOpcoesAneis(tipo) {
  const topo=tipo==='topo', area = $(topo?'opcoesAneis':'opcoesAneisCantoInferior');
  if (!area) return;
  const lista = topo ? opcoesTopo : opcoesInferior;
  const escolhida = topo ? selecionadaTopo : selecionadaInferior;
  const limitado = topo ? opcoesTopo.limitado : opcoesInferior.limitado;
  if(!lista.length) {
    area.innerHTML = '<div class="notice warning">Nenhuma combinação exata encontrada com as peças disponíveis. Confira o estoque ou ajuste a indisponibilidade.</div>';
    return;
  }
  area.innerHTML = `${limitado?'<div class="notice warning">Muitas possibilidades: exibindo as primeiras opções. Prioridade para menos peças.</div>':''}
    ${lista.map((op,i)=>cardOpcao(op,i,tipo,chaveOpcao(op)===chaveOpcao(escolhida))).join('')}`;
  area.querySelectorAll('[data-escolher]').forEach(botao=>botao.addEventListener('click',()=>{
    const op = lista[Number(botao.dataset.indice)];
    if(topo) {
      selecionadaTopo = op;
      refazerInferior();
      renderizarOpcoesAneis('topo');
    } else {
      selecionadaInferior=op;
      renderizarOpcoesAneis('inferior');
    }
    preencherEscolhas();
  }));
}
function refazerInferior() {
  const bloqueados = new Set((selecionadaTopo?.pecas||[]).map(p=>String(p.id)));
  const resultado = encontrarCombinacoes('ANEL', montagemAtual.cantoInferior, bloqueados);
  opcoesInferior = resultado.opcoes;
  opcoesInferior.limitado = resultado.limitado;
  selecionadaInferior = opcoesInferior[0] || null;
  renderizarOpcoesAneis('inferior');
  preencherEscolhas();
}
function preencherEscolhas() {
  if($('aneisEscolhidos')) $('aneisEscolhidos').value = selecionadaTopo ? textoCombinacao(selecionadaTopo) : '';
  if($('aneisCantoInferiorEscolhidos')) $('aneisCantoInferiorEscolhidos').value = selecionadaInferior ? textoCombinacao(selecionadaInferior) : '';
  if($('impulsoresEscolhidos')) $('impulsoresEscolhidos').value = selecionadaImpulsor ? textoCombinacao(selecionadaImpulsor) : '';
  if($('reducaoEscolhida')) $('reducaoEscolhida').value = selecionadaImpulsor ? String(selecionadaImpulsor.reducao) : '';
  if($('fichaAneis')) $('fichaAneis').textContent = selecionadaTopo ? textoCombinacao(selecionadaTopo) : 'Nenhuma combinação exata';
  if($('fichaInferior')) $('fichaInferior').textContent = selecionadaInferior ? textoCombinacao(selecionadaInferior) : 'Nenhuma combinação exata';
  if($('fichaImpulsores')) $('fichaImpulsores').textContent = selecionadaImpulsor ? `${textoCombinacao(selecionadaImpulsor)} (redução ${formatar(selecionadaImpulsor.reducao)} cm)` : 'Nenhuma combinação exata';
}
function renderizarImpulsores() {
  const area=$('opcoesImpulsores'); if(!area) return;
  const lista = opcoesImpulsores.filter(op=>filtroReducao==='TODAS'||igualdade(op.reducao,numero(filtroReducao)));
  const limitado = opcoesImpulsores.limitado;
  if(!lista.length) { area.innerHTML='<div class="notice warning">Nenhuma combinação exata de impulsores encontrada para este filtro.</div>'; return; }
  area.innerHTML=`${limitado?'<div class="notice warning">Há muitas opções: mostrando as primeiras combinações por quantidade de peças.</div>':''}
    ${lista.map((op,i) => cardOpcao(op,i,'imp',chaveOpcao(op)===chaveOpcao(selecionadaImpulsor))).join('')}`;
  area.querySelectorAll('[data-escolher]').forEach(botao => botao.addEventListener('click',()=>{
    selecionadaImpulsor=lista[Number(botao.dataset.indice)];
    renderizarImpulsores(); preencherEscolhas();
  }));
}
document.querySelectorAll('[data-reducao]').forEach(b=>b.addEventListener('click',()=>{
  filtroReducao=b.dataset.reducao;
  document.querySelectorAll('[data-reducao]').forEach(item=>item.classList.toggle('selected',item===b));
  renderizarImpulsores();
}));
function gerarCombinacoes() {
  if(!montagemAtual) return;
  const topo = encontrarCombinacoes('ANEL',montagemAtual.largura);
  opcoesTopo=topo.opcoes; opcoesTopo.limitado=topo.limitado;
  // O canto inferior e a largura principal utilizam anéis físicos distintos.
  // Procurar um par viável antes de escolher automaticamente a opção do topo.
  selecionadaTopo=opcoesTopo[0]||null;
  let melhorPar=null;
  for(const candidato of opcoesTopo.slice(0, 25)) {
    const bloqueados=new Set(candidato.pecas.map(p=>String(p.id)));
    const abaixo=encontrarCombinacoes('ANEL',montagemAtual.cantoInferior,bloqueados).opcoes[0];
    if(!abaixo) continue;
    const score=[candidato.pecas.filter(p=>p.ultimoCaso).length+abaixo.pecas.filter(p=>p.ultimoCaso).length,
      candidato.pecas.length+abaixo.pecas.length,
      contarMedidasDiferentes([...candidato.pecas,...abaixo.pecas])];
    if(!melhorPar || score.some((v,i)=>v<melhorPar.score[i] && score.slice(0,i).every((x,j)=>x===melhorPar.score[j]))) {
      melhorPar={topo:candidato,score};
    }
    if(score[0]===0 && score[1]===2) break;
  }
  if(melhorPar) selecionadaTopo=melhorPar.topo;
  renderizarOpcoesAneis('topo');
  refazerInferior();
  opcoesImpulsores=[];
  let limitadas = false;
  for(const reducao of [.10,.15,.20]) {
    const alvo=arred(montagemAtual.largura - reducao);
    const achadas=encontrarCombinacoes('IMPULSOR',alvo);
    if(achadas.limitado) limitadas=true;
    opcoesImpulsores.push(...achadas.opcoes.map(o=>({...o,reducao,alvo})));
  }
  opcoesImpulsores.sort(compararOpcoes);
  selecionadaImpulsor=opcoesImpulsores[0]||null;
  opcoesImpulsores.limitado=limitadas;
  renderizarImpulsores();
  preencherEscolhas();
}

/* DADOS DA MONTAGEM, RESUMO E CÁLCULOS */
function lerMontagem() {
  const cliente=$('cliente').value.trim();
  const largura=numero($('largura').value);
  const larguraRolo=$('larguraRolo').value.trim() ? numero($('larguraRolo').value) : null;
  const espessura=numero($('espessura').value);
  const folga=obterFolga(espessura,$('folgaManual').value);
  const cabecote=$('cabecote').value;
  const faca1=numero($('facaSuperior').value);
  const qtdFacas=Number(document.querySelector('input[name="qtdFacas"]:checked')?.value || 1);
  const faca2=qtdFacas===2 ? numero($('facaInferior').value) : null;
  const anel=numero($('canto').value);
  if(!cliente) throw new Error('Informe o cliente ou etapa.');
  if(!Number.isFinite(largura)||largura<=0) throw new Error('Informe uma largura solicitada válida.');
  if(larguraRolo!==null && (!Number.isFinite(larguraRolo)||larguraRolo<=0)) throw new Error('Informe a largura do rolo corretamente.');
  if(!Number.isFinite(espessura)||espessura<=0||folga===null) throw new Error('Espessura sem folga definida. Verifique a tabela ou selecione 0,30/0,35 para espessura 1,00.');
  if(!['Grande','Pequeno'].includes(cabecote)) throw new Error('Selecione o cabeçote.');
  if(!Number.isFinite(faca1)||faca1<=0) throw new Error('Informe a medida numérica da faca 1.');
  if(qtdFacas===2 && (!Number.isFinite(faca2)||faca2<=0)) throw new Error('Informe a medida numérica da faca 2.');
  if(!Number.isFinite(anel)||anel<=0) throw new Error('Informe a medida do anel para cálculo do canto.');
  const largurasTiras=lerTiras();
  const larguraTotalTiras=arred(largurasTiras.reduce((s,t)=>s+t.largura*t.quantidade,0));
  const totalTiras=largurasTiras.length ? largurasTiras.reduce((s,t)=>s+t.quantidade,0)
    : larguraRolo!==null ? Math.floor((larguraRolo*10000+0.0001)/(largura*10000)) : null;
  const cantoSuperior=calcularCanto(anel,folga,cabecote);
  const cantoInferior=calcularInferior(cantoSuperior,folga,faca1);
  return { id:novoId(),data:new Date().toISOString(),cliente,largura,larguraRolo,espessura,folga,
    tipoEtapa:$('tipoPedido').value,tipoPedido:$('tipoPedido').value,cabecote,
    qtdFacas,facaSuperior:formatar(faca1),facaInferior:qtdFacas===2?formatar(faca2):'',faca1,faca2,
    medidaAnel:anel,canto:cantoSuperior,cantoCalculado:cantoSuperior,cantoSuperior,cantoInferior,
    contracorte1:calcularContracorte(largura,faca1,folga),
    contracorte2:qtdFacas===2?calcularContracorte(largura,faca2,folga):null,
    largurasTiras,larguraTotalTiras,totalTiras,
    observacoes:$('observacoes').value.trim() };
}
$('formMontagem')?.addEventListener('submit',evento=>{
  evento.preventDefault();
  try {
    montagemAtual=lerMontagem();
    excluidosTemporarios.clear();
    filtroReducao='TODAS';
    document.querySelectorAll('[data-reducao]').forEach(b=>b.classList.toggle('selected',b.dataset.reducao==='TODAS'));
    $('mensagemMontagem').textContent='';
    $('mensagemResultado').textContent='';
    $('buscaIndisponivel').value='';
    $('filtroIndisponivel').value='TODOS';
    $('observacaoResultado').value='';
    mostrarResumo(); atualizarCalculos();
    atualizarDisponibilidade(); gerarCombinacoes();
    abrirPagina('resultados');
  } catch(e) { $('mensagemMontagem').textContent=e.message; }
});
function resumoCampo(titulo,valor) {
  return `<div class="summary-cell"><small>${escapar(titulo)}</small><strong>${escapar(valor)}</strong></div>`;
}
function mostrarResumo() {
  const m=montagemAtual; if(!m) return;
  const larguraTiras = m.largurasTiras.length
    ? m.largurasTiras.map(t=>`${t.quantidade} × ${formatar(t.largura)} cm`).join(' + ')
    : `${formatar(m.largura)} cm`;
  const facaTexto = m.qtdFacas===2 ? `${formatar(m.faca1)} cm / ${formatar(m.faca2)} cm` : `${formatar(m.faca1)} cm`;
  const campos=[
    ['Cliente',m.cliente],['Largura solicitada',formatar(m.largura)+' cm'],
    ['Largura do rolo recebido',m.larguraRolo===null?'Não informada':formatar(m.larguraRolo)+' cm'],
    ['Tiras',larguraTiras],['Total de tiras cortadas',m.totalTiras===null?'Não informado':String(m.totalTiras)],
    ['Tipo de etapa',m.tipoEtapa],['Espessura',formatar(m.espessura)+' cm'],
    ['Folga utilizada',formatar(m.folga)+' cm'],['Cabeçote',m.cabecote],
    ['Faca(s) utilizadas',facaTexto],['Canto superior',formatar(m.cantoSuperior)+' cm'],
    ['Canto inferior',formatar(m.cantoInferior)+' cm'] ];
  $('resultadoResumo').innerHTML=campos.map(([a,b])=>{
    if(a!=='Canto superior') return resumoCampo(a,b);
    const roxo=m.cabecote==='Grande' && igualdade(m.folga,.05)
      ? '<span class="aviso-papel-roxo">Papel roxo junto no canto</span>' : '';
    return `<div class="summary-cell summary-canto-superior">
      <div class="canto-superior-cabecalho"><small>Canto superior</small>${roxo}</div>
      <strong>${escapar(b)}</strong>
    </div>`;
  }).join('');
}
function atualizarCalculos() {
  const m=montagemAtual; if(!m)return;
  // Cada faca aparece imediatamente acima do seu próprio contra-corte.
  // A mesma ordem é mantida em computadores e celulares para evitar troca de medidas.
  const campoCalculo=(rotulo,valor,detalhe='')=>
    `<div class="metric"><small>${escapar(rotulo)}</small><strong>${formatar(valor)} cm</strong>${detalhe?`<div class="metric-note">${escapar(detalhe)}</div>`:''}</div>`;
  const parFaca=(n,faca,contracorte)=>`<section class="calculo-par" aria-label="Faca ${n} e contra-corte ${n}">
    <h3>Faca ${n} e contra-corte ${n}</h3>
    ${campoCalculo(`Faca ${n}`,faca)}
    ${campoCalculo(`Contra-corte ${n}`,contracorte,
      `${formatar(m.largura)} − (2 × ${formatar(faca)}) − ${formatar(m.folga)} = ${formatar(contracorte)} cm`)}
  </section>`;
  $('metricasResultado').classList.toggle('uma-faca',m.qtdFacas!==2);
  $('metricasResultado').innerHTML=
    `<div class="calculo-largura">${campoCalculo('Largura do corte',m.largura)}</div>
     ${parFaca(1,m.faca1,m.contracorte1)}
     ${m.qtdFacas===2?parFaca(2,m.faca2,m.contracorte2):''}`;
  const avisos=[];
  if(m.cantoInferior<=0) avisos.push('Canto inferior não positivo: confira os valores antes de montar.');
  if(m.contracorte1<=0 || (m.qtdFacas===2&&m.contracorte2<=0)) avisos.push('Contra-corte não positivo: confira as facas.');
  const capacidade=m.cabecote==='Grande'?570:270;
  if(m.largura>capacidade+0.000001) avisos.push(`Largura solicitada maior que a capacidade do cabeçote (${capacidade} cm).`);
  if(m.largurasTiras.length && m.larguraTotalTiras>capacidade+0.000001) avisos.push('Soma das larguras diferentes excede a capacidade do cabeçote.');
  if(m.largurasTiras.length && !igualdade(m.largura,m.larguraTotalTiras)) avisos.push(`As larguras diferentes somam ${formatar(m.larguraTotalTiras)} cm, diferente da largura solicitada de ${formatar(m.largura)} cm. Confira.`);
  if(m.larguraRolo!==null && m.largurasTiras.length && m.larguraTotalTiras>m.larguraRolo+0.000001) avisos.push('As tiras informadas excedem a largura do rolo recebido.');
  for(const medida of [m.faca1,...(m.qtdFacas===2?[m.faca2]:[])]) {
    const cadastradas=obterPecas('FACA').filter(p=>igualdade(p.medida,medida));
    const disponiveis=pecasDisponiveis('FACA').filter(p=>igualdade(p.medida,medida));
    if(cadastradas.length && !disponiveis.length) avisos.push(`Faca ${formatar(medida)} cm consta no cadastro, mas está indisponível. Confira antes de montar.`);
  }
  $('alertaCalculos').hidden=avisos.length===0;
  $('alertaCalculos').textContent=avisos.join(' ');
}

/* RESULTADOS, HISTÓRICO E REUTILIZAÇÃO */
$('voltarEdicao')?.addEventListener('click',()=>abrirPagina('inicio'));
$('imprimirFicha')?.addEventListener('click',()=>window.print());
$('confirmarMontagem')?.addEventListener('click',()=>{
  if(!montagemAtual) { $('mensagemResultado').textContent='Nenhuma montagem para salvar.';return; }
  const registro={...montagemAtual,
    aneisEscolhidos:$('aneisEscolhidos').value.trim()||'Nenhuma combinação exata',
    aneisCantoInferiorEscolhidos:$('aneisCantoInferiorEscolhidos').value.trim()||'Nenhuma combinação exata',
    impulsoresEscolhidos:$('impulsoresEscolhidos').value.trim()||'Nenhuma combinação exata',
    reducaoImpulsores:selecionadaImpulsor?.reducao ?? null,
    idsAneis:selecionadaTopo?.pecas.map(p=>p.id)||[],
    idsAneisInferior:selecionadaInferior?.pecas.map(p=>p.id)||[],
    idsImpulsores:selecionadaImpulsor?.pecas.map(p=>p.id)||[],
    observacaoResultado:$('observacaoResultado').value.trim(),status:'Salva'};
  try {
    const dados=lerLista(CHAVES.montagens); dados.unshift(registro); salvarLista(CHAVES.montagens,dados);
    montagemAtual=null;
    atualizarHistorico(); atualizarUltimasMontagens(); abrirPagina('historico');
  } catch { $('mensagemResultado').textContent='Não foi possível salvar o histórico. Confira o armazenamento do navegador.'; }
});
function dataLegivel(d) {
  const data=new Date(d);
  return !d||Number.isNaN(data.getTime())?String(d||'Data não informada'):data.toLocaleString('pt-BR');
}
function atualizarHistorico() {
  const area=$('listaHistorico'); if(!area)return;
  const busca=$('buscaHistorico').value.trim().toLowerCase();
  const registros=lerLista(CHAVES.montagens).filter(m=>JSON.stringify(m).toLowerCase().includes(busca));
  if(!registros.length) {area.innerHTML='<p class="empty">Nenhuma montagem encontrada.</p>';return;}
  area.innerHTML=registros.map(m=>`<article class="record-item">
    <strong>${escapar(m.cliente||'Montagem')}</strong>
    <div class="record-meta">${escapar(dataLegivel(m.data))} · ${escapar(m.tipoEtapa||m.tipoPedido||'')}</div>
    <div class="record-meta">Largura: ${formatar(m.largura)} cm · Espessura: ${formatar(m.espessura)} cm · Folga: ${formatar(m.folga)} cm · Cabeçote: ${escapar(m.cabecote||'—')}</div>
    <div class="record-meta">Tiras: ${escapar(m.totalTiras??'—')} · Rolo recebido: ${m.larguraRolo!=null?formatar(m.larguraRolo)+' cm':'—'}</div>
    <div class="record-meta">Canto superior: ${formatar(m.cantoSuperior??m.cantoCalculado??m.canto)} cm · Inferior: ${formatar(m.cantoInferior)} cm</div>
    <div class="record-meta">Faca(s): ${escapar(m.facaSuperior||'—')}${m.facaInferior?' / '+escapar(m.facaInferior):''}</div>
    <div class="record-meta">Anéis (largura): ${escapar(m.aneisEscolhidos||m.aneis||'—')}</div>
    <div class="record-meta">Anéis (canto inferior): ${escapar(m.aneisCantoInferiorEscolhidos||'—')}</div>
    <div class="record-meta">Impulsores: ${escapar(m.impulsoresEscolhidos||m.impulsores||'—')}</div>
    ${m.observacoes?`<div class="record-meta">Observações: ${escapar(m.observacoes)}</div>`:''}
    ${m.observacaoResultado?`<div class="record-meta">Escolha: ${escapar(m.observacaoResultado)}</div>`:''}
    <div class="record-actions"><button class="small-btn" data-reutilizar="${escapar(m.id||'')}" type="button">Reutilizar montagem</button>
    <button class="small-btn danger" data-apagar="${escapar(m.id||'')}" type="button">Excluir registro</button></div>
  </article>`).join('');
  area.querySelectorAll('[data-reutilizar]').forEach(b=>b.addEventListener('click',()=>{
    const m=lerLista(CHAVES.montagens).find(x=>String(x.id)===b.dataset.reutilizar);
    if(!m)return;
    $('cliente').value=m.cliente||'';
    $('largura').value=m.largura??'';
    $('larguraRolo').value=m.larguraRolo??'';
    $('espessura').value=m.espessura??'';
    atualizarFolga();
    $('folgaManual').value=igualdade(Number(m.espessura),1)?String(m.folga??''):'';
    $('tipoPedido').value=['Etapa Final','Etapa Intermediária'].includes(m.tipoEtapa||m.tipoPedido)?(m.tipoEtapa||m.tipoPedido):'Etapa Final';
    $('cabecote').value=m.cabecote||'';
    document.querySelector(`input[name="qtdFacas"][value="${m.qtdFacas===2?'2':'1'}"]`).checked=true;
    atualizarCampoSegundaFaca();
    $('facaSuperior').value=m.faca1??m.facaSuperior??'';
    $('facaInferior').value=m.faca2??m.facaInferior??'';
    $('canto').value=m.medidaAnel??'';
    $('observacoes').value=m.observacoes||'';
    iniciarTiras(Array.isArray(m.largurasTiras)?m.largurasTiras:[]);
    abrirPagina('inicio');
    $('formSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  area.querySelectorAll('[data-apagar]').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('Deseja excluir esta montagem do histórico?'))return;
    salvarLista(CHAVES.montagens,lerLista(CHAVES.montagens).filter(m=>String(m.id)!==b.dataset.apagar));
    atualizarHistorico(); atualizarUltimasMontagens();
  }));
}
function atualizarUltimasMontagens() {
  const area=$('ultimasMontagens'); if(!area)return;
  const registros=lerLista(CHAVES.montagens).slice(0,5);
  area.innerHTML=registros.length?registros.map(m=>`<article class="record-item">
    <strong>${escapar(m.cliente||'Montagem')}</strong>
    <div class="record-meta">${escapar(dataLegivel(m.data))}</div>
    <div class="record-meta">${formatar(m.largura)} cm · ${escapar(m.cabecote||'—')}</div>
    </article>`).join(''):'<p class="empty">Nenhuma montagem registrada ainda.</p>';
}
$('buscaHistorico')?.addEventListener('input',atualizarHistorico);

/* BACKUP / RESTAURAÇÃO */
$('exportarDados')?.addEventListener('click',()=>{
  const backup={versao:2,exportadoEm:new Date().toISOString(),montagens:lerLista(CHAVES.montagens),
    pecas:lerLista(CHAVES.pecas),tema:armazenamento.getItem(CHAVES.tema)||'escuro'};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='backup-armco-montagem.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('mensagemConfiguracoes').textContent='Backup exportado. Guarde em local seguro.';
});
$('importarArquivo')?.addEventListener('change',async evento=>{
  const arquivo=evento.target.files?.[0];if(!arquivo)return;
  try {
    const dados=JSON.parse(await arquivo.text());
    if(!dados||!Array.isArray(dados.montagens)||!Array.isArray(dados.pecas)||
      !dados.montagens.every(p=>p&&typeof p==='object'&&!Array.isArray(p))||
      !dados.pecas.every(p=>p&&typeof p==='object'&&!Array.isArray(p)))
      throw new Error('O arquivo não tem um backup ARMCO válido.');
    if(!confirm('Restaurar backup? Isso substituirá os ferramentais e o histórico deste navegador.'))return;
    // Confirmar primeiro e alterar somente depois que a estrutura foi validada.
    salvarLista(CHAVES.montagens,dados.montagens);
    salvarLista(CHAVES.pecas,dados.pecas);
    if(['claro','escuro'].includes(dados.tema))armazenamento.setItem(CHAVES.tema,dados.tema);
    excluidosTemporarios.clear();
    aplicarTema(); atualizarFerramentais(); atualizarDisponibilidade(); atualizarListaFacas();
    atualizarHistorico(); atualizarUltimasMontagens();
    if(montagemAtual) gerarCombinacoes();
    $('mensagemConfiguracoes').textContent='Backup restaurado com sucesso.';
  } catch(e) { $('mensagemConfiguracoes').textContent='Não foi possível restaurar: '+e.message; }
  finally {evento.target.value='';}
});

/* INICIALIZAÇÃO E COMPATIBILIDADE COM DADOS ANTIGOS */
function iniciarSistema() {
  if(!armazenamento.getItem(CHAVES.montagens)) salvarLista(CHAVES.montagens,[]);
  if(!armazenamento.getItem(CHAVES.pecas)) salvarLista(CHAVES.pecas,[]);
  const pecas=lerLista(CHAVES.pecas);
  let alterou=false;
  pecas.forEach(p=>{if(!p.id){p.id=novoId();alterou=true;}});
  if(alterou)salvarLista(CHAVES.pecas,pecas);
  if (!armazenamentoPersistente && $('avisoArmazenamento')) {
    $('avisoArmazenamento').hidden = false;
  }
  aplicarTema(); atualizarFolga(); atualizarCampoSegundaFaca(); iniciarTiras();
  atualizarQtdCadastro(); atualizarListaFacas(); atualizarFerramentais(); atualizarDisponibilidade();
  atualizarHistorico(); atualizarUltimasMontagens();
}
iniciarSistema();
