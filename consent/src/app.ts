import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "http://localhost:4445";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Automatically accept all consent requests
app.get("/consent", async (req, res) => {
  const { consent_challenge } = req.query;

  if (!consent_challenge) {
    return res.status(400).send("Missing consent_challenge");
  }

  try {
    // Get consent request info from Hydra
    const { data: consentRequest } = await axios.get(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`
    );

    // Accept consent request (grant all scopes)
    const { data: acceptConsent } = await axios.put(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`,
      {
        grant_scope: consentRequest.requested_scope,
        grant_access_token_audience: consentRequest.requested_access_token_audience,
        session: {},
        remember: true,
        remember_for: 3600
      }
    );

    // Redirect user to Hydra's redirect URL
    return res.redirect(acceptConsent.redirect_to);
  } catch (err: any) {
    console.error("Consent error:", err.response?.data || err.message);
    return res.status(500).send("Consent error");
  }
});

// Health check
app.get("/", (_req, res) => {
  res.send("Consent app is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Consent app listening on port ${PORT}`);
});
