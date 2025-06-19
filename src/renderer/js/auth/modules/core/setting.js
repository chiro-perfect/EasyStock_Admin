// src/renderer/js/auth/modules/core/settings.js

// Variable pour stocker les informations de l'utilisateur actuellement chargé
let currentAdminUser = null;

// Fonction pour afficher la date actuelle
function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = today.toLocaleDateString('fr-FR', options);
    }
}

// Custom modal function instead of alert/confirm (copiée des autres fichiers JS)
function showModal(message, onConfirm = null) {
    let modal = document.getElementById('customModal');
    let overlay = document.getElementById('modalOverlay');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customModal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--primary-medium);
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            color: var(--text-light);
            text-align: center;
            max-width: 90%;
        `;
        document.body.appendChild(modal);

        overlay = document.createElement('div');
        overlay.id = 'modalOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 999;
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', () => {
            modal.style.display = 'none';
            overlay.style.display = 'none';
            if (onConfirm) {
                onConfirm(false);
            }
        });
    }

    modal.innerHTML = `
        <p>${message}</p>
        <div style="display: flex; justify-content: center; gap: 10px;">
            <button id="modalConfirmBtn" style="padding: 8px 15px; border: none; border-radius: 5px; background-color: var(--success-color); color: white; cursor: pointer;">OK</button>
            ${onConfirm ? '<button id="modalCancelBtn" style="padding: 8px 15px; border: none; border-radius: 5px; background-color: var(--danger-color); color: white; cursor: pointer;">Annuler</button>' : ''}
        </div>
    `;

    modal.style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';

    document.getElementById('modalConfirmBtn').onclick = () => {
        modal.style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
        if (onConfirm) {
            onConfirm(true);
        }
    };

    if (onConfirm) {
        document.getElementById('modalCancelBtn').onclick = () => {
            modal.style.display = 'none';
            document.getElementById('modalOverlay').style.display = 'none';
            onConfirm(false);
        };
    }
}

// Fonction de navigation (si nécessaire pour les boutons SVG)
function navigateToSettings() {
    // Si déjà sur la page settings, ne rien faire ou rafraîchir
    if (window.location.pathname.includes('/admin/settings.html')) {
        location.reload(); // Recharger la page si déjà sur celle-ci
    } else {
        window.location.href = './settings.html';
    }
}

function navigateToDashboard() {
    window.location.href = './dashboard.html';
}

// Fonction pour charger les informations du profil administrateur
async function loadAdminProfile() {
    const formMessage = document.getElementById('profileMessage');
    const userProfileNameElement = document.getElementById('userProfileName'); 
    const usernameInput = document.getElementById('username');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');

    if (!usernameInput || !firstNameInput || !lastNameInput) {
        console.error("Éléments de formulaire de profil non trouvés.");
        formMessage.textContent = "Erreur: Certains champs du formulaire de profil sont manquants.";
        formMessage.style.color = 'red';
        return;
    }

    if (window.electronAPI && typeof window.electronAPI.getUserById === 'function') {
        try {
            const adminId = 1; // Toujours supposer l'ID 1 pour le prototype
            const result = await window.electronAPI.getUserById(adminId);

            if (result.success && result.data) {
                currentAdminUser = result.data; 
                usernameInput.value = currentAdminUser.username || '';
                firstNameInput.value = currentAdminUser.first_name || ''; // Utilise first_name
                lastNameInput.value = currentAdminUser.last_name || '';   // Utilise last_name

                if (userProfileNameElement) {
                    userProfileNameElement.textContent = currentAdminUser.username || 'Admin';
                }

            } else {
                formMessage.textContent = result.error || "Erreur lors du chargement du profil administrateur.";
                formMessage.style.color = 'red';
                console.error("Erreur de chargement du profil admin:", result.error);
            }
        } catch (error) {
            formMessage.textContent = "Erreur de communication avec l'application pour charger le profil.";
            formMessage.style.color = 'red';
            console.error("Erreur IPC pour getUserById:", error);
        }
    } else {
        formMessage.textContent = "API Electron pour la gestion des utilisateurs non disponible.";
        formMessage.style.color = 'red';
        console.error("window.electronAPI.getUserById non disponible.");
    }
}

// Gestionnaire de soumission du formulaire de profil
async function handleAdminProfileFormSubmit(event) {
    event.preventDefault();

    const formMessage = document.getElementById('profileMessage');
    const username = document.getElementById('username').value.trim();
    const firstName = document.getElementById('firstName').value.trim(); 
    const lastName = document.getElementById('lastName').value.trim();
    
    if (!currentAdminUser || !currentAdminUser.idUser) {
        formMessage.textContent = "Impossible de récupérer l'ID utilisateur actuel pour la mise à jour.";
        formMessage.style.color = 'red';
        return;
    }

    if (!username) { 
        formMessage.textContent = "Le nom d'utilisateur est obligatoire.";
        formMessage.style.color = 'red';
        return;
    }

    formMessage.textContent = "Mise à jour en cours...";
    formMessage.style.color = 'orange';

    const userData = {
        idUser: currentAdminUser.idUser, 
        username: username,
        firstName: firstName === '' ? null : firstName, // Envoie null si vide
        lastName: lastName === '' ? null : lastName,   // Envoie null si vide
    };

    console.log("[settings.js] Données de profil à envoyer:", JSON.stringify(userData));

    if (window.electronAPI && typeof window.electronAPI.updateUser === 'function') {
        try {
            const result = await window.electronAPI.updateUser(userData);
            if (result.success) {
                formMessage.textContent = "Profil mis à jour avec succès !";
                formMessage.style.color = 'green';
                
                // Mettre à jour l'objet local currentAdminUser pour refléter les changements
                currentAdminUser.username = username;
                currentAdminUser.first_name = firstName; // Mettre à jour la propriété first_name
                currentAdminUser.last_name = lastName;   // Mettre à jour la propriété last_name
                
                // Mettre à jour le nom d'utilisateur affiché dans l'en-tête
                const userProfileNameElement = document.getElementById('userProfileName');
                if (userProfileNameElement) {
                    userProfileNameElement.textContent = username;
                }

            } else {
                formMessage.textContent = result.error || "Erreur lors de la mise à jour du profil.";
                formMessage.style.color = 'red';
                console.error("Erreur de mise à jour du profil:", result.error);
            }
        } catch (error) {
            formMessage.textContent = "Erreur de communication avec l'application lors de la mise à jour.";
            formMessage.style.color = 'red';
            console.error("Erreur IPC pour updateUser:", error);
        }
    } else {
        formMessage.textContent = "Fonctionnalité de mise à jour du profil non disponible.";
        formMessage.style.color = 'red';
        console.error("window.electronAPI.updateUser non disponible.");
    }

    setTimeout(() => {
        formMessage.textContent = '';
    }, 5000);
}

// Fonction de déconnexion (copiée des autres fichiers JS)
async function logout() {
    showModal('Êtes-vous sûr de vouloir vous déconnecter ?', async (confirmed) => {
        if (confirmed) {
            if (window.electronAPI && typeof window.electronAPI.logout === 'function') {
                await window.electronAPI.logout();
            } else {
                console.error("Impossible d'appeler la fonction de déconnexion.");
                showModal("La fonction de déconnexion n'est pas disponible.");
            }
        }
    });
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', async () => {
    displayCurrentDate();
    const userProfileNameSpan = document.querySelector('.main-header .user-profile');
    if (userProfileNameSpan && !userProfileNameSpan.id) {
        userProfileNameSpan.id = 'userProfileName'; 
    }

    await loadAdminProfile(); 

    const adminProfileForm = document.getElementById('adminProfileForm');
    if (adminProfileForm) {
        adminProfileForm.addEventListener('submit', handleAdminProfileFormSubmit);
    }
});
