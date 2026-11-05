import { GATE_SCHEMA, gateMetadata, metadataBytes, metadataDigest, fundingSummary, assessArrival } from './gates.mjs';
const $ = id => document.getElementById(id);

export function createPinning({ map, getPosition }) {
  let reviewed = null, selected = null, timer = null, generation = 0;
  const form = $('pin-form');
  const status = text => { $('pin-status').textContent = text; };
  function invalidate() {
    generation++;
    reviewed = null; $('export-gate').disabled = true; $('gate-review').textContent = '';
    selected = null; updateArrival();
  }
  function pick(point) {
    form.elements.latitude.value = point.latitude; form.elements.longitude.value = point.longitude;
    invalidate();
    map.pin(point, Number(form.elements.radius.value) || 30);
    status('Pin positioned. Check access permission, gate size and the basket before reviewing. Nothing is funded or published.');
  }
  function updateArrival() {
    clearTimeout(timer);
    const position = getPosition();
    const result = selected && selected.expiresAt * 1000 <= Date.now() ? { state: 'expired', message: 'This draft gate has expired. Review new terms before rehearsing a visit.' }
      : selected ? assessArrival(position, { ...selected.gate }, Date.now()) : { state: 'unconfigured', message: 'Review a local gate draft to rehearse its arrival check. No real verification service is configured.' };
    $('arrival-state').textContent = result.message;
    $('visit-video').disabled = result.state !== 'inside' || selected?.gate.verification !== 'video';
    $('visit-knowledge').disabled = result.state !== 'inside' || selected?.gate.verification !== 'knowledge';
    $('visit-result').textContent = '';
    const remaining = selected && position ? Math.min(position.timestamp + 60001, selected.expiresAt * 1000) - Date.now() : 0;
    if (Number.isFinite(remaining) && remaining > 0) timer = setTimeout(updateArrival, remaining);
  }
  form.addEventListener('input', invalidate);
  form.addEventListener('submit', async event => {
    event.preventDefault(); invalidate(); const revision = generation;
    try {
      const fields = Object.fromEntries(new FormData(form));
      const metadata = gateMetadata({ schema: GATE_SCHEMA, status: 'unfunded-draft', name: fields.name, description: fields.description,
        gate: { latitude: fields.latitude, longitude: fields.longitude, radius: Number(fields.radius), verification: fields.verification, prompt: fields.prompt },
        mode: fields.mode, participants: fields.participants.split(/[\s,]+/).filter(Boolean), verifier: fields.verifier,
        expiresAt: Math.floor(new Date(fields.expiresAt).getTime() / 1000),
        basket: [{ address: fields.token, symbol: fields.symbol, decimals: Number(fields.decimals), amount: fields.amount }] });
      const hash = await metadataDigest(metadata);
      if (generation !== revision) return;
      reviewed = metadata; selected = metadata;
      const summary = fundingSummary(metadata)[0];
      $('gate-review').textContent = `${metadata.name} · ${metadata.mode === 'per-participant' ? `${metadata.participants.length} people, one basket each` : 'one basket, first eligible collector'}\n${summary.totalUnits} raw ${summary.symbol} units required in escrow.\nSHA-256 ${hash}\nUnfunded, unminted local draft. Publishing would expose the stop coordinates and wallet allowlist.`;
      $('export-gate').disabled = false;
      map.pin(metadata.gate, metadata.gate.radius); updateArrival();
      status('Draft reviewed. Export saves the exact metadata bytes locally; it does not mint, fund or promise a collection.');
    } catch (error) { status(error.message); }
  });
  $('export-gate').addEventListener('click', () => {
    if (!reviewed) { status('Review the gate before exporting.'); return; }
    const url = URL.createObjectURL(new Blob([metadataBytes(reviewed)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pilgrimage-gate-v2-draft.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Exact reviewed metadata exported locally. No mint, IPFS upload, escrow deposit or verification occurred.');
  });
  $('import-gate').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    invalidate(); const revision = generation;
    try {
      if (file.size > 32000) throw new Error('Gate draft exceeds the 32 KB recovery limit.');
      const metadata = gateMetadata(JSON.parse(await file.text()));
      if (revision !== generation) return;
      const asset = metadata.basket[0];
      if (metadata.basket.length !== 1) throw new Error('This desk edits one asset per basket. Multi-asset drafts need the reviewed contract tooling; no assets were discarded.');
      const date = new Date(metadata.expiresAt * 1000);
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const values = { name: metadata.name, description: metadata.description, ...metadata.gate, mode: metadata.mode,
        participants: metadata.participants.join(', '), verifier: metadata.verifier, expiresAt: localDate,
        token: asset.address, symbol: asset.symbol, decimals: String(asset.decimals), amount: asset.amount };
      for (const [name, value] of Object.entries(values)) form.elements[name].value = String(value);
      form.elements.consent.checked = false;
      map.pin(metadata.gate, metadata.gate.radius);
      status('Draft recovered for editing. Confirm access/privacy and review again. Recovery cannot restore funding, minting, whitelist rights or a visit authorization.');
    } catch (error) { status(`Gate recovery refused: ${error.message}`); }
    finally { event.target.value = ''; }
  });
  $('pin-at-location').addEventListener('click', () => {
    const position = getPosition();
    if (!position || !Number.isFinite(position.timestamp) || Date.now() < position.timestamp || Date.now() - position.timestamp > 60000 ||
        !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) { status('Request a fresh location first, or choose coordinates on the map.'); return; }
    pick({ latitude: position.latitude.toFixed(6), longitude: position.longitude.toFixed(6) });
  });
  for (const [id, method] of [['visit-video', 'video'], ['visit-knowledge', 'knowledge']]) {
    $(id).addEventListener('click', () => {
      const result = selected && selected.expiresAt * 1000 > Date.now() && assessArrival(getPosition(), selected.gate);
      if (result?.state !== 'inside' || selected.gate.verification !== method) { updateArrival(); return; }
      $('visit-result').textContent = method === 'video'
        ? 'Video check-in is not connected. A designated verifier must arrange the call and issue a wallet-bound authorization after review. No camera, microphone, GPS or wallet data was sent.'
        : 'Private knowledge-test service is not connected. The verifier must serve and grade a bounded challenge server-side, then issue a wallet-bound authorization. Answers must not be stored in public metadata. No answer or payment was accepted.';
    });
  }
  return { pick, updateArrival, dispose() { clearTimeout(timer); } };
}
