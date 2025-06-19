// src/renderer/js/suppliers/new.js

// Function to display the current date
function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = today.toLocaleDateString('fr-FR', options);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    displayCurrentDate(); 
    const newSupplierForm = document.getElementById('newSupplierForm');
    const formMessage = document.getElementById('formMessage');

    // Récupération des références aux éléments du formulaire
    const supplierNameInput = document.getElementById('supplierName');
    const supplierContactInput = document.getElementById('supplierContact');
    const supplierAddressInput = document.getElementById('supplierAddress');

    if (newSupplierForm) {
        newSupplierForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Empêche le rechargement de la page

            // Récupération des valeurs des champs
            const supplierName = supplierNameInput.value;
            const supplierContact = supplierContactInput.value;
            const supplierAddress = supplierAddressInput.value;

            // Validation simple côté client (en plus de l'attribut 'required' HTML5)
            if (!supplierName || !supplierContact || !supplierAddress) {
                formMessage.textContent = "Veuillez remplir tous les champs (Nom, Contact, Adresse) avant de soumettre.";
                formMessage.style.color = 'red';
                console.warn("[suppliers/new.js] Validation échouée: champs requis manquants.");
                return;
            }

            formMessage.textContent = "Ajout en cours...";
            formMessage.style.color = 'orange';

            const supplierData = {
                nom: supplierName,
                contact: supplierContact,
                adresse: supplierAddress
            };

            // LOG IMPORTANT: Affiche les données que le renderer va envoyer au main process
            console.log("[suppliers/new.js] Données du fournisseur à envoyer pour ajout:", JSON.stringify(supplierData));

            if (window.electronAPI && typeof window.electronAPI.addSupplier === 'function') {
                try {
                    const result = await window.electronAPI.addSupplier(supplierData);
                    if (result.success) {
                        formMessage.textContent = result.message || "Fournisseur ajouté avec succès !";
                        formMessage.style.color = 'green';
                        newSupplierForm.reset(); // Réinitialiser le formulaire après succès
                        console.log("[suppliers/new.js] Fournisseur ajouté avec succès via l'API.");
                    } else {
                        formMessage.textContent = result.error || "Erreur lors de l'ajout du fournisseur.";
                        formMessage.style.color = 'red';
                        console.error("[suppliers/new.js] Erreur de l'API lors de l'ajout du fournisseur:", result.error);
                    }
                } catch (error) {
                    console.error("[suppliers/new.js] Erreur d'appel IPC pour addSupplier:", error);
                    formMessage.textContent = "Erreur de communication avec l'application: " + (error.message || error);
                    formMessage.style.color = 'red';
                }
            } else {
                console.error("[suppliers/new.js] L'API Electron (addSupplier) pour ajouter un fournisseur n'est pas disponible.");
                formMessage.textContent = "Fonctionnalité d'ajout de fournisseur non disponible.";
                formMessage.style.color = 'red';
            }

            setTimeout(() => {
                formMessage.textContent = '';
            }, 5000);
        });
    }
});

async function logout() {
    if (window.electronAPI && typeof window.electronAPI.logout === 'function') {
        await window.electronAPI.logout();
    } else {
        console.error("Impossible d'appeler la fonction de déconnexion.");
    }
}
