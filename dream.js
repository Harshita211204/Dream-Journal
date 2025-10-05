 

    
        // --- GLOBAL STATE (Local Memory Only) ---
        // Array to hold dreams for the current session only
        window.localDreams = [];
        window.currentDreamScene = null;
        
        // --- LOCAL PERSISTENCE FUNCTIONS (Replaces Firestore logic) ---

        /**
         * Saves the current processed dream (transcript + scene JSON) to local memory.
         */
        window.saveDream = () => {
            const transcript = document.getElementById('transcript').textContent.trim();
            if (!window.currentDreamScene || !transcript) {
                console.error("Cannot save: Missing dream data.");
                return;
            }

            document.getElementById('saveBtn').textContent = "Saving...";
            document.getElementById('saveBtn').disabled = true;

            // Create a unique temporary ID and timestamp for local tracking
            const newDream = {
                id: Date.now().toString(),
                transcript: transcript,
                sceneData: window.currentDreamScene,
                timestamp: new Date()
            };

            window.localDreams.unshift(newDream); // Add to the start
            window.renderGallery(window.localDreams);

            document.getElementById('statusMessage').textContent = `Dream "${window.currentDreamScene.sceneTitle}" saved successfully!`;
            
            // Clear the current view after saving
            document.getElementById('transcript').textContent = 'Your transcribed dream will appear here after recording stops.';
            window.currentDreamScene = null;
            document.getElementById('dreamTitleDisplay').classList.add('hidden');
            document.getElementById('saveBtn').textContent = "Save to Gallery";
            document.getElementById('saveBtn').disabled = true;
        };
        
        /**
         * Loads dreams from the local array (instant).
         */
        window.loadDreams = () => {
            window.renderGallery(window.localDreams);
        };

        /**
         * Renders the fetched dreams in the gallery section.
         * @param {Array<Object>} dreams - Array of dream objects from local memory.
         */
        window.renderGallery = (dreams) => {
            const gallery = document.getElementById('dreamGallery');
            gallery.innerHTML = '';
            
            if (dreams.length === 0) {
                gallery.innerHTML = `
                    <p id="galleryPlaceholder" class="lg:col-span-3 text-center text-purple-400 p-8 glowing-card rounded-xl">
                        No dreams saved yet. Record and save your first dream!
                    </p>`;
                return;
            }

            document.getElementById('galleryPlaceholder')?.remove();

            dreams.forEach(dream => {
                const date = dream.timestamp.toLocaleDateString();
                const card = document.createElement('div');
                card.className = 'glowing-card rounded-xl p-4 flex flex-col justify-between';
                card.innerHTML = `
                    <h3 class="text-xl font-bold text-pink-300 mb-2">${dream.sceneData.sceneTitle || 'Untitled Dream'}</h3>
                    <p class="text-sm text-purple-300 mb-3">${date}</p>
                    <div class="text-sm mb-3">
                        <span class="font-semibold">Mood:</span> <span class="text-purple-100">${dream.sceneData.dominantMood || 'Unknown'}</span>
                    </div>
                    <div class="text-sm text-purple-400 mb-4 overflow-hidden max-h-16 text-ellipsis">${dream.transcript.substring(0, 100)}...</div>
                    <button class="glowing-button px-4 py-2 text-sm rounded-full mt-2" data-dream-id="${dream.id}">
                        View Visualization
                    </button>
                    <button class="text-sm text-red-400 hover:text-red-500 mt-2" onclick="deleteDream('${dream.id}')">
                        Delete
                    </button>
                `;
                
                const viewButton = card.querySelector('button[data-dream-id]');
                viewButton.addEventListener('click', () => {
                    window.displayDreamVisualization(dream);
                });

                gallery.appendChild(card);
            });
        };

        /**
         * Deletes a dream from local memory.
         * @param {string} dreamId - The ID of the dream to delete.
         */
        window.deleteDream = (dreamId) => {
            window.confirmModal("Are you sure you want to delete this dream from the current session's gallery?", () => {
                const initialLength = window.localDreams.length;
                window.localDreams = window.localDreams.filter(d => d.id !== dreamId);
                if (window.localDreams.length < initialLength) {
                    console.log("Dream deleted successfully locally.");
                }
                window.renderGallery(window.localDreams);
            });
        }

        // Custom Modal Function (replaces alert/confirm)
        window.confirmModal = (message, onConfirm) => {
            const existingModal = document.getElementById('customModal');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.id = 'customModal';
            modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="glowing-card p-6 rounded-xl w-80 text-center">
                    <p class="text-lg mb-6">${message}</p>
                    <div class="flex justify-center space-x-4">
                        <button id="modalConfirm" class="glowing-button px-4 py-2 rounded-full">Yes</button>
                        <button id="modalCancel" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-full">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('modalConfirm').onclick = () => {
                onConfirm();
                modal.remove();
            };
            document.getElementById('modalCancel').onclick = () => {
                modal.remove();
            };
        };

        /**
         * Displays a saved dream in the main visualization area.
         */
        window.displayDreamVisualization = (dream) => {
            document.getElementById('transcript').textContent = dream.transcript;
            window.currentDreamScene = dream.sceneData;
            window.animateScene(dream.sceneData);
            document.getElementById('dreamTitleDisplay').textContent = dream.sceneData.sceneTitle || 'Visualizing Dream...';
            document.getElementById('dreamTitleDisplay').classList.remove('hidden');
            document.getElementById('saveBtn').disabled = true; // Cannot save an already saved dream
        };
    
