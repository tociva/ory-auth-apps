// Save as deleteAllKratosIdentities.js
// Usage: node deleteAllKratosIdentities.js

const KRATOS_ADMIN_URL = 'http://localhost:4434/admin/identities';

async function main() {
  // 1. Get all identities
  const res = await fetch(KRATOS_ADMIN_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch identities: ${res.status} ${res.statusText}`);
  }
  const identities = await res.json();

  if (!Array.isArray(identities) || identities.length === 0) {
    console.log('No identities found.');
    return;
  }

  console.log(`Found ${identities.length} identities.`);

  // 2. Delete each identity
  for (const identity of identities) {
    const { id, traits } = identity;
    const delUrl = `${KRATOS_ADMIN_URL}/${id}`;
    const delRes = await fetch(delUrl, { method: 'DELETE' });

    if (delRes.ok) {
      console.log(`Deleted identity: ${id} (${traits?.email || 'no email'})`);
    } else {
      console.error(`Failed to delete identity ${id}: ${delRes.status} ${delRes.statusText}`);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
