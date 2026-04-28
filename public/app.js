const form = document.querySelector('#search-form');
const statusNode = document.querySelector('#status');
const resultsNode = document.querySelector('#results');
const debugNode = document.querySelector('#debug');

function getFormPayload() {
  const formData = new FormData(form);
  return {
    categories: formData.getAll('categories'),
    city: formData.get('city'),
    state: formData.get('state'),
    country: formData.get('country'),
    limit: Number(formData.get('limit')),
    debug: formData.get('debug') === '1'
  };
}

function contactBadge(label, value) {
  if (!value || (Array.isArray(value) && !value.length)) return `<span class="muted">${label}: not found</span>`;
  if (Array.isArray(value)) return `<span>${label}: ${value.join(', ')}</span>`;
  if (value.includes('@')) return `<span>${label}: <a href="mailto:${value}">${value}</a></span>`;
  return `<span>${label}: <a href="${value}" target="_blank" rel="noopener">${value}</a></span>`;
}

function renderResults(data) {
  statusNode.innerHTML = `
    <p>
      <strong>Discovered:</strong> ${data.scannedBusinesses} |
      <strong>Crawled:</strong> ${data.crawledBusinesses} |
      <strong>Qualified:</strong> ${data.matchedBusinesses} |
      <strong>Rejected:</strong> ${data.rejectedBusinesses}
    </p>
    <p>
      <strong>Providers:</strong> ${data.providerUsed.join(', ')} |
      <strong>Retries:</strong> ${data.retriesUsed} |
      <strong>Time:</strong> ${data.elapsedMs} ms
    </p>
  `;

  if (!data.results.length) {
    resultsNode.innerHTML = '<p class="muted">No qualified leads found. Enable debug and retry broader location input.</p>';
    return;
  }

  resultsNode.innerHTML = data.results
    .map(
      (item) => `
      <article class="card">
        <h3>${item.businessName}</h3>
        <p><strong>Lead Score:</strong> ${item.leadScore} · <strong>Type:</strong> ${item.relevanceType}</p>
        <p class="muted">${item.location}</p>
        <p class="muted">Discovery intent: ${item.discoveryIntent}</p>
        <div class="contact-grid">
          ${contactBadge('Website', item.website)}
          ${contactBadge('Email', item.email)}
          ${contactBadge('Facebook', item.facebookUrl)}
          ${contactBadge('Instagram', item.instagramUrl)}
          ${contactBadge('LinkedIn', item.linkedinUrl)}
          ${contactBadge('WhatsApp', item.whatsappUrl)}
          ${contactBadge('Phone', item.phoneNumbers)}
          ${contactBadge('Contact/Apply', item.contactApplyPage)}
          ${contactBadge('Form', item.formPage)}
        </div>
      </article>
    `
    )
    .join('');
}

function renderDebug(data) {
  if (!data.debug) {
    debugNode.innerHTML = '';
    return;
  }

  const rejected = data.debug.rejected || [];
  const events = data.debug.events || [];

  debugNode.innerHTML = `
    <details>
      <summary>Debug Trace (${events.length} events, ${rejected.length} rejected)</summary>
      <pre>${JSON.stringify({ rejected, sampleEvents: events.slice(0, 80) }, null, 2)}</pre>
    </details>
  `;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusNode.textContent = 'Running lead intelligence search...';
  resultsNode.innerHTML = '';
  debugNode.innerHTML = '';

  try {
    const payload = getFormPayload();
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Search failed');
    }

    renderResults(data);
    renderDebug(data);
  } catch (error) {
    statusNode.innerHTML = `<p class="muted">Error: ${error.message}</p>`;
  }
});
