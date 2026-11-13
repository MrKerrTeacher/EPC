const KerracadeReward = (function() {
    // --- PORTABLE CONFIGURATION ---
    const SECRET_KEY = "kerr_retro_arcade_80s_secret";
    const KERRACADE_BASE_URL = "https://kerracade.teachertools.org.uk/index.php";
    let countdownInterval;

    async function generateSHA256Hash(message) {
        const msgUint8 = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function renderUI(containerId, state, data) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`KerracadeReward Error: Could not find element with ID '${containerId}'`);
            return;
        }

        if (state === 'reward') {
            container.innerHTML = `
                <div style="background: rgba(31, 41, 55, 0.95); padding: 20px; border-radius: 8px; border: 1px solid #4b5563; text-align: center; margin-top: 20px; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                    <h3 style="color: #60a5fa; font-size: 1.25rem; font-weight: bold; margin-top: 0; margin-bottom: 10px;">🎉 KERRACADE REWARD EARNED! 🎉</h3>
                    <p style="color: #e5e7eb; margin-bottom: 8px; font-size: 1rem;">You scored ${data.score} and earned <strong style="color: #4ade80;">${data.mins}m ${data.secs}s</strong> of playtime.</p>
                    <p style="color: #9ca3af; font-size: 0.875rem; margin-bottom: 15px;">Your secure link expires in: <strong id="kerr-countdown" style="color: #f87171; font-family: monospace; font-size: 1.1rem;">05:00</strong></p>
                    <a id="kerr-link" href="${data.url}" target="_blank" style="display: inline-block; background-color: #db2777; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; transition: opacity 0.2s; box-shadow: 0 0 15px rgba(219,39,119,0.5);">ENTER KERRACADE</a>
                </div>
            `;
        } else if (state === 'expired') {
            container.innerHTML = `
                <div style="background: rgba(127, 29, 29, 0.2); padding: 15px; border-radius: 8px; border: 1px solid #7f1d1d; text-align: center; margin-top: 20px; font-family: sans-serif;">
                    <p style="color: #f87171; font-weight: bold; margin: 0;">Your Kerracade reward link has expired.</p>
                </div>
            `;
        } else if (state === 'no_time') {
            container.innerHTML = `
                <div style="background: rgba(31, 41, 55, 0.8); padding: 15px; border-radius: 8px; border: 1px solid #4b5563; text-align: center; margin-top: 20px; font-family: sans-serif;">
                    <p style="color: #9ca3af; font-weight: bold; margin: 0;">No Kerracade playtime earned this time. Keep trying!</p>
                </div>
            `;
        }
    }

    function startCountdown(expiresAt, containerId) {
        clearInterval(countdownInterval);
        
        countdownInterval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = expiresAt - now;

            const timerEl = document.getElementById('kerr-countdown');

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                localStorage.removeItem('kerr_earned_url'); // Permanently destroy access
                renderUI(containerId, 'expired');
            } else if (timerEl) {
                const m = Math.floor(remaining / 60).toString().padStart(2, '0');
                const s = (remaining % 60).toString().padStart(2, '0');
                timerEl.innerText = `${m}:${s}`;
            }
        }, 1000);
    }

    return {
        /**
         * Call this on window.onload to restore the timer if the student refreshes the page
         * @param {string} containerId - The HTML ID of the div where the reward should appear
         */
        init: function(containerId) {
            const expiresAt = parseInt(localStorage.getItem('kerr_ui_expires_at')) || 0;
            const now = Math.floor(Date.now() / 1000);
            const earnedUrl = localStorage.getItem('kerr_earned_url');

            if (expiresAt > now && earnedUrl) {
                const timeEarned = parseInt(localStorage.getItem('kerr_time_earned'));
                renderUI(containerId, 'reward', {
                    score: localStorage.getItem('kerr_score'),
                    mins: Math.floor(timeEarned / 60),
                    secs: timeEarned % 60,
                    url: earnedUrl
                });
                startCountdown(expiresAt, containerId);
            } else if (expiresAt > 0 && expiresAt <= now) {
                renderUI(containerId, 'expired');
            }
        },

        /**
         * Call this function when the student finishes their quiz/activity
         * @param {number} score - The number of points or correct answers they got
         * @param {number} secondsPerPoint - How many seconds each point is worth (e.g. 18)
         * @param {string} containerId - The HTML ID of the div where the reward should appear
         */
        grantReward: async function(score, secondsPerPoint, containerId) {
            const timeEarned = score * secondsPerPoint;
            
            localStorage.setItem('kerr_score', score.toString());
            localStorage.setItem('kerr_time_earned', timeEarned.toString());

            if (timeEarned > 0) {
                const ts = Math.floor(Date.now() / 1000);
                const signature = await generateSHA256Hash(timeEarned.toString() + ts.toString() + SECRET_KEY);
                const finalUrl = `${KERRACADE_BASE_URL}?time=${timeEarned}&ts=${ts}&sig=${signature}`;
                
                const uiExpiresAt = ts + 300; // Hard 5-minute window
                
                localStorage.setItem('kerr_earned_url', finalUrl);
                localStorage.setItem('kerr_ui_expires_at', uiExpiresAt.toString());
                
                renderUI(containerId, 'reward', {
                    score: score,
                    mins: Math.floor(timeEarned / 60),
                    secs: timeEarned % 60,
                    url: finalUrl
                });
                startCountdown(uiExpiresAt, containerId);
            } else {
                renderUI(containerId, 'no_time');
            }
        }
    };
})();