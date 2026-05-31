// Default email_verified to false so the expression is safe even if Google
// omits the claim. Google sets email_verified=true for normal Gmail/Workspace
// accounts, which lets Kratos mark the address verified on sign-in (no email
// verification flow is started).
local claims = { email_verified: false } + std.extVar('claims');

{
  identity: {
    traits: {
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
    },
    // Any verifiable address (see identity.schema.json) matching an entry here
    // is automatically marked verified once the identity passes validation.
    verified_addresses: std.prune([
      if 'email' in claims && claims.email_verified then { via: 'email', value: claims.email },
    ]),
  },
}
