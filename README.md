# Authentication and Authorization using ORY Apps

This project implements modern authentication and authorization workflows leveraging the **ORY** ecosystem. Our approach uses only social logins and follows best practices for security, privacy, and scalability.

---

## Key Components

### 1. Social Logins Only

We support authentication exclusively via popular social providers:

- Google
- Apple
- Microsoft
- LinkedIn
- X (formerly Twitter)

No local username/password registrations are supported.

---

### 2. ORY Hydra

- **ORY Hydra** acts as our OAuth2/OpenID Connect server, providing a secure and flexible way to manage authorization.
- Hydra is responsible for:
  - Acting as the authorization server for all OAuth2/OpenID Connect flows
  - Issuing and validating access tokens and ID tokens
  - Managing consent and login challenges
  - Integrating with the consent app to handle user approvals

---

### 3. Consent App (Next.JS)

- A simple Next.js (Express) application is used as the **Consent App**.
- This app:
  - Presents the login/consent UI to users when requested by Hydra
  - Integrates with ORY Kratos to authenticate users via their chosen social provider
  - Collects user consent for application scopes and claims

```sh
yarn dev
yarn build
yarn start
```

---

### 4. ORY Kratos

- **ORY Kratos** serves as the user identity and authentication provider.
- Kratos handles:
  - Social login flows (using Google, Apple, Microsoft, LinkedIn, X, etc.)
  - Identity lifecycle management (creation, update, deactivation)
  - Linking social provider accounts to user identities
  - Integrating with the Consent App to facilitate user authentication

---

## Flow Overview

1. User attempts to access a protected resource.
2. ORY Hydra triggers an authentication/consent flow via the Consent App.
3. Consent App redirects the user to ORY Kratos, which handles authentication using a social provider.
4. Upon successful authentication, Kratos passes the user identity back to the Consent App.
5. Consent App presents the consent screen, collects approval, and communicates with Hydra to issue tokens.
6. User gains access to the requested application or resource.

---

## Tech Stack

- [ORY Hydra](https://www.ory.sh/hydra/docs/)
- [ORY Kratos](https://www.ory.sh/kratos/docs/)
- Node.js + Express (Consent App)

---

## Notes

- No user credentials are stored locally; only federated identities are used.
- All components are containerized for easy local and cloud deployment.
- For production, ensure proper HTTPS, secure secrets, and persistent databases for Hydra and Kratos.

---

## Set-UP ORY-HYDRA ##
1. Setup database
```sh
-- Connect as the default superuser (usually 'postgres')
psql -U postgres -h localhost -p 5432 -d postgres

-- 1. Create the user for hydra with a strong password
CREATE USER hydrau WITH PASSWORD '<My Password>';

-- 2. Create the hydra database owned by the hydrau user
CREATE DATABASE hydra OWNER hydrau;

-- 3. Grant all privileges on the hydra database to the hydrau user
GRANT ALL PRIVILEGES ON DATABASE hydra TO hydrau;

-- (Optional) Make hydrau the owner in case you used the admin user to create the database
ALTER DATABASE hydra OWNER TO hydrau;

```

How to run

## Run ORY Hydra ##
* Run the migration before starting the hydra
```sh
docker run --rm -e DSN="postgres://hydrau:<My Password>@host.docker.internal:5432/hydra?sslmode=disable" oryd/hydra:v2.2 migrate sql -e --yes
```
* Run Hydra
```sh
cd hydra
docker compose up
```

## Run Consent app ##
```sh
cd consent
nvm use 22
yarn install
yarn build
pm2 start dist/app.js --name ory-consent
pm2 stop ory-consent
```

## Set-UP ORY-KRATOS ##
1. Setup database
```sh
-- Connect as the default superuser (usually 'postgres')
psql -U postgres -h localhost -p 5432 -d postgres

-- 1. Create the user for kratos with a strong password
CREATE USER kratosu WITH PASSWORD '<My Password>';

-- 2. Create the hydra database owned by the hydrau user
CREATE DATABASE kratos OWNER kratosu;

-- 3. Grant all privileges on the hydra database to the hydrau user
GRANT ALL PRIVILEGES ON DATABASE kratos TO kratosu;

-- (Optional) Make hydrau the owner in case you used the admin user to create the database
ALTER DATABASE kratos OWNER TO kratosu;

```

## Run ORY Kratos ##
* Run the migration before starting the kratos
```sh
docker run --rm -e DSN="postgres://kratosu:<My Password>@host.docker.internal:5432/kratos?sslmode=disable" -v $PWD/kratos-config:/etc/config oryd/kratos:v1.1 migrate sql -e --yes
```
* Run Hydra
```sh
cd hydra
docker compose up
```

* After starting above applications, open `http://localhost:4433/self-service/login/browser` to verify locally.

### Debug ###
```
curl -X DELETE http://localhost:4434/admin/identities/e75312cf-6798-4d7c-be97-7adf6305e919
curl -s http://localhost:4434/admin/identities | jq .
docker exec -it ory-kratos cat /etc/config/kratos.yml 
```

* Installed nginx locally
* configred subdomains hydra.daybook.com etc in nginx with port 443
* updated /etc/hosts