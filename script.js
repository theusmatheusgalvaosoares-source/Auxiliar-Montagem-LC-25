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
    const retirar = excluidosTemporarios.has(chave) ? pecas.length : 0;
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
  linha.querySelectorAll('input').forEach(c => c.addEventListener('input', atualizarObrigatoriedadeLargura));
  linha.querySelector('.remover-tira').addEventListener('click', () => {
    if (document.querySelectorAll('.linha-tira').length <= 3) {
      linha.querySelectorAll('input').forEach(c => c.value = '');
    } else linha.remove();
    atualizarObrigatoriedadeLargura();
  });
}
function iniciarTiras(valores = []) {
  $('linhasTiras').innerHTML = '';
  numeroLinhasTiras = 0;
  const count = Math.max(3, valores.length);
  for (let i = 0; i < count; i++) criarLinhaTira(valores[i] || {});
  atualizarObrigatoriedadeLargura();
}
function atualizarObrigatoriedadeLargura() {
  const temTiras = [...document.querySelectorAll('.largura-tira')].some(c => c.value.trim());
  $('largura').required = !temTiras;
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
  if (!Number.isFinite(medida) || medida <= 0) { $('mensagemFerramental').textContent = 'Digite uma medida maior que zero.'; return; }
  // Cada categoria e medida aparece apenas uma vez, sem controle de quantidade.
  // Cadastros antigos com a mesma medida permanecem preservados até exclusão explícita.
  if (obterPecas(categoriaAtual).some(p => inteiro(p.medida) === inteiro(arred(medida)))) {
    $('mensagemFerramental').textContent = 'Essa medida já está cadastrada nesta categoria.';
    return;
  }
  const pecas = lerLista(CHAVES.pecas);
  pecas.push({ id:novoId(), categoria:categoriaAtual, medida:arred(medida),
    identificacao:proximaIdentificacao(categoriaAtual,pecas),
    ultimoCaso:$('ultimoCasoFerramental').checked, indisponivel:false,
    criadoEm:new Date().toISOString() });
  $('formFerramental').reset();
  salvarPecas(pecas);
  $('mensagemFerramental').textContent = 'Ferramental cadastrado com sucesso.';
});
$('filtroCategoria')?.addEventListener('change', atualizarFerramentais);
$('buscaFerramental')?.addEventListener('input', atualizarFerramentais);
function gruposPecas(filtro, busca='') {
  const grupos = new Map();
  obterPecas(filtro).forEach(p => { const k = chaveGrupo(p); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); });
  return [...grupos.entries()]
    .filter(([,ps]) => ps.some(p => `${nomeCategoria(p.categoria)} ${formatar(p.medida)} ${p.medida}`.toLowerCase().includes(busca.toLowerCase())))
    .sort((a,b) => a[1][0].categoria.localeCompare(b[1][0].categoria) || a[1][0].medida-b[1][0].medida);
}
function atualizarFerramentais() {
  const area = $('listaFerramentais'); if (!area) return;
  const grupos = gruposPecas($('filtroCategoria').value, $('buscaFerramental').value.trim());
  if (!grupos.length) { area.innerHTML = '<p class="empty">Nenhum ferramental encontrado.</p>'; return; }
  area.innerHTML = grupos.map(([k,ps]) => {
    const p = ps[0], ultimo = ps.every(x => x.ultimoCaso);
    const temIndisponivel = ps.some(x => x.indisponivel);
    return `<article class="record-item tool-group">
      <div class="tool-top"><div><strong>${nomeCategoria(p.categoria)} · ${formatar(p.medida)} cm</strong>
      ${temIndisponivel ? '<div class="record-meta">Em uso ou indisponível</div>' : ''}</div>
      <button class="small-btn danger" type="button" data-excluir-ferramental="${escapar(k)}"
        aria-label="Excluir ${escapar(nomeCategoria(p.categoria))} ${formatar(p.medida)} cm">Excluir</button></div>
      <label class="radio-label preference-choice"><input type="checkbox" data-preferencia="${escapar(k)}" ${ultimo?'checked':''}>
      Usar apenas em último caso</label>
    </article>`;
  }).join('');
  // O botão Excluir remove apenas a categoria e a medida escolhidas, com confirmação.
  // Um cadastro antigo pode conter várias cópias da mesma medida; todas pertencem
  // ao mesmo item visível e só serão removidas após a confirmação.
  area.querySelectorAll('[data-excluir-ferramental]').forEach(botao => botao.addEventListener('click', () => {
    const chave = botao.dataset.excluirFerramental;
    const grupo = gruposPecas('TODOS').find(([k]) => k === chave)?.[1];
    if (!grupo?.length) return;
    const p = grupo[0];
    const descricao = `${nomeCategoria(p.categoria)} · ${formatar(p.medida)} cm`;
    if (!window.confirm(`Excluir ${descricao} do cadastro?\n\nEssa ação remove esta medida das sugestões futuras, mas mantém o histórico de montagens já salvas.`)) return;
    excluidosTemporarios.delete(chave);
    salvarPecas(lerLista(CHAVES.pecas).filter(item => chaveGrupo(normalizarPeca(item)) !== chave));
    $('mensagemFerramental').textContent = `${descricao} excluído do cadastro.`;
  }));
  area.querySelectorAll('[data-preferencia]').forEach(input => input.addEventListener('change', () => {
    const pecas = lerLista(CHAVES.pecas);
    pecas.forEach(p => { if (chaveGrupo(normalizarPeca(p)) === input.dataset.preferencia) p.ultimoCaso = input.checked; });
    salvarPecas(pecas);
  }));
}

/* EXCLUSÃO TEMPORÁRIA: X por medida, nunca por quantidade física */
function atualizarDisponibilidade() {
  const area=$('listaDisponibilidade'); if(!area) return;
  const grupos=gruposPecas($('filtroIndisponivel').value,$('buscaIndisponivel').value.trim());
  area.innerHTML=grupos.length?grupos.map(([k,ps])=>{
    const excluido=excluidosTemporarios.has(k);
    return `<div class="availability-item"><span class="availability-description"><strong>${escapar(nomeCategoria(ps[0].categoria))} · ${formatar(ps[0].medida)} cm</strong></span>
      <button class="small-btn botao-exclusao ${excluido?'excluido':''}" type="button" data-alternar-x="${escapar(k)}" aria-pressed="${excluido}" aria-label="${excluido?'Voltar a usar':'Não utilizar'} ${escapar(nomeCategoria(ps[0].categoria))} ${formatar(ps[0].medida)}">${excluido?'↶ Voltar a usar':'× Não usar'}</button></div>`;
  }).join(''):'<p class="empty">Nenhum ferramental encontrado.</p>';
  area.querySelectorAll('[data-alternar-x]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.alternarX;
    if(excluidosTemporarios.has(k)) excluidosTemporarios.delete(k); else excluidosTemporarios.set(k,true);
    atualizarDisponibilidade(); gerarCombinacoes();
  }));
}
$('buscaIndisponivel')?.addEventListener('input',atualizarDisponibilidade);
$('filtroIndisponivel')?.addEventListener('change',atualizarDisponibilidade);
$('recalcular')?.addEventListener('click',gerarCombinacoes);

/* MOTOR: medidas independentes; quantidades não restringem SUGESTÕES */
function contarMedidasDiferentes(lista) { return new Set(lista.map(p=>inteiro(p.medida))).size; }
function pontuacaoOpcao(o) { return [o.pecas.filter(p=>p.ultimoCaso).length,o.pecas.length,contarMedidasDiferentes(o.pecas)]; }
function compararOpcoes(a,b) {
  const A=pontuacaoOpcao(a),B=pontuacaoOpcao(b);
  for(let i=0;i<A.length;i++) if(A[i]!==B[i]) return A[i]-B[i];
  return (a.reducao||0)-(b.reducao||0);
}
function medidasParaBusca(categoria) {
  const grupos=new Map();
  obterPecas(categoria).forEach(p=>{
    const chave=chaveGrupo(p);
    if(excluidosTemporarios.has(chave))return;
    const ant=grupos.get(chave);
    if(!ant || (ant.ultimoCaso && !p.ultimoCaso)) grupos.set(chave,p);
  });
  return [...grupos.values()];
}
function enumerarCombinacoes(pecas,alvo,limite=48) {
  if(!Number.isFinite(alvo)||alvo<=0||!pecas.length)return {opcoes:[],limitado:false};
  const alvoInt=inteiro(alvo);
  const itens=pecas.map(p=>({valor:inteiro(p.medida),p})).filter(x=>x.valor>0&&x.valor<=alvoInt).sort((a,b)=>b.valor-a.valor);
  if(!itens.length)return {opcoes:[],limitado:false};
  const minV=itens[itens.length-1].valor,maxV=itens[0].valor;
  const minimo=Math.ceil(alvoInt/maxV);
  // Sem limite físico por estoque; limite computacional evita travar no celular.
  const maximo=Math.min(22,Math.floor(alvoInt/minV));
  const escolhas=[];let visitados=0,limitado=false;
  const resultados=[];
  for(let qtd=minimo;qtd<=maximo;qtd++){
    const coletados=[];
    function dfs(i,pecasRestantes,medidaRestante){
      if(resultados.length>=limite||visitados++>140000){limitado=true;return;}
      if(!pecasRestantes){
        if(!medidaRestante){
          const lista=coletados.map(j=>itens[j].p);
          resultados.push({pecas:lista,soma:arred(alvo),alvo:arred(alvo),quantidade:lista.length});
        }
        return;
      }
      if(i>=itens.length||medidaRestante<=0)return;
      if(pecasRestantes*itens[i].valor<medidaRestante)return;
      if(pecasRestantes*minV>medidaRestante)return;
      const maxN=Math.min(pecasRestantes,Math.floor(medidaRestante/itens[i].valor));
      for(let n=maxN;n>=0;n--){
        for(let j=0;j<n;j++)coletados.push(i);
        dfs(i+1,pecasRestantes-n,medidaRestante-n*itens[i].valor);
        for(let j=0;j<n;j++)coletados.pop();
        if(limitado)break;
      }
    }
    dfs(0,qtd,alvoInt);
    if(limitado)break;
  }
  resultados.sort(compararOpcoes);
  return {opcoes:resultados,limitado};
}
function encontrarCombinacoes(categoria,alvo){
  const pecas=medidasParaBusca(categoria);
  if(categoria==='ANEL'){
    const preferenciais=enumerarCombinacoes(pecas.filter(p=>!p.ultimoCaso),alvo);
    if(preferenciais.opcoes.length)return preferenciais;
  }
  return enumerarCombinacoes(pecas,alvo);
}
const textoCombinacao=o=>o.pecas.map(p=>`${formatar(p.medida)} cm`).join(' + ');
const chaveOpcao=o=>o?.pecas.map(p=>inteiro(p.medida)).sort((a,b)=>a-b).join('|')||'';
const resultadosPorGrupo={cortes:[],contra:[]};
const selecoesPorGrupo=new Map();
let filtroReducaoContra='TODAS';
function objetivosMontagem(){
  if(!montagemAtual)return [];
  const m=montagemAtual;
  const larguras=m.largurasTiras.length?m.largurasTiras:[{largura:m.largura,quantidade:m.totalTiras}];
  return larguras.map((t,i)=>({
    nome:`Tira ${i+1}`,largura:t.largura,
    cortes:[{id:`corte-${i}`,titulo:`Tira ${i+1} · Corte`,alvo:t.largura}],
    contras:[
      {id:`contra-${i}-1`,titulo:`Tira ${i+1} · Contra-corte 1`,alvo:calcularContracorte(t.largura,m.faca1,m.folga)},
      ...(m.qtdFacas===2?[{id:`contra-${i}-2`,titulo:`Tira ${i+1} · Contra-corte 2`,alvo:calcularContracorte(t.largura,m.faca2,m.folga)}]:[])
    ]
  }));
}
function prepararGrupo(base){
  const aneis=encontrarCombinacoes('ANEL',base.alvo);
  const impulsores=[.10,.15,.20].flatMap(reducao=>{
    const alvo=arred(base.alvo-reducao);
    if(alvo<=0)return [];
    return encontrarCombinacoes('IMPULSOR',alvo).opcoes.map(o=>({...o,reducao,alvo}));
  }).sort(compararOpcoes);
  return {...base,aneis:aneis.opcoes,impulsores,limitado:aneis.limitado};
}
function selecionadaGrupo(grupo,tipo,visiveis){
  const chave=`${grupo.id}|${tipo}`;
  const id=selecoesPorGrupo.get(chave);
  return visiveis.find(o=>chaveOpcao(o)+(o.reducao||'')===id)||visiveis[0]||null;
}
function cardOpcao(op,i,identificador,selecionada){
  return `<button class="option-card option-button ${selecionada?'recommended':''}" data-escolher-grupo="${escapar(identificador)}" data-indice="${i}" type="button" aria-pressed="${selecionada}">
    <div class="option-title"><strong>${selecionada?'✓ Melhor opção · ':'Opção '+(i+1)+' · '}${op.pecas.length} peça(s)</strong>
    ${op.reducao?`<span class="badge">Redução ${formatar(op.reducao)} cm</span>`:''}</div>
    <div class="option-pieces">${escapar(textoCombinacao(op))}</div>
    <p>Soma: ${formatar(op.soma)} cm${op.pecas.some(p=>p.ultimoCaso)?' · Último caso':''}</p></button>`;
}
function desenharLista(grupos,tipo,filtro='TODAS'){
  return grupos.map(grupo=>{
    const lista=(tipo==='anel'?grupo.aneis:grupo.impulsores)
      .filter(o=>tipo==='anel'||filtro==='TODAS'||igualdade(o.reducao,numero(filtro)));
    const selecionada=selecionadaGrupo(grupo,tipo,lista);
    const itens=lista.length?lista.slice(0,35).map((o,i)=>cardOpcao(o,i,`${grupo.id}|${tipo}`,chaveOpcao(o)+(o.reducao||'')===chaveOpcao(selecionada)+(selecionada?.reducao||''))).join(''):
      '<div class="notice warning">Nenhuma combinação exata encontrada para esta medida.</div>';
    return `<section class="grupo-combinacao" data-grupo="${escapar(grupo.id)}"><div class="cabecalho-combinacao"><strong>${escapar(grupo.titulo)}</strong><span>Soma: ${formatar(grupo.alvo)} cm</span></div>
      <div class="opcoes-grupo">${itens}</div></section>`;
  }).join('');
}
function ligarSelecoes(raiz,grupos,tipo,filtro){
  raiz.querySelectorAll('[data-escolher-grupo]').forEach(b=>b.addEventListener('click',()=>{
    const ident=b.dataset.escolherGrupo;
    const grupo=grupos.find(g=>`${g.id}|${tipo}`===ident);if(!grupo)return;
    const lista=(tipo==='anel'?grupo.aneis:grupo.impulsores).filter(o=>tipo==='anel'||filtro==='TODAS'||igualdade(o.reducao,numero(filtro)));
    const op=lista[Number(b.dataset.indice)];if(!op)return;
    selecoesPorGrupo.set(ident,chaveOpcao(op)+(op.reducao||''));
    renderizarTodosGrupos();preencherEscolhas();
  }));
}
function renderizarTodosGrupos(){
  const areaA=$('opcoesAneis'),areaI=$('opcoesImpulsores'),areaC=$('opcoesContracortes');
  if(areaA){areaA.innerHTML=desenharLista(resultadosPorGrupo.cortes,'anel');ligarSelecoes(areaA,resultadosPorGrupo.cortes,'anel','TODAS');}
  if(areaI){areaI.innerHTML=desenharLista(resultadosPorGrupo.cortes,'impulsor',filtroReducao);ligarSelecoes(areaI,resultadosPorGrupo.cortes,'impulsor',filtroReducao);}
  if(areaC){
    areaC.innerHTML=resultadosPorGrupo.contra.map(g=>`<section class="bloco-contra"><h3>${escapar(g.titulo)} — ${formatar(g.alvo)} cm</h3>
      <div class="grade-contra"><div><h4>Anéis</h4>${desenharLista([g],'anel')}</div><div><h4>Impulsores</h4>${desenharLista([g],'impulsor',filtroReducaoContra)}</div></div></section>`).join('');
    ligarSelecoes(areaC,resultadosPorGrupo.contra,'anel','TODAS');ligarSelecoes(areaC,resultadosPorGrupo.contra,'impulsor',filtroReducaoContra);
  }
}
function textoSelecoes(grupos,tipo){
  return grupos.map(g=>{
    const lista=tipo==='anel'?g.aneis:g.impulsores;
    const o=selecionadaGrupo(g,tipo,lista);
    return `${g.titulo} (${formatar(g.alvo)} cm): ${o?textoCombinacao(o)+(o.reducao?' · redução '+formatar(o.reducao)+' cm':''):'Sem combinação exata'}`;
  }).join('\n');
}
function preencherEscolhas(){
  const cortes=resultadosPorGrupo.cortes,contras=resultadosPorGrupo.contra;
  const aneis=textoSelecoes(cortes,'anel'),impulsores=textoSelecoes(cortes,'impulsor');
  if($('aneisEscolhidos'))$('aneisEscolhidos').value=aneis;
  if($('impulsoresEscolhidos'))$('impulsoresEscolhidos').value=impulsores;
  if($('aneisCantoInferiorEscolhidos'))$('aneisCantoInferiorEscolhidos').value=selecionadaInferior?textoCombinacao(selecionadaInferior):'';
  if($('fichaAneis'))$('fichaAneis').textContent=aneis;
  if($('fichaImpulsores'))$('fichaImpulsores').textContent=impulsores;
  if($('fichaInferior'))$('fichaInferior').textContent=selecionadaInferior?textoCombinacao(selecionadaInferior):'Sem combinação exata';
  if($('fichaContracortes'))$('fichaContracortes').textContent=textoSelecoes(contras,'anel')+' | '+textoSelecoes(contras,'impulsor');
  const primeira=cortes[0];selecionadaTopo=primeira?selecionadaGrupo(primeira,'anel',primeira.aneis):null;
  selecionadaImpulsor=primeira?selecionadaGrupo(primeira,'impulsor',primeira.impulsores):null;
  if($('reducaoEscolhida'))$('reducaoEscolhida').value=selecionadaImpulsor?String(selecionadaImpulsor.reducao):'';
}
function renderizarOpcoesAneis(tipo){
  if(tipo!=='inferior')return;
  const area=$('opcoesAneisCantoInferior');if(!area)return;
  const lista=opcoesInferior;
  area.innerHTML=lista.length?lista.slice(0,35).map((o,i)=>cardOpcao(o,i,'inferior',chaveOpcao(o)===chaveOpcao(selecionadaInferior))).join(''):
    '<div class="notice warning">Nenhuma combinação exata para o canto inferior.</div>';
  area.querySelectorAll('[data-escolher-grupo]').forEach(b=>b.addEventListener('click',()=>{
    selecionadaInferior=lista[Number(b.dataset.indice)];renderizarOpcoesAneis('inferior');preencherEscolhas();
  }));
}
function refazerInferior(){
  // O operador confere a disponibilidade física: não subtrair peças usadas em outras sugestões.
  const resultado=encontrarCombinacoes('ANEL',montagemAtual.cantoInferior);
  opcoesInferior=resultado.opcoes;selecionadaInferior=opcoesInferior[0]||null;
  renderizarOpcoesAneis('inferior');
}
document.querySelectorAll('[data-reducao]').forEach(b=>b.addEventListener('click',()=>{
  filtroReducao=b.dataset.reducao;
  document.querySelectorAll('[data-reducao]').forEach(item=>item.classList.toggle('selected',item===b));
  renderizarTodosGrupos();preencherEscolhas();
}));
document.querySelectorAll('[data-reducao-contra]').forEach(b=>b.addEventListener('click',()=>{
  filtroReducaoContra=b.dataset.reducaoContra;
  document.querySelectorAll('[data-reducao-contra]').forEach(item=>item.classList.toggle('selected',item===b));
  renderizarTodosGrupos();preencherEscolhas();
}));
function gerarCombinacoes(){
  if(!montagemAtual)return;
  selecoesPorGrupo.clear();
  const objetivos=objetivosMontagem();
  // NUNCA transformar a soma das larguras em alvo de busca.
  resultadosPorGrupo.cortes=objetivos.flatMap(t=>t.cortes).map(prepararGrupo);
  resultadosPorGrupo.contra=objetivos.flatMap(t=>t.contras).filter(c=>c.alvo>0).map(prepararGrupo);
  refazerInferior();renderizarTodosGrupos();preencherEscolhas();
}

/* DADOS DA MONTAGEM, RESUMO E CÁLCULOS */
function lerMontagem() {
  const cliente=$('cliente').value.trim();
  const larguraInformada=$('largura').value.trim() ? numero($('largura').value) : null;
  const largurasTiras=lerTiras();
  const larguraTotalTiras=arred(largurasTiras.reduce((s,t)=>s+t.largura*t.quantidade,0));
  // Sem largura principal, a soma das tiras é usada para buscar os ferramentais.
  const largura=larguraInformada===null ? larguraTotalTiras : larguraInformada;
  const larguraRolo=$('larguraRolo').value.trim() ? numero($('larguraRolo').value) : null;
  const espessura=numero($('espessura').value);
  const folga=obterFolga(espessura,$('folgaManual').value);
  const cabecote=$('cabecote').value;
  const faca1=numero($('facaSuperior').value);
  const qtdFacas=Number(document.querySelector('input[name="qtdFacas"]:checked')?.value || 1);
  const faca2=qtdFacas===2 ? numero($('facaInferior').value) : null;
  const anel=numero($('canto').value);
  if(!cliente) throw new Error('Informe o cliente ou etapa.');
  if(!Number.isFinite(largura)||largura<=0) throw new Error('Informe uma largura solicitada ou ao menos uma largura de tira válida.');
  if(larguraRolo!==null && (!Number.isFinite(larguraRolo)||larguraRolo<=0)) throw new Error('Informe a largura do rolo corretamente.');
  if(!Number.isFinite(espessura)||espessura<=0||folga===null) throw new Error('Espessura sem folga definida. Verifique a tabela ou selecione 0,30/0,35 para espessura 1,00.');
  if(!['Grande','Pequeno'].includes(cabecote)) throw new Error('Selecione o cabeçote.');
  if(!Number.isFinite(faca1)||faca1<=0) throw new Error('Informe a medida numérica da faca 1.');
  if(qtdFacas===2 && (!Number.isFinite(faca2)||faca2<=0)) throw new Error('Informe a medida numérica da faca 2.');
  if(!Number.isFinite(anel)||anel<=0) throw new Error('Informe a medida do anel para cálculo do canto.');
  const totalTiras=largurasTiras.length ? largurasTiras.reduce((s,t)=>s+t.quantidade,0)
    : larguraRolo!==null ? Math.floor((larguraRolo*10000+0.0001)/(largura*10000)) : null;
  const cantoSuperior=calcularCanto(anel,folga,cabecote);
  const cantoInferior=calcularInferior(cantoSuperior,folga,faca1);
  return { id:novoId(),data:new Date().toISOString(),cliente,largura,larguraInformada,larguraRolo,espessura,folga,
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
    filtroReducaoContra='TODAS';
    document.querySelectorAll('[data-reducao-contra]').forEach(b=>b.classList.toggle('selected',b.dataset.reducaoContra==='TODAS'));
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
    ['Cliente',m.cliente],['Largura solicitada',m.larguraInformada===null?'Não informada (calculada pelas tiras)':formatar(m.largura)+' cm'],
    ['Largura do rolo recebido',m.larguraRolo===null?'Não informada':formatar(m.larguraRolo)+' cm'],
    ['Total de tiras',m.largurasTiras.length ? String(m.totalTiras) : (m.larguraRolo===null?'Não informado':String(Math.floor((m.larguraRolo*10000+0.0001)/(m.largura*10000))))],
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
  // Exibir somente medidas finais; sem fórmulas nos cartões.
  const campoCalculo=(rotulo,valor,unidade=' cm')=>
    `<div class="metric"><small>${escapar(rotulo)}</small><strong>${formatar(valor)}${unidade}</strong></div>`;
  const tiras=m.largurasTiras.length ? m.largurasTiras : [{largura:m.largura,quantidade:m.totalTiras??null}];
  const resultados=tiras.map(t=>({
    ...t,cc1:calcularContracorte(t.largura,m.faca1,m.folga),
    cc2:m.qtdFacas===2?calcularContracorte(t.largura,m.faca2,m.folga):null
  }));
  $('metricasResultado').classList.add('calculos-por-largura');
  $('metricasResultado').classList.toggle('uma-faca',m.qtdFacas!==2);
  $('metricasResultado').innerHTML=resultados.map((t,i)=>`
    <section class="grupo-largura-calculo" aria-label="Cálculos da tira ${i+1}">
      <h3>Tira ${i+1}</h3>
      <div class="linha-calculos-tira">
        <div class="calculo-extremo">${campoCalculo('Largura',t.largura)}</div>
        <div class="calculo-coluna">
          ${campoCalculo('Faca 1',m.faca1)}
          ${m.qtdFacas===2?campoCalculo('Faca 2',m.faca2):''}
        </div>
        <div class="calculo-coluna">
          ${campoCalculo('Contra-corte 1',t.cc1)}
          ${m.qtdFacas===2?campoCalculo('Contra-corte 2',t.cc2):''}
        </div>
        <div class="calculo-extremo">${t.quantidade===null?'<div class="metric"><small>Total de tiras</small><strong>Não informado</strong></div>':campoCalculo('Total de tiras',t.quantidade,'')}</div>
      </div>
    </section>`).join('');
  const avisos=[];
  if(m.cantoInferior<=0) avisos.push('Canto inferior não positivo: confira os valores antes de montar.');
  if(resultados.some(t=>t.cc1<=0 || (m.qtdFacas===2&&t.cc2<=0))) avisos.push('Contra-corte não positivo em uma ou mais larguras: confira as facas.');
  const capacidade=m.cabecote==='Grande'?570:270;
  if(m.largura>capacidade+0.000001) avisos.push(`Largura solicitada maior que a capacidade do cabeçote (${capacidade} cm).`);
  if(m.largurasTiras.length && m.larguraTotalTiras>capacidade+0.000001) avisos.push('Soma das larguras diferentes excede a capacidade do cabeçote.');
  if(m.largurasTiras.length && m.larguraInformada!==null && !igualdade(m.largura,m.larguraTotalTiras)) avisos.push(`As larguras diferentes somam ${formatar(m.larguraTotalTiras)} cm, diferente da largura solicitada de ${formatar(m.largura)} cm. Confira.`);
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
    combinacoesContracortes: $('fichaContracortes')?.textContent || '',
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
    ${m.combinacoesContracortes?`<div class="record-meta">Contra-cortes: ${escapar(m.combinacoesContracortes)}</div>`:''}
    ${m.observacoes?`<div class="record-meta">Observações: ${escapar(m.observacoes)}</div>`:''}
    ${m.observacaoResultado?`<div class="record-meta">Escolha: ${escapar(m.observacaoResultado)}</div>`:''}
    <div class="record-actions"><button class="small-btn" data-reutilizar="${escapar(m.id||'')}" type="button">Reutilizar montagem</button>
    <button class="small-btn danger" data-apagar="${escapar(m.id||'')}" type="button">Excluir registro</button></div>
  </article>`).join('');
  area.querySelectorAll('[data-reutilizar]').forEach(b=>b.addEventListener('click',()=>{
    const m=lerLista(CHAVES.montagens).find(x=>String(x.id)===b.dataset.reutilizar);
    if(!m)return;
    $('cliente').value=m.cliente||'';
    $('largura').value=m.larguraInformada===null?'':(m.largura??'');
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
  atualizarListaFacas(); atualizarFerramentais(); atualizarDisponibilidade();
  atualizarHistorico(); atualizarUltimasMontagens();
}
iniciarSistema();
