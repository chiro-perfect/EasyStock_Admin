// src/renderer/js/fournisseurs/edit.js

// Function to display the current date
function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = today.toLocaleDateString('fr-FR', options);
    }
}

// Custom modal function instead of alert/confirm
function showCustomModal(message, onConfirm = null) {
    let modal = document.getElementById('customModal');
    let overlay = document.getElementById('modalOverlay');

    // Create modal elements if they don't exist
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customModal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%); /* Centrage horizontal et vertical */
            background-color: var(--primary-medium); /* Use CSS variable */
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            color: var(--text-light); /* Light text */
            text-align: center;
            max-width: 90vw; /* Responsive */
            width: 400px; /* Max width */
        `;
        document.body.appendChild(modal);
    }

    if (!overlay) {
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
            if (onConfirm) { // If there's a confirm callback, simulate cancellation if overlay clicked
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
            onConfirm(true); // Confirmed
        }
    };

    if (onConfirm) {
        document.getElementById('modalCancelBtn').onclick = () => {
            modal.style.display = 'none';
            document.getElementById('modalOverlay').style.display = 'none';
            onConfirm(false); // Cancelled
        };
    }
}


// Assurez-vous d'avoir la fonction logout si vous utilisez le bouton de déconnexion
async function logout() {
    if (window.electronAPI && typeof window.electronAPI.logout === 'function') {
        try {
            const result = await window.electronAPI.logout();
            if (result.success) {
                // Rediriger vers la page de connexion ou une page d'accueil publique
                window.location.href = '../auth/login.html';
            } else {
                showCustomModal(`Erreur de déconnexion: ${result.error || 'Inconnue'}`);
            }
        } catch (error) {
            console.error('Erreur lors de l\'appel IPC de déconnexion:', error);
            showCustomModal('Erreur de communication avec l\'application lors de la déconnexion.');
        }
    } else {
        showCustomModal('Fonctionnalité de déconnexion non disponible.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    displayCurrentDate();
    
    // Récupérer l'ID du fournisseur depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const supplierId = urlParams.get('id');

    if (supplierId) {
        await loadSupplierData(supplierId);
    } else {
        showCustomModal('ID du fournisseur non trouvé dans l\'URL.');
        document.getElementById('editSupplierForm').style.display = 'none';
    }

    const editSupplierForm = document.getElementById('editSupplierForm');
    if (editSupplierForm) {
        editSupplierForm.addEventListener('submit', submitSupplierForm);
    }
});

async function loadSupplierData(id) {
    const formMessage = document.getElementById('formMessage');
    formMessage.style.display = 'none';

    if (window.electronAPI && typeof window.electronAPI.getSupplierById === 'function') {
        try {
            const result = await window.electronAPI.getSupplierById(parseInt(id));
            if (result.success && result.data) {
                const supplier = result.data;
                document.getElementById('supplierId').value = supplier.idFournisseur;
                document.getElementById('supplierName').value = supplier.nom;
                // Le champ "Contact" affiche désormais le champ 'contact' de la BDD (qui contient l'email)
                document.getElementById('supplierContact').value = supplier.contact || ''; 
                document.getElementById('supplierAddress').value = supplier.adresse || '';

                // Afficher les dates de création et de dernière mise à jour
                const createdAtDate = new Date(supplier.created_at);
                document.getElementById('createdAt').value = isNaN(createdAtDate) ? 'N/A' : createdAtDate.toLocaleDateString('fr-FR');
                
                const updatedAtDate = new Date(supplier.updated_at);
                document.getElementById('updatedAt').value = isNaN(updatedAtDate) ? 'N/A' : updatedAtDate.toLocaleDateString('fr-FR');

            } else {
                showCustomModal(`Erreur lors du chargement des données du fournisseur: ${result.error || 'Fournisseur introuvable.'}`);
                formMessage.textContent = `Erreur: ${result.error || 'Fournisseur introuvable.'}`;
                formMessage.className = 'message-area error';
                formMessage.style.display = 'block';
            }
        } catch (error) {
            console.error('Erreur d\'appel IPC pour getSupplierById:', error);
            showCustomModal('Erreur de communication avec l\'application lors du chargement du fournisseur.');
            formMessage.textContent = 'Erreur de communication avec l\'application.';
            formMessage.className = 'message-area error';
            formMessage.style.display = 'block';
        }
    } else {
        showCustomModal('Fonctionnalité de chargement du fournisseur non disponible.');
        formMessage.textContent = 'API Electron non disponible.';
        formMessage.className = 'message-area error';
        formMessage.style.display = 'block';
    }
}

async function submitSupplierForm(event) {
    event.preventDefault();

    const formMessage = document.getElementById('formMessage');
    formMessage.style.display = 'none';

    const supplierId = document.getElementById('supplierId').value;
    const supplierName = document.getElementById('supplierName').value;
    // La valeur du champ "Contact" sera envoyée comme le champ 'contact' pour la BDD
    const supplierContactValue = document.getElementById('supplierContact').value; 
    const supplierAddress = document.getElementById('supplierAddress').value;

    if (!supplierName || !supplierContactValue || !supplierAddress) {
        showCustomModal('Veuillez remplir tous les champs obligatoires.');
        return;
    }

    const supplierData = {
        idFournisseur: parseInt(supplierId),
        nom: supplierName,
        contact: supplierContactValue, // Le champ 'contact' de l'UI correspond à 'contact' pour la fonction updateSupplier de db.js
        adresse: supplierAddress
    };

    if (window.electronAPI && typeof window.electronAPI.updateSupplier === 'function') {
        try {
            const result = await window.electronAPI.updateSupplier(parseInt(supplierId), supplierData); 

            if (result.success) {
                showCustomModal('Fournisseur mis à jour avec succès !', () => {
                    window.location.href = './list.html'; // Rediriger après confirmation
                });
            } else {
                showCustomModal(`Erreur lors de la mise à jour: ${result.error || 'Inconnu'}`);
                formMessage.textContent = `Erreur lors de la mise à jour: ${result.error || 'Inconnu'}`;
                formMessage.className = 'message-area error';
                formMessage.style.display = 'block';
            }
        } catch (error) {
            console.error('Erreur d\'appel IPC pour updateSupplier:', error);
            showCustomModal('Erreur de communication avec l\'application.');
            formMessage.textContent = 'Erreur de communication avec l\'application.';
            formMessage.className = 'message-area error';
            formMessage.style.display = 'block';
        }
    } else {
        showCustomModal('Fonctionnalité de mise à jour du fournisseur non disponible.');
        formMessage.textContent = 'API Electron non disponible.';
        formMessage.className = 'message-area error';
        formMessage.style.display = 'block';
    }
}
