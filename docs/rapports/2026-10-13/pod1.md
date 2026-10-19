# POD-1 — preuves de livraison durcies

13 octobre 2026 — implémentation locale et recette connectée sur l'environnement de test, sans déploiement ni changement de schéma.

## Résultat

Le serveur valide JPEG/PNG avant stockage : MIME autorisé, taille maximale de 5 Mo, structure complète, dimensions bornées, données et marqueur de fin. Les chemins sont générés par le serveur, uniques et limités à l'entreprise et à la livraison. Un chemin fourni en JSON est refusé et les réponses API ne révèlent plus le chemin Storage.

La clôture avec preuve est idempotente lorsque le client perd la réponse : un rejeu avec le même statut, la même note, le même motif et la même présence de photo retourne la mission existante sans nouvel upload. Un rejeu différent renvoie un conflit. Un fichier uploadé avant un échec de transaction est supprimé ; après succès, les anciens objets valides du même dossier sont nettoyés en conservant la preuve attachée.

Le chauffeur affecté voit désormais la carte de preuve sur sa mission terminée, avec photo signée, note et motif. Les routes chauffeur, client et administration signent la photo après leurs contrôles d'accès et retirent systématiquement le chemin brut.

## Vérifications

- `npm run check` : types valides, lint sans erreur avec 24 avertissements historiques, 148 tests réussis sur 148.
- `npm run build` : compilation de production réussie, 94 pages générées.
- Recette connectée : 55 assertions réussies. PNG tronqué, SVG, fichier supérieur à 5 Mo, preuve prématurée et clôture sans photo refusés avant stockage. Réponse volontairement abandonnée puis rejeu, conflit différent, double envoi concurrent, orphelin réel, note et motif, bucket privé et accès des trois rôles vérifiés.
- Accès : chauffeur affecté, client propriétaire et administration de l'entreprise récupèrent la même preuve par URL signée ; utilisateur anonyme et trois rôles d'une autre entreprise sont refusés ; l'URL publique ne fonctionne pas.
- Nettoyage : zéro compte Auth, entreprise, commande, livraison, job ou objet Storage de recette restant. Comptes globaux et empreinte SHA-256 des entreprises, utilisateurs, commandes et livraisons préexistants identiques avant/après.

Deux passages non finaux ont été nettoyés avant la preuve finale. Le premier a rencontré une saturation temporaire du pool pendant des connexions parallèles ; les connexions de recette ont été sérialisées avec reprise bornée. Le second utilisait un faux nom d'orphelin hors format TutelLiv, correctement ignoré par la protection de suppression ; la fixture a été corrigée pour reproduire un véritable upload abandonné.

## Limites

La preuve démontre le résultat inconnu après traitement serveur et le double envoi concurrent. Elle ne simule pas une coupure physique au milieu des octets ni une file hors ligne sur téléphone. Ces comportements restent MOB-01B ; R09 reste ouverte sur cette seule partie. Les avertissements lint préexistants, la vulnérabilité RLS déjà suivie et la validation sur appareils réels restent dans leurs tâches dédiées.

Preuves : `outputs/pod1/connected-final.json`, `outputs/pod1/check-final.log`, `outputs/pod1/build-final.log`.
