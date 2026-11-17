# ADR-004 : toute action qui change un contrat passe par le verrou de sa ligne

**État** : acceptée.

## Contexte

Deux juristes peuvent valider et rejeter la même étape au même moment ; un rédacteur peut réviser pendant qu'une décision s'enregistre. Vérifier l'état puis écrire, sans précaution, laisse passer les deux actions.

## Décision

Chaque action qui change l'état d'un contrat (réviser, soumettre, décider) s'exécute dans une transaction qui commence par `SELECT … FOR UPDATE` sur la ligne du contrat (`lockContract`). Toutes les vérifications (étape active, rôle, décision déjà prise, auteur de la version) sont faites **sous ce verrou**. Les actions concurrentes sur un même contrat s'exécutent donc l'une après l'autre, et la seconde voit l'état laissé par la première.

## Conséquences

- Quatre décisions lancées en même temps sur une étape : une seule est retenue, les trois autres sont refusées (« déjà traitée »), jamais un mélange.
- Le test qui le vérifie ouvre d'abord quatre connexions : sans cela, le pool les crée une à une, la première décision se termine avant que les autres commencent, et le test passait même sans verrou (constaté en retirant le verrou : détecté une fois sur trois seulement, puis cinq fois sur cinq après correction).
- Le verrou porte sur un contrat : deux contrats différents ne se bloquent jamais.
