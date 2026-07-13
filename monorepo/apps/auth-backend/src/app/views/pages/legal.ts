import { IDNEST_LOGO } from "../icons";
import { layout } from "../layout";

export function renderPrivacy(): string {
  const body = `<div class="page-center">
  <main class="card card-legal">
    <div class="card-header">
      ${IDNEST_LOGO}
      <p class="brand-tagline">Privacy Policy</p>
    </div>

    <div class="legal-copy">
      <p>
        Idnest uses your sign-in information to authenticate your account, protect access,
        and issue tokens to applications you approve.
      </p>
      <p>
        Client-specific privacy terms can be configured on each OAuth client. Until then,
        this page is the local Idnest development privacy notice.
      </p>
    </div>
  </main>
</div>`;

  return layout({ title: "Privacy Policy · Idnest", body });
}

export function renderTerms(): string {
  const body = `<div class="page-center">
  <main class="card card-legal">
    <div class="card-header">
      ${IDNEST_LOGO}
      <p class="brand-tagline">Terms</p>
    </div>

    <div class="legal-copy">
      <p>
        Use Idnest authentication only with applications and accounts you are authorized
        to access.
      </p>
      <p>
        Client-specific terms can be configured on each OAuth client. Until then, this
        page is the local Idnest development terms notice.
      </p>
    </div>
  </main>
</div>`;

  return layout({ title: "Terms · Idnest", body });
}
