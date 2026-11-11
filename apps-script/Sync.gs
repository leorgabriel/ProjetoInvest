/**
 * Sync.gs — recebe lançamentos novos (à vista/parcelado) do ProjetoInvest via pg_cron a cada 3h.
 * Reaproveita salvarLancamento() do codigo.gs: mesma gravação, mesma validação, mesmo Log.
 */
function doPost(e) {
  const resp = { ok: false, resultados: [] };
  try {
    const body = JSON.parse(e.postData.contents);
    const tokenEsperado = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
    if (!tokenEsperado || body.token !== tokenEsperado) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: 'Token inválido.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    (body.itens || []).forEach(item => {
      try {
        item.origemSync = true;
        const r = salvarLancamento(item);
        resp.resultados.push({ ok: true, descricao: item.descricao, mensagem: r.mensagem });
      } catch (err) {
        resp.resultados.push({ ok: false, descricao: item.descricao, erro: err.message });
      }
    });

    resp.ok = true;
  } catch (err) {
    resp.erro = err.message;
  }
  return ContentService.createTextOutput(JSON.stringify(resp)).setMimeType(ContentService.MimeType.JSON);
}
