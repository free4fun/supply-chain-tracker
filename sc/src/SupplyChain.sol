// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

// --- Custom errors (file scope) ---
error NotAdmin();
error EmptyRole();
error NoUser();

contract SupplyChain {
    // ---------- Enums ----------
    enum UserStatus {
        Pending,
        Approved,
        Rejected,
        Canceled
    }
    enum TransferStatus {
        Pending,
        Accepted,
        Rejected
    }

    // ---------- Structs ----------
    struct User {
        uint256 id;
        address userAddress;
        string role; // "Producer" | "Factory" | "Retailer" | "Consumer"
        UserStatus status;
    }

    struct Token {
        uint256 id;
        address creator;
        string name;
        uint256 totalSupply;
        string features; // JSON blob
        uint256 parentId; // 0 = root
        uint256 dateCreated; // block.timestamp
        mapping(address => uint256) balance;
    }

    struct Transfer {
        uint256 id;
        address from;
        address to;
        uint256 tokenId;
        uint256 dateCreated;
        uint256 amount;
        TransferStatus status;
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

    // Transfers
    uint256 public nextTransferId = 1;
    mapping(uint256 => Transfer) private transfers;
    // Reserved amounts while transfers are Pending: tokenId => from => reserved
    mapping(uint256 => mapping(address => uint256)) private reservedPendingOut;

    // Track user -> token set
    mapping(address => mapping(uint256 => bool)) private hasToken;
    mapping(address => uint256[]) private userTokens;

    // Track user -> transfer ids
    mapping(address => uint256[]) private userTransfers;

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
    event TransferRequested(
        uint256 indexed transferId,
        address indexed from,
        address indexed to,
        uint256 tokenId,
        uint256 amount
    );
    event TransferAccepted(uint256 indexed transferId);
    event TransferRejected(uint256 indexed transferId);

    // ---------- Constructor ----------
    constructor() {
        admin = msg.sender;
    }

    // ---------- Modifiers ----------
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    // ---------- Internal helpers ----------
    /// @dev True if address is a registered Approved user.
    function _isApproved(address a) internal view returns (bool) {
        uint256 id = addressToUserId[a];
        if (id == 0) return false;
        return users[id].status == UserStatus.Approved;
    }

    /// @dev Role string or empty if not registered.
    function _roleOf(address a) internal view returns (string memory) {
        uint256 id = addressToUserId[a];
        if (id == 0) return "";
        return users[id].role;
    }

    /// @dev Allowed hop in the chain: Producer->Factory->Retailer->Consumer.
    function _isValidRoute(address from, address to) internal view returns (bool) {
        bytes32 rf = keccak256(bytes(_roleOf(from)));
        bytes32 rt = keccak256(bytes(_roleOf(to)));
        if (rf == keccak256("Producer") && rt == keccak256("Factory")) return true;
        if (rf == keccak256("Factory") && rt == keccak256("Retailer")) return true;
        if (rf == keccak256("Retailer") && rt == keccak256("Consumer")) return true;
        return false;
    }

    /// @dev Require existing token.
    function _requireToken(uint256 tokenId) internal view {
        require(tokenId != 0 && tokenId < nextTokenId, "Token not found");
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

    /// @notice Read-only view of a token (Token has a mapping so we expose a view tuple).
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
        _requireToken(tokenId);
        Token storage t = tokens[tokenId];
        return (t.id, t.creator, t.name, t.totalSupply, t.features, t.parentId, t.dateCreated);
    }

    /// @notice Balance of an address for a given token.
    function getTokenBalance(uint256 tokenId, address userAddress)
        external
        view
        returns (uint256)
    {
        _requireToken(tokenId);
        return tokens[tokenId].balance[userAddress];
    }

    /// @notice Returns transfer data as a tuple.
    function getTransfer(uint256 transferId)
        external
        view
        returns (
            uint256 id,
            address from,
            address to,
            uint256 tokenId,
            uint256 dateCreated,
            uint256 amount,
            TransferStatus status
        )
    {
        require(transferId != 0 && transferId < nextTransferId, "Transfer not found");
        Transfer storage tr = transfers[transferId];
        return (tr.id, tr.from, tr.to, tr.tokenId, tr.dateCreated, tr.amount, tr.status);
    }

    // ---------- User management ----------
    function requestUserRole(string memory role) external {
        if (bytes(role).length == 0) revert EmptyRole();

        uint256 id = addressToUserId[msg.sender];
        if (id == 0) {
            id = nextUserId++;
            addressToUserId[msg.sender] = id;
            users[id] =
                User({ id: id, userAddress: msg.sender, role: role, status: UserStatus.Pending });
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

        t.balance[msg.sender] = totalSupply;

        if (!hasToken[msg.sender][tokenId]) {
            hasToken[msg.sender][tokenId] = true;
            userTokens[msg.sender].push(tokenId);
        }

        emit TokenCreated(tokenId, msg.sender, name, totalSupply, features, parentId);
    }

    // ---------- Transfers ----------
    /// @notice Create a pending transfer and reserve sender balance until accept/reject.
    function transfer(address to, uint256 tokenId, uint256 amount) external {
        _requireToken(tokenId);
        require(_isApproved(msg.sender), "Sender not approved");
        require(_isApproved(to), "Recipient not approved");
        require(to != address(0), "Zero address");
        require(to != msg.sender, "Self transfer");
        require(amount > 0, "Amount required");
        require(_isValidRoute(msg.sender, to), "Invalid route");

        Token storage t = tokens[tokenId];

        // Available amount considering reservations
        uint256 available = t.balance[msg.sender] - reservedPendingOut[tokenId][msg.sender];
        require(amount <= available, "Insufficient available");

        uint256 transferId = nextTransferId++;
        transfers[transferId] = Transfer({
            id: transferId,
            from: msg.sender,
            to: to,
            tokenId: tokenId,
            dateCreated: block.timestamp,
            amount: amount,
            status: TransferStatus.Pending
        });

        if (!hasToken[msg.sender][tokenId]) {
            hasToken[msg.sender][tokenId] = true;
            userTokens[msg.sender].push(tokenId);
        }
        // Index transfer for both parties
        userTransfers[msg.sender].push(transferId);
        userTransfers[to].push(transferId);

        // Reserve the amount
        reservedPendingOut[tokenId][msg.sender] += amount;

        emit TransferRequested(transferId, msg.sender, to, tokenId, amount);
    }

    /// @notice Accept a pending transfer. Only recipient can accept.
    function acceptTransfer(uint256 transferId) external {
        require(transferId != 0 && transferId < nextTransferId, "Transfer not found");
        Transfer storage tr = transfers[transferId];
        require(tr.status == TransferStatus.Pending, "Not pending");
        require(msg.sender == tr.to, "Only recipient");

        Token storage t = tokens[tr.tokenId];

        // Apply movement
        uint256 fromBal = t.balance[tr.from];

        if (!hasToken[tr.to][tr.tokenId]) {
            hasToken[tr.to][tr.tokenId] = true;
            userTokens[tr.to].push(tr.tokenId);
        }

        // Reserved was already counted out of 'available' so must exist
        require(fromBal >= tr.amount, "From balance low");

        t.balance[tr.from] = fromBal - tr.amount;
        t.balance[tr.to] += tr.amount;

        // Release reservation
        uint256 reserved = reservedPendingOut[tr.tokenId][tr.from];
        if (reserved >= tr.amount) {
            reservedPendingOut[tr.tokenId][tr.from] = reserved - tr.amount;
        } else {
            reservedPendingOut[tr.tokenId][tr.from] = 0; // defensive
        }

        tr.status = TransferStatus.Accepted;
        emit TransferAccepted(transferId);
    }

    /// @notice Reject a pending transfer. Only recipient can reject.
    function rejectTransfer(uint256 transferId) external {
        require(transferId != 0 && transferId < nextTransferId, "Transfer not found");
        Transfer storage tr = transfers[transferId];
        require(tr.status == TransferStatus.Pending, "Not pending");
        require(msg.sender == tr.to, "Only recipient");

        // Release reservation only
        uint256 reserved = reservedPendingOut[tr.tokenId][tr.from];
        if (reserved >= tr.amount) {
            reservedPendingOut[tr.tokenId][tr.from] = reserved - tr.amount;
        } else {
            reservedPendingOut[tr.tokenId][tr.from] = 0; // defensive
        }

        tr.status = TransferStatus.Rejected;
        emit TransferRejected(transferId);
    }

    function getUserTokens(address user) external view returns (uint256[] memory) {
        return userTokens[user];
    }

    function getUserTransfers(address user) external view returns (uint256[] memory) {
        return userTransfers[user];
    }
}
