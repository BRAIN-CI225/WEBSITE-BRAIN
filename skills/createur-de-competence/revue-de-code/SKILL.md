---
name: revue-de-code
description: Analyse et examine les modifications de code pour détecter les bugs, failles de sécurité, problèmes de style et bonnes pratiques. À utiliser lors de la révision de Pull Requests (PR) ou du contrôle de la qualité du code.
---

# Compétence : Revue de Code (Code Review)

Cette compétence guide l'agent IA pour effectuer une analyse rigoureuse, constructive et complète du code source, des commits ou des Pull Requests.

> [!TIP]
> Priorisez la clarté, la sécurité et la maintenabilité lors de chaque revue de code.

---

## 🎯 Objectifs de la Revue de Code

1. **Exactitude et Correctitude** : S'assurer que le code remplit exactement les exigences attendues sans introduire de régression.
2. **Gestion des erreurs et Cas limites** : Vérifier la robustesse face aux exceptions, entrées invalides et cas d'angle (edge cases).
3. **Qualité et Style** : Garantir le respect des conventions du projet, la lisibilité et la propreté du code (*Clean Code*).
4. **Performance et Sécurité** : Détecter les inefficacités évidentes et les vulnérabilités de sécurité.

---

## 📋 Grille de Contrôle (Checklist de Revue)

### 1. Correctitude et Logique
- [ ] Le code répond-il fidèlement au besoin spécifié ?
- [ ] La logique métier est-elle exacte et compréhensible ?
- [ ] Y a-t-il des effets secondaires non désirés ?

### 2. Robustesse et Cas Limites
- [ ] Les valeurs `null`, `undefined` ou vides sont-elles gérées correctement ?
- [ ] Les exceptions et erreurs asynchrones sont-elles capturées et traitées ?
- [ ] Les délais d'attente (*timeouts*) et limites de ressources sont-ils pris en compte ?

### 3. Lisibilité et Conventions
- [ ] Les noms de variables, fonctions et classes sont-ils explicites et cohérents ?
- [ ] Le code suit-il le style et les normes du projet ?
- [ ] Les commentaires apportent-ils de la valeur sans être redondants ?

### 4. Performance et Sécurité
- [ ] Y a-t-il des requêtes ou calculs superflus dans des boucles ?
- [ ] Les entrées utilisateur sont-elles validées et assainies (prévention XSS, injections, etc.) ?
- [ ] Les clés d'API et secrets sont-ils strictement absents du code source ?

---

## 💬 Directives pour Formuler les Retours (Feedback)

Lors de la rédaction des retours de revue :
- **Précision** : Ciblez la ligne ou la fonction exacte nécessitant une amélioration.
- **Explication** : Expliquez *pourquoi* une modification est recommandée (impact sur la sécurité, la performance ou la lisibilité).
- **Propositions** : Fournissez un exemple de code alternatif prêt à l'emploi lorsque c'est possible.
- **Priorisation** : Catégorisez les retours (`[Bloquant]`, `[Amélioration]`, `[Question]`).
