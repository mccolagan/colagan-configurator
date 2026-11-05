# Colagan Configurator — cahier des charges (étape 1)

Application web statique pour configurer **visuellement** le clavier split Colagan V2 (firmware Vial) depuis le
navigateur : touches, éclairage RGB en direct, sauvegarde / restauration. Remplace l'usage de vial.rocks, jugé
vieillot, sans rien changer au firmware. Les étapes 2 et 3 (couleurs par couche éditables, miroir RGB temps réel)
sont hors périmètre mais l'architecture doit les prévoir.

Ce document sert de **prompt d'architecture** : chaque section liste les décisions prises, les points d'attention,
et des cases à cocher qui constituent la définition de « terminé ».

---

## 1. Contexte

| Élément | Valeur |
|---|---|
| Clavier | Colagan V2, split RP2040 (droite : Pico, gauche : Pico W), 58 touches, 58 LED (29 par moitié) |
| Firmware | Fork `vial-qmk` ; sources dans `~/perso/clavier/colagan-pico-split-keyboard/firmware/colagan_v2/` |
| USB | VID `0xFEED`, PID `0x0004`, n° de série `vial:f64c2b3c`, produit « Colagan V2 » |
| Vial | protocole 6, UID `0x0EDC4207FC15EEC7` (octets `0e dc 42 07 fc 15 ee c7`) |
| Matrice | 10 × 6 ; gauche lignes 0-4, droite lignes 5-9 ; `[r, c]` = switch CH(6r+c+1) d'une moitié |
| Couches | 8 : 0 BASE, 1 FN, 2 FPS, 3 MMO, 4 MMO_UI, 5 SEL (sélecteur), 6-7 libres |
| Touche perso | `SEL x3` = `QK_KB_0` (`0x7E00`) : 3 appuis < 500 ms ouvrent le sélecteur (`customKeycodes` du vial.json) |
| RGB | VialRGB, luminosité max 64/255 (budget USB), couleurs imposées par couche compilées (`ledmaps`) |
| OS de l'utilisateur | Linux (règle udev `50-qmk.rules` déjà en place pour `FEED:0004`) et Windows |
| Utilisateur | gaucher : souris main gauche, couches de jeu sous la main droite ; OS en **AZERTY FR** |

## 2. Objectifs et non-objectifs

**Objectifs (étape 1)**
- [x] Éditer n'importe quelle touche de n'importe quelle couche en cliquant sur un dessin fidèle du clavier.
- [x] Régler le RGB (effet, couleur, luminosité, vitesse) avec effet **immédiat** sur le clavier, puis enregistrer.
- [x] Sauvegarder / restaurer la configuration dans un fichier **compatible `.vil`** (Vial, Pipette).
- [x] Éditer macros, tap-dance et combos.
- [x] Afficher les étiquettes **telles qu'elles s'écrivent en AZERTY** (bascule QWERTY possible).

**Non-objectifs (étape 1)**
- Modifier ou flasher le firmware (pas de WebUSB/UF2 dans l'app).
- Éditer les couleurs par couche (étape 2 : nécessite de les déplacer en EEPROM côté firmware).
- Afficher l'état réel des LED (étape 3 : nécessite une commande firmware).
- Firefox / Safari (pas de WebHID) : message explicite, pas de contournement.

## 3. Décisions d'architecture

| Sujet | Décision |
|---|---|
| Stack | **Vite + TypeScript strict**, sans framework ; UI en modules TS + **SVG** pour le clavier |
| Dépôt | **séparé** : `colagan-configurator` (GitHub), ce dossier `~/perso/clavier/configurator/` |
| Hébergement | GitHub Pages, déployé par GitHub Actions ; `base` Vite = `/colagan-configurator/` |
| Périmètre | **Colagan d'abord, générique possible** : rien de spécifique en dur hors d'un « profil clavier » |
| Design | **sobre**, clair / sombre automatique (`prefers-color-scheme`) + bascule manuelle |
| Langue | **français**, textes centralisés (i18n prête, anglais ajoutable sans toucher au code) |
| Écritures | **immédiates** dans le clavier + **historique annuler / rétablir** (Ctrl+Z / Ctrl+Maj+Z) |
| Sauvegarde | format **`.vil`** (lecture + écriture), validé contre un export réel de Vial |
| Étiquettes | **AZERTY FR par défaut**, bascule QWERTY (noms QMK) |
| Qualité | Vitest (protocole), ESLint + Prettier, CI GitHub Actions, Playwright (WebHID simulé) |
| Docker | **projet dockerisé** : dev, tests, build et image de prod sans Node installé sur l'hôte (voir §7 bis) |

### Découpage en couches logicielles (à respecter)

```
src/
  transport/    WebHID : ouverture, envoi/réception de rapports 32 octets, file d'attente, timeouts
  protocol/     VIA + Vial + VialRGB : encodage/décodage pur (sans DOM), testable avec un faux transport
  keyboard/     modèle : définition (layout KLE), keymap[couche][ligne][col], macros, tap-dance, combos, RGB
  keycodes/     table keycode <-> nom QMK <-> étiquette AZERTY/QWERTY, catégories du sélecteur
  profiles/     profil Colagan (noms de couches, couleurs ledmaps de référence, aides) ; clé = UID Vial
  ui/           rendu SVG du clavier, panneaux, sélecteur de keycodes, RGB, historique, notifications
  io/           import / export .vil, instantanés locaux
  i18n/         fr.json (+ en.json plus tard)
```

- [x] `protocol/` n'importe ni DOM ni WebHID : une interface `Transport { send(bytes): Promise<Uint8Array> }`.
- [x] Un **faux transport** (clavier simulé en mémoire) sert aux tests unitaires, aux tests E2E et au mode démo. *(`FakeKeyboard`, calqué sur les réponses réelles du Colagan, réglages QMK compris)*
- [ ] Le profil Colagan est **optionnel** : un clavier Vial inconnu fonctionne avec sa seule définition.

## 4. Protocole (référence vérifiée dans `vial-qmk/quantum/via.h`, `vial.h`, `vial.c`, `vialrgb.*`)

Rapports HID de **32 octets**, interface raw HID **usage page `0xFF60`, usage `0x61`**. Avec WebHID :
`device.sendReport(0, data32)` (pas d'octet de report ID dans `data`, contrairement à hidraw).
Valeurs multi-octets **big-endian côté VIA** (keycodes, offsets), **little-endian côté Vial** (taille, UID).

| Commande | Octets | Usage |
|---|---|---|
| `0x01` protocole VIA | `01` | sanity check |
| `0x04` / `0x05` keycode | `04 L R C` → `.. .. .. .. KH KL` ; `05 L R C KH KL` | lire / écrire une touche |
| `0x11` nb de couches | `11` → `11 n` | 8 attendu |
| `0x12` / `0x13` buffer keymap | `12 OH OL len(≤28)` | lecture **en bloc** de la keymap (à privilégier) |
| `0x06` reset keymap | `06` | **confirmation obligatoire** |
| `0x0C`–`0x10` macros | count, taille buffer, get/set buffer, reset | `set` exige le déverrouillage |
| `0x07`/`0x08`/`0x09` + `0x41` | VialRGB set/get mode, save | voir ci-dessous |
| `0x0A` reset EEPROM | — | **confirmation forte** + instantané avant, efface tout |
| `0x0B` bootloader | — | exige le déverrouillage ; bouton derrière confirmation (fige le clavier) |
| `0xFE 0x00` | id Vial | protocole (u32 LE) + UID (8 octets) |
| `0xFE 0x01` / `0x02` | taille / bloc n de la définition | JSON **compressé LZMA**, par blocs de 32 octets |
| `0xFE 0x05`/`06`/`07`/`08` | état / début / poll / verrouillage | procédure de déverrouillage |
| `0xFE 0x09`–`0x0C` | réglages QMK (query/get/set/reset) | facultatif étape 1 |
| `0xFE 0x0D` + sous-cmd | entrées dynamiques | `00` nombres, `01/02` tap-dance, `03/04` combos, `05/06` key overrides, `07/08` alt-repeat |

**VialRGB** (`0x08` get / `0x07` set / `0x09` save) : `0x40` info, `0x41` mode courant
(`id u16 LE, vitesse, H, S, V`), `0x42` liste des effets supportés (paginée), `0x43` nb de LED, `0x44` infos LED.
- [x] Les **identifiants VialRGB ne sont pas les numéros d'effets QMK** (ex. 14 = cycle gauche-droite,
  19 = pinwheel, 5 = dégradé gauche-droite, 2 = couleur unie) : table issue de `vialrgb_effects.inc`.
- [x] La liste affichée vient de `0x42` (effets réellement compilés), jamais d'une liste en dur.

**Déverrouillage Vial** (le firmware n'est pas `VIAL_INSECURE`) : nécessaire pour **écrire des macros**,
**assigner `QK_BOOT`** (remplacé par `KC_NO` sinon), lire l'état de la matrice, sauter au bootloader.
- [x] L'UI détecte le besoin, affiche **quelles touches tenir** (positions renvoyées par `0xFE 0x05`,
  sur le Colagan : les deux touches 1,5U extérieures de la droite, haut et bas) et une jauge de progression.
- [x] Toute action protégée tentée sans déverrouillage est expliquée, jamais échouée en silence.

## 5. Fonctionnalités et critères d'acceptation

### 5.1 Connexion
- [x] Bouton « Connecter » → `navigator.hid.requestDevice` filtré sur l'usage page `0xFF60`.
- [x] Reconnexion automatique aux appareils déjà autorisés (`navigator.hid.getDevices()`), gestion du
  débranchement (`disconnect`) avec bandeau d'état et reprise propre.
- [x] Contrôles à la connexion : protocole Vial, UID → profil, nb de couches, taille matrice, définition.
- [x] Navigateur sans WebHID : page explicative (Chrome / Edge requis) + mode démo.
- [ ] Linux : message d'aide si l'ouverture échoue (règle udev hidraw), avec la règle à copier.
- [ ] Avertir que **Vial / Pipette ouverts en même temps** peuvent interférer.
- [x] Toutes les commandes passent par **une file unique** (une requête à la fois, timeout ~1 s, 2 essais).

### 5.2 Dessin du clavier
- [x] Rendu SVG à partir du **layout KLE** de la définition Vial : `x`, `y`, `w`, `h`, rotations `r/rx/ry`
  (pouces en arc à ±45° / ±22,5°), colonne extérieure 1,5U, moitié gauche en miroir.
- [ ] Mise à l'échelle responsive (écran large → téléphone en paysage), aucun défilement horizontal de page.
- [x] Onglets de couches nommés par le profil (BASE, FN, FPS, MMO, MMO UI, Sélecteur, 6, 7).
- [ ] Touches transparentes (`KC_TRNS`) et vides (`KC_NO`) visuellement distinctes ; option « afficher ce que
  donne la touche transparente » (couche résolue en dessous).
- [ ] Indication des couleurs `ledmaps` de référence du profil sur les couches de jeu (lecture seule, étape 1).

### 5.3 Édition des touches
- [x] Clic sur une touche → sélection ; panneau de keycodes par catégories :
  basiques, modificateurs, F-keys, navigation, pavé num, médias / système, souris, **couches**
  (`MO`, `TO`, `TG`, `OSL`, `LT(n, kc)`, `MT(mod, kc)`), **RGB** (`RM_*`), **système** (`QK_BOOT`, `EE_CLR`),
  **utilisateur** (`customKeycodes`, dont `SEL x3`), macros `M0..`, tap-dance `TD(n)`.
- [x] Recherche par nom ou par caractère tapé (« ù » trouve `KC_QUOT` en AZERTY).
- [x] Saisie avancée : keycode QMK brut (`LT(2, KC_SPC)`, `0x5225`) avec validation.
- [x] Écriture immédiate (`0x05`), relecture de contrôle, mise à jour du dessin ; échec → retour arrière + erreur.
- [x] **Annuler / rétablir** sur toute la session (touches, macros, tap-dance, combos) ; l'annulation réécrit
  l'ancienne valeur dans le clavier.
- [ ] *(reporté, cf. §12)* Glisser-déposer d'une touche sur une autre (échange) et copier / coller d'une couche entière.
- [x] Garde-fous : impossible de retirer **la dernière touche** permettant de quitter une couche de jeu
  (`SEL x3`, `TO(0)`, `MO`…) sans avertissement ; `QK_BOOT` signalé comme « fige le clavier ».
  *(confirmation pour `QK_BOOT` / `QK_CLEAR_EEPROM` ; avertissement si une couche atteinte par TO/TG/DF perd sa
  dernière sortie, transparence vers la couche 0 comprise ; SEL x3 déclaré sortie dans le profil)*

### 5.4 Étiquettes AZERTY
- [x] Table de correspondance keycode → caractère AZERTY FR (dont `KC_Q`→a, `KC_W`→z, `KC_SCLN`→m,
  `KC_M`→, , `KC_LBRC`→^, `KC_QUOT`→ù, `KC_GRV`→², `KC_NUBS`→<, rangée des chiffres & é " ' ( - è _ ç à ) =).
- [x] Combinaisons Shift et AltGr affichées en petit (ex. `KC_2` : é / 2 / ~).
- [x] Bascule AZERTY / QWERTY (noms QMK) mémorisée localement ; info-bulle avec le nom QMK exact.

### 5.5 RGB en direct
- [x] Lecture du mode courant et de la liste des effets supportés à la connexion.
- [x] Contrôles : effet (liste nommée en français), couleur (roue ou H/S), luminosité (bornée au max du
  firmware, 64), vitesse ; chaque changement est envoyé **immédiatement** (`0x07 0x41`), avec limitation
  de débit (~20 envois/s max, dernier état garanti).
- [x] Bouton « Enregistrer dans le clavier » (`0x09`) ; indicateur « modifié non enregistré ».
- [x] « Rétablir » revient aux valeurs lues à la connexion (le firmware ne permet pas de relire l'EEPROM).
- [x] Rappel : sur les couches FPS / MMO / sélecteur, des couleurs imposées masquent l'effet (`ledmaps`).

### 5.6 Macros, tap-dance, combos
- [x] Macros : liste, éditeur d'actions (texte, appui, relâche, frappe, délai), taille du buffer affichée ;
  écriture soumise au déverrouillage.
- [x] Tap-dance : appui / maintien / double appui / appui-maintien + délai (ms).
- [x] Combos : jusqu'à 4 touches → 1 keycode ; key overrides si le firmware en expose.
  *(key overrides et alt-repeat : sauvegardés / restaurés par le `.vil`, pas encore éditables)*
- [x] Texte de macro : avertissement « tapé en QWERTY » et conversion en frappes AZERTY (Shift / AltGr compris).
- [x] Nombre d'entrées lu via `0xFE 0x0D 0x00`, jamais supposé.

### 5.7 Sauvegarde / restauration
- [x] Export `.vil` : keymap, macros, tap-dance, combos, key overrides, réglages QMK, UID, versions.
- [x] Import `.vil` : vérification UID / dimensions, **aperçu des différences**, puis écriture en bloc
  avec barre de progression ; import partiel possible (keymap seule). *(écart : seules les différences sont
  écrites, une par une, plutôt qu'un bloc ; import partiel « keymap seule » pas encore proposé)*
- [ ] Le RGB n'est pas dans le `.vil` : export complémentaire optionnel (JSON) sans casser la compatibilité.
- [ ] **Instantané local automatique** (IndexedDB, par UID) à chaque connexion et après chaque modification.
  *(partiel : instantané `localStorage` avant chaque import + bouton manuel, 5 derniers gardés ; pas encore à la
  connexion ni par UID)*
- [ ] **Détection d'un reflash** : chaque compilation Vial remet la keymap par défaut (identifiant de build
  aléatoire). Si la keymap lue = celle par défaut et qu'un instantané plus riche existe → proposer de restaurer.
- [x] Format validé par **un `.vil` réel exporté de Vial** : fixture `tests/fixtures/colagan-v2-default.vil`
  (vial.rocks, keymap par défaut du 05/11/2026), aller-retour **octet pour octet** (JSON compact sur une ligne).
- [x] Structure constatée : `version` 1, `uid` (u64 = les 8 octets de l'UID lus en little-endian),
  `layout[8][10][6]` en **noms** de keycodes (`-1` = position sans touche, ex. `[9,5]`), `encoder_layout`,
  `layout_options` -1, `macro[16]` (listes d'actions), `vial_protocol` 6, `via_protocol` 9,
  `tap_dance[32]` = `[tap, hold, double_tap, tap_hold, term_ms]`, `combo[32]` = `[k1, k2, k3, k4, sortie]`,
  `key_override[32]` (objets `trigger`, `replacement`, `layers`, `trigger_mods`, `negative_mod_mask`,
  `suppressed_mods`, `options`), `alt_repeat_key[32]` (objets), `settings` {id QMK Settings: valeur} (26).
- [x] **`uid` > 2^53** : un `JSON.parse` standard l'arrondit → parseur préservant les grands entiers
  (BigInt / texte brut) pour la lecture comme pour l'écriture.

### 5.8 Mode démo (sans clavier)
- [x] Le faux transport simule un Colagan (définition, keymap par défaut, RGB) : l'app est explorable sans
  matériel, sous Firefox ou sur téléphone ; bandeau « Démo » permanent, aucune écriture réelle.

## 6. UX et design
- [ ] Sobre, lisible, contraste AA dans les deux thèmes ; le clavier occupe la zone centrale.
- [ ] Navigation au clavier (Tab / flèches sur les touches du dessin, Entrée pour éditer, Échap pour fermer).
- [ ] États explicites : déconnecté, connexion, prêt, écriture en cours, erreur, verrouillé / déverrouillé.
- [ ] Notifications courtes et non bloquantes ; confirmations seulement pour les actions destructrices.
- [ ] Aucun texte en dur hors `i18n/fr.json` ; dates et nombres localisés.

## 7. Qualité, CI, livraison
- [ ] TypeScript `strict`, ESLint + Prettier, aucun `any` dans `protocol/`.
- [ ] Vitest : encodage de chaque commande, décodage des réponses, keycodes (aller-retour nom ↔ valeur),
  décompression de la définition, `.vil` aller-retour.
- [ ] Playwright : parcours principaux en mode démo (connexion simulée, édition, annuler, export / import, RGB).
- [ ] GitHub Actions : lint + tests + build à chaque push ; déploiement Pages sur `main`.
- [x] Table des keycodes **générée** (script versionné, lecture **texte** du fichier, jamais d'exécution) depuis
  `~/perso/clavier/vial-gui/src/main/python/keycodes/keycodes_v6.py` (clone de `vial-kb/vial-gui`, `aef8222`) :
  dictionnaire nom Vial → valeur (519 entrées, ex. `KC_BSPACE` 0x2A, `KC_LSHIFT` 0xE1, `RM_VALU` 0x7849,
  `QK_BOOT` 0x7C00). Le `.vil` utilise ces noms historiques, pas les alias QMK actuels (`KC_BSPC`, `KC_LSFT`…).
- [x] Formes calculées, absentes de la table : `USERnn` = `0x7E00 + nn` (`customKeycodes`, `USER00` = `SEL x3`),
  `MO(n)` / `TO(n)` / `TG(n)` / `OSL(n)` / `LT(n, kc)`, modificateurs `LSFT(kc)`…, `MT(mod, kc)`, `TD(n)`, `M0..` :
  encodage / décodage testés sur toutes les valeurs de la fixture.
- [ ] README : usage, navigateurs supportés, règle udev Linux, mode démo, lien vers le dépôt du clavier.
- [ ] Licence (GPL-2.0-or-later, comme le firmware) ; pas de télémétrie, pas d'appel réseau à l'exécution.
- [ ] Bundle léger (cible < 300 ko gzip), dépendances minimales (une lib LZMA pour la définition).

## 7 bis. Docker

Tout le cycle passe par Docker : aucun Node / npm requis sur l'hôte. Le clavier n'est **jamais** monté dans un
conteneur : WebHID s'exécute dans le navigateur de l'hôte, le conteneur ne sert que les fichiers.

```
docker-compose.yml           # base : service app (node), volumes, réseau
docker-compose.override.yml  # dev (auto-chargé) : Vite HMR, code monté, port exposé
docker-compose.prod.yml      # prod : image nginx avec le build statique, sans volume de code, restart policy
.docker/
  node/Dockerfile            # node:<LTS>-alpine, version épinglée ; npm ci ; utilisateur non root
  nginx/Dockerfile           # multi-stage : build Vite → nginx:<x.y>-alpine
  nginx/default.conf         # fichiers statiques, cache des assets hashés, en-têtes de sécurité
  playwright/Dockerfile      # image officielle Playwright (version = dépendance du projet) pour l'E2E
.dockerignore
```

- [x] `docker compose up` : serveur Vite sur **`http://localhost:5173`** (HMR fonctionnel, code monté).
- [x] Commandes outillées via le conteneur : `docker compose run --rm app npm run lint|test|build`
  (ou cibles `make` équivalentes documentées dans le README).
- [x] `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` : app servie par nginx sur
  `http://localhost:8080` (mêmes fichiers que GitHub Pages, `base` configurable par variable de build).
- [x] E2E Playwright dans son conteneur, contre le serveur de dev ou l'image nginx.
- [ ] La CI GitHub Actions utilise les **mêmes images** que le local (pas de divergence de version Node).
- [x] Versions d'images épinglées (pas de `latest`), `node_modules` dans un volume nommé (pas sur l'hôte),
  fichiers créés avec l'UID de l'utilisateur hôte.
- [x] `.env` versionné avec les valeurs par défaut documentées (ports, `BASE_PATH`) ; `.env.local` ignoré ;
  aucun secret nécessaire au projet.

**Point d'attention majeur — contexte sécurisé :** WebHID n'existe que sur `https://` ou `http://localhost`.
Ouvrir le serveur Docker via l'IP du LAN (`http://192.168.x.x:5173`) **désactive WebHID** sans erreur claire :
- [x] Ports publiés sur `127.0.0.1` par défaut ; l'app détecte un contexte non sécurisé et l'explique.
- [ ] Si un accès depuis une autre machine est voulu : HTTPS (certificat local, ex. mkcert) documenté, en option.

## 8. Points d'attention

- **WebHID** : Chrome / Edge uniquement, HTTPS (GitHub Pages OK), geste utilisateur requis pour la 1re
  autorisation ; plusieurs interfaces HID exposées par le clavier → filtrer sur `0xFF60`.
- **Une requête à la fois** : le firmware répond en écho au même rapport ; deux requêtes concurrentes
  mélangent les réponses.
- **Endianness** mixte VIA (BE) / Vial (LE) ; la définition fait plusieurs kilo-octets (≈ 80 blocs de 32 o).
- **Définition compressée en XZ** (en-tête `FD 37 7A 58 5A`, CRC64), pas LZMA brut : lib `xz-decompress` (XZ Embedded en WebAssembly), validée sur la fixture `tests/fixtures/colagan-v2-definition.xz` (508 octets).
- **Keycodes** : deux vocabulaires (noms Vial dans le `.vil`, alias QMK dans le code) ; valeurs du protocole Vial 6 = QMK récent (`QK_KB_0` = `0x7E00`, `MO(n)` = `0x5220|n`…) ;
  ne pas reprendre d'anciennes tables VIA.
- **Reflash = keymap par défaut** (Vial `BUILD_ID` aléatoire) : la sauvegarde n'est pas un confort, c'est
  le filet de sécurité principal.
- **Maître = moitié branchée au PC** : la keymap lue est celle de la moitié branchée (en principe la droite) ;
  la gauche branchée seule a sa propre mémoire → afficher quelle moitié est connectée si détectable, sinon
  le rappeler.
- **RGB** : les écritures non enregistrées sont perdues au débranchement ; luminosité plafonnée par le firmware.
- **Couleurs par couche** compilées : l'app ne peut que les afficher en référence (étape 2 pour les éditer).
- **Ports clavier de KVM** : le clavier composite peut y être mal reconnu (diagnostic déjà rencontré).

## 9. Préparer les étapes 2 et 3 (sans les implémenter)
- [x] `protocol/` extensible par « commandes clavier personnalisées » (canal `id_custom_*` / commande dédiée) :
  `protocol/led-stream.ts` (commande `0xC0`).
- [x] Modèle RGB prévu pour des couleurs **par couche et par LED** (58 × 8) et une source « état réel ».
- [x] **Étape 2 faite** : couleurs (RGB ou « effet ») et effet propre de chaque couche, en EEPROM côté
  firmware (`led_layers.c`, protocole LED v2), éditables en mode « Couleurs » de la page Touches (pinceau,
  glisser, pipette Alt+clic, annuler / rétablir), aperçu de la couche sur le clavier. L'onglet RGB disparaît :
  l'effet global se règle en mode Couleurs sur la couche 0.
- [x] Rendu SVG capable d'afficher une couleur par touche à ~20 images/s sans recréer le DOM (`paintLeds`).
- [x] **Étape 3 faite** : aperçu « Éclairage réel » (`rgb/led-preview.ts`) d'après
  `colagan-pico-split-keyboard/docs/led-stream-protocol.md` ; onglets Touches et RGB, mode démo simulé.

## 10. Livrables de l'étape 1
- [ ] Dépôt `colagan-configurator` initialisé (Vite + TS, lint, tests, CI, Pages).
- [ ] Environnement Docker complet (dev, outils, E2E, image nginx de prod) décrit au §7 bis.
- [ ] App publiée sur GitHub Pages, testée sur le vrai clavier sous Linux et Windows (Chrome).
- [x] Fixture `.vil` réelle + faux clavier pour les tests.
- [ ] README et ce SPEC à jour (cases cochées, écarts documentés).

## 11. Décisions complémentaires (05/11/2026)
- Nom : dépôt **`colagan-configurator`**, app « Colagan Configurator »
  (URL Pages : `https://mccolagan.github.io/colagan-configurator/`).
- Actions risquées **exposées avec confirmation** : `QK_BOOT` / `EE_CLR` assignables (déverrouillage requis
  pour `QK_BOOT`) ; boutons « Réinitialiser la keymap » et « Effacer la mémoire » derrière une confirmation
  forte, précédés d'un **instantané automatique**.
- Image nginx de prod : **usage local uniquement** (vérifier le build) ; la version publique reste GitHub Pages.

## 12. Questions ouvertes
- Fonctions de confort (glisser-déposer / échange, copier-coller de couche, réglages QMK) : non tranché →
  **hors étape 1 par défaut** (§5.3, dernière puce, reportée), à confirmer.
