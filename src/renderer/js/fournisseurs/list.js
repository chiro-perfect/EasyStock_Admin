// src/renderer/js/fournisseurs/list.js

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

// Ensure the logout function exists if the logout button is used in the header
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

document.addEventListener('DOMContentLoaded', () => {
    displayCurrentDate(); 
    loadSuppliers(); // Loads suppliers on startup

    const supplierSearchInput = document.getElementById('supplierSearch');
    if (supplierSearchInput) {
        supplierSearchInput.addEventListener('keyup', (event) => {
            loadSuppliers(event.target.value); // Reloads suppliers with the search term
        });
    }
});

// Loads suppliers and displays them in the table
async function loadSuppliers(searchTerm = '') {
    const suppliersTableBody = document.getElementById('suppliersTableBody');
    if (!suppliersTableBody) {
        console.error("L'élément 'suppliersTableBody' n'a pas été trouvé.");
        return;
    }

    suppliersTableBody.innerHTML = '<tr><td colspan="7" class="loading-message">Chargement des fournisseurs...</td></tr>'; 

    if (window.electronAPI && typeof window.electronAPI.getSuppliers === 'function') {
        try {
            const result = await window.electronAPI.getSuppliers(searchTerm);

            if (result.success && result.data) {
                suppliersTableBody.innerHTML = ''; // Clear loading message
                if (result.data.length > 0) {
                    result.data.forEach(supplier => {
                        const row = suppliersTableBody.insertRow();
                        row.insertCell(0).textContent = supplier.idFournisseur;
                        row.insertCell(1).textContent = supplier.nom;
                        row.insertCell(2).textContent = supplier.contact || 'N/A'; // Affiche le champ 'contact' de la BDD (qui est l'email)
                        row.insertCell(3).textContent = supplier.adresse || 'N/A'; 
                        
                        // Handle potential 'Invalid Date' for created_at
                        const createdAtDate = new Date(supplier.created_at);
                        row.insertCell(4).textContent = isNaN(createdAtDate) ? 'N/A' : createdAtDate.toLocaleDateString('fr-FR');

                        // Handle potential 'Invalid Date' for updated_at
                        const updatedAtDate = new Date(supplier.updated_at);
                        row.insertCell(5).textContent = isNaN(updatedAtDate) ? 'N/A' : updatedAtDate.toLocaleDateString('fr-FR');

                        const actionsCell = row.insertCell(6); 
                        actionsCell.className = 'actions';

                        const editButton = document.createElement('button');
                        editButton.className = 'action-btn edit-btn';
                        editButton.textContent = 'Modifier';
                        editButton.dataset.id = supplier.idFournisseur;
                        editButton.onclick = handleEditClick;
                        actionsCell.appendChild(editButton);

                        const deleteButton = document.createElement('button');
                        deleteButton.className = 'action-btn delete-btn';
                        deleteButton.textContent = 'Supprimer';
                        deleteButton.dataset.id = supplier.idFournisseur;
                        deleteButton.onclick = handleDeleteClick;
                        actionsCell.appendChild(deleteButton);
                    });
                } else {
                    suppliersTableBody.innerHTML = '<tr><td colspan="7" class="no-data-message">Aucun fournisseur trouvé.</td></tr>';
                }
            } else {
                console.error('Failed to load suppliers:', result.error);
                suppliersTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Erreur: ${result.error || 'Impossible de charger les fournisseurs.'}</td></tr>`;
                showCustomModal(`Erreur de chargement des fournisseurs: ${result.error || 'Inconnu'}`); 
            }
        } catch (error) {
            console.error('Erreur d\'appel IPC pour getSuppliers:', error); 
            suppliersTableBody.innerHTML = '<tr><td colspan="7" class="error-message">Erreur de communication avec l\'application.</td></tr>';
            showCustomModal('Erreur de communication avec l\'application lors du chargement des fournisseurs.'); 
        }
    } else {
        suppliersTableBody.innerHTML = '<tr><td colspan="7" class="error-message">API Electron non disponible.</td></tr>';
        showCustomModal('Fonctionnalité de chargement des fournisseurs non disponible.'); 
    }
}

function handleEditClick(event) {
    const supplierId = event.target.dataset.id;
    window.location.href = `../fournisseurs/edit.html?id=${supplierId}`;
}

async function handleDeleteClick(event) {
    const supplierId = event.target.dataset.id;
    showCustomModal(`Êtes-vous sûr de vouloir supprimer le fournisseur avec l'ID ${supplierId} ?`, async (confirmed) => {
        if (confirmed) {
            if (window.electronAPI && typeof window.electronAPI.deleteSupplier === 'function') {
                try {
                    const result = await window.electronAPI.deleteSupplier(parseInt(supplierId));
                    if (result.success) {
                        showCustomModal('Fournisseur supprimé avec succès.');
                        loadSuppliers(); 
                    } else {
                        showCustomModal(`Erreur lors de la suppression: ${result.error || 'Inconnu'}`);
                    }
                } catch (error) {
                    console.error("Erreur d'appel IPC pour deleteSupplier:", error);
                    showCustomModal("Erreur de communication avec l'application.");
                }
            } else {
                showCustomModal("Fonctionnalité de suppression non disponible.");
            }
        }
    });
}

// Fonction pour réinitialiser les filtres et recharger tous les fournisseurs
function resetFilters() {
    document.getElementById('supplierSearch').value = '';
    loadSuppliers(); 
}
