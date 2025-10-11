// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;
contract SupplyChain {
    // --- Enums ---
    enum UserStatus { Pending, Approved, Rejected, Canceled }
    enum TransferStatus { Pending, Accepted, Rejected }

    // --- Structs ---
    struct User {
        uint256 id;
        address userAddress;
        string role; // "Producer" | "Factory" | "Retailer" | "Consumer"
        UserStatus status;
    }

    // --- Storage ---
    address public admin;
    uint256 public nextUserId = 1;

    mapping(address => uint256) public addressToUserId;
    mapping(uint256 => User) public users;

    // --- Events ---
    event UserRoleRequested(address indexed user, string role);
    event UserStatusChanged(address indexed user, UserStatus status);

    // --- Constructor ---
    constructor() {
        admin = msg.sender;
    }

    // --- Modifiers ---
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    // --- Views ---
    function isAdmin(address a) public view returns (bool) {
        return a == admin;
    }

    function getUserInfo(address userAddress) external view returns (User memory) {
        uint256 uid = addressToUserId[userAddress];
        require(uid != 0, "User not found");
        return users[uid];
    }

    // --- User management ---
    function requestUserRole(string memory role) external {
        uint256 uid = addressToUserId[msg.sender];
        if (uid == 0) {
            uid = nextUserId++;
            addressToUserId[msg.sender] = uid;
            users[uid] = User({
                id: uid,
                userAddress: msg.sender,
                role: role,
                status: UserStatus.Pending
            });
        } else {
            // Update role and reset to Pending
            User storage u = users[uid];
            u.role = role;
            u.status = UserStatus.Pending;
        }
        emit UserRoleRequested(msg.sender, role);
    }

    function changeStatusUser(address userAddress, UserStatus newStatus) external onlyAdmin {
        uint256 uid = addressToUserId[userAddress];
        require(uid != 0, "User not found");
        users[uid].status = newStatus;
        emit UserStatusChanged(userAddress, newStatus);
    }
}