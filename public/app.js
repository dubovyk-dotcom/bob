const form = document.querySelector('#search-form');
const statusNode = document.querySelector('#status');
const filtersNode = document.querySelector('#result-filters');
const actionsNode = document.querySelector('#actions');
const tableWrap = document.querySelector('#table-wrap');

let lastData = null;
let sortKey = 'leadScore';
let sortDir = 'desc';
let activeFilters = {
  j1Agencies: true,
  workTravel: true,
  schools: true,
  hotels: true,
  restaurants: true,
  recruiters: true,
  facebookOnly: false,
  websiteOnly: false
};

function getFormPayload() {
  const fd = new FormData(form);
  return {
    categories: fd.getAll('categories'),
    mode: fd.get('mode'),
    country: fd.get('country'),
    city: fd.get('city'),
    state: fd.get('state'),
    limit: Number(fd.get('limit')),
    export: 'csv'
  };
}


function buildPipeTable(results) {
  const headers = ['EMAIL', 'WEBSITE', 'FACEBOOK', 'NAME', 'COUNTRY'];
  const lines = results.map((r) =>
    [r.email || '', r.website || '', r.facebookUrl || '', r.businessName || '', r.country || '']
      .map((v) => String(v).replace(/\r?\n/g, ' ').replace(/\|/g, '/').trim())
      .join(' | ')
  );
  return [headers.join(' | '), ...lines].join('\n');
}

function copyTable() {
  if (!lastData?.results?.length) return;
  navigator.clipboard.writeText(buildPipeTable(lastData.results));
}

function downloadContent(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportFormat(format) {
  if (!lastData) return;
  const payload = { ...getFormPayload(), export: format };
  const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  const type = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8';
  if (format === 'xlsx' && data.export.format === 'xlsx' && data.export.encoding === 'base64') {
    const bytes = Uint8Array.from(atob(data.export.content), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.export.filename;
    a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'xlsx' && data.export.format === 'copy') {
    navigator.clipboard.writeText(data.export.content);
  } else {
    downloadContent(data.export.content, data.export.filename, type);
  }
}

function copyField(field) {
  if (!lastData?.results?.length) return;
  navigator.clipboard.writeText([...new Set(lastData.results.map((r) => r[field]).filter(Boolean))].join('\n'));
}

function scoreOrder(score) { return score === 'High' ? 3 : score === 'Medium' ? 2 : score === 'Low' ? 1 : 0; }

function passesFilter(lead) {
  const r = (lead.relevanceType || '').toLowerCase();
  const bucket = (lead.outputBucket || '').toLowerCase();
  if (!activeFilters.j1Agencies && (bucket.includes('j1') || r.includes('j1'))) return false;
  if (!activeFilters.workTravel && (r.includes('work and travel') || (lead.notes || '').toLowerCase().includes('work and travel'))) return false;
  if (!activeFilters.schools && (r.includes('school') || r.includes('college'))) return false;
  if (!activeFilters.hotels && r.includes('hotel')) return false;
  if (!activeFilters.restaurants && r.includes('restaurant')) return false;
  if (!activeFilters.recruiters && (r.includes('agency') || r.includes('recruiter') || bucket.includes('employment'))) return false;
  if (activeFilters.facebookOnly && !lead.facebookUrl) return false;
  if (activeFilters.websiteOnly && !lead.website) return false;
  return true;
}

function sortedResults(results) {
  return [...results]
    .filter(passesFilter)
    .sort((a, b) => {
      let av = a[sortKey] || '';
      let bv = b[sortKey] || '';
      if (sortKey === 'leadScore') {
        av = scoreOrder(av);
        bv = scoreOrder(bv);
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
}

function renderFilters() {
  filtersNode.innerHTML = `
    <div class="actions">
      <label><input type="checkbox" data-f="j1Agencies" ${activeFilters.j1Agencies ? 'checked' : ''}/> J1 Agencies</label>
      <label><input type="checkbox" data-f="workTravel" ${activeFilters.workTravel ? 'checked' : ''}/> Work and Travel USA</label>
      <label><input type="checkbox" data-f="schools" ${activeFilters.schools ? 'checked' : ''}/> Schools</label>
      <label><input type="checkbox" data-f="hotels" ${activeFilters.hotels ? 'checked' : ''}/> Hotels</label>
      <label><input type="checkbox" data-f="restaurants" ${activeFilters.restaurants ? 'checked' : ''}/> Restaurants</label>
      <label><input type="checkbox" data-f="recruiters" ${activeFilters.recruiters ? 'checked' : ''}/> Recruiters</label>
      <label><input type="checkbox" data-f="facebookOnly" ${activeFilters.facebookOnly ? 'checked' : ''}/> Facebook-only leads</label>
      <label><input type="checkbox" data-f="websiteOnly" ${activeFilters.websiteOnly ? 'checked' : ''}/> Website-only leads</label>
    </div>
  `;

  filtersNode.querySelectorAll('input[data-f]').forEach((el) => {
    el.addEventListener('change', () => {
      activeFilters[el.dataset.f] = el.checked;
      if (lastData) renderTable(lastData.results || []);
    });
  });
}

function renderTable(results) {
  const rows = sortedResults(results)
    .map(
      (r) => `<tr>
        <td>${r.email ? `<a href="mailto:${r.email}">${r.email}</a>` : ''}</td>
        <td>${r.website ? `<a target="_blank" rel="noopener" href="${r.website}">${r.website}</a>` : ''}</td>
        <td>${r.facebookUrl ? `<a target="_blank" rel="noopener" href="${r.facebookUrl}">${r.facebookUrl}</a>` : ''}</td>
        <td>${r.businessName || ''}</td>
        <td>${r.leadScore || ''}</td>
      </tr>`
    )
    .join('');

  tableWrap.innerHTML = `<table><thead><tr><th data-key="email">Email</th><th data-key="website">Website</th><th data-key="facebookUrl">Facebook</th><th data-key="businessName">Name</th><th data-key="leadScore">Score</th></tr></thead><tbody>${rows}</tbody></table>`;

  tableWrap.querySelectorAll('th[data-key]').forEach((th) => {
    th.addEventListener('click', () => {
      const k = th.dataset.key;
      if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else {
        sortKey = k;
        sortDir = 'asc';
      }
      renderTable(lastData.results || []);
    });
  });
}

function renderActions() {
  actionsNode.innerHTML = `<div class="actions">
    <button type="button" id="export-csv">Export CSV</button>
    <button type="button" id="export-xlsx">Export Excel</button>
    <button type="button" id="copy-emails">Copy Emails Only</button>
    <button type="button" id="copy-websites">Copy Websites Only</button>
    <button type="button" id="copy-facebook">Copy Facebook Only</button>
    <button type="button" id="copy-table">Copy Table</button>
  </div>`;

  document.querySelector('#export-csv')?.addEventListener('click', () => exportFormat('csv'));
  document.querySelector('#export-xlsx')?.addEventListener('click', () => exportFormat('xlsx'));
  document.querySelector('#copy-emails')?.addEventListener('click', () => copyField('email'));
  document.querySelector('#copy-websites')?.addEventListener('click', () => copyField('website'));
  document.querySelector('#copy-facebook')?.addEventListener('click', () => copyField('facebookUrl'));
  document.querySelector('#copy-table')?.addEventListener('click', copyTable);
}

function renderStatus(data) {
  statusNode.innerHTML = `<p><strong>Mode:</strong> ${data.mode} | <strong>Scanned:</strong> ${data.scannedBusinesses} | <strong>Crawled:</strong> ${data.crawledBusinesses} | <strong>Qualified:</strong> ${data.matchedBusinesses} | <strong>Rejected:</strong> ${data.rejectedBusinesses}</p>`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusNode.textContent = 'Searching local-first leads...';
  filtersNode.innerHTML = '';
  actionsNode.innerHTML = '';
  tableWrap.innerHTML = '';
  const payload = getFormPayload();

  try {
    const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Search failed');
    lastData = data;
    renderStatus(data);
    renderFilters();
    renderActions();
    renderTable(data.results || []);
  } catch (error) {
    statusNode.innerHTML = `<p class="muted">Error: ${error.message}</p>`;
  }
});
