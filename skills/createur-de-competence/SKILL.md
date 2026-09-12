---
name: createur-de-competence
description: Guide systématique et normes pour concevoir, structurer et générer de nouvelles compétences (Skills) claires, puissantes et directement exploitables pour l'assistant IA, entièrement rédigées en français et conformes aux bonnes pratiques de Google Antigravity.
---

# Créateur de Compétences (Skill Creator)

Cette compétence guide l'agent IA lors de la création, la structuration ou la mise à jour de nouvelles compétences (Skills) dans l'environnement Google Antigravity.

> [!IMPORTANT]
> **Règle absolue :** Toutes les compétences créées ou modifiées avec cette compétence doivent être intégralement rédigées en **français**.

---

## 🎯 Objectif et Philosophie

Les compétences sont des dossiers d'instructions enrichis qui étendent les capacités de l'agent pour des domaines spécialisés. Un dossier de compétence propre doit être :
1. **Déclenchable automatiquement** : Le `name` et le `description` du frontmatter YAML sont les seuls éléments analysés pour le déclenchement automatique.
2. **Concise et Structurée** : Le fichier principal `SKILL.md` doit faire idéalement moins de 500 lignes. Les documentations longues doivent être placées dans `references/`.
3. **Prête à l'emploi** : Fournir des commandes exactes, des structures de fichiers et des critères de validation.

---

## 📂 Structure Standard d'une Compétence

Toute compétence doit respecter l'arborescence suivante :

```
skills/<nom-de-la-competence>/
├── SKILL.md                 # [OBLIGATOIRE] Fichier principal (YAML frontmatter + instructions)
├── scripts/                 # (Optionnel) Scripts d'assistance ou utilitaires (Python, JS, Shell)
├── examples/                # (Optionnel) Exemples d'implémentation et modèles de code
├── resources/               # (Optionnel) Fichiers de données, modèles, templates ou assets
└── references/              # (Optionnel) Documentation longue ou guides détaillés
```

---

## 📝 Format et Syntaxe du Fichier `SKILL.md`

### 1. Frontmatter YAML (Obligatoire)
```yaml
---
name: <nom-de-la-competence-en-kebab-case>
description: <Description claire, précise et détaillée du rôle de la compétence, décrivant QUAND et POURQUOI l'agent doit la déclencher.>
---
```

### 2. Contenu Markdown (Sections Recommandées)
1. **Description & Contexte** : Présentation du rôle de la compétence.
2. **Déclencheurs & Cas d'Usage** : Situations explicites qui nécessitent son activation.
3. **Flux de Travail (Workflow)** : Étapes séquentielles claires pour réaliser la tâche.
4. **Commandes & Exemples de Code** : Extraits réels et exécutables adaptés à l'OS de l'utilisateur.
5. **Bonnes Pratiques & Pièges à Éviter** : Mises en garde et critères de qualité.

---

## 🛠️ Procédure de Création d'une Nouvelle Compétence

Lorsque vous devez concevoir une nouvelle compétence pour l'utilisateur, suivez rigoureusement ces étapes :

### Étape 1 : Analyser le Besoin et le Périmètre
- Déterminer le nom de la compétence (en `kebab-case`, ex: `gestionnaire-base-de-donnees`).
- Choisir l'emplacement :
  - **Globale** (disponible pour tous les projets) : `C:\Users\BRAIN\.gemini\config\skills\<nom-competence>\SKILL.md`
  - **Espace de travail** (spécifique au projet) : `.agents\skills\<nom-competence>\SKILL.md`

### Étape 2 : Rediger le Frontmatter YAML
- `name` : Nom court en minuscules séparées par des tirets.
- `description` : Description détaillée contenant tous les mots-clés et contextes de déclenchement.

### Étape 3 : Rédiger les Instructions (`SKILL.md`)
- Rédiger **intégralement en français**.
- Employer un ton direct, instructif et professionnel.
- Spécifier les commandes de terminal compatibles avec Windows / PowerShell ou Bash selon l'environnement.

### Étape 4 : Créer le Fichier
- Utiliser l'outil `write_to_file` pour générer `SKILL.md`.

### Étape 5 : Validation
- Vérifier la création du fichier avec `view_file` ou `list_dir`.
- Présenter à l'utilisateur un résumé avec le lien cliquable au format `[SKILL.md](file:///C:/Users/BRAIN/.../SKILL.md)`.

---

## ⚠️ Checklist de Validation Qualité

- [ ] **Langue** : La compétence est-elle rédigée 100% en **français** ?
- [ ] **YAML** : Le bloc `---` de frontmatter comporte-t-il les clés `name` et `description` ?
- [ ] **Clarté** : Les instructions et étapes de travail sont-elles explicites et exploitables immédiatement ?
- [ ] **Liens** : Tous les liens de fichiers utilisent-ils la syntaxe Markdown `[texte](file:///chemin/absolu)` ?
