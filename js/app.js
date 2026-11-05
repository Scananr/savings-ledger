import { bankData } from './data.js';
import { sessionState, setRole } from './auth.js';
import { renderApp } from './ui.js';
import { initGoogleAuth } from './data.js'; // <-- Make sure this is imported
import { logSystemChange } from './data.js'
import { triggerLocalBackup, saveLedgerToDrive } from './data.js';
import { downloadLocalBackup } from './data.js';

// Run initialization on load
document.addEventListener('DOMContentLoaded', () => {
    initGoogleAuth(); // <-- Make sure this is called here!
    renderApp(bankData, sessionState);
});

 
// Global function to switch roles from UI buttons
window.switchRole = function(role) {
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
            loan: { amount: 0, dueDate: "", status: "None" },
            history: [{ type: "Deposit", amount: amountInput, date: currentDate }]
        });
    }
        logSystemChange("SAVINGS_DEPOSIT", `Deposited $${amountInput} for member ${nameInput}`);
    
    document.getElementById('deposit-form').reset();
    renderApp(bankData, sessionState);

    

});

// Handle Loan Form with Due Date
document.getElementById('loan-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('loan-member').value.trim();
    const amountInput = parseFloat(document.getElementById('loan-amount').value);
    const dueDateInput = document.getElementById('loan-due').value;
    const currentDate = new Date().toISOString().split('T')[0];

    let member = bankData.members.find(m => m.name.toLowerCase() === nameInput.toLowerCase());

    if (member) {
        member.loan.amount += amountInput;
        member.loan.dueDate = dueDateInput;
        member.loan.status = "Active";
        member.history.push({ type: "Loan Taken", amount: amountInput, date: currentDate });
    } else {
        bankData.members.push({
            id: bankData.members.length + 1,
            name: nameInput,
            savings: 0,
            loan: { amount: amountInput, dueDate: dueDateInput, status: "Active" },
            history: [{ type: "Loan Taken", amount: amountInput, date: currentDate }]
        });
    }

    document.getElementById('loan-form').reset();
    renderApp(bankData, sessionState);
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

    if (member) {
        if (member.savings < amountInput) {
            alert("Error: Withdrawal amount exceeds member's savings balance!");
            return;
        }
        member.savings -= amountInput;
        member.history.push({ type: "Withdrawal", amount: amountInput, date: currentDate });
    } else {
        alert("Member not found!");
        return;
    }

    document.getElementById('withdraw-form').reset();
    renderApp(bankData, sessionState);
});

// Handle Loan Form with Dynamic Interest Calculations
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

    document.getElementById('loan-form').reset();
    renderApp(bankData, sessionState);
});

// Handle Partial Loan Repayments
document.getElementById('repay-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('repay-member').value.trim();
    const repayAmount = parseFloat(document.getElementById('repay-amount').value);
    const currentDate = new Date().toISOString().split('T')[0];

    let member = bankData.members.find(m => m.name.toLowerCase() === nameInput.toLowerCase());

    if (!member || member.loan.balanceRemaining <= 0) {
        alert("Member not found or has no active loan balance.");
        return;
    }

    if (repayAmount > member.loan.balanceRemaining) {
        alert(`Repayment exceeds remaining balance ($${member.loan.balanceRemaining})!`);
        return;
    }

    member.loan.amountPaid += repayAmount;
    member.loan.balanceRemaining -= repayAmount;
    
    if (member.loan.balanceRemaining === 0) {
        member.loan.status = "Paid";
    }

    member.history.push({ type: "Loan Repayment", amount: repayAmount, date: currentDate });

    document.getElementById('repay-form').reset();
    renderApp(bankData, sessionState);
});

// Handle Overdue Penalty Application
document.getElementById('penalty-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('penalty-member').value.trim();
    const penaltyAmount = parseFloat(document.getElementById('penalty-amount').value);
    const currentDate = new Date().toISOString().split('T')[0];

    let member = bankData.members.find(m => m.name.toLowerCase() === nameInput.toLowerCase());

    if (!member) {
        alert("Member not found!");
        return;
    }

    if (member.loan.balanceRemaining <= 0) {
        alert("Cannot apply penalty: This member has no active loan balance.");
        return;
    }

    // Increase debt obligations and flag as overdue
    member.loan.balanceRemaining += penaltyAmount;
    member.loan.totalDue += penaltyAmount;
    member.loan.status = "Overdue";

    // Record the penalty in their history log
    member.history.push({ 
        type: "Penalty Applied", 
        amount: penaltyAmount, 
        date: currentDate 
    });

    document.getElementById('penalty-form').reset();
    renderApp(bankData, sessionState);
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

// Automatically download local copy whenever changes are synced to Google Drive
export async function saveAndBackup() {
    await saveLedgerToDrive(); // Saves to Google Drive
    triggerLocalBackup();      // Triggers local PC download
}

// Optional: Prompt or auto-trigger local backup before closing the window
window.addEventListener('beforeunload', (e) => {
    triggerLocalBackup();
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