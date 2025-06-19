// src/renderer/js/auth/modules/core/login.js

document.addEventListener('DOMContentLoaded', () => {
  console.log("[Renderer Process] DOMContentLoaded pour login.js");

  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const notificationElement = document.getElementById('notification');

  // Vérification que tous les éléments nécessaires existent
  if (!loginForm) { console.error("[Renderer Process] loginForm non trouvé."); return; }
  if (!usernameInput) { console.error("[Renderer Process] usernameInput non trouvé."); return; }
  if (!passwordInput) { console.error("[Renderer Process] passwordInput non trouvé."); return; }
  if (!notificationElement) { console.error("[Renderer Process] notificationElement non trouvé."); return; }

  // Ajout de l'écouteur d'événement sur la soumission du formulaire
  loginForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // Empêche le rechargement de la page par défaut du formulaire
      console.log("[Renderer Process] Formulaire soumis.");

      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      
      // Réinitialise le message de notification et le cache
      notificationElement.textContent = '';
      notificationElement.className = 'message-container'; 
      notificationElement.style.display = 'none'; 

      // Vérification de base des champs avant d'envoyer
      if (!username || !password) {
          notificationElement.textContent = 'Veuillez entrer un nom d\'utilisateur et un mot de passe.';
          notificationElement.classList.add('error-message');
          notificationElement.style.display = 'flex'; 
          console.warn("[Renderer Process] Champs de connexion vides.");
          return;
      }

      try {
          console.log(`[Renderer Process] Appel à electronAPI.login pour ${username}...`);
          const response = await window.electronAPI.login({ username, password });
          console.log("[Renderer Process] Réponse reçue de main process:", response);

          if (response.success) {
              notificationElement.textContent = 'Connexion réussie ! Redirection...';
              notificationElement.classList.add('success-message'); 
              notificationElement.style.display = 'flex'; 

              console.log("[Renderer Process] Connexion réussie, redirection dans 1 seconde.");
              setTimeout(() => {
                  window.location.href = '../../views/admin/Dashboard.html'; 
              }, 1000); 
          } else {
              const errorMessage = response.error || 'Échec de la connexion. Veuillez vérifier vos identifiants.';
              notificationElement.textContent = errorMessage;
              notificationElement.classList.add('error-message'); 
              notificationElement.style.display = 'flex'; 

              console.error("[Renderer Process] Échec de connexion :", errorMessage);

              setTimeout(() => {
                  notificationElement.textContent = '';
                  notificationElement.className = 'message-container';
                  notificationElement.style.display = 'none';
              }, 5000);
          }
      } catch (error) {
          // CETTE PARTIE A ÉTÉ AMÉLIORÉE POUR AFFICHER L'ERREUR SPÉCIFIQUE
          const detailedErrorMessage = error.message || String(error); // Tente de récupérer le message d'erreur
          console.error(`[Renderer Process] Erreur inattendue lors de l'appel IPC : ${detailedErrorMessage}`, error);
          notificationElement.textContent = `Erreur interne: ${detailedErrorMessage}. Veuillez réessayer.`;
          notificationElement.classList.add('error-message');
          notificationElement.style.display = 'flex'; 

          setTimeout(() => {
              notificationElement.textContent = '';
              notificationElement.className = 'message-container';
              notificationElement.style.display = 'none';
          }, 5000);
      }
  });
});

