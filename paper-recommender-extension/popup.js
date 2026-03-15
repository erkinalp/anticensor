document.addEventListener("DOMContentLoaded", async () => {
    const omrcDisplay = document.getElementById("omrc-display");
    const recList = document.getElementById("rec-list");
    const loading = document.getElementById("loading");
    const errorMsg = document.getElementById("error-msg");

    function showError(msg) {
        loading.style.display = "none";
        errorMsg.textContent = msg;
        errorMsg.style.display = "block";
    }

    function showLoading() {
        loading.style.display = "block";
        recList.innerHTML = "";
        errorMsg.style.display = "none";
    }

    // Initialize communication with background script
    try {
        // In a real Zotero extension, we would use Zotero.getActiveZoteroPane() or similar
        // For this WebExtension-compatible approach, we send a message to background
        showLoading();

        const response = await chrome.runtime.sendMessage({ action: "analyzeCurrentItem" });

        if (response.error) {
            showError(response.error);
            return;
        }

        if (!response.omrc) {
            showError("No abstract found or unable to extract OMRC structure.");
            return;
        }

        // Display OMRC
        let omrcHtml = "";
        for (const [key, value] of Object.entries(response.omrc)) {
            if (value) {
                omrcHtml += `<div><strong>${key}:</strong> ${value}</div>`;
            }
        }
        omrcDisplay.innerHTML = omrcHtml || "Could not structure abstract.";

        // Display Recommendations
        loading.style.display = "none";
        if (response.recommendations && response.recommendations.length > 0) {
            recList.innerHTML = response.recommendations
                .map(
                    (rec) => `
                <div class="recommendation-item">
                    <a href="${rec.url}" target="_blank" class="rec-title">${rec.title}</a>
                    <div class="rec-meta">
                        ${rec.authors ? rec.authors.map((a) => a.name).join(", ") : "Unknown Authors"}
                        (${rec.year || "n.d."})
                        <span class="score" title="Similarity Score">Score: ${Math.round(rec.score * 100)}%</span>
                    </div>
                </div>
            `,
                )
                .join("");
        } else {
            recList.innerHTML = '<div style="padding:10px; color:#666;">No recommendations found.</div>';
        }
    } catch (e) {
        showError("Failed to communicate with Zotero: " + e.message);
    }
});
