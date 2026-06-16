# Sécurité de déploiement statique pour `public/`

## Objectif
Ce fichier documente le durcissement actuel du site statique et les pages qui ne doivent pas être servies sans un backend sécurisé.

## Ce qui a été appliqué
- `public/.htaccess` ajouté
- Désactivation de l'exploration de répertoires (`Options -Indexes`)
- Entêtes HTTP renforcées :
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: interest-cohort=()`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security`
- Cache control pour CSS, JS, images et polices
- Suppression des ETag
- Protection des fichiers cachés `.*`
- Blocage des pages qui exposent des flux non sécurisés ou qui nécessitent un vrai backend

## Pages bloquées en déploiement statique
Ces pages sont potentiellement dangereuses si elles sont servies depuis un hébergement statique sans backend :

- `admin/` (admin client-side avec secret JavaScript)
- `payment/checkout.html` (payement PayPal construit côté client)
- `payment/bank-transfer-request.html` (formulaire mailto non sécurisé)
- `payment/paypal-success.html` et `payment/paypal-cancel.html`
- `dashboard.html` (auth Firebase côté client)
- `login.html` et `register.html` (forms client-only)
- `article.html` (auth Firebase côté client)
- `contact.html` (Firestore direct)
- `free-courses/github-actions.html` (Firebase auth / Firestore)
- `paid-courses/*` (course-lock côté client + backend attendu)

`pricing.html` reste servi comme contenu de la page sponsor, via `sponsor` et `sponsor.html`.

## Avis important
Ce durcissement Apache améliore la surface statique, mais il ne transforme pas le site en application sécurisée.

- Le code JavaScript visible côté client n’est pas une authentification réelle.
- Les clés PayPal ou Firebase présentes dans le code sont des configurations publiques, pas des secrets.
- Pour sécuriser les paiements, l’admin, les cours payants ou les comptes utilisateurs, il faut un backend réel avec authentification, autorisation et validation server-side.

## Recommandation
- Déployer uniquement le contenu statique public sécurisé.
- Ne pas exposer `admin/`, `dashboard.html`, `payment/*`, `login.html`, `register.html`, `contact.html`, `article.html`, `paid-courses/*` sans serveur.
- Ajouter un backend dédié si les fonctionnalités dynamiques doivent être rétablies.
