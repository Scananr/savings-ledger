// js/auth.js - Manages user sessions and system roles

export let sessionState = {
    role: "admin", // Options: "admin" or "member"
    currentMemberName: "Alice" // Used when role is "member"
};

export function setRole(newRole, memberName = null) {
    sessionState.role = newRole;
    if (memberName) {
        sessionState.currentMemberName = memberName;
    }
}