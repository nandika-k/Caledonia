# GitHub Actions deployment setup

The workflow in `.github/workflows/deploy-container.yml` builds the Docker image on a GitHub-hosted runner, pushes it to ACR, and updates the Caledonia App Service. It runs on pushes to the `main` branch and can also be started manually from GitHub Actions.

Azure must trust the `main` branch through the `caledonia-github-deploy` user-assigned identity. That identity needs `AcrPush` on the registry and `Website Contributor` on the Caledonia app. The App Service's separate system-assigned identity needs `AcrPull` on the registry.

Add the `main` branch trust from PowerShell (the existing `frontend` trust can remain):

```powershell
az identity federated-credential create --resource-group Caledonia_group --identity-name caledonia-github-deploy --name github-main --issuer https://token.actions.githubusercontent.com --subject repo:nandika-k/GirlHacks2026:ref:refs/heads/main --audiences api://AzureADTokenExchange
```

## Add GitHub repository secrets

In GitHub, open **nandika-k/GirlHacks2026 → Settings → Secrets and variables → Actions → New repository secret**. Add:

| Secret | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | `4194c96c-d48c-4c87-afe1-3e662e2063c1` |
| `AZURE_TENANT_ID` | Output of `az account show --query tenantId --output tsv` |
| `AZURE_SUBSCRIPTION_ID` | `f13fab85-1923-4dab-a02f-6a08027e243d` |

No ACR username, password, publish profile, or Azure client secret is needed. Do not enable ACR admin credentials for this workflow.

## Start the first deployment

Commit and push `.github/workflows/deploy-container.yml` to the `main` branch. GitHub Actions then builds and deploys the image. Watch the run under the repository's **Actions** tab. The deployed image tag is the full Git commit SHA, so each deployment has a distinct tag.
