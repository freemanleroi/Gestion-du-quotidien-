# Suivi commercial — guide pour Fouad

Une application personnelle pour suivre tes objectifs, tes échanges par mail et tes relances. Elle fonctionne sur ton iPad, sans compte à créer, et tes données restent sur ton iPad.

---

## 1. Ce que fait l'application (version 1)

- **Aujourd'hui** : ta priorité du jour, les deadlines proches, les relances à faire, un résumé.
- **Objectifs** : intitulé, échéance, boîte mail, personnes, statut. Tu crées, modifies et supprimes toi-même. Une modification s'applique à partir d'aujourd'hui et le passé reste intact.
- **Interlocuteurs** : une fiche par personne, avec son historique et un voyant (a répondu / n'a pas répondu / relance à prévoir).
- **Échanges** : tu crées un « échange groupé » après avoir envoyé un mail à plusieurs personnes. L'application montre qui a répondu, propose un texte de relance, et t'annonce quand tout le monde a répondu.
- **Bilans** : jour, semaine, historique. Calculés automatiquement, rien à remplir.

**L'application n'envoie jamais de mail toute seule.** Elle prépare un texte, c'est toi qui l'envoies.

---

## 2. Ce qui n'est PAS dans cette version (honnêteté)

1. **Connexion automatique à tes 3 boîtes mail : pas encore faite.** Dans cette version, tu rattaches un mail à la main (tu colles son objet ou son lien) et tu indiques toi-même, d'un toucher, qui a répondu. Le reste de l'application ne dépend pas de cette connexion.
2. **Synchronisation avec l'agenda de l'iPad : seulement « au cas par cas » ou « toutes les dates d'un coup ».** Un bouton 📅 télécharge un petit fichier que l'iPad propose d'ajouter à ton Calendrier. Une connexion permanente qui ajoute les dates toute seule n'est pas possible avec ce type d'application sans serveur ; je ne te dis pas qu'elle existe.
3. **Aucune synchronisation entre appareils.** Ce que tu saisis sur l'iPad reste sur l'iPad.

---

## 3. Où sont tes données, et comment ne rien perdre

Elles sont enregistrées dans l'iPad, dans cette application, après chaque modification.

**Elles sont perdues si** : tu effaces les données de Safari, tu supprimes l'icône de l'écran d'accueil, tu changes d'appareil, ou l'adresse du site change.

**Ce qui te protège :**
- Fais une sauvegarde de temps en temps : **⚙︎ Réglages → Sauvegarder (fichier)**. L'application te le rappelle si tu n'en as pas fait depuis 14 jours.
- Range le fichier dans l'app **Fichiers** (iCloud Drive).
- Pour tout restaurer : **⚙︎ Réglages → Restaurer un fichier**.

---

## 4. Mettre l'application en ligne (gratuit)

Le dossier doit être publié sur Internet pour que ton iPad puisse l'ouvrir. **Le site doit être accessible publiquement, et son adresse ne doit plus changer ensuite** : tes données sont liées à cette adresse exacte. Tes données personnelles, elles, ne sont jamais envoyées sur Internet : seul le programme est publié.

### Option recommandée : GitHub Pages (gratuit)

1. Va sur **github.com** et crée un compte gratuit.
2. Clique sur **+ → New repository**. Nom : `suivi-commercial`. Choisis **Public**. Clique **Create repository**.
3. Clique sur **uploading an existing file**. Envoie **tous les fichiers du dossier** `suivi-commercial` (index.html, app.js, logic.js, style.css, sw.js, manifest.json et les 3 images icon-*.png). Clique **Commit changes**.
4. Va dans **Settings → Pages**. Sous « Build and deployment », choisis **Deploy from a branch**, branche **main**, dossier **/ (root)**, puis **Save**.
5. Attends 1 à 2 minutes. L'adresse apparaît en haut de la page : `https://TON-PSEUDO.github.io/suivi-commercial/`.
6. **Note cette adresse et ne la change jamais** (ne renomme pas le dépôt, ne change pas ton pseudo).

> Évite les services qui donnent une adresse temporaire (par exemple un dépôt de fichiers sans compte) : l'adresse peut disparaître ou changer, et tu perdrais l'accès à tes données.

### Pour mettre à jour l'application plus tard
Remplace les fichiers dans GitHub et change le numéro `VERSION` dans `sw.js` (par exemple `suivi-v2`). Demande-moi si tu veux que je le fasse.

---

## 5. L'ajouter à l'écran d'accueil de ton iPad

1. Ouvre l'adresse du site **dans Safari** (pas dans une autre application).
2. Touche le bouton **Partager** (carré avec une flèche vers le haut).
3. Fais défiler et touche **Sur l'écran d'accueil**.
4. Touche **Ajouter**.
5. Ouvre l'application **depuis cette icône**, toujours.

**Important :** installe-la **avant** de saisir tes vraies données. Safari peut effacer les données des sites « simplement visités » après une semaine sans usage ; une application installée sur l'écran d'accueil est mieux protégée. Fais quand même tes sauvegardes.

Une fois ouverte une première fois avec Internet, elle fonctionne aussi **sans connexion**.

---

## 6. Autoriser l'accès à tes boîtes Gmail et Outlook (étape future)

Ce n'est pas encore branché. Voici ce que tu devras accepter le moment venu, pour que tu saches à quoi t'attendre.

**Principe.** Tu te connectes sur la page officielle de Google ou de Microsoft et tu acceptes « lecture seule ». L'application reçoit un accès limité, **jamais ton mot de passe**. Tu peux le retirer à tout moment :
- Google : compte Google → Sécurité → Connexions via Google (ou « Applications tierces »).
- Microsoft : compte Microsoft → Confidentialité → Applications et services.

**Ce que « lecture seule » permet** : lire tes mails et leurs réponses pour détecter qui a répondu. **Ce que ça ne permet pas** : envoyer, supprimer ou modifier un mail.

**Démarches à faire une seule fois :**
- **Gmail (2 boîtes)** : créer un projet gratuit dans Google Cloud, y activer l'accès Gmail en lecture seule. Tant que l'application n'est pas validée par Google (inutile pour un usage perso), l'autorisation expire **tous les 7 jours** : il faudra te reconnecter chaque semaine.
- **Outlook (APAJH)** : enregistrer l'application chez Microsoft (Azure). Comme c'est un compte professionnel, **l'administrateur informatique de l'APAJH peut bloquer** ce type d'autorisation. Cela se saurait seulement à l'essai.

Quand tu voudras avancer, dis-le-moi : je te guiderai pas à pas, boîte par boîte, en commençant par une des deux Gmail.

---

## 7. Ce qui a été testé, et ce qui ne l'a pas été

**Testé et validé :**
- 20 tests automatiques des règles (qui a répondu, relances, bilans, historique, calculs sans donnée = « Pas assez de données », export/import) : `node test.js`.
- Parcours complet dans un vrai navigateur (Chromium) avec un écran de la taille d'un iPad : créer un objectif, créer un échange groupé, marquer des réponses, relancer, échange complet, bilans, rechargement sans perte, export puis import sur un appareil vierge, fichier invalide refusé, mode sombre, fonctionnement hors connexion. Aucune erreur.

**Non testé (honnêtement) :**
- Sur un **vrai iPad / Safari** : l'installation sur l'écran d'accueil, le comportement exact du stockage, l'ouverture des fichiers de sauvegarde et d'agenda (.ics), la copie du texte de relance, le bouton « Ouvrir dans Mail ».
- Toute connexion Gmail / Outlook (elle n'existe pas encore).

Si quelque chose se comporte bizarrement sur l'iPad, dis-moi précisément ce que tu vois : je corrigerai.

---

## 8. Règles de calcul des bilans

- Un taux ou une moyenne n'est calculé que sur ce qui était **prévu et évaluable**.
- Sans donnée : **« Pas assez de données »**, jamais 0.
- Un jour sans aucune saisie ni deadline prévue est **exclu** des calculs.
- Une deadline terminée en retard compte comme **non tenue**.
- Les semaines passées gardent les objectifs et échéances qu'elles avaient, même s'ils ont été modifiés ou supprimés depuis.
- Les tendances comparent deux chiffres ; elles n'expliquent jamais pourquoi.
