
        // Gemini API Configuration
        const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
        const apiKey = "";
        
        let isRecording = false;
        let finalTranscript = '';
        let recognition = null;
        let animationFrameId = null; // Stores the current animation frame ID

        // --- SPEECH RECOGNITION SETUP ---
        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                isRecording = true;
                document.getElementById('micState').classList.add('recording');
                document.getElementById('statusMessage').textContent = 'Listening... Speak clearly now.';
                console.log("🎤 Recording started...");
            };

            recognition.onerror = (event) => {
                isRecording = false;
                document.getElementById('micState').classList.remove('recording');
                console.error('❌ Speech recognition error:', event.error);
                document.getElementById('statusMessage').textContent = `Error: ${event.error}. Click mic to retry.`;
            };

            recognition.onend = () => {
                isRecording = false;
                document.getElementById('micState').classList.remove('recording');
                document.getElementById('statusMessage').textContent = 'Processing dream...';
                console.log("🛑 Recording ended. Final Transcript length:", finalTranscript.length);
                
                if (finalTranscript) {
                    document.getElementById('transcript').textContent = finalTranscript;
                    window.processDream(finalTranscript);
                } else {
                    document.getElementById('statusMessage').textContent = 'No speech detected. Click mic to retry.';
                    document.getElementById('transcript').textContent = 'No transcript recorded.';
                    document.getElementById('saveBtn').disabled = true;
                }
            };

            recognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                // Show interim result while recording
                document.getElementById('transcript').textContent = finalTranscript + interimTranscript;
            };
        } else {
            document.getElementById('statusMessage').textContent = "Speech Recognition not supported in this browser.";
            document.getElementById('recordBtn').disabled = true;
        }

        /**
         * Toggles the recording state.
         */
        window.toggleRecording = () => {
            if (!recognition) return;

            if (isRecording) {
                recognition.stop();
            } else {
                finalTranscript = '';
                document.getElementById('transcript').textContent = '...Awaiting voice input...';
                document.getElementById('loader').classList.add('hidden');
                document.getElementById('saveBtn').disabled = true;
                document.getElementById('dreamTitleDisplay').classList.add('hidden');
                
                try {
                    recognition.start();
                } catch (e) {
                    // Avoid 'already started' error if button is double-tapped
                    console.warn("Recognition start failed, likely already active:", e);
                }
            }
        };

        // --- AI PROCESSING (GEMINI API) ---
        
        /**
         * Generates a structured scene description from the dream transcript using the Gemini API.
         * @param {string} transcript - The user's dream narrative.
         */
        window.processDream = async (transcript) => {
            document.getElementById('loader').classList.remove('hidden');
            console.log("🧠 Starting AI analysis for transcript:", transcript.substring(0, 50) + "...");

            const systemPrompt = "You are a creative dream analyzer. Based on the user's dream transcript, generate a structured JSON object for visualization. Ensure 'primaryColor' is a valid hex code (e.g., #FFFFFF).";
            const userQuery = `Analyze this dream transcript and generate the structured JSON scene object: "${transcript}"`;

            // Define the JSON schema for the AI response
            const responseSchema = {
                type: "OBJECT",
                properties: {
                    "sceneTitle": { "type": "STRING", "description": "A concise, evocative title for the dream." },
                    "dominantMood": { "type": "STRING", "description": "The primary emotion or feeling of the dream (e.g., Calm, Anxious, Joyful, Mysterious)." },
                    "primaryObject": { "type": "STRING", "description": "The most significant or visually striking object or element in the dream (e.g., Flying whale, Empty house, Red door)." },
                    "primaryColor": { "type": "STRING", "description": "A hex color code relevant to the mood or object (e.g., #FF6AC1 for joyful, #301E67 for mysterious)." },
                    "animationType": { "type": "STRING", "description": "One of these animation types based on the mood: 'Particles', 'Swirl', 'Mist', 'Comet', 'Vortex'." }
                },
                "required": ["sceneTitle", "dominantMood", "primaryObject", "primaryColor", "animationType"]
            };

            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            };

            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts) {
                try {
                    const response = await fetch(`${API_URL}?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    
                    if (!jsonText) throw new Error("AI response content is empty.");
                    
                    const dreamScene = JSON.parse(jsonText);
                    
                    console.log("✅ AI Analysis successful. Scene Data:", dreamScene);

                    window.currentDreamScene = dreamScene;
                    document.getElementById('dreamTitleDisplay').textContent = dreamScene.sceneTitle;
                    document.getElementById('dreamTitleDisplay').classList.remove('hidden');
                    document.getElementById('loader').classList.add('hidden');
                    document.getElementById('statusMessage').textContent = `Analysis complete. Mood: ${dreamScene.dominantMood}.`;
                    document.getElementById('saveBtn').disabled = false;
                    
                    // Start the visualization
                    window.animateScene(dreamScene);
                    return;

                } catch (error) {
                    attempts++;
                    console.error(`❌ Attempt ${attempts}: API call or JSON parsing failed.`, error);
                    if (attempts >= maxAttempts) {
                        document.getElementById('loader').classList.add('hidden');
                        document.getElementById('statusMessage').textContent = 'AI analysis failed after multiple retries. Try a simpler dream.';
                        document.getElementById('saveBtn').disabled = true;
                        return;
                    }
                    const delay = Math.pow(2, attempts) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        };

        // --- CANVAS VISUALIZATION ---
        
        const canvas = document.getElementById('visualizationCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        let sceneData = null;

        /**
         * Sets up canvas size and starts the main animation loop.
         * @param {Object} data - The structured DreamScene JSON from the AI.
         */
        window.animateScene = (data) => {
            sceneData = data;
            console.log("🖼️ Starting visualization with data:", data);
            
            // Cancel any existing animation frame
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            // Set canvas dimensions to its container size
            const container = canvas.parentElement;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;

            particles = [];
            
            // Initialize particles based on animation type
            const numParticles = 100;
            for (let i = 0; i < numParticles; i++) {
                particles.push(createParticle(canvas.width, canvas.height, sceneData));
            }

            // Start new loop
            animationLoop();
        };

        /**
         * Creates a single particle object based on scene data.
         */
        function createParticle(w, h, data) {
            const size = Math.random() * 2 + 1;
            const center = { x: w / 2, y: h / 2 };
            let x, y, angle;

            switch (data.animationType) {
                case 'Swirl':
                case 'Vortex':
                    angle = Math.random() * 2 * Math.PI;
                    x = center.x + Math.cos(angle) * (Math.random() * w * 0.4);
                    y = center.y + Math.sin(angle) * (Math.random() * h * 0.4);
                    break;
                case 'Comet':
                    x = Math.random() * w;
                    y = h;
                    break;
                case 'Mist':
                case 'Particles':
                default:
                    x = Math.random() * w;
                    y = Math.random() * h;
            }

            return {
                x: x,
                y: y,
                size: size,
                color: data.primaryColor || '#E0BBFF',
                // Velocity based on mood/type
                vx: (Math.random() - 0.5) * (data.dominantMood === 'Anxious' ? 1.5 : 0.5),
                vy: (Math.random() - 0.5) * (data.dominantMood === 'Anxious' ? 1.5 : 0.5),
                originalAngle: angle || Math.random() * 2 * Math.PI,
                dist: Math.random() * 50 + 50,
                life: Math.random() * 100 + 50,
                maxLife: 150,
                opacity: 0
            };
        }

        /**
         * Main animation loop for the canvas visualization.
         */
        function animationLoop(timestamp) {
            if (!sceneData) return;

            // Fading background for a misty/dreamy trail effect
            ctx.fillStyle = 'rgba(21, 0, 61, 0.15)'; // Very dark blue/purple
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw primary object representation (a glowing circle/orb)
            ctx.shadowBlur = 40;
            ctx.shadowColor = sceneData.primaryColor || '#E0BBFF';
            ctx.fillStyle = sceneData.primaryColor || '#E0BBFF';
            ctx.globalAlpha = 0.5 + 0.1 * Math.sin(timestamp * 0.001); // Subtle pulse
            
            ctx.beginPath();
            // A central "object" whose size pulsates and changes based on mood
            const moodFactor = sceneData.dominantMood === 'Joyful' ? 1 : (sceneData.dominantMood === 'Anxious' ? 0.5 : 0.75);
            const objectSize = (40 * moodFactor) + (10 * Math.sin(timestamp * 0.002));
            ctx.arc(canvas.width / 2, canvas.height / 2, objectSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Reset shadow and alpha
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;

            // Update and draw particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                p.life--;
                if (p.life <= 0) {
                    particles[i] = createParticle(canvas.width, canvas.height, sceneData); // Recreate particle
                    continue;
                }
                
                p.opacity = p.life / p.maxLife;

                switch (sceneData.animationType) {
                    case 'Swirl':
                    case 'Vortex':
                        const center = { x: canvas.width / 2, y: canvas.height / 2 };
                        const dx = p.x - center.x;
                        const dy = p.y - center.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const angle = Math.atan2(dy, dx);
                        
                        const speed = sceneData.dominantMood === 'Anxious' ? 0.05 : 0.01;
                        p.x = center.x + Math.cos(angle + speed) * dist;
                        p.y = center.y + Math.sin(angle + speed) * dist;
                        
                        // Add a slight pull toward the center
                        if (sceneData.animationType === 'Vortex') {
                            p.x -= dx * 0.001;
                            p.y -= dy * 0.001;
                        }
                        break;
                    case 'Comet':
                        // Particles fly upwards and fade out
                        p.y -= (2 + p.size / 2);
                        p.x += Math.sin(p.y * 0.01) * 0.5; // Sine wave for slight wobble
                        break;
                    case 'Mist':
                    case 'Particles':
                    default:
                        // Simple random motion
                        p.x += p.vx * (sceneData.dominantMood === 'Anxious' ? 2 : 1);
                        p.y += p.vy * (sceneData.dominantMood === 'Anxious' ? 2 : 1);
                        break;
                }

                // Wrap or bounce particles
                if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                     particles[i] = createParticle(canvas.width, canvas.height, sceneData);
                     continue;
                }


                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                
                // Use a semi-transparent version of the primary color
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fill();
            }
            
            // Request the next frame
            animationFrameId = requestAnimationFrame(animationLoop);
        }

        // Handle canvas resizing for responsiveness
        window.addEventListener('resize', () => {
            if (sceneData) {
                // Rerun animateScene to reset dimensions and particles
                window.animateScene(sceneData);
            } else {
                 // Just resize if no animation is active
                const container = canvas.parentElement;
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                ctx.fillStyle = '#15003D'; // Clear to background color
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        });

        // Initialize canvas background and load local dreams on load
        window.onload = () => {
             const container = canvas.parentElement;
             canvas.width = container.clientWidth;
             canvas.height = container.clientHeight;
             ctx.fillStyle = '#15003D';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             window.loadDreams(); // Load any dreams saved in the current session
        };
    