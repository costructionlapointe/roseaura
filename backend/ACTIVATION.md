# Activation de l’administration RoseAura

Cette branche est préparatoire. Le site public conserve son contenu tant que le service n’est pas activé. Aucun mot de passe ni secret n’est présent dans le dépôt.

1. Créer un projet Supabase dédié à RoseAura, après autorisation du propriétaire. Ne pas utiliser le projet des applications Lapointe.
2. Désactiver les inscriptions publiques et les connexions anonymes. Configurer les URL autorisées sur `https://roseauras.ca/admin/`. Activer la protection contre les mots de passe compromis et fixer une durée courte pour les jetons.
3. Appliquer `setup.sql`. Exécuter les tests d’autorisation sur le projet, puis les contrôles de sécurité Supabase.
4. Créer le compte du propriétaire dans Supabase Auth, puis attribuer **uniquement à cet utilisateur** le rôle `admin` dans `ra_roles`, depuis l’interface du propriétaire. Aucun premier visiteur ne peut devenir administrateur.
5. Déployer `accounts.ts` comme fonction `ra-accounts`, avec la vérification JWT activée. Les secrets intégrés Supabase restent côté serveur. Restreindre les origines à Roseauras.ca.
6. Renseigner `cms-config.js` avec l’URL et la **clé publique publishable**, jamais une clé secrète ni `service_role`.
7. Vérifier en environnement de test les connexions, uploads, deux modifications concurrentes, publication, restauration, déconnexion et refus d’accès au gestionnaire pour les fonctions réservées au propriétaire. Vérifier les écrans sur téléphone et ordinateur.
8. Le propriétaire crée le compte `gestionnaire@example.com` depuis la section Accès, avec un mot de passe unique transmis en privé. Tester ce compte puis le changement de son mot de passe.
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

Préparation uniquement : aucune base distante, aucun compte et aucun déploiement n’ont été créés. Validation locale : 24 contrôles Postgres/PGlite de permissions et transactions, 4 contrôles de la fonction de création de comptes (transport simulé), 10 contrôles navigateur des parcours public/administration (transport Auth/REST simulé). Les tests se lancent avec `npm ci`, `npx playwright install chromium`, puis `npm test`. L’activation réelle et les tests complets restent requis.
