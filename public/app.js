const form = document.querySelector('#search-form');
const statusNode = document.querySelector('#status');
const resultsNode = document.querySelector('#results');

function getFormPayload() {
  const formData = new FormData(form);
  return {
    categories: formData.getAll('categories'),
    city: formData.get('city'),
    state: formData.get('state'),
    country: formData.get('country'),
    limit: Number(formData.get('limit'))
  };
}

function contactBadge(label, value) {
  if (!value) return `<span class="muted">${label}: not found</span>`;
  if (value.includes('@')) return `<span>${label}: <a href="mailto:${value}">${value}</a></span>`;
  return `<span>${label}: <a href="${value}" target="_blank" rel="noopener">${value}</a></span>`;
}

function renderResults(data) {
  statusNode.innerHTML = `<p><strong>Scanned:</strong> ${data.scannedBusinesses} | <strong>Qualified Leads:</strong> ${data.matchedBusinesses}</p>`;

  if (!data.results.length) {
    resultsNode.innerHTML = '<p class="muted">No intent-matched leads with usable contact channels were found.</p>';
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
          ${contactBadge('Contact/Apply', item.contactApplyPage)}
        </div>
      </article>
    `
    )
    .join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusNode.textContent = 'Running lead intelligence search...';
  resultsNode.innerHTML = '';

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
  } catch (error) {
    statusNode.innerHTML = `<p class="muted">Error: ${error.message}</p>`;
  }
});
