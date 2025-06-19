// src/main/services/auth.service.js

// Importe le module db.js qui contient la logique d'authentification détaillée
// Le chemin est '../database/db' car auth.service.js est dans src/main/services/
// et db.js est dans src/main/database/
const db = require('../database/db'); 

module.exports = {
  /**
   * Tente de connecter un utilisateur. Seuls les utilisateurs avec le rôle 'admin'
   * seront autorisés à se connecter avec succès au tableau de bord.
   * @param {string} username - Le nom d'utilisateur.
   * @param {string} password - Le mot de passe.
   * @returns {Promise<Object>} - Le résultat de l'authentification (success, message, user).
   */
  async login(username, password) {
    try {
      console.log(`[Auth Service] Tentative de connexion pour ${username}.`);
      // Appelle la fonction authenticateUser de db.js pour gérer la logique de connexion
      // Cette fonction renverra { success: true, user: ... } ou { success: false, message: ... }
      const authResult = await db.authenticateUser(username, password);
      console.log("[Auth Service] Résultat de db.authenticateUser:", authResult);

      // Si l'authentification est réussie du point de vue de la base de données (identifiant/mot de passe corrects, compte non bloqué)
      if (authResult.success) {
        // Maintenant, vérifie spécifiquement si l'utilisateur a le rôle 'admin'
        if (authResult.user && authResult.user.role === 'admin') {
          console.log(`[Auth Service] Connexion autorisée pour l'administrateur : ${username}`);
          return authResult; // Retourne le succès et les données de l'utilisateur
        } else {
          // L'utilisateur est authentifié, mais n'est pas un administrateur
          console.warn(`[Auth Service] Connexion refusée : L'utilisateur '${username}' n'a pas le rôle administrateur.`);
          return { success: false, message: "Accès refusé. Seuls les administrateurs peuvent se connecter à cette interface." };
        }
      } else {
        // L'authentification a échoué dans db.js (mauvais mot de passe, compte verrouillé, ou utilisateur non trouvé)
        console.warn(`[Auth Service] Échec de l'authentification pour ${username}: ${authResult.message}`);
        return authResult; // Renvoie directement le message d'erreur de db.js
      }
    } catch (error) {
      console.error('[Auth Service] Erreur inattendue lors de la tentative de connexion:', error.message, error);
      // Retourne une erreur générique pour des raisons de sécurité en cas d'erreur inattendue
      return { success: false, message: "Une erreur interne est survenue lors de la connexion. Veuillez réessayer." };
    }
  },

  // Vous pouvez ajouter d'autres fonctions d'authentification ici si nécessaire.
};
