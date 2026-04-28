const form = document.querySelector('#search-form');
const statusNode = document.querySelector('#status');
const actionsNode = document.querySelector('#actions');
const tableWrap = document.querySelector('#table-wrap');
const debugNode = document.querySelector('#debug');

let lastData = null;
let sortKey = 'leadScore';
let sortDir = 'desc';

function getFormPayload() {
  const formData = new FormData(form);
  return {
    categories: formData.getAll('categories'),
    mode: formData.get('mode'),
    country: formData.get('country'),
    city: formData.get('city'),
    state: formData.get('state'),
    limit: Number(formData.get('limit')),
    export: 'csv',
    debug: false
  };
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
  const payload = { ...lastData.requested, categories: form.querySelectorAll('input[name="categories"]:checked') ? getFormPayload().categories : [], export: format };
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  const type = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8';
  downloadContent(data.export.content, data.export.filename, type);
}

function copyField(field) {
  if (!lastData?.results?.length) return;
  const lines = [...new Set(lastData.results.map((r) => r[field]).filter(Boolean))];
  navigator.clipboard.writeText(lines.join('\n'));
}

function scoreOrder(score) {
  if (score === 'High') return 3;
  if (score === 'Medium') return 2;
  if (score === 'Low') return 1;
  return 0;
}

function sortedResults(results) {
  const arr = [...results];
  arr.sort((a, b) => {
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
  return arr;
}

function renderTable(results) {
  const rows = sortedResults(results)
    .map(
      (r) => `
      <tr>
        <td>${r.email ? `<a href="mailto:${r.email}">${r.email}</a>` : ''}</td>
        <td>${r.website ? `<a href="${r.website}" target="_blank" rel="noopener">${r.website}</a>` : ''}</td>
        <td>${r.facebookUrl ? `<a href="${r.facebookUrl}" target="_blank" rel="noopener">${r.facebookUrl}</a>` : ''}</td>
        <td>${r.businessName || ''}</td>
        <td>${r.leadScore || ''}</td>
      </tr>
    `
    )
    .join('');

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th data-key="email">Email</th>
          <th data-key="website">Website</th>
          <th data-key="facebookUrl">Facebook</th>
          <th data-key="businessName">Name</th>
          <th data-key="leadScore">Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  tableWrap.querySelectorAll('th[data-key]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else {
        sortKey = key;
        sortDir = 'asc';
      }
      renderTable(lastData.results);
    });
  });
}

function renderActions() {
  actionsNode.innerHTML = `
    <div class="actions">
      <button type="button" id="export-csv">Export CSV</button>
      <button type="button" id="export-xlsx">Export Excel</button>
      <button type="button" id="copy-emails">Copy Emails Only</button>
      <button type="button" id="copy-websites">Copy Websites Only</button>
      <button type="button" id="copy-facebook">Copy Facebook Only</button>
    </div>
  `;

  document.querySelector('#export-csv')?.addEventListener('click', () => exportFormat('csv'));
  document.querySelector('#export-xlsx')?.addEventListener('click', () => exportFormat('xlsx'));
  document.querySelector('#copy-emails')?.addEventListener('click', () => copyField('email'));
  document.querySelector('#copy-websites')?.addEventListener('click', () => copyField('website'));
  document.querySelector('#copy-facebook')?.addEventListener('click', () => copyField('facebookUrl'));
}

function renderStatus(data) {
  statusNode.innerHTML = `
    <p><strong>Mode:</strong> ${data.mode} | <strong>Scanned:</strong> ${data.scannedBusinesses} | <strong>Crawled:</strong> ${data.crawledBusinesses} | <strong>Qualified:</strong> ${data.matchedBusinesses} | <strong>Rejected:</strong> ${data.rejectedBusinesses}</p>
    <p><strong>Providers:</strong> ${data.providerUsed.join(', ')} | <strong>Time:</strong> ${data.elapsedMs} ms</p>
  `;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusNode.textContent = 'Searching for USA-focused partner leads...';
  actionsNode.innerHTML = '';
  tableWrap.innerHTML = '';
  debugNode.innerHTML = '';

  try {
    const payload = getFormPayload();
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search failed');

    lastData = data;
    renderStatus(data);
    renderActions();
    renderTable(data.results || []);
  } catch (error) {
    statusNode.innerHTML = `<p class="muted">Error: ${error.message}</p>`;
  }
});
