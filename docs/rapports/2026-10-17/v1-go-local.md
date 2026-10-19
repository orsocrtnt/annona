# V1-GO — passage local automatisé

Date : 17 octobre 2026.

## Résultat

Le périmètre automatisable localement est vert. Les 235 règles locales passent. La recette connectée sur deux entreprises temporaires valide les trois rôles, les doubles créations standard et coursier sans doublon, la collecte coursier obligatoire, une transition sautée refusée, une livraison réussie avec preuve, un échec refusé sans motif puis concordant côté client/admin, une facture visible, le fil de commande et six frontières d'entreprise. Le nettoyage final retrouve zéro entreprise, utilisateur, commande, livraison, facture ou tâche de la fixture.

Les trois scénarios Chrome généraux consécutifs passent en 4,5 minutes : onboarding interne, support client → staff → client, puis administration/client/chauffeur avec suivi, facture, refus de rôle et panne 503 affichée. Le scénario opérationnel supplémentaire repasse sur le build final en 4,1 minutes le 18 octobre. Il ferme R01, R02, R06 et R10 avec un vrai double clic, une seule commande persistée, la collecte obligatoire, les contrôles de proximité, une preuve PNG privée, un échec `ABSENT` motivé et la concordance client/administration. Les champs Motif et Note sont nommés et sélectionnés par leurs rôles accessibles. Cinq captures ont été contrôlées, aucune erreur de page n'est relevée et la fixture ainsi que sa preuve sont supprimées sans résidu. Le build de production génère 100 pages. Le scanner et le contrôle documentaire ne relèvent aucune erreur.

## Défaut trouvé et corrigé

La première répétition a reproduit un `P2028` lors de la troisième connexion de démonstration. Huit montages transactionnels pouvaient solliciter simultanément le pool applicatif borné. Les livraisons de démo sont maintenant montées par lots de deux, ce qui conserve de la capacité pour l'authentification. La recette d'un build local utilise aussi `localhost`, car ses cookies sont sécurisés en production. Trois sessions successives ont ensuite réussi.

## Limites restantes

Le jalon V1-GO n'est pas clos. La position du scénario Chrome est déterministe et ne remplace pas le GPS terrain. Les essais iPhone/Android avec verrouillage et déplacement, la réception d'e-mails réels, une préproduction isolée et une restauration base + photos exigent appareils ou accès externes. Ces validations sont reportées conformément à la décision du propriétaire et ne bloquent pas les prochains travaux locaux.

Preuve synthétique : `outputs/v1-go/readiness.json`.
