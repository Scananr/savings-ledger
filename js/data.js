const LOCAL_STORAGE_KEY = 'savings_ledger_data';

// 1. Always load from local browser storage first so refreshes never wipe out data
const savedLocalData = localStorage.getItem(LOCAL_STORAGE_KEY);


export let bankData = savedLocalData ? JSON.parse(savedLocalData) : {
    members: [],
    auditLog: [
        {
            timestamp: new Date().toISOString(),
            action: "SYSTEM_INIT",
            details: "Ledger initialized locally."
        }
    ]
};

// 2. Ensure this function writes cleanly to browser storage
export function persistLocalState() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bankData));
}



// Google Drive Sync Logic
let accessToken = null;

export function getAccessToken() {
    return accessToken;
}

//  Fetch the master ledger publicly for regular members (No OAuth / Token required)
export async function fetchPublicMemberLedger(fileId) {
    try {
        // Using Google Drive's direct download endpoint for shared/public files
        const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch public ledger data.");
        
        const remoteData = await response.json();
        
        // Safely update the local client state with the treasurer's latest data
        bankData.members = remoteData.members || bankData.members;
        bankData.auditLog = remoteData.auditLog || bankData.auditLog;
        
        console.log("Successfully synced member view from master ledger!", bankData);
        return bankData;
    } catch (err) {
        console.error("Error fetching public ledger:", err);
        return null;
    }
}

// Search for ledger.json in Google Drive
export async function findLedgerFile() {
    if (!accessToken) return null;
    
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='ledger.json' and trashed=false`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        const data = await response.json();
        
        if (data.files && data.files.length > 0) {
            const fileId = data.files[0].id;
            
            // ⬇️ CACHE IT LOCALLY RIGHT HERE ⬇️
            localStorage.setItem('google_drive_file_id', fileId);
            console.log("File ID cached locally from search:", fileId);
            
            return fileId;
        }
        
        return null;
    } catch (err) {
        console.error("Error searching for ledger.json:", err);
        return null;
    }
}

//  Create ledger.json in Google Drive with initial bankData
export async function createLedgerFile() {
    if (!accessToken) return null;

    const metadata = {
        name: 'ledger.json',
        mimeType: 'application/json'
    };

    const fileContent = JSON.stringify(bankData, null, 2);

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: 'application/json' }));

    try {
        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: form
            }
        );
        const file = await response.json();
        
        if (file && file.id) {
            localStorage.setItem('google_drive_file_id', file.id);
            console.log("File ID cached locally:", file.id);
        }

        console.log("Created new ledger.json in Drive with ID:", file.id);
        return file.id;
        
        console.log("Created new ledger.json in Drive with ID:", file.id);
        return file.id;
    } catch (err) {
        console.error("Error creating ledger.json:", err);
        return null;
    }
}

//  Load ledger data from Google Drive
export async function loadLedgerFromDrive() {
    const fileId = await findLedgerFile();
    if (!fileId) {
        console.log("ledger.json not found in Drive. Creating one now...");
        await createLedgerFile();
        return bankData; // return default local state
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        const remoteData = await response.json();
        // Update local bankData state with remote data
        bankData.members = remoteData.members || bankData.members;
        console.log("Successfully loaded ledger from Google Drive!", bankData);
        return bankData;
    } catch (err) {
        console.error("Error downloading ledger from Drive:", err);
        return bankData;
    }
}

// Save and Sync bankData changes to Google Drive
export async function saveLedgerToDrive() {
    let fileId = await findLedgerFile();
    
    if (!fileId) {
        await createLedgerFile();
        return;
    }

    const fileContent = JSON.stringify(bankData, null, 2);
    try {
        await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: fileContent
            }
        );
        console.log("Ledger successfully updated in Google Drive!");
    } catch (err) {
        console.error("Error updating ledger in Drive:", err);
    }
}

// Google Authentication Hook
export function initGoogleAuth(onAuthSuccess) {
    const authBtn = document.getElementById('google-auth-btn');
    if (!authBtn) {
        console.warn("⚠️ Warning: 'google-auth-btn' button not found in the DOM.");
        return;
    }

    authBtn.addEventListener('click', () => {
        console.log("🔗 Connect Drive button clicked!");

        if (typeof google === 'undefined' || !google.accounts) {
            console.error("❌ Google Identity Services script not loaded yet.");
            alert("Google API script failed to load. Check your internet connection or ad blocker.");
            return;
        }

        const CLIENT_ID = '54983330641-ul3a5rmfsu39rt4c5l9ebmu0ehl6g9uu.apps.googleusercontent.com'; 

        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: async (response) => {
                    if (response.error) {
                        console.error("Auth Error:", response);
                        return;
                    }
                    accessToken = response.access_token;
                    console.log("Success! Access Token acquired.");
                    alert("Successfully connected to Google Drive!");

                    // Automatically check for or create ledger.json upon login
                    await loadLedgerFromDrive();

                    // If your main app script passed a callback function, call it here to refresh UI
                    if (typeof onAuthSuccess === 'function') {
                        onAuthSuccess(bankData);
                    }
                },
            });
            client.requestAccessToken();
        } catch (err) {
            console.error("Exception during OAuth initialization:", err);
            alert("Check browser console for details.");
        }
    });
}
//  Archive (Soft Delete) a member instead of destroying the record
export async function archiveMember(memberId) {
    const member = bankData.members.find(m => m.id === memberId);
    
    if (!member) {
        console.warn(`Member with ID ${memberId} not found.`);
        return false;
    }

    // Freeze the account state and mark as archived
    member.isArchived = true;
    member.archivedDate = new Date().toISOString().split('T')[0];

    console.log(`Member ${member.name} archived successfully. Saving to Google Drive...`);
    
    // Automatically sync the updated ledger to Google Drive
    await saveLedgerToDrive();
    return true;
}

// Restore an archived member if needed
export async function restoreMember(memberId) {
    const member = bankData.members.find(m => m.id === memberId);
    
    if (!member) return false;

    member.isArchived = false;
    delete member.archivedDate;

    console.log(`Member ${member.name} restored. Saving to Google Drive...`);
    await saveLedgerToDrive();
    return true;
}

// Helper to register every change made to the ledger
export function logSystemChange(actionType, description) {
    const entry = {
        timestamp: new Date().toISOString(),
        action: actionType,
        details: description
    };
    bankData.auditLog.push(entry);
    console.log(`[Audit Log] ${actionType}: ${description}`);
}



// Generate and download a local recovery JSON file
export function downloadLocalBackup() {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bankData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        
        const dateStr = new Date().toISOString().split('T')[0];
        downloadAnchor.setAttribute("download", `ledger_recovery_backup_${dateStr}.json`);
        
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        logSystemChange("LOCAL_BACKUP_EXPORT", "Treasurer exported manual local recovery backup file.");
        alert("Local backup file downloaded successfully.");
    } catch (err) {
        console.error("Failed to generate local backup file:", err);
        alert("Error generating backup file.");
    }
}
// Reset ledger to a completely empty state for alpha testing
export async function resetLedgerToEmpty() {
    if (confirm("⚠️ WARNING: This will wipe all demo data and members. Are you sure you want to start fresh for the alpha test?")) {
        bankData.members = [];
        bankData.auditLog = [{
            timestamp: new Date().toISOString(),
            action: "SYSTEM_RESET",
            details: "Ledger reset to empty state for alpha testing."
        }];
        
        // Save the empty state to Google Drive
        await saveLedgerToDrive();
        alert("Ledger has been cleared and reset to a clean state.");
        window.location.reload(); // Refresh app view
    }
}