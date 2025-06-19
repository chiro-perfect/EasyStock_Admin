EasyStock Admin - Application de Gestion de Stock (Client Lourd)
Le projet EasyStock Admin est une application de bureau (client lourd) robuste, développée avec Electron, conçue spécifiquement pour l'École Efrei Villejuif. Son objectif principal est de fournir une interface intuitive et fonctionnelle aux administrateurs pour gérer efficacement les fournisseurs, les produits, les commandes et les utilisateurs dans le cadre des approvisionnements de l'établissement. Elle utilise la même base de données que le projet web EasyStock, assurant une gestion centralisée des données.

Fonctionnalités Clés Côté Administration
EasyStock Admin intègre plusieurs modules essentiels pour une gestion complète :

1. Authentification et Accès Sécurisé
Connexion Administrateur Exclusive : Seuls les utilisateurs avec le role 'admin' peuvent se connecter à l'interface, garantissant un accès contrôlé aux fonctionnalités sensibles.

Sécurité des Mots de Passe : Les mots de passe sont hachés de manière sécurisée en base de données (password_hash() et vérifiés via password_verify()) pour garantir qu'ils ne sont jamais stockés en texte clair.

Communication Sécurisée : Les interactions entre l'interface utilisateur (processus de rendu) et le cœur de l'application (processus principal) se font via des canaux IPC (Inter-Process Communication) sécurisés, exposés via un script preload.js pour empêcher l'accès direct aux modules Node.js.

2. Gestion des Utilisateurs
L'application permet aux administrateurs de gérer les comptes utilisateurs du système :

Consultation des Utilisateurs : Affichez les informations de tous les utilisateurs (idUser, nom, prénom, poste, username, password, role, created_at).

Mise à Jour des Profils : Modifiez les informations des utilisateurs, y compris leur rôle.

Création et Suppression : Ajoutez de nouveaux utilisateurs ou supprimez des comptes existants.

3. Gestion des Fournisseurs
Les administrateurs peuvent gérer le répertoire des fournisseurs de l'école :

Ajout de Fournisseurs : Enregistrez de nouveaux fournisseurs avec leurs coordonnées (idFournisseur, nom, mail, téléphone, adresse, created_at).

Modification et Suppression : Mettez à jour les informations existantes des fournisseurs ou supprimez-les du système.

Consultation : Accédez facilement à la liste complète des fournisseurs.

4. Gestion des Produits
Ce module permet une administration complète du catalogue de produits :

Ajout de Produits : Enregistrez de nouveaux articles avec leur désignation, quantité, et prix, ainsi que leur idFournisseur associé.

Modification et Suppression : Ajustez les détails des produits existants (par exemple, la quantité en stock) ou retirez des articles du catalogue.

Consultation des Stocks : Visualisez les quantités disponibles et les prix des produits, aidé par des graphiques de stock par catégorie.

5. Gestion des Commandes
Le cœur de la gestion des flux de l'école :

Suivi des Commandes : Visualisez toutes les commandes passées par les administrateurs (idCommande, quantité, created_at, statut, idProduit, idUser).

Mise à Jour des Statuts : Changez le statut des commandes (par exemple, de "en cours" à "traitée").

Consultation des Détails : Accédez aux produits spécifiques inclus dans chaque commande.

6. Gestion des Achats
Ce module permet de suivre les transactions avec les fournisseurs :

Enregistrement des Achats : Suivez les achats effectués auprès des fournisseurs (idAchat, prix, statut, created_at, idFournisseur, idUser).

Suivi des Statuts d'Achat : Mettez à jour le statut des achats (par exemple, de "en cours" à "traité").

7. Tableau de Bord et Rapports
Statistiques Générales : Un tableau de bord affiche des indicateurs clés (produits en faible stock, activités récentes, etc.).

Rapports Détaillés : Générez des rapports textuels sur les stocks, les fournisseurs, les commandes et les achats, utiles pour l'analyse et la prise de décision.

Architecture et Technologies
EasyStock Admin est construite sur une architecture client-serveur, tirant parti des technologies web pour une application de bureau :

Front-end (Processus de Rendu) :

HTML / CSS : Pour la structure et le style de l'interface utilisateur graphique (GUI).

JavaScript : Gère l'interactivité et la logique côté client.

Electron Renderer Process : Chaque fenêtre exécute le code web dans un environnement isolé.

Back-end (Processus Principal) :

Node.js : Gère la logique métier, la sécurité (authentification via auth.service.js), et les interactions avec la base de données.

IPC (Inter-Process Communication) : Communication sécurisée entre les processus de rendu et principal via ipcMain et ipcRenderer.

preload.js : Expose une API sécurisée au processus de rendu via contextBridge, sans donner d'accès direct à Node.js.

mysql2/promise : Pilote MySQL pour les interactions asynchrones avec la base de données.

bcryptjs : Pour le hachage sécurisé des mots de passe.

dotenv : Pour la gestion des variables d'environnement (informations sensibles de la DB).

Base de Données :

MySQL : La base de données est partagée avec le projet web EasyStock et contient les tables User, Fournisseur, Achat, Produit, et Commande.

Sécurité
La sécurité est une caractéristique fondamentale de EasyStock Admin :

Isolation du Contexte (contextIsolation: true) : Empêche le code web d'accéder directement aux ressources du système via Node.js.

Désactivation de l'Intégration Node.js (nodeIntegration: false) : Le code web s'exécute comme dans un navigateur web standard, sans accès aux APIs Node.js.

API contextBridge : Seules les fonctions nécessaires sont exposées de manière contrôlée du processus principal au processus de rendu.

Hachage des Mots de Passe : Tous les mots de passe sont hachés avec bcryptjs avant d'être stockés.

Validation des Entrées : Toutes les données utilisateur sont validées pour prévenir les injections SQL et autres vulnérabilités.


Bachar ALAOUI MEDAGHRI Email : bachar.alaoui@gmail.com
