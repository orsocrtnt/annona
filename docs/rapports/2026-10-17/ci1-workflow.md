# CI-1 — Workflow de contrôle

Date : 17 octobre 2026. Jalonnement partiel de CI-1 consacré aux contrôles automatiques ; aucune publication n'a été réalisée.

## Mise en place

Le workflow GitHub Actions comporte deux frontières distinctes. Le job automatique fonctionne sans secret et vérifie le dépôt avant toute intégration. Le job connecté est manuel, dépend du premier et attend un environnement protégé `preproduction` avec des identifiants dédiés.

Un scanner versionné refuse les fichiers `.env`, clés privées, clés OpenAI probables et chaînes PostgreSQL avec identifiants. `.env.example` et les valeurs de fixture explicitement réservées restent autorisées. Les preuves de la recette connectée ne sont téléversées qu'après réussite complète.

## Défaut révélé pendant la validation

La première simulation dans une copie sans `.env.local` a passé les 235 tests mais échoué au pré-rendu de `/settings/billing` : le client Supabase exige ses deux valeurs publiques même quand aucune connexion n'est effectuée. Le job local fournit maintenant une URL sous le domaine réservé `.invalid` et une clé publique factice. Aucun secret ou projet Supabase réel n'est nécessaire au build.

## Validation locale

- syntaxe YAML lue avec succès ;
- scanner : zéro détection sur 792 fichiers suivis ou non ignorés ;
- copie neuve sans `.env.local` et installation depuis le lockfile ;
- types, lint strict et 235/235 tests réussis ;
- 36 documents courants vérifiés ;
- audit des dépendances de production sans vulnérabilité ;
- build Next.js réussi avec 100 pages.

Preuve synthétique : `outputs/ci1/workflow-validation.json`.

## Limite de conclusion

Cette validation prouve que le job local est reproductible et que la recette connectée est correctement isolée dans le fichier de workflow. Le dépôt `origin` est configuré, mais le fichier n'a pas été poussé et aucun exécuteur distant ne l'a lancé. Les protections d'environnement et le déploiement/retour arrière restent non vérifiés. Ces points exigent ENV-1, DB-1 et une publication explicitement autorisée ; CI-1 reste donc ouverte.
