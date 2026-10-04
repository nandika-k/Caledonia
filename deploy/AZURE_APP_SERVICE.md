# Deploy Caledonia to Azure App Service

This repository can run as one Linux container with Nginx on port 80, the React/TanStack app on an internal port, and Flask on an internal port. Browser requests stay on one origin: Nginx forwards `/api/*` and `/auth/*` to Flask and all other paths to the frontend.

## 1. Build and publish the image

The repository root contains the `Dockerfile`. From the repository root, use Azure Container Registry Tasks to build it in Azure (Docker Desktop does not need to be installed or running):

```powershell
az login
az acr build --registry <registry-name> --image caledonia:v1 .
```

If the registry does not exist, create an Azure Container Registry in the same resource group first. The image will be available as `<registry-name>.azurecr.io/caledonia:v1`.

## 2. Point the Web App at the image

In the Web App's **Deployment Center > Containers** settings, select Azure Container Registry if offered and choose the registry. If you use **Other container registries**, set the server URL to `https://<registry-name>.azurecr.io` and choose **Private**. Then set:

- Image and tag: `caledonia:v1`
- Port: `80`
- Startup command: leave blank; the image starts its own services.

For a private registry, grant the Web App's managed identity permission to pull images (`AcrPull`) or provide registry credentials. Save and restart the Web App after selecting the image.

## 3. Add application settings

In **Settings > Environment variables**, add these settings. Use the Web App's final HTTPS URL in both URL settings:

```text
SECRET_KEY=<a long random secret>
GOOGLE_OAUTH_CLIENT_ID=<Google OAuth web client ID>
GOOGLE_OAUTH_CLIENT_SECRET=<Google OAuth web client secret>
OAUTH_REDIRECT_URI=https://<web-app-host>/auth/callback
FRONTEND_URL=https://<web-app-host>
COOKIE_SECURE=true
GEMINI_API_KEY=<Gemini API key>
PGHOST=<TigerData host>
PGPORT=<TigerData port>
PGDATABASE=<TigerData database>
PGUSER=<TigerData user>
PGPASSWORD=<TigerData password>
PGSSLMODE=require
```

Register the exact `OAUTH_REDIRECT_URI` under **Authorized redirect URIs** in the Google OAuth web client. Do not put secrets in the Docker image or frontend variables.

## 4. Verify

Open `https://<web-app-host>/`, sign in with an `@njit.edu` Google account, then check that `/api/me` reports the authenticated user. Review **Monitoring > Log stream** if the container does not start.

Check `https://<web-app-host>/api/opportunities` to confirm the Flask API can read current opportunities from TigerData.

The current activity flow still keeps submitted Grove activities in browser storage; it does not persist them to Tiger Data or another shared database yet.
