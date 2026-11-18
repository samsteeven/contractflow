# ADR-011 : pièces jointes refusées par défaut, antivirus, politique de contenu

**État** : acceptée.

## Contexte

Une pièce jointe est un fichier fourni par un utilisateur, stocké puis servi à d'autres. C'est la voie classique pour déposer un programme malveillant ou un script. La page, elle, charge du code : un script injecté (XSS) y serait exécuté sans la politique de contenu du navigateur.

## Décision

**Pièces jointes**
- **Rien n'est stocké avant d'être jugé sain.** Ordre : taille et type vérifiés, analyse antivirus, puis seulement écriture du fichier et de sa ligne, sous le verrou du contrat. L'analyse se fait *avant* le verrou : elle peut durer, le verrou ne doit pas.
- **Refus par défaut.** Antivirus injoignable, délai dépassé, réponse inattendue, limite du démon atteinte, antivirus non configuré : le fichier est refusé (503). Il n'existe pas de mode « sans analyse ».
- **ClamAV par son protocole `INSTREAM`** (`clamd`, port 3310), sans dépendance : commande `zINSTREAM`, blocs précédés de leur taille, bloc final de taille zéro, lecture de `stream: OK` ou `stream: <signature> FOUND`. Derrière une interface `VirusScanner` : un autre moteur s'ajoute sans toucher au service.
- **On ne croit ni le navigateur ni la seule extension.** Cinq types (PDF, PNG, JPEG, DOCX, XLSX) ; les premiers octets doivent correspondre à l'extension, et le type enregistré est celui que le serveur déduit. Le détecteur d'extension d'AdonisJS est volontairement laissé de côté : il voit un `.docx` comme `zip` et refuserait tous les vrais DOCX.
- **Nom aléatoire au stockage**, nom affiché nettoyé (pas de chemin, de guillemet ni de caractère de contrôle). Téléchargement par URL pré-signée de cinq minutes, toujours en `attachment`, jamais affiché dans la page.
- **Table en ajout seul** (déclencheur `forbid_change`), 10 Mo au plus. Un refus pour infection est tracé au journal (nom, signature, empreinte). Pas de pièce sur un contrat en signature ou signé : il ne change plus ([ADR-008](0008-signature-par-webhook-signe.md)).

**Politique de contenu et en-têtes**
- **CSP** (Shield) : `default-src 'self'`, scripts `'self'` plus un jeton (nonce) **renouvelé à chaque réponse**, `object-src 'none'`, `base-uri` et `form-action` sur `'self'`, `frame-ancestors 'none'`. Un script injecté n'a pas le jeton : il ne s'exécute pas. `upgrade-insecure-requests` en production.
- **Styles en ligne tolérés** (`style-src 'unsafe-inline'`) : les propriétés `style` de React et le rechargement à chaud de Vite en ont besoin ; une feuille de style injectée est un risque bien plus faible qu'un script.
- **`Referrer-Policy: same-origin`**, `Permissions-Policy` fermée, `Cross-Origin-Opener-Policy: same-origin`. `no-referrer` avait été essayé : sans en-tête `Referer`, la redirection « retour à la page précédente » de tous les refus métier retombe sur l'accueil.

## Conséquences

- Un antivirus est une défense, pas une preuve : il ne trouve que ce qu'il connaît. EICAR est détecté, une menace sans signature ne l'est pas ; le type vérifié, le téléchargement forcé et la CSP limitent les dégâts d'un fichier qui passerait.
- **Ce que ClamAV voit dépend du fichier** : la signature EICAR est ancrée au début du fichier, un PDF qui la contient plus loin n'est pas détecté ; dans un `.docx` (archive), si. Les tests le vérifient contre un vrai démon.
- ClamAV demande de la mémoire (environ 1,5 Go) et une à deux minutes de chargement au premier démarrage ; le fichier entier est lu en mémoire pour l'analyse.
- Pas d'analyse a posteriori : un fichier accepté n'est pas rescanné quand les signatures évoluent.
- La CSP en développement autorise les WebSockets (rechargement à chaud) ; Cypress retire la CSP des pages qu'il affiche, elle est donc vérifiée par requêtes directes.
