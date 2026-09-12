---
name: brainstorming
description: Compétence obligatoire avant tout travail créatif (création de fonctionnalités, construction de composants, ajout de capacités ou modification du comportement). Explore l'intention de l'utilisateur, les exigences et l'architecture logicielle avant toute implémentation.
---

# Compétence : Brainstorming & Conception Logicielle

Cette compétence permet de transformer des idées brutes en spécifications d'architecture claires, validées et complètes à travers un dialogue collaboratif et structuré.

> [!IMPORTANT]
> **Règle absolue (HARD-GATE) :** Ne générez AUCUN code, ne créez AUCUN fichier de projet et n'exécutez aucune action d'implémentation avant d'avoir présenté une spécification de conception et d'avoir obtenu l'accord explicite de l'utilisateur.

---

## 🚫 Anti-Modèle à Éviter : "Ce projet est trop simple pour nécessiter un design"

Chaque tâche (qu'il s'agisse d'un script d'une fonction, d'une modification de configuration ou d'une application complète) doit suivre ce processus. C'est sur les projets dits "simples" que les hypothèses non examinées causent le plus de travail inutile. La conception peut être courte pour un besoin simple (quelques phrases), mais elle **doit** être présentée et validée.

---

## 📋 Déroulement et Liste de Contrôle (Checklist)

Pour chaque phase de brainstorming, créez et validez les étapes suivantes dans l'ordre :

1. **Explorer le contexte du projet** : Analyser les fichiers existants, la documentation et l'architecture actuelle.
2. **Poser des questions de clarification** : Poser **une seule question à la fois** pour clarifier les besoins, les contraintes et les critères de succès (privilégier les questions à choix multiples).
3. **Proposer 2 à 3 approches** : Détailler les options possibles avec leurs compromis (trade-offs) et votre recommandation motivée.
4. **Présenter le design par sections** : Présenter la solution retenue (architecture, flux de données, composants, gestion des erreurs) et valider chaque section avec l'utilisateur.
5. **Rédiger le document de spécification** : Enregistrer le design validé dans `docs/specs/YYYY-MM-DD-<sujet>-design.md`.
6. **Auto-revue de la spécification** : Vérifier l'absence de placeholders, de contradictions ou d'ambiguïtés.
7. **Validation par l'utilisateur** : Demander une relecture finale par l'utilisateur.
8. **Transition vers la planification** : Invoquer la compétence `planification` pour construire le plan d'exécution étape par étape.

---

## 💡 Principes Clés de Conception

- **Une question à la fois** : Ne submergez jamais l'utilisateur avec une liste de questions.
- **YAGNI (You Aren't Gonna Need It)** : Éliminez sans pitié les fonctionnalités superflues du périmètre initial.
- **Isolation et modularité** : Découpez le système en unités autonomes ayant une responsabilité unique et des interfaces claires.
- **Décomposition** : Si le projet est vaste ou comporte plusieurs sous-systèmes indépendants, aidez l'utilisateur à le découper en sous-projets avant d'entamer la conception du premier module.
