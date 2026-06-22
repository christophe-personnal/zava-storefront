# Security Guidelines

## OWASP Top 10 Focus

### 1. **Broken Access Control**
- Implémenter l'authentification et l'autorisation à la frontière de l'application
- Utiliser des tokens signés (JWT/OIDC) avec une courte expiration
- Valider l'autorisation avant chaque opération sensible, jamais se fier au client
- Appliquer le principe du **deny by default** pour les routes protégées

### 2. **Cryptographic Failures**
- Chiffrer les données sensibles en transit (TLS 1.2+ obligatoire)
- Ne jamais inventer un schéma cryptographique : utiliser les libs éprouvées
- Mots de passe : **Argon2id** (préféré) ou bcrypt avec cost ≥ 12
- Jamais MD5, SHA-1 ou SHA-256 non salé

### 3. **Injection**
- **SQL** : paramétrer ALL queries, jamais de concaténation de strings
- **OS Commands** : utiliser les APIs de la langue, pas `exec()` ou `system()`
- **LDAP/NoSQL** : même approche que SQL, utiliser les drivers natives
- Valider et echapper l'input en fonction du contexte de sortie

### 4. **Insecure Design**
- Utiliser les menaces connues (STRIDE) lors de la conception
- Document les décisions de sécurité dans les ADR
- Tester les chemins d'erreur ("fail closed")

### 5. **Security Misconfiguration**
- Configurations d'environnement via variables d'env ou Azure Key Vault, jamais en dur
- Réviser les configurations par défaut : port, service, logging
- Activer les logs d'audit pour toutes les opérations sensibles

### 6. **Vulnerable Components**
- **Dépendances** : versions exactes ou ranges auditées dans package.json/requirements.txt
- Renovate ou Dependabot obligatoire avec auto-PR sur security alerts
- Justifier chaque nouvelle dépendance (1 ligne en description PR)

### 7. **Authentication Failures**
- Pas de mots de passe faibles (min 12 chars, majuscules, minuscules, chiffres, spéciaux)
- Implémenter le rate limiting sur les endpoints d'auth
- Logs : pas de tokens/passwords en clair (masquer : `token=****...`)

### 8. **Software & Data Integrity**
- Pinned dependencies
- Checksums/signatures sur artifacts
- Pas de conteneurs ou images non trustées

### 9. **Logging & Monitoring**
- Logs structurés (JSON)
- Champs obligatoires : `correlation_id`, `user_id` (hashé si PII), `operation`, `latency_ms`, `outcome`
- Logs d'audit pour : authentification, changements d'autorisation, opérations sensibles

### 10. **SSRF**
- Valider et restreindre les URLs dans les requêtes outbound
- Blocklist les métadonnées IaaS URLs (169.254.169.254, etc.)

---

## Gestion Centralisée des Secrets

### 1. **Jamais dans le dépôt Git**
- `.env` local dans `.gitignore`
- Scanning automatique (gitleaks) dans CI/CD
- Si un secret est leaké : rotation immédiate + suppression de l'historique (BFG / `git filter-repo`)

### 2. **Sources de vérité**
- **Azure Key Vault** : production & staging
- **GitHub Secrets** : CI/CD workflows (`${{ secrets.XYZ }}`)
- **`gh auth`** / **`az login`** : développement local
- Pas de long-lived tokens : utiliser OIDC où possible

### 3. **Conventions**
```
❌ DO NOT:
  STRIPE_KEY=sk_live_...
  PASSWORD=mySecretPassword
  DATABASE_URL=postgres://user:password@host

✅ DO:
  STRIPE_KEY_VAULT_NAME=my-stripe-prod-key
  PASSWORD_PROVIDER=azure-key-vault
  DATABASE_URL_FROM_VAULT=true
```

### 4. **Accès des développeurs**
- Authentification OIDC avec Azure Entra ID
- Accès Role-Based (RBAC) minimal
- Audit trail : qui a accédé à quoi, quand

---

## Review Checklist

Avant chaque PR :
- [ ] Gitleaks clean (pas de secrets détectés)
- [ ] Tous les handlers HTTP ont authN + authZ
- [ ] Toutes les DB queries paramétrisées
- [ ] Dépendances justifiées en description PR
- [ ] Logs masqués pour PII et secrets
- [ ] Pas de credentials en dur dans configs
