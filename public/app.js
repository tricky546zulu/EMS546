// public/app.js

// This event listener ensures that the script runs only after the entire HTML
// document has been loaded and parsed.
document.addEventListener('DOMContentLoaded', () => {
    const dataContainer = document.getElementById('data-container');
    const lastUpdatedElement = document.getElementById('last-updated');
    const loadingIndicator = document.getElementById('loading-indicator');
    const pageTitle = document.getElementById('page-title');

    // --- Main Function to Fetch and Render Data ---
    const fetchAndRenderCapacity = async () => {
        try {
            // Show the loading indicator and update the title
            loadingIndicator.style.display = 'block';
            dataContainer.innerHTML = ''; // Clear previous data
            if (pageTitle) {
                pageTitle.textContent = 'Saskatoon Hospital Bed Capacity';
            }


            // Fetch data from our new back-end API endpoint
            const response = await fetch('/api/bed-capacity');
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();

            // Hide the loading indicator
            loadingIndicator.style.display = 'none';

            // Handle cases where the scraper returned an error
            if (data.error) {
                throw new Error(data.error);
            }

            // Update the 'Last Updated' timestamp on the page
            lastUpdatedElement.textContent = `Data as of: ${data.lastUpdated || 'Not available'}`;

            // Loop through the array of hospital data and create a card for each
            data.hospitals.forEach(hospital => {
                const card = createHospitalCard(hospital);
                dataContainer.appendChild(card);
            });

        } catch (error) {
            // If an error occurs, hide the loading indicator and display the error
            loadingIndicator.style.display = 'none';
            console.error('Error fetching or rendering bed capacity:', error);
            dataContainer.innerHTML = `<div class="error-message">Could not load data. ${error.message}</div>`;
        }
    };

    // --- Helper Function to Create an HTML Card for a Hospital ---
    const createHospitalCard = (hospital) => {
        // Create the main card container
        const card = document.createElement('div');
        card.className = 'hospital-card bg-white p-6 rounded-lg shadow-md border border-gray-200';

        // Sanitize data - show 'N/A' if data is missing
        const emergency = hospital.emergency || {};
        const inpatient = hospital.inpatient || {};
        const admittedWaiting = hospital.admittedWaiting || {};

        // Use template literals to build the inner HTML for the card
        card.innerHTML = `
            <h2 class="text-xl font-bold text-gray-800 mb-4">${hospital.name}</h2>
            
            <div class="space-y-4">
                <!-- Emergency Department Section -->
                <div>
                    <h3 class="text-md font-semibold text-indigo-600 border-b pb-2 mb-2">Emergency Department</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-500">Patients in ED</p>
                            <p class="text-gray-900 font-medium text-lg">${emergency.patientsInED || 'N/A'}</p>
                        </div>
                        <div>
                            <p class="text-gray-500">Waiting for Physician</p>
                            <p class="text-gray-900 font-medium text-lg">${emergency.patientsWaiting || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <!-- Inpatient Beds Section -->
                <div>
                    <h3 class="text-md font-semibold text-indigo-600 border-b pb-2 mb-2">Inpatient Beds</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-500">Occupancy</p>
                            <p class="text-gray-900 font-medium text-lg">${inpatient.occupancy || 'N/A'}%</p>
                        </div>
                        <div>
                            <p class="text-gray-500">Total Beds</p>
                            <p class="text-gray-900 font-medium text-lg">${inpatient.beds || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <!-- Admitted Patients Waiting Section -->
                <div>
                    <h3 class="text-md font-semibold text-indigo-600 border-b pb-2 mb-2">Admitted Patients Waiting</h3>
                    <div class="text-sm">
                        <p class="text-gray-500">Waiting for Inpatient Bed</p>
                        <p class="text-gray-900 font-medium text-lg">${admittedWaiting.count || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;
        return card;
    };

    // --- Initial Load ---
    // Call the function to fetch and render the data when the page loads.
    fetchAndRenderCapacity();
});

