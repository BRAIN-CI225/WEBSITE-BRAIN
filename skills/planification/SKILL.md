---
name: planification
description: Utiliser lorsque vous disposez d'une spécification ou d'exigences pour une tâche multi-étapes, avant de toucher au code. Génère des plans d'implémentation détaillés, rigoureux et découpés en tâches unitaires testables.
---

# Compétence : Planification d'Implémentation

Cette compétence permet de transformer des spécifications ou des exigences de conception en plans d'action pas-à-pas, précis, autonomes et directement exécutables.

> [!IMPORTANT]
> **Annonce initiale :** Au démarrage, annoncez : *"J'utilise la compétence de planification pour élaborer le plan d'implémentation."*

---

## 🎯 Principes Directeurs

- **Découpage atomique** : Chaque tâche doit représenter l'unité minimale dotée de sa propre boucle de test et d'une valeur testable individuellement.
- **TDD (Test-Driven Development)** : Privilégier la démarche "Test en échec → Code minimal → Test réussi → Commit".
- **Zéro Ambigüité / Zéro Placeholder** : Aucun "TODO", "TBD" ou code incomplet. Chaque étape doit fournir l'extrait de code ou la commande exacte à exécuter.
- **Hypothèse de contexte nul** : Rédiger le plan comme si l'exécutant ne connaissait pas le projet.

---

## 📄 Structure Obligatoire du Document de Plan (`docs/plans/`)

Chaque document de plan doit suivre l'en-tête suivant :

```markdown
# Plan d'Implémentation - [Nom de la Fonctionnalité]

**Objectif :** [Description en une phrase du résultat attendu]
**Architecture :** [2-3 phrases décrivant l'approche retenue]
**Stack Technique :** [Technologies, frameworks et bibliothèques clés]

## Contraintes Globales
- [Exigences du projet : versions, conventions de nommage, contraintes de sécurité]

---
```

---

## 🛠️ Structure d'une Tâche

```markdown
### Tâche N : [Nom du Composant ou de la Fonctionnalité]

**Fichiers concernés :**
- Créer : `chemin/exact/vers/nouveau_fichier.ext`
- Modifier : `chemin/exact/vers/fichier_existant.ext`
- Test : `tests/chemin/exact/vers/test_fichier.ext`

**Interfaces & Contrats :**
- Consomme : [Signatures et données produites par les tâches précédentes]
- Produit : [Nouveaux types, fonctions et paramètres exposés]

- [ ] **Étape 1 : Écrire le test en échec**
```python
def test_comportement_specifique():
    resultat = fonction_cible(entree)
    assert resultat == valeur_attendue
```

- [ ] **Étape 2 : Exécuter le test et vérifier l'échec**
Commande : `pytest tests/path/test_fichier.py -v`
Résultat attendu : FAIL (fonction non définie)

- [ ] **Étape 3 : Écrire l'implémentation minimale**
```python
def fonction_cible(entree):
    return valeur_attendue
```

- [ ] **Étape 4 : Exécuter le test et vérifier le succès**
Commande : `pytest tests/path/test_fichier.py -v`
Résultat attendu : PASS

- [ ] **Étape 5 : Commiter les modifications**
```bash
git add tests/path/test_fichier.py src/path/nouveau_fichier.py
git commit -m "feat: ajout de la fonctionnalité spécifique"
```
```

---

## 🔍 Auto-Examen du Plan (Self-Review)

Avant de soumettre le plan à l'utilisateur, effectuez ce contrôle :
1. **Couverture de la spécification** : Chaque exigence du design possède-t-elle sa tâche dédiée ?
2. **Détection des placeholders** : Avez-vous éliminé tous les "TODO", "à compléter", "traiter les erreurs" sans détails ?
3. **Cohérence des signatures** : Les noms de fonctions et de variables utilisés dans la tâche N correspondent-ils exactement à ceux définis dans les tâches précédentes ?

---

## 🤝 Passation d'Exécution

Une fois le plan rédigé et enregistré dans `docs/plans/YYYY-MM-DD-<fonctionnalite>.md`, proposez le choix d'exécution à l'utilisateur :
1. **Exécution sous-agents (Recommandée)** : Délégation de chaque tâche à un sous-agent dédié avec revue inter-tâches.
2. **Exécution séquentielle** : Exécution pas-à-pas dans la session courante avec jalons de validation.
