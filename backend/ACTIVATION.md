# Activation de l’administration RoseAura

Le service de contenu RoseAura est activé. Les comptes et invitations sont stockés uniquement dans le service sécurisé. Aucun mot de passe ni secret n’est présent dans le dépôt. Le compte gestionnaire choisit son propre mot de passe grâce à un lien privé à usage unique.

1. Créer un projet Supabase dédié à RoseAura, après autorisation du propriétaire. Ne pas utiliser le projet des applications Lapointe.
2. Conserver les droits d’accès indépendants des inscriptions : seuls les comptes explicitement inscrits dans ra_roles peuvent gérer le contenu. Les invitations utilisent un fragment de lien puis une vérification POST, sans dépendre d’un redirecteur externe. Les nouveaux utilisateurs sans rôle n’ont aucun accès. La protection payante contre les mots de passe compromis est facultative.
3. Appliquer `setup.sql`. Exécuter les tests d’autorisation sur le projet, puis les contrôles de sécurité Supabase.
4. Créer le compte du propriétaire dans Supabase Auth, puis attribuer **uniquement à cet utilisateur** le rôle `admin` dans `ra_roles`, depuis l’interface du propriétaire. Aucun premier visiteur ne peut devenir administrateur.
5. Déployer `accounts.ts` comme fonction `ra-accounts`, avec la vérification JWT activée. Les secrets intégrés Supabase restent côté serveur. Restreindre les origines à Roseauras.ca.
6. Renseigner `cms-config.js` avec l’URL et la **clé publique publishable**, jamais une clé secrète ni `service_role`.
7. Vérifier en environnement de test les connexions, uploads, deux modifications concurrentes, publication, restauration, déconnexion et refus d’accès au gestionnaire pour les fonctions réservées au propriétaire. Vérifier les écrans sur téléphone et ordinateur.
8. Le propriétaire invite le gestionnaire depuis la section Accès et transmet uniquement le lien privé à usage unique. Le gestionnaire choisit son propre mot de passe. La même section permet de renouveler un lien d’accès.
9. Fusionner cette branche et publier par GitHub Pages, sans toucher au domaine, aux DNS ou au design public. Le premier brouillon n’est mis en ligne qu’après aperçu et publication volontaire.

## Choix et limites

- Les modifications sont enregistrées dans le service de contenu : Melissa n’obtient aucun accès GitHub, hébergeur, DNS ou facturation.
- Les autorisations sont basées sur une table que les clients ne peuvent pas écrire, jamais sur des données de profil modifiables par l’utilisateur.
- Les textes sont du texte brut. Aucun code HTML, JavaScript, CSS, clé ou lien de paiement ne peut être édité depuis le tableau de bord.
- Chaque sauvegarde/publication/restauration conserve un instantané, auteur et heure. Les médias sont immuables pour conserver les photos des anciennes versions. Une suppression retire l’élément du contenu, sans détruire son historique.
- Une restauration crée un nouveau brouillon : le propriétaire doit vérifier et publier pour modifier le site public.
- Aucun inventaire n’existe actuellement dans le site. Aucune gestion de stock fictive n’a été ajoutée. Le panier et les liens de paiement existants sont conservés; les nouveaux produits restent « bientôt disponibles » jusqu’à configuration commerciale par le propriétaire.
- Les articles disposent d’un état visible/retiré. La publication du document met en ligne uniquement ceux marqués visibles.
- Les catégories, prix et prix avant promotion sont éditables. Les réglages de paiements, coûts fournisseurs, structure et infrastructure restent hors de cette interface.
- Le compte propriétaire conserve l’accès technique via ses comptes habituels; le tableau de bord n’expose pas de secrets.
- La session d’administration est uniquement en mémoire, aucune donnée de session dans le dépôt ou localStorage. L’expiration impose une nouvelle connexion.
- Les instantanés d’application ne remplacent pas une sauvegarde hors service. Les options de sauvegarde complète dépendront du forfait activé.
- L’identification des textes utilise la structure actuelle de la page. Une future refonte du code public exige de migrer les identifiants avec les textes sauvegardés.

## État de livraison

Service distant et rôles configurés. La fonction de gestion des comptes exige un JWT valide puis le rôle Administrateur. Aucune fonction d’initialisation publique ou clé d’accès privilégiée permanente n’existe. Validation locale : 24 contrôles Postgres/PGlite de permissions et transactions, 4 contrôles de la fonction de création de comptes (transport simulé), 11 contrôles navigateur des parcours public/administration (transport Auth/REST simulé). Les tests se lancent avec `npm ci`, `npx playwright install chromium`, puis `npm test`. 17 contrôles supplémentaires ont été réalisés avec le service réel : Auth, données, permissions, aperçu, publication, restauration et téléversement de photo. La protection payante contre les mots de passe compromis n’est pas incluse dans le forfait gratuit; un mot de passe unique long est requis par l’interface.
