# Koffi Local Docker Lab Runner

Ce MVP transforme le terminal du laboratoire en vraie session Ubuntu locale.

## Prerequis

- Docker Desktop ou Docker Engine installe et demarre.
- Node.js installe.
- Le projet lance en local avec `node server.js`.

Le runner est limite a `localhost`. Il ne doit pas etre expose publiquement tel quel.

## Demarrage Windows PowerShell

```powershell
.\lab-runner\start-local-lab.ps1
```

Puis ouvrir:

```text
http://127.0.0.1:4173/laboratoire-dev-box-caipe-lab/
```

Le terminal detecte automatiquement le runner local et cree une session Docker.

## Demarrage manuel

```powershell
docker build -t koffi/local-dev-box:latest .\lab-runner\images\dev-box
$env:KOFFI_LAB_IMAGE = "koffi/local-dev-box:latest"
node server.js
```

## API locale

- `GET /api/labs/health`
- `POST /api/labs/sessions`
- `GET /api/labs/sessions`
- `GET /api/labs/sessions/:id`
- `DELETE /api/labs/sessions/:id`
- `WS /api/labs/sessions/:id/terminal`

## Securite du MVP

- Une session = un container Docker jetable.
- Acces API limite a `localhost`.
- Limites par defaut: 1 CPU, 768 MB RAM, 256 PIDs.
- TTL par defaut: 90 minutes.
- Le container tourne avec l'utilisateur non-root `dev`.

Variables utiles:

```text
KOFFI_LAB_IMAGE=koffi/local-dev-box:latest
KOFFI_LAB_SESSION_TTL_MS=5400000
KOFFI_LAB_MAX_SESSIONS=8
KOFFI_LAB_CPUS=1
KOFFI_LAB_MEMORY=768m
KOFFI_LAB_PIDS_LIMIT=256
```

## Limite importante

Ce MVP donne un vrai shell Ubuntu isole. Pour des labs qui doivent lancer Kubernetes `kind`, Docker-in-Docker, Proxmox, AWS ou Terraform contre un vrai cloud, il faudra une orchestration plus avancee et des credentials temporaires.
