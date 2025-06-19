// src/renderer/js/reports/generate.js

document.addEventListener('DOMContentLoaded', () => {
    displayCurrentDate(); // Fonction du tableau de bord
    const reportForm = document.getElementById('reportForm');
    const formMessage = document.getElementById('formMessage');
    const reportOutput = document.getElementById('reportOutput');

    if (reportForm) {
        reportForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const reportType = document.getElementById('reportType').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            if (!reportType) {
                formMessage.textContent = "Veuillez sélectionner un type de rapport.";
                formMessage.style.color = 'red';
                return;
            }

            formMessage.textContent = "Génération du rapport en cours...";
            formMessage.style.color = 'orange';
            reportOutput.textContent = ''; // Efface le contenu précédent du rapport

            const reportCriteria = {
                type: reportType,
                startDate: startDate || null,
                endDate: endDate || null
            };

            if (window.electronAPI && typeof window.electronAPI.generateReport === 'function') {
                try {
                    const result = await window.electronAPI.generateReport(reportCriteria);
                    if (result.success) {
                        formMessage.textContent = "Rapport généré avec succès !";
                        formMessage.style.color = 'green';
                        reportOutput.textContent = result.data || "Aucune donnée pour ce rapport.";
                    } else {
                        formMessage.textContent = result.error || "Erreur lors de la génération du rapport.";
                        formMessage.style.color = 'red';
                        reportOutput.textContent = `Erreur: ${result.error || 'Impossible de générer le rapport.'}`;
                    }
                } catch (error) {
                    console.error("Erreur d'appel IPC pour generateReport:", error);
                    formMessage.textContent = "Erreur de communication avec l'application.";
                    formMessage.style.color = 'red';
                    reportOutput.textContent = "Erreur de communication pour générer le rapport.";
                }
            } else {
                console.error("L'API Electron pour générer les rapports n'est pas disponible.");
                formMessage.textContent = "Fonctionnalité de génération de rapport non disponible.";
                formMessage.style.color = 'red';
                reportOutput.textContent = "Fonctionnalité non disponible.";
            }

            setTimeout(() => {
                formMessage.textContent = '';
            }, 5000);
        });
    }
});
