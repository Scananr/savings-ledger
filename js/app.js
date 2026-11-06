import { bankData, initGoogleAuth, logSystemChange, saveLedgerToDrive, downloadLocalBackup, fetchPublicMemberLedger, persistLocalState, getAccessToken } from './data.js';
import { sessionState, setRole } from './auth.js';
import { renderApp, showProfileModal, closeProfileModal } from './ui.js';
import { resetLedgerToEmpty } from './data.js';

// This event listener helps reset the initial ledger fields to empty.
document.getElementById('reset-ledger-btn').addEventListener('click', function() {
    resetLedgerToEmpty();
});

// Run initialization on load
document.addEventListener('DOMContentLoaded', () => {
    initGoogleAuth(); // <-- Make sure this is called here!
    renderApp(bankData, sessionState);
});

 
// This switchRole instructs the member button click
window.switchRole = async function(role) {
    if (role === 'member') {
        // Retrieve the file ID cached in localStorage during admin save/sync
        const MASTER_FILE_ID = localStorage.getItem('google_drive_file_id');
        
        if (!MASTER_FILE_ID) {
            alert("Ledger File ID not found. Please complete an admin action or sync first.");
            return;
        }
        
        // Fetch the latest data from Drive publicly before switching view
        const remoteData = await fetchPublicMemberLedger(MASTER_FILE_ID);
        if (remoteData) {
            console.log("Successfully updated local state from Google Drive.");
        }
    }
    
    setRole(role);
    renderApp(bankData, sessionState);
};

// Handle Member Portal dropdown change
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'member-selector') {
        const selectedName = e.target.value;
        setRole('member', selectedName);
        renderApp(bankData, sessionState);
    }
});

// Handle Savings Deposit Form
document.getElementById('deposit-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nameInput = document.getElementById('deposit-member').value.trim();
    const amountInput = parseFloat(document.getElementById('deposit-amount').value);

    // 1. POP UP THE CHECKPOINT DIALOGUE
    const isConfirmed = confirm(`Review Deposit Entry:\n\nMember: ${nameInput}\nAmount: $${amountInput}\n\nClick OK to confirm and save, or Cancel to discard.`);

    // 2. IF ADMIN CANCELS, STOP COMPLETELY
    if (!isConfirmed) {
        console.log("Deposit cancelled by admin. No data saved.");
        return; // Exits function without saving or touching storage
    }

    // 3. IF CONFIRMED, PROCEED WITH SAVING
    const currentDate = new Date().toISOString().split('T')[0];
    let member = bankData.members.find(m => m.name.toLowerCase() === nameInput.toLowerCase());

    if (member) {
        member.savings += amountInput;
        member.history.push({ type: "Deposit", amount: amountInput, date: currentDate });
    } else {
        bankData.members.push({
            id: bankData.members.length + 1,
            name: nameInput,
            savings: amountInput,
            loan: { principal: 0, balanceRemaining: 0, dueDate: "", status: "None" },
            history: [{ type: "Deposit", amount: amountInput, date: currentDate }]
        });
    }

    logSystemChange("SAVINGS_DEPOSIT", `Deposited $${amountInput} for member ${nameInput}`);
    document.getElementById('deposit-form').reset();

    // 4. COMMIT TO LOCAL STORAGE & SYNC
    persistLocalState(); 
    renderApp(bankData, sessionState);
    
    alert("Deposit successfully recorded!");

    
});



// Event Delegation for Table Buttons (View Account)
document.getElementById('ledger-table-body').addEventListener('click', function(e) {
    if (e.target.classList.contains('view-profile-btn')) {
        const memberName = e.target.getAttribute('data-name');
        showProfileModal(memberName, bankData);
    }
});

// Handle Savings Withdrawal Form
document.getElementById('withdraw-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('withdraw-member').value.trim();
    const amountInput = parseFloat(document.getElementById('withdraw-amount').value);
    const currentDate = new Date().toISOString().split('T')[0];

    let member = bankData.members.find(m => m.name.toLowerCase() === nameInput.toLowerCase());

    // 1. Validate member existence
    if (!member) {
        alert("Member not found!");
        return;
    }

    // 2. Validate sufficient balance
    if (member.savings < amountInput) {
        alert("Error: Withdrawal amount exceeds member's savings balance!");
        return;
    }

    // 3. POP UP THE CHECKPOINT DIALOGUE
    const isConfirmed = confirm(`Review Withdrawal Entry:\n\nMember: ${member.name}\nRequested Withdrawal: $${amountInput}\nCurrent Balance: $${member.savings}\n\nClick OK to confirm and save, or Cancel to discard.`);

    // 4. IF ADMIN CANCELS, STOP COMPLETELY (No storage updates)
    if (!isConfirmed) {
        console.log("Withdrawal cancelled by admin. No data saved.");
        return;
    }

    // 5. PROCEED WITH WITHDRAWAL MUTATION
    member.savings -= amountInput;
    member.history.push({ type: "Withdrawal", amount: amountInput, date: currentDate });

    logSystemChange("SAVINGS_WITHDRAWAL", `Withdrew $${amountInput} for member ${member.name}`);
    document.getElementById('withdraw-form').reset();

    // 6. LOCK IN LOCAL STORAGE & BACKGROUND SYNC TO CLOUD
    autoSaveAndSync();

    renderApp(bankData, sessionState);
    alert("Withdrawal successfully recorded!");
});

// Handle Loan Form
document.getElementById('loan-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('loan-member').value.trim();
    const principal = parseFloat(document.getElementById('loan-amount').value);
    const interestRate = parseFloat(document.getElementById('loan-rate').value);
    const interestType = document.getElementById('loan-interest-type').value;
    const dueDateInput = document.getElementById('loan-due').value;
    const currentDate = new Date().toISOString().split('T')[0];

    // Calculate Interest
    let totalDue = principal;
    if (interestType === "simple") {
        totalDue = principal + (principal * (interestRate / 100));
    } else {
        // Basic compound formula for 1 period/term
        totalDue = principal * Math.pow((1 + (interestRate / 100)), 1);
    }
    totalDue = Math.round(totalDue * 100) / 100; // Round to 2 decimals

    // 1. POP UP THE CHECKPOINT DIALOGUE
    const isConfirmed = confirm(`Review Loan Issuance:\n\nMember: ${nameInput}\nPrincipal: $${principal}\nInterest Type: ${interestType} (${interestRate}%)\nTotal Due: $${totalDue}\nDue Date: ${dueDateInput}\n\nClick OK to confirm and save, or Cancel to discard.`);

    // 2. IF ADMIN CANCELS, STOP COMPLETELY (No storage updates)
    if (!isConfirmed) {
        console.log("Loan issuance cancelled by admin. No data saved.");
        return;
    }

    // 3. PROCEED WITH LOAN MUTATION
    let member = bankData.members.find(m => m.name.toLowerCase() === nameInput.toLowerCase());

    if (member) {
        member.loan = {
            principal: principal,
            interestRate: interestRate,
            interestType: interestType,
            totalDue: totalDue,
            amountPaid: 0,
            balanceRemaining: totalDue,
            dueDate: dueDateInput,
            status: "Active"
        };
        member.history.push({ type: "Loan Taken", amount: principal, date: currentDate });
    } else {
        bankData.members.push({
            id: bankData.members.length + 1,
            name: nameInput,
            savings: 0,
            loan: {
                principal: principal,
                interestRate: interestRate,
                interestType: interestType,
                totalDue: totalDue,
                amountPaid: 0,
                balanceRemaining: totalDue,
                dueDate: dueDateInput,
                status: "Active"
            },
            history: [{ type: "Loan Taken", amount: principal, date: currentDate }]
        });
    }

    logSystemChange("LOAN_ISSUED", `Issued loan of $${principal} to member ${nameInput}`);
    document.getElementById('loan-form').reset();

    // 4. LOCK IN LOCAL STORAGE & BACKGROUND SYNC TO CLOUD
    autoSaveAndSync();

    renderApp(bankData, sessionState);
    alert("Loan successfully recorded!");
});

// Handle Partial Loan Repayments
document.getElementById('repay-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('repay-member').value.trim();
    const repayAmount = parseFloat(document.getElementById('repay-amount').value);
    const currentDate = new Date().toISOString().split('T')[0];

    let member = bankData.members.find(m => m.name.toLowerCase() === nameInput.toLowerCase());

    // 1. Validate member and active loan
    if (!member || !member.loan || member.loan.balanceRemaining <= 0) {
        alert("Member not found or has no active loan balance.");
        return;
    }

    // 2. Validate repayment amount against remaining balance
    if (repayAmount > member.loan.balanceRemaining) {
        alert(`Repayment exceeds remaining balance ($${member.loan.balanceRemaining})!`);
        return;
    }

    const newBalance = Math.round((member.loan.balanceRemaining - repayAmount) * 100) / 100;
    const projectedStatus = newBalance === 0 ? "Paid" : member.loan.status;

    // 3. POP UP THE CHECKPOINT DIALOGUE
    const isConfirmed = confirm(`Review Loan Repayment:\n\nMember: ${member.name}\nRepayment Amount: $${repayAmount}\nPrevious Balance: $${member.loan.balanceRemaining}\nNew Balance Remaining: $${newBalance}\nStatus After Payment: ${projectedStatus}\n\nClick OK to confirm and save, or Cancel to discard.`);

    // 4. IF ADMIN CANCELS, STOP COMPLETELY (No storage updates)
    if (!isConfirmed) {
        console.log("Loan repayment cancelled by admin. No data saved.");
        return;
    }

    // 5. PROCEED WITH REPAYMENT MUTATION
    member.loan.amountPaid += repayAmount;
    member.loan.balanceRemaining = newBalance;
    
    if (member.loan.balanceRemaining === 0) {
        member.loan.status = "Paid";
    }

    member.history.push({ type: "Loan Repayment", amount: repayAmount, date: currentDate });

    logSystemChange("LOAN_REPAYMENT", `Received repayment of $${repayAmount} from member ${member.name}`);
    document.getElementById('repay-form').reset();

    // 6. LOCK IN LOCAL STORAGE & BACKGROUND SYNC TO CLOUD
    autoSaveAndSync();

    renderApp(bankData, sessionState);
    alert("Loan repayment successfully recorded!");
});

// Handle Overdue Penalty Application
document.getElementById('penalty-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('penalty-member').value.trim();
    const penaltyAmount = parseFloat(document.getElementById('penalty-amount').value);
    const currentDate = new Date().toISOString().split('T')[0];

    let member = bankData.members.find(m => m.name.toLowerCase() === nameInput.toLowerCase());

    // 1. Validate member existence
    if (!member) {
        alert("Member not found!");
        return;
    }

    // 2. Validate active loan existence
    if (!member.loan || member.loan.balanceRemaining <= 0) {
        alert("Cannot apply penalty: This member has no active loan balance.");
        return;
    }

    const newBalance = Math.round((member.loan.balanceRemaining + penaltyAmount) * 100) / 100;
    const newTotalDue = Math.round((member.loan.totalDue + penaltyAmount) * 100) / 100;

    // 3. POP UP THE CHECKPOINT DIALOGUE
    const isConfirmed = confirm(`Review Penalty Application:\n\nMember: ${member.name}\nPenalty Amount: $${penaltyAmount}\nPrevious Balance: $${member.loan.balanceRemaining}\nNew Total Balance: $${newBalance}\nStatus Change: Active ➡️ Overdue\n\nClick OK to confirm and save, or Cancel to discard.`);

    // 4. IF ADMIN CANCELS, STOP COMPLETELY (No storage updates)
    if (!isConfirmed) {
        console.log("Penalty application cancelled by admin. No data saved.");
        return;
    }

    // 5. PROCEED WITH PENALTY MUTATION
    member.loan.balanceRemaining = newBalance;
    member.loan.totalDue = newTotalDue;
    member.loan.status = "Overdue";

    // Record the penalty in their history log
    member.history.push({ 
        type: "Penalty Applied", 
        amount: penaltyAmount, 
        date: currentDate 
    });

    logSystemChange("PENALTY_APPLIED", `Applied penalty of $${penaltyAmount} to member ${member.name}`);
    document.getElementById('penalty-form').reset();

    // 6. LOCK IN LOCAL STORAGE & BACKGROUND SYNC TO CLOUD
    autoSaveAndSync();

    renderApp(bankData, sessionState);
    alert("Penalty successfully recorded!");
});

// Handle Admin Copy WhatsApp Report Button
document.getElementById('copy-whatsapp-btn').addEventListener('click', function() {
    let totalSavings = 0;
    let totalLoans = 0;
    let overdueCount = 0;

    bankData.members.forEach(m => {
        totalSavings += m.savings;
        totalLoans += m.loan.balanceRemaining;
        if (m.loan.status === "Overdue") overdueCount++;
    });

    const currentDate = new Date().toLocaleDateString();

    const whatsappText = 
` *MEMBERS LEDGER - MEETING FINANCIAL REPORT*
 *Date:* ${currentDate}

 *Total Members:* ${bankData.members.length}
 *Total Group Savings:* $${totalSavings}
 *Outstanding Loans Balance:* $${totalLoans}
 *Overdue / At-Risk Loans:* ${overdueCount}

_Report generated securely via Member's Ledger System._`;

    navigator.clipboard.writeText(whatsappText).then(() => {
        const feedback = document.getElementById('copy-feedback');
        feedback.style.display = 'inline';
        setTimeout(() => {
            feedback.style.display = 'none';
        }, 3000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Could not copy to clipboard automatically.');
    });
});

// Silent background sync helper
async function autoSaveAndSync() {
    // 1. Save to browser memory so refresh doesn't wipe it
    persistLocalState();
    
    // 2. If connected to Google Drive, sync silently in the background
    if (getAccessToken()) {
        try {
            await saveLedgerToDrive();
            console.log("Auto-synced changes to Google Drive.");
        } catch (err) {
            console.error("Background sync failed:", err);
        }
    }
}

// Automatically download local copy whenever changes are synced to Google Drive
export async function saveAndBackup() {
    await saveLedgerToDrive(); // Saves to Google Drive
    downloadLocalBackup();      // Triggers local PC download
}

// Prompt or auto-trigger local backup before closing the window
window.addEventListener('beforeunload', (e) => {
    downloadLocalBackup();
});

// Handle Admin Print / Export to PDF Button
document.getElementById('print-pdf-btn').addEventListener('click', function() {
    window.print();
});

// Handle Member Portal Print / PDF Statement Button
document.getElementById('print-member-btn').addEventListener('click', function() {
    window.print();
});

document.getElementById('download-backup-btn').addEventListener('click', function() {
    downloadLocalBackup();
});

// Global exposure for modal closing
window.closeProfile = closeProfileModal;

// Initial Load
renderApp(bankData, sessionState);