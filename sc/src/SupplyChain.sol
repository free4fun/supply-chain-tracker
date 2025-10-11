// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

// --- Custom errors (file scope) ---
error NotAdmin();
error EmptyRole();
error NoUser();

contract SupplyChain {
    // ---------- Enums ----------
    enum UserStatus { Pending, Approved, Rejected, Canceled }
    enum TransferStatus { Pending, Accepted, Rejected } // reserved for next phase

    // ---------- Structs ----------
    struct User {
        uint256 id;
        address userAddress;
        string role; // "Producer" | "Factory" | "Retailer" | "Consumer"
        UserStatus status;
    }

    // Internal token struct with per-address balances mapping (cannot be returned directly)
    struct Token {
        uint256 id;
        address creator;
        string name;
        uint256 totalSupply;
        string features;     // JSON blob
        uint256 parentId;    // 0 = root
        uint256 dateCreated; // block.timestamp
        mapping(address => uint256) balance;
    }

    // ---------- Storage ----------
    address public admin;

    // Users
    uint256 public nextUserId = 1;
    mapping(address => uint256) public addressToUserId; // 0 means none
    mapping(uint256 => User) public users;

    // Tokens
    uint256 public nextTokenId = 1;
    mapping(uint256 => Token) private tokens;

    // ---------- Events ----------
    event UserRoleRequested(address indexed user, string role);
    event UserStatusChanged(address indexed user, UserStatus status);

    event TokenCreated(
        uint256 indexed tokenId,
        address indexed creator,
        string name,
        uint256 totalSupply,
        string features,
        uint256 parentId
    );

    // ---------- Constructor ----------
    constructor() {
        admin = msg.sender;
    }

    // ---------- Modifiers ----------
    modifier onlyAdmin() {
        // keep simple require; tests use generic expectRevert()
        require(msg.sender == admin, "Only admin");
        _;
    }

    // ---------- Internal helpers ----------
    /// @dev true if address is a registered Approved user
    function _isApproved(address a) internal view returns (bool) {
        uint256 id = addressToUserId[a];
        if (id == 0) return false;
        return users[id].status == UserStatus.Approved;
    }

    /// @dev role string or empty if not registered
    function _roleOf(address a) internal view returns (string memory) {
        uint256 id = addressToUserId[a];
        if (id == 0) return "";
        return users[id].role;
    }

    // ---------- Views ----------
    function isAdmin(address a) public view returns (bool) {
        return a == admin;
    }

    function getUserInfo(address userAddress) external view returns (User memory) {
        uint256 uid = addressToUserId[userAddress];
        require(uid != 0, "User not found");
        return users[uid];
    }

    /// @notice Read-only view of a token (Token has a mapping so we expose a view tuple)
    function getTokenView(uint256 tokenId)
        external
        view
        returns (
            uint256 id,
            address creator,
            string memory name,
            uint256 totalSupply,
            string memory features,
            uint256 parentId,
            uint256 dateCreated
        )
    {
        require(tokenId != 0 && tokenId < nextTokenId, "Token not found");
        Token storage t = tokens[tokenId];
        return (t.id, t.creator, t.name, t.totalSupply, t.features, t.parentId, t.dateCreated);
    }

    /// @notice Balance of an address for a given token
    function getTokenBalance(uint256 tokenId, address userAddress) external view returns (uint256) {
        require(tokenId != 0 && tokenId < nextTokenId, "Token not found");
        return tokens[tokenId].balance[userAddress];
    }

    // ---------- User management ----------
    function requestUserRole(string memory role) external {
        if (bytes(role).length == 0) revert EmptyRole();

        uint256 id = addressToUserId[msg.sender];
        if (id == 0) {
            id = nextUserId++;
            addressToUserId[msg.sender] = id;
            users[id] = User({
                id: id,
                userAddress: msg.sender,
                role: role,
                status: UserStatus.Pending
            });
        } else {
            User storage u = users[id];
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

    // ---------- Token creation ----------
    /// @notice Create a token. Only Approved users. Consumers cannot create.
    /// @dev For now, parentId is not enforced beyond being provided by caller.
    function createToken(
        string memory name,
        uint256 totalSupply,
        string memory features,
        uint256 parentId
    ) external {
        require(_isApproved(msg.sender), "Not approved");
        string memory role = _roleOf(msg.sender);
        require(keccak256(bytes(role)) != keccak256("Consumer"), "Role forbidden");

        require(bytes(name).length > 0, "Name required");
        require(totalSupply > 0, "Supply required");

        uint256 tokenId = nextTokenId++;

        Token storage t = tokens[tokenId];
        t.id = tokenId;
        t.creator = msg.sender;
        t.name = name;
        t.totalSupply = totalSupply;
        t.features = features;
        t.parentId = parentId;
        t.dateCreated = block.timestamp;

        // assign full supply to creator
        t.balance[msg.sender] = totalSupply;

        emit TokenCreated(tokenId, msg.sender, name, totalSupply, features, parentId);
    }
}
