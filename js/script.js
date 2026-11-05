// Advanced State Structure with Individual Member Accounts & History
let bankData = {
    members: [
        {
            id: 1,
            name: "Alice",
            savings: 450,
            loan: { amount: 200, dueDate: "2026-11-15", status: "Active" },
            history: [
                { type: "Deposit", amount: 250, date: "2026-09-01" },
                { type: "Deposit", amount: 200, date: "2026-10-01" },
                { type: "Loan Taken", amount: 200, date: "2026-10-10" }
            ]
        },
        {
            id: 2,
            name: "Bob",
            savings: 200,
            loan: { amount: 300, dueDate: "2026-10-01", status: "Overdue" },
            history: [
                { type: "Deposit", amount: 200, date: "2026-10-01" },
                { type: "Loan Taken", amount: 300, date: "2026-10-05" }
            ]
        },
        {
            id: 3,
            name: "Charlie",
            savings: 120,
            loan: { amount: 0, dueDate: "", status: "None" },
            history: [
                { type: "Deposit", amount: 120, date: "2026-10-02" }
            ]
        }
    ]
};

// Render Dashboard Metrics and Directory Table
function updateDashboard() {
    const tableBody = document.getElementById('ledger-table-body');
    tableBody.innerHTML = '';

    let totalSavingsCalc = 0;
    let totalLoansCalc = 0;

    bankData.members.forEach(member => {
        totalSavingsCalc += member.savings;
        totalLoansCalc += member.loan.amount;

        let badgeClass = "badge-none";
        if (member.loan.status === "Active") badgeClass = "badge-active";
        if (member.loan.status === "Overdue") badgeClass = "badge-overdue";

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${member.name}</strong></td>
            <td>$${member.savings}</td>
            <td>$${member.loan.amount}</td>
            <td><span class="badge ${badgeClass}">${member.loan.status}</span></td>
            <td><button class="btn-sm" onclick="openProfile('${member.name}')">View Account</button></td>
        `;
        tableBody.appendChild(row);
    });

    // Update Summary Metric Cards
    document.getElementById('total-savings').textContent = `$${totalSavingsCalc}`;
    document.getElementById('total-loans').textContent = `$${totalLoansCalc}`;
    document.getElementById('total-pool').textContent = `$${totalSavingsCalc}`;
}

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

    document.getElementById('deposit-form').reset();
    updateDashboard();
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
    updateDashboard();
});

// Open Individual Member Profile Modal
function openProfile(memberName) {
    const member = bankData.members.find(m => m.name.toLowerCase() === memberName.toLowerCase());
    if (!member) return;

    document.getElementById('profile-name').textContent = `${member.name}'s Account Profile`;
    document.getElementById('profile-savings').textContent = `$${member.savings}`;
    document.getElementById('profile-loan-amount').textContent = `$${member.loan.amount}`;
    document.getElementById('profile-due-date').textContent = member.loan.dueDate || "No active due date";
    
    const statusEl = document.getElementById('profile-status');
    statusEl.textContent = member.loan.status;
    statusEl.className = `badge ${member.loan.status === 'Active' ? 'badge-active' : member.loan.status === 'Overdue' ? 'badge-overdue' : 'badge-none'}`;

    // Populate History Log
    const historyList = document.getElementById('profile-history-list');
    historyList.innerHTML = '';
    if (member.history.length === 0) {
        historyList.innerHTML = '<li>No recorded transactions.</li>';
    } else {
        member.history.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `[${item.date}] ${item.type}: $${item.amount}`;
            historyList.appendChild(li);
        });
    }

    document.getElementById('profile-modal').style.display = 'flex';
}

// Close Profile Modal
function closeProfile() {
    document.getElementById('profile-modal').style.display = 'none';
}

// Initial Load
window.onload = function() {
    updateDashboard();
};