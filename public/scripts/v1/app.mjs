import { deployment as configuredDeployment, assistant, radio } from './config.mjs';
import { fixtures, tutorial, deploymentProblem, writeProblem, isNativeToken, formatTokenAmount, coordinateToMicrodegrees, emptyJournal, validateJournal, requestAdvisoryLocation, advisoryDistanceMeters, assistantRequest } from './core.mjs';
import { createPilgrimageClient } from './client.mjs';
import { createRadioController } from './radio.mjs';
import { createGeographicMap } from './map.mjs';
import { createPinning } from './pinning.mjs';
import { mountSupporterCard } from './supporter.mjs';

const $ = id => document.getElementById(id);
mountSupporterCard(document);
const deployment = { ...configuredDeployment, tokens: configuredDeployment.tokens.map(token => ({ ...token })) };
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let journal = emptyJournal(), localStorageAvailable = true, places = [...fixtures], selected = places[0], location = null;
let tourIndex = 0, tourTarget = null, tourReturn = null, busy = false, claimApproval = null, assistantBusy = false;
let geoRequest = 0;
let geographicMap = null, pinning = null;
try {
  geographicMap = createGeographicMap($('map'), { onSelect: place => { selectPlace(place); geographicMap.focus(place); }, onPin: point => pinning.pick(point) });
  pinning = createPinning({ map: geographicMap, getPosition: () => location });
} catch (error) { $('map-status').textContent = error.message; $('pin-form').querySelector('fieldset').disabled = true; }
$('map-tiles').addEventListener('change', event => {
  if (!geographicMap) { $('map-status').textContent = 'Local map is unavailable. Reload to retry.'; return; }
  geographicMap.setTiles(event.target.checked, () => { $('map-status').textContent = 'Some map tiles are unavailable. Pins and gate circles remain usable; retry by toggling the basemap.'; });
  $('map-status').textContent = event.target.checked ? 'OpenStreetMap enabled. Its tile server receives your IP and viewed map area. No route or GPS coordinates are explicitly uploaded.' : 'Basemap off. Geographic pins and gate circles remain local; no new tile requests.';
});
try { const stored = localStorage.getItem('decentpilgrimages:journal:v1'); if (stored) journal = validateJournal(JSON.parse(stored)); }
catch { localStorageAvailable = false; }

function openDialog(id) { const dialog = $(id); if (!dialog.open) dialog.showModal(); }
function closeDialog(dialog) { dialog.close(); if (dialog.id === 'tour-dialog') endTour(); }
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
});
function notice(text) { $('notice').textContent = text; }
function saveJournal() {
  try { localStorage.setItem('decentpilgrimages:journal:v1', JSON.stringify(validateJournal(journal))); localStorageAvailable = true; }
  catch { localStorageAvailable = false; notice('Browser storage unavailable. Journal is memory-only; export it before leaving.'); }
  updateProfile();
}
function updateProfile() {
  $('nickname').value = journal.nickname;
  $('profile-state').textContent = `${journal.savedTrailIds.length} saved trails · ${journal.tutorialComplete ? 'Tutorial complete (no reward)' : 'Tutorial not completed'} · ${localStorageAvailable ? 'Stored only in this browser' : 'Memory-only; export to keep it'}`;
}
function exportProfile() {
  const blob = new Blob([JSON.stringify(validateJournal(journal), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'decentpilgrimages-journal-v1.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice('Journal exported locally. It contains no GPS or wallet credentials.');
}

window.DECENT_CONFIG = {
  version: '2.0.0', appName: 'DecentPilgrimages', subtitle: 'Your trail. Your agency.',
  providerLabel: 'unconfigured · local files only', ipfsControlsMode: 'host-only',
  ens: { enabled: false },
  chain: { chainId: 8453, chainName: 'Base', rpcUrls: ['https://mainnet.base.org'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://basescan.org'] },
  art: { titleEnds: ['', ''] },
  theme: { 'bg-1': '#101c1b', 'bg-2': '#162b28', 'bg-3': '#243c32', accent: '#afd8b5', 'accent-2': '#e9c477', title: '#e9c477', text: '#eef3e8', muted: '#b4c3b5' },
  about: { title: 'About DecentPilgrimages', summary: 'Sponsor a traveler. Place tokens along their journey. Collect at places of pilgrimage.', sections: [] },
  links: [{ label: 'Source & reuse provenance', url: 'https://github.com/TheJollyLaMa/DecentPilgrimages' }, { label: 'Help & experience team (#3)', url: 'https://github.com/TheJollyLaMa/DecentPilgrimages/issues/3' }],
  relatedDapps: [{ label: 'DecentCanopy', url: 'https://github.com/TheJollyLaMa/DecentCanopy' }, { label: 'DBuskRadio', url: 'https://github.com/A-Decent-Agency/DBuskRadio' }],
  ipfsAdapter: { version: 1, label: 'DecentPilgrimages journal',
    getStatus: async () => ({ backup: { state: 'idle', detail: 'Local journal export/recovery only. No IPFS upload or pinning service is configured; nothing is published.' } }),
    capabilities: { backup: { open: async () => { updateProfile(); openDialog('profile-dialog'); } } } },
};
const { DecentHead } = await import('../../vendor/decent-head/2.0.0/js/main.js');
const { loadEthers } = await import('../../vendor/decent-head/2.0.0/js/wallet.js');
const wallet = DecentHead.getWallet();
const getSession = () => wallet.snapshot();
const client = createPilgrimageClient(deployment, { getSession, loadEthers,
  onSubmitted: hash => { $('write-status').textContent = `Submitted ${hash}. Awaiting two Base confirmations; not yet a confirmed success.`; $('claim-status').textContent = $('write-status').textContent; } });
const radioController = createRadioController($('radio-widget'), radio, { head: DecentHead });

function updateGates() {
  const session = getSession(), state = client.state(), problem = writeProblem(deployment, session, state.verified);
  $('refresh-chain').disabled = busy || Boolean(deploymentProblem(deployment)) || !session.connected || Number(session.chainId) !== 8453;
  $('deployment-state').textContent = problem || `Verified Base deployment ${deployment.address}. ${places.filter(place => !place.demo).length} organizer locations read. Read-only approval is not payment.`;
  $('organizer-state').textContent = problem || (state.organizer ? `Verified owner: ${session.address}. Organizer actions available. ${state.sponsor ? 'Sponsor funding is allowlisted.' : 'Funding locked: explicitly allowlist your own address before funding.'}` : state.sponsor ? `Allowlisted sponsor: ${session.address}. Funding available; organizer writes remain locked.` : 'This wallet is not an owner or allowlisted sponsor. Ask the organizer privately; this menu grants no access.');
  document.querySelectorAll('[data-owner]').forEach(button => { button.disabled = busy || Boolean(problem) || !state.organizer; });
  document.querySelectorAll('#sponsor-form button').forEach(button => { button.disabled = busy || Boolean(problem) || !state.sponsor || !deployment.tokens.length; });
  const sponsorToken = deployment.tokens.find(token => token.address === $('sponsor-token').value);
  const allowance = document.querySelector('#sponsor-form [data-action="approve-token"]');
  allowance.disabled ||= isNativeToken(sponsorToken);
  allowance.textContent = isNativeToken(sponsorToken) ? 'Native ETH · no allowance needed' : 'Approve exact ERC20 allowance';
  $('inspect-token').disabled = busy || Boolean(problem);
  $('check-claim').disabled = busy || Boolean(problem) || selected.demo || !deployment.tokens.length;
  $('claim-reward').disabled = busy || Boolean(problem) || selected.demo || !claimApproval?.eligible;
}
function renderPlaces() {
  $('trail-list').replaceChildren();
  for (const place of places) {
    const card = document.createElement('button');
    card.className = 'trail-card'; card.type = 'button'; card.setAttribute('aria-pressed', String(place.id === selected.id));
    const kind = document.createElement('span'); kind.textContent = place.demo ? 'DEMONSTRATION · NO REWARD' : `BASE LOCATION ${place.id}${place.active ? '' : ' · INACTIVE'}`;
    const title = document.createElement('strong'); title.textContent = place.name;
    const theme = document.createElement('span'); theme.textContent = place.theme;
    card.append(kind, title, theme); card.addEventListener('click', () => { selectPlace(place); geographicMap?.focus(place); }); $('trail-list').append(card);
  }
  geographicMap?.render(places, selected);
}
function selectPlace(place) {
  selected = place; claimApproval = null;
  $('detail-kind').textContent = place.demo ? 'DEMONSTRATION · NO PAYMENT' : `BASE LOCATION ${place.id} · ORGANIZER REVIEW`;
  $('detail-title').textContent = place.name; $('detail-mission').textContent = place.mission;
  $('detail-meta').replaceChildren();
  for (const [key, value] of [['Coordinates', `${place.latitude}, ${place.longitude}`], ['Advisory radius', `${place.radius} m`], ['Status', place.demo ? 'Example, no contract' : place.active ? 'Active on-chain' : 'Inactive on-chain']]) {
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value; $('detail-meta').append(dt, dd);
  }
  $('save-trail').textContent = journal.savedTrailIds.includes(place.id) ? 'Saved in local journal' : 'Save locally';
  $('claim-status').textContent = place.demo ? 'This demonstration has no on-chain reward. Saving, GPS and tutorials do not create eligibility.' : 'Use Check organizer approval to read your exact on-chain eligibility. No location evidence is sent.';
  $('claim-token-label').hidden = place.demo || !deployment.tokens.length;
  if (location) showAdvisoryDistance();
  renderPlaces(); updateGates();
}
function showAdvisoryDistance() {
  const meters = advisoryDistanceMeters(location, selected);
  const distance = meters >= 1000 ? `${Math.round(meters / 1000)} km` : `${meters} m`;
  $('geo-status').textContent = `About ${distance} from ${selected.name} (straight-line guidance, ±${Math.round(location.accuracy)} m accuracy). Memory-only; not navigation or reward eligibility.`;
  geographicMap?.location(location); pinning?.updateArrival();
}
function fillTokens() {
  document.querySelectorAll('#sponsor-token, #claim-token, .token-select').forEach(select => {
    select.replaceChildren();
    for (const token of deployment.tokens) { const option = document.createElement('option'); option.value = token.address; option.textContent = isNativeToken(token) ? 'Native ETH · 18 decimals · no ERC20 allowance' : `ERC20 ${token.symbol} · ${token.decimals} decimals · ${token.address}`; select.append(option); }
  });
}
async function refresh() {
  const previous = selected.id;
  const result = await client.read();
  places = result.locations.length ? result.locations : [...fixtures];
  selected = places.find(place => place.id === previous) || places[0];
  $('map-mode').textContent = result.locations.length ? 'Organizer locations · Base' : 'Empty Base deployment · demo map';
  selectPlace(selected);
  return result;
}
async function perform(operation, { claim = false } = {}) {
  if (busy) return;
  busy = true; claimApproval = null; updateGates();
  try {
    const receipt = await operation();
    const hash = receipt.hash || receipt.transactionHash;
    $('write-status').replaceChildren();
    const link = document.createElement('a'); link.href = `https://basescan.org/tx/${hash}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${claim ? 'ClaimPaid verified' : 'Transaction confirmed'} · ${hash}`;
    $('write-status').append(link); notice(claim ? 'Organizer-approved claim paid: exact ClaimPaid event verified after two Base confirmations.' : 'Transaction confirmed after two Base confirmations.');
    if (claim) {
      $('claim-status').textContent = `Confirmed claim receipt ${hash}.`;
      if (!reducedMotion()) { $('celebration').hidden = false; setTimeout(() => { $('celebration').hidden = true; }, 2200); }
    }
    try { await refresh(); }
    catch { notice('Confirmed receipt retained. Deployment refresh is unavailable; read it again before further actions.'); }
    if (claim) { $('claim-status').replaceChildren(document.createTextNode('Exact organizer-approved claim paid after two confirmations. '), link.cloneNode(true)); }
  } catch (error) { $('write-status').textContent = error.shortMessage || error.message || 'Action unavailable. No confirmed success was recorded.'; $('claim-status').textContent = $('write-status').textContent; }
  finally { busy = false; updateGates(); }
}
DecentHead.on('wallet', () => { client.invalidate(); claimApproval = null; updateGates(); $('claim-status').textContent = 'Wallet context changed. Explicitly read the Base deployment and recheck your approval.'; });

const header = document.querySelector('decent-header');
document.addEventListener('decenthead:about', event => {
  if (event.target !== header) return;
  event.preventDefault();
  openDialog('about-dialog');
}, { capture: true });
for (const [side, dialogId, label] of [['left', 'organizer-dialog', 'Organizer & sponsor desk'], ['right', 'profile-dialog', 'My local profile']]) {
  const ankh = header.shadowRoot.querySelector(`ankh-menu[side="${side}"]`);
  const button = ankh.shadowRoot.querySelector('button');
  button.textContent = label; button.style.cursor = 'pointer';
  button.addEventListener('click', () => { ankh.shadowRoot.querySelector('details').open = false; updateProfile(); updateGates(); openDialog(dialogId); });
}
$('open-help').addEventListener('click', () => openDialog('help-dialog'));
$('open-profile').addEventListener('click', () => { updateProfile(); openDialog('profile-dialog'); });
$('refresh-chain').addEventListener('click', async () => {
  if (busy) return; busy = true; updateGates();
  try { await refresh(); notice('Base contract state read. No transaction or location request was sent.'); }
  catch (error) { $('deployment-state').textContent = error.shortMessage || error.message; $('organizer-state').textContent = $('deployment-state').textContent; }
  finally { busy = false; updateGates(); }
});
$('save-trail').addEventListener('click', () => { if (!journal.savedTrailIds.includes(selected.id)) { if (journal.savedTrailIds.length >= 100) { notice('Your journal has reached its 100-trail limit. Export or clear it before saving more.'); return; } journal.savedTrailIds.push(selected.id); } saveJournal(); selectPlace(selected); notice('Trail saved locally. This is not registration or reward eligibility.'); });
$('request-location').addEventListener('click', async () => {
  const request = ++geoRequest;
  $('request-location').disabled = true; $('geo-status').textContent = 'Requesting optional advisory location…';
  try {
    const result = await requestAdvisoryLocation(navigator.geolocation);
    if (request !== geoRequest) return;
    location = result;
    showAdvisoryDistance();
    $('clear-location').hidden = false;
  } catch (error) { if (request === geoRequest) { location = null; geographicMap?.location(null); pinning?.updateArrival(); $('clear-location').hidden = true; $('geo-status').textContent = error.message; } }
  finally { if (request === geoRequest) $('request-location').disabled = false; }
});
$('clear-location').addEventListener('click', () => { ++geoRequest; location = null; geographicMap?.location(null); pinning?.updateArrival(); $('request-location').disabled = false; $('geo-status').textContent = 'Location cleared from this page. Participation does not require it.'; $('clear-location').hidden = true; });
window.addEventListener('pagehide', () => { ++geoRequest; location = null; pinning?.dispose(); geographicMap?.destroy(); wallet.disconnect(); });
$('profile-form').addEventListener('submit', event => { event.preventDefault(); journal.nickname = $('nickname').value; saveJournal(); });
$('export-profile').addEventListener('click', exportProfile);
$('clear-profile').addEventListener('click', () => { journal = emptyJournal(); try { localStorage.removeItem('decentpilgrimages:journal:v1'); } catch {} updateProfile(); selectPlace(selected); notice('Local journal forgotten. No wallet or claim state was changed.'); });
$('import-profile').addEventListener('change', async event => {
  const file = event.target.files[0];
  try { if (!file || file.size > 16000) throw new Error('Recovery file must be a journal smaller than 16 KB.'); journal = validateJournal(JSON.parse(await file.text())); saveJournal(); selectPlace(selected); notice('Journal recovered locally. No external request or wallet action was made.'); }
  catch (error) { $('profile-state').textContent = error.message; }
  finally { event.target.value = ''; }
});
$('claim-token').addEventListener('change', () => { claimApproval = null; $('claim-status').textContent = 'Token changed. Recheck the exact organizer approval.'; updateGates(); });
$('check-claim').addEventListener('click', async () => {
  if (busy || selected.demo) return; busy = true; updateGates();
  try {
    claimApproval = await client.eligibility(selected.id, $('claim-token').value);
    $('claim-status').textContent = claimApproval.eligible ? `Organizer-approved: ${formatTokenAmount(claimApproval.amount, claimApproval.token.decimals)} ${claimApproval.token.symbol}. Claim requires your wallet transaction and successful receipt.` :
      claimApproval.claimed ? 'Already claimed for this location and token.' : !claimApproval.active ? 'Location inactive; no claim is available.' : 'No funded organizer approval exists for this wallet, location and token. Location sharing cannot change this.';
  } catch (error) { claimApproval = null; $('claim-status').textContent = error.shortMessage || error.message; }
  finally { busy = false; updateGates(); }
});
$('claim-reward').addEventListener('click', () => { if (!selected.demo) void perform(() => client.claim(selected.id, $('claim-token').value), { claim: true }); });
$('sponsor-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget), address = $('sponsor-token').value, amount = String(form.get('amount')); void perform(() => event.submitter.dataset.action === 'approve-token' ? client.sponsorAllowance(address, amount) : client.fund(address, amount)); });
$('sponsor-token').addEventListener('change', updateGates);
$('token-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const form = new FormData(event.currentTarget); busy = true; updateGates();
  try { const token = await client.inspectToken(String(form.get('address')), String(form.get('symbol'))); fillTokens(); $('sponsor-token').value = token.address; $('claim-token').value = token.address; claimApproval = null; $('write-status').textContent = `${token.symbol}: ${token.address}, ${token.decimals} on-chain decimals. Available only in this page; not a sponsor approval, reward or token endorsement.`; }
  catch (error) { $('write-status').textContent = error.shortMessage || error.message; }
  finally { busy = false; updateGates(); }
});
$('allowlist-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); void perform(() => client.ownerWrite('setSponsor', [form.get('wallet'), form.get('approved') === 'on'])); });
$('location-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); void perform(() => client.ownerWrite('createLocation', [form.get('name'), coordinateToMicrodegrees(String(form.get('latitude')), 90), coordinateToMicrodegrees(String(form.get('longitude')), 180), BigInt(String(form.get('radius'))), form.get('mission')])); });
$('allocation-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); void perform(() => client.ownerTokenWrite('addAllocation', BigInt(String(form.get('location'))), form.get('token'), String(form.get('amount')))); });
$('approval-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); void perform(() => client.ownerTokenWrite(event.submitter.dataset.action === 'cancel-claim' ? 'cancelClaimApproval' : 'approveClaim', BigInt(String(form.get('location'))), form.get('token'), String(form.get('amount')), form.get('wallet'))); });
$('location-status-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); void perform(() => client.ownerWrite('setLocationActive', [BigInt(String(form.get('location'))), form.get('active') === 'on'])); });
$('release-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); void perform(() => client.ownerTokenWrite('releaseAllocation', BigInt(String(form.get('location'))), form.get('token'), String(form.get('amount')))); });
$('recover-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!form.get('reviewed')) return; void perform(() => client.ownerTokenWrite('recoverToken', null, form.get('token'), String(form.get('amount')), form.get('recipient'))); });
$('load-radio').addEventListener('click', async () => { $('load-radio').disabled = true; $('stop-radio').hidden = false; try { await radioController.load(); } finally { $('load-radio').disabled = false; $('load-radio').textContent = 'Reload / retry radio'; } });
$('stop-radio').addEventListener('click', () => { radioController.destroy(); $('stop-radio').hidden = true; $('load-radio').textContent = 'Load radio (external service)'; $('load-radio').disabled = false; });
$('open-assistant').addEventListener('click', () => { $('assistant-state').textContent = assistant.endpoint ? 'Send only a question you choose, with fresh consent each time. No request has been sent automatically.' : 'Helper disabled — no endpoint configured. No request has been sent.'; openDialog('assistant-dialog'); });
function helperGates() { $('send-assistant').disabled = assistantBusy || !assistant.endpoint || !$('assistant-consent').checked || !$('assistant-question').value.trim(); }
$('assistant-consent').addEventListener('change', helperGates); $('assistant-question').addEventListener('input', helperGates);
$('assistant-form').addEventListener('submit', async event => {
  event.preventDefault(); if (assistantBusy) return;
  const question = $('assistant-question').value, consent = $('assistant-consent').checked;
  $('assistant-consent').checked = false;
  assistantBusy = true; helperGates(); $('assistant-answer').textContent = 'Waiting for the optional helper…';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  try {
    const body = assistantRequest(assistant.endpoint, question, consent);
    const response = await fetch(assistant.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    const text = await response.text();
    if (text.length > 10000) throw new Error('Helper response exceeds the display limit.');
    const result = JSON.parse(text);
    if (!response.ok) throw new Error(result.error || 'Helper unavailable.');
    if (typeof result.answer !== 'string' || result.answer.length > 2400) throw new Error('Invalid helper response.');
    $('assistant-answer').textContent = `${result.abstained ? 'Not enough approved evidence: ' : ''}${result.answer} (Helper guidance is not organizer approval.)`;
  } catch (error) { $('assistant-answer').textContent = error.name === 'AbortError' ? 'Helper timed out. No automatic retry.' : error.message; }
  finally { clearTimeout(timer); assistantBusy = false; helperGates(); }
});

function showTourStep() {
  tourTarget?.classList.remove('tour-target');
  tourTarget?.style.removeProperty('outline'); tourTarget?.style.removeProperty('outline-offset');
  const step = tutorial[tourIndex];
  tourTarget = document.querySelector(step.target);
  if (step.control === 'profile') tourTarget = header.shadowRoot.querySelector('ankh-menu[side="right"]').shadowRoot.querySelector('summary');
  tourTarget.classList.add('tour-target');
  if (tourTarget.getRootNode() !== document) { tourTarget.style.outline = '3px dashed #e9c477'; tourTarget.style.outlineOffset = '6px'; }
  tourTarget.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  $('tour-progress').textContent = `HOP ${tourIndex + 1} OF ${tutorial.length}`;
  $('tour-title').textContent = step.title; $('tour-text').textContent = step.text;
  $('tour-back').disabled = tourIndex === 0; $('tour-next').textContent = tourIndex === tutorial.length - 1 ? 'Finish & return to trail' : 'Next hop';
  if (!$('tour-dialog').open) $('tour-dialog').show();
  $('tour-next').focus({ preventScroll: true });
}
function startTour() { $('help-dialog').close(); tourIndex = 0; tourReturn = document.activeElement; showTourStep(); }
function endTour() {
  if (!tourTarget) return;
  tourTarget?.classList.remove('tour-target');
  if (tourTarget) {
    tourTarget.style.removeProperty('outline'); tourTarget.style.removeProperty('outline-offset');
    const destination = tourTarget.disabled ? document.querySelector(tutorial[tourIndex].fallback || '#open-help') : tourTarget;
    if (!destination.hasAttribute('tabindex')) destination.setAttribute('tabindex', '-1');
    destination.focus({ preventScroll: true });
  }
  else tourReturn?.focus();
  tourTarget = null;
}
$('tour-dialog').addEventListener('close', endTour);
$('tour-dialog').addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeDialog($('tour-dialog')); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('tour-dialog').open) { event.preventDefault(); closeDialog($('tour-dialog')); } });
$('start-tour').addEventListener('click', startTour); $('help-tour').addEventListener('click', startTour);
$('about-tour').addEventListener('click', () => { $('about-dialog').close(); startTour(); });
$('about-help').addEventListener('click', () => { $('about-dialog').close(); openDialog('help-dialog'); });
$('tour-back').addEventListener('click', () => { if (tourIndex) { --tourIndex; showTourStep(); } });
$('tour-next').addEventListener('click', () => { if (tourIndex === tutorial.length - 1) { journal.tutorialComplete = true; saveJournal(); closeDialog($('tour-dialog')); notice('Tutorial complete. No reward or eligibility was created.'); } else { ++tourIndex; showTourStep(); } });
fillTokens(); selectPlace(selected); updateProfile(); helperGates();
