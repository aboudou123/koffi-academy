# lingenieur.de — Koffi Academy

Site de formation en ligne en Platform Engineering, DevOps et Cloud.  
Hébergé sur **one.com** · Dépôt sur **GitHub** · Déploiement automatique via **GitHub Actions**.

---

## Architecture

```
Koffi_web/
├── public/              ← Tout ce qui est déployé sur one.com
│   ├── index.html
│   ├── idp-demo.html
│   ├── idp-platform.html
│   ├── assets/
│   │   ├── css/
│   │   ├── js/
│   │   └── images/
│   ├── courses/
│   ├── free-courses/
│   ├── laboratoire*.html
│   ├── payment/
│   └── .htaccess        ← Headers sécurité + cache
│
├── .github/
│   └── workflows/
│       └── deploy.yml   ← Pipeline GitHub Actions (déploiement auto)
│
├── server.js            ← Backend Node.js (IDP demo, local seulement)
├── data/                ← Données runtime locale (non déployées)
└── artifacts/           ← Artefacts IDP local (non déployés)
```

---

## Processus de déploiement

### Workflow automatique

```
Modifier un fichier  →  git commit  →  git push  →  GitHub Actions  →  one.com
```

Le déploiement se déclenche automatiquement à chaque `git push` sur la branche `main`.  
Seul le contenu du dossier `public/` est transféré sur le serveur.

### Durée typique

| Étape | Durée |
|---|---|
| Checkout GitHub | ~10 s |
| Installation lftp | ~15 s |
| Transfert SFTP (10 MB) | ~60–90 s |
| **Total** | **~2 min** |

### Suivi d'un déploiement

1. Va sur **github.com/aboudou123/koffi-academy**
2. Clique sur l'onglet **Actions**
3. Voir le job en cours ou le dernier terminé
4. Statut vert = site mis à jour · Statut rouge = voir les logs

---

## Secrets GitHub requis

> **Emplacement** : GitHub → dépôt → Settings → Secrets and variables → Actions → New repository secret

| Secret | Valeur | Comment trouver |
|---|---|---|
| `SFTP_HOST` | `ssh.cnqx5t58k.service.one` | one.com → Kontrollpanel → SFTP & FTP |
| `SFTP_USER` | `cnqx5t58k_ssh` | one.com → Kontrollpanel → SFTP & FTP |
| `SFTP_PASS` | *(mot de passe SFTP)* | E-mail reçu après avoir cliqué "Senden" |
| `SFTP_REMOTE_PATH` | `/www/` | Dossier racine du site sur one.com |

---

## Futures mises à jour (workflow quotidien)

```bash
# 1. Modifier les fichiers dans VS Code
# 2. Commiter
git add public/fichier-modifie.html
git commit -m "Description de la modification"

# 3. Pousser — le déploiement se lance automatiquement
git push
```

---

## Revenir à une version précédente

### Option 1 — Depuis GitHub (recommandé)

1. Va sur **github.com/aboudou123/koffi-academy → Actions**
2. Clique sur un déploiement précédent qui fonctionnait
3. Clique sur **Re-run all jobs** → le site revient à cette version

### Option 2 — Depuis la ligne de commande

```bash
# Voir les commits récents
git log --oneline -10

# Revenir au commit précédent (ex: abc1234)
git revert abc1234
git push
# Un nouveau déploiement s'enclenche automatiquement
```

---

## Informations sensibles — Ce qui NE doit JAMAIS être commité

| Fichier / Info | Pourquoi |
|---|---|
| Mot de passe SFTP | Accès serveur one.com |
| `server.js` | Contient la logique admin (exclu via .gitignore) |
| `data/` | Données runtime locales |
| `.env` | Variables d'environnement secrètes |
| Clés Firebase privées | Auth Firebase |

Tout est déjà exclu via `.gitignore`. Les secrets de déploiement sont dans **GitHub Secrets** uniquement.

---

## Lancer le backend IDP localement (optionnel)

Le `server.js` est un backend Node.js pour les démos IDP — il n'est pas déployé sur one.com.

```bash
node server.js
# Accessible sur http://localhost:4173
```

---

## Lancer une vraie VM de laboratoire en local avec Docker

Le terminal des pages laboratoire peut se connecter à un runner Docker local.  
Ce mode crée un container Ubuntu isolé par session et relie le terminal web au shell via WebSocket.

### Démarrage rapide Windows PowerShell

```powershell
.\lab-runner\start-local-lab.ps1
```

Puis ouvre :

```text
http://127.0.0.1:4173/laboratoire-dev-box-caipe-lab/
```

Le terminal détecte automatiquement le runner local. Si Docker n'est pas prêt, la page reste en mode simulateur.

### Démarrage manuel

```powershell
docker build -t koffi/local-dev-box:latest .\lab-runner\images\dev-box
$env:KOFFI_LAB_IMAGE = "koffi/local-dev-box:latest"
node server.js
```

### Notes

- API locale seulement : `http://127.0.0.1:4173/api/labs/health`
- Une session = un container Docker jetable.
- TTL par défaut : 90 minutes.
- Image de base : Ubuntu 24.04 avec `curl`, `git`, `jq`, `python3`, `nano`, `vim`, outils réseau.
- Documentation détaillée : `lab-runner/README.md`

---

## Technologies

- HTML5, CSS3, JavaScript (ES5+)
- Font Awesome 6.5.2
- Firebase (auth + Firestore)
- PayPal (paiements)
- GitHub Actions (CI/CD)
- one.com (hébergement statique)
