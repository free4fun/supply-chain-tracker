// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

// --- Custom errors (file scope) ---
error NotAdmin();
error EmptyRole();
error NoUser();

contract SupplyChain {
    // ---------- Custom errors (contract scope) ----------
    error StatusLocked();
    error ParentNotAssigned();

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
        Rejected,
        Cancelled
    }

    // ---------- Structs ----------
    struct User {
        uint256 id;
        address userAddress;
        string role; // Active role: "Producer" | "Factory" | "Retailer" | "Consumer"
        string pendingRole; // Requested role while under review (empty if none)
        UserStatus status;
        // Profile fields
        string company;
        string firstName;
        string lastName;
    }

    struct Component {
        uint256 tokenId;
        uint256 amount;
    }

    struct Token {
        uint256 id;
        address creator;
        string name;
        string description; // Optional human-readable summary
        uint256 totalSupply;
        string features; // JSON blob
        uint256 parentId; // 0 = root
        uint256 dateCreated; // block.timestamp
        uint256 availableSupply; // Tracks remaining units after transformations
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
    // Mapping is internal; expose read-only views via getTokenView to avoid getter issues with mappings in structs
    mapping(uint256 => Token) private tokens;
    mapping(uint256 => Component[]) private tokenInputs; // tokenId => consumed components

    // Transfers
    uint256 public nextTransferId = 1;
    mapping(uint256 => Transfer) public transfers;
    // Reserved amounts while transfers are Pending: tokenId => from => reserved
    mapping(uint256 => mapping(address => uint256)) private reservedPendingOut;

    // Track user -> token set
    mapping(address => mapping(uint256 => bool)) private hasToken;
    mapping(address => uint256[]) private userTokens;

    // Recommended parent token per account, updated after accepted transfers
    mapping(address => uint256) private suggestedParentByUser;

    // Track user -> transfer ids
    mapping(address => uint256[]) private userTransfers;

    // ---------- Events ----------
    event UserRoleRequested(address indexed user, string role);
    event UserStatusChanged(address indexed user, UserStatus status);
    event UserProfileUpdated(address indexed user, string company, string firstName, string lastName);
    event TokenCreated(
        uint256 indexed tokenId,
        address indexed creator,
        string name,
        string description,
        uint256 totalSupply,
        string features,
        uint256 parentId
    );
    event TokenComponentsLinked(uint256 indexed tokenId, uint256[] componentIds, uint256[] componentAmounts);
    event TransferRequested(
        uint256 indexed transferId,
        address indexed from,
        address indexed to,
        uint256 tokenId,
        uint256 amount
    );
    event TransferAccepted(uint256 indexed transferId);
    event TransferRejected(uint256 indexed transferId);
    event TransferCancelled(uint256 indexed transferId);

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

    /// @dev Compute enforced parent id for the current sender based on role and transfers.
    function _resolveParentId(string memory role) internal view returns (uint256) {
        if (keccak256(bytes(role)) == keccak256("Producer")) {
            // Producers mint root assets that start the traceability tree.
            return 0;
        }

        uint256 suggested = suggestedParentByUser[msg.sender];
        if (suggested == 0) revert ParentNotAssigned();
        return suggested;
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
            string memory description,
            uint256 totalSupply,
            string memory features,
            uint256 parentId,
            uint256 dateCreated,
            uint256 availableSupply
        )
    {
        _requireToken(tokenId);
        Token storage t = tokens[tokenId];
        return (
            t.id,
            t.creator,
            t.name,
            t.description,
            t.totalSupply,
            t.features,
            t.parentId,
            t.dateCreated,
            t.availableSupply
        );
    }

    function getTokenInputs(uint256 tokenId) external view returns (Component[] memory) {
        _requireToken(tokenId);
        return tokenInputs[tokenId];
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

    /// @notice Returns the enforced parent id for a future token creation by the given user.
    function getSuggestedParent(address userAddress) external view returns (uint256) {
        return suggestedParentByUser[userAddress];
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
    function requestUserRole(string memory role) external { // Mejorar funcion de testeo
        if (bytes(role).length == 0) revert EmptyRole();

        uint256 id = addressToUserId[msg.sender];
        if (id == 0) {
            // New user without profile: enforce initial registration via registerAndRequestRole
            revert NoUser();
        } else {
            User storage u = users[id];
            if (u.status == UserStatus.Approved) {
                // Keep active role until admin approves; just set pendingRole
                u.pendingRole = role;
            } else {
                // Onboarding flow: keep status Pending and stage role
                u.pendingRole = role;
                u.status = UserStatus.Pending;
            }
        }
        emit UserRoleRequested(msg.sender, role);
    }

    /// @notice First-time registration: set profile and request a role in a single transaction.
    function registerAndRequestRole(
        string memory company,
        string memory firstName,
        string memory lastName,
        string memory role
    ) external {
        require(bytes(company).length != 0, "Company required");
        require(bytes(firstName).length != 0, "First name required");
        require(bytes(lastName).length != 0, "Last name required");
        if (bytes(role).length == 0) revert EmptyRole();

        uint256 id = addressToUserId[msg.sender];
        require(id == 0, "Already registered");

        id = nextUserId++;
        addressToUserId[msg.sender] = id;
        users[id] = User({
            id: id,
            userAddress: msg.sender,
            role: "",
            pendingRole: role,
            status: UserStatus.Pending,
            company: company,
            firstName: firstName,
            lastName: lastName
        });

        emit UserProfileUpdated(msg.sender, company, firstName, lastName);
        emit UserRoleRequested(msg.sender, role);
    }

    /// @notice Update user profile fields; caller must be registered.
    function updateUserProfile(
        string memory company,
        string memory firstName,
        string memory lastName
    ) external {
        uint256 id = addressToUserId[msg.sender];
        require(id != 0, "User not found");

        require(bytes(company).length != 0, "Company required");
        require(bytes(firstName).length != 0, "First name required");
        require(bytes(lastName).length != 0, "Last name required");

        User storage u = users[id];
        u.company = company;
        u.firstName = firstName;
        u.lastName = lastName;

        emit UserProfileUpdated(msg.sender, company, firstName, lastName);
    }

    function changeStatusUser(address userAddress, UserStatus newStatus) external onlyAdmin { // Mejorar funcion de testeo
        uint256 uid = addressToUserId[userAddress];
        require(uid != 0, "User not found");
        User storage u = users[uid];

        bool hasPending = bytes(u.pendingRole).length != 0;
        if (!hasPending) {
            // No staged change: only allow transitions when Pending or idempotent
            if (u.status != UserStatus.Pending && u.status != newStatus) {
                revert StatusLocked();
            }
            u.status = newStatus;
        } else {
            if (newStatus == UserStatus.Approved) {
                // Apply requested role and keep Approved status
                u.role = u.pendingRole;
                u.pendingRole = "";
                u.status = UserStatus.Approved;
            } else if (newStatus == UserStatus.Rejected) {
                // Drop request; keep current active role
                u.pendingRole = "";
                if (u.status != UserStatus.Approved) {
                    u.status = UserStatus.Rejected;
                }
            } else if (newStatus == UserStatus.Canceled) {
                // Treat as dropping the request (admin shouldn't cancel usually)
                u.pendingRole = "";
                if (u.status != UserStatus.Approved) {
                    u.status = UserStatus.Canceled;
                }
            } else if (newStatus == UserStatus.Pending) {
                // no-op
            } else {
                revert("Invalid status");
            }
        }

        emit UserStatusChanged(userAddress, newStatus);
    }

    function cancelRoleRequest() external { // Necesita funcion de testeo
        uint256 uid = addressToUserId[msg.sender];
        require(uid != 0, "User not found");
        User storage u = users[uid];

        bool hasPending = bytes(u.pendingRole).length != 0;
        require(hasPending || u.status == UserStatus.Pending, "No role request pending");

        if (hasPending && u.status == UserStatus.Approved) {
            // Approved user cancels their pending change: keep active role as-is
            u.pendingRole = "";
            emit UserStatusChanged(msg.sender, u.status);
            return;
        }

        // Onboarding user cancels while Pending
        require(u.status == UserStatus.Pending, "Not pending");
        u.pendingRole = "";
        u.status = UserStatus.Canceled;
        emit UserStatusChanged(msg.sender, u.status);
    }

    // ---------- Token creation ----------
    /// @notice Create a token. Only Approved users. Consumers cannot create.
    function createToken(
        string memory name,
        string memory description,
        uint256 totalSupply,
        string memory features,
        uint256[] memory inputIds,
        uint256[] memory inputAmounts
    ) external {
        require(_isApproved(msg.sender), "Not approved");
        string memory role = _roleOf(msg.sender);
        require(keccak256(bytes(role)) != keccak256("Consumer"), "Role forbidden");

        require(bytes(name).length > 0, "Name required");
        require(totalSupply > 0, "Supply required");

        uint256 parentId = 0;
        if (keccak256(bytes(role)) == keccak256("Producer")) {
            require(inputIds.length == 0, "Root tokens use no inputs");
        } else {
            require(inputIds.length == inputAmounts.length, "Inputs mismatch");
            require(inputIds.length > 0, "Inputs required");
            // Parent ID is informational: we take the first component as the parent for traceability,
            // but we do NOT enforce it to match any suggested value. Suggested parent is now a UI hint only.
            parentId = inputIds[0];
        }

        uint256 tokenId = nextTokenId++;

        Token storage t = tokens[tokenId];
        t.id = tokenId;
        t.creator = msg.sender;
        t.name = name;
        t.description = description;
        t.totalSupply = totalSupply;
        t.features = features;
        t.parentId = parentId;
        t.dateCreated = block.timestamp;
        t.availableSupply = totalSupply;

        t.balance[msg.sender] = totalSupply;

        if (!hasToken[msg.sender][tokenId]) {
            hasToken[msg.sender][tokenId] = true;
            userTokens[msg.sender].push(tokenId);
        }

        if (inputIds.length > 0) {
            for (uint256 i = 0; i < inputIds.length; i++) {
                uint256 componentId = inputIds[i];
                uint256 amount = inputAmounts[i];
                require(amount > 0, "Component amount");
                _requireToken(componentId);

                Token storage component = tokens[componentId];
                uint256 available = component.balance[msg.sender] - reservedPendingOut[componentId][msg.sender];
                require(amount <= available, "Component exhausted");

                component.balance[msg.sender] -= amount;
                if (component.availableSupply >= amount) {
                    component.availableSupply -= amount;
                } else {
                    component.availableSupply = 0;
                }

                tokenInputs[tokenId].push(Component({ tokenId: componentId, amount: amount }));
            }

            // After transformation the new asset becomes the suggested parent for the creator
            suggestedParentByUser[msg.sender] = tokenId;
        }

        emit TokenCreated(tokenId, msg.sender, name, description, totalSupply, features, parentId);
        if (inputIds.length > 0) {
            emit TokenComponentsLinked(tokenId, inputIds, inputAmounts);
        }
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

    // Only the creator of the token can transfer it (not received tokens)
    require(t.creator == msg.sender, "Only creator can transfer this token");

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

        // Update the enforced parent suggestion so downstream creations chain correctly.
        suggestedParentByUser[tr.to] = tr.tokenId;

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

    /// @notice Cancel a pending transfer. Only the sender can cancel and it must be Pending.
    function cancelTransfer(uint256 transferId) external {
        require(transferId != 0 && transferId < nextTransferId, "Transfer not found");
        Transfer storage tr = transfers[transferId];
        require(tr.status == TransferStatus.Pending, "Not pending");
        require(msg.sender == tr.from, "Only sender");

        // Release reservation
        uint256 reserved = reservedPendingOut[tr.tokenId][tr.from];
        if (reserved >= tr.amount) {
            reservedPendingOut[tr.tokenId][tr.from] = reserved - tr.amount;
        } else {
            reservedPendingOut[tr.tokenId][tr.from] = 0; // defensive
        }

        tr.status = TransferStatus.Cancelled;
        emit TransferCancelled(transferId);
    }

    function getUserTokens(address user) external view returns (uint256[] memory) {
        return userTokens[user];
    }

    function getUserTransfers(address user) external view returns (uint256[] memory) {
        return userTransfers[user];
    }

    // ---------- Analytics (views) ----------
    /// @notice Returns tokens created by the given user.
    function getUserCreatedTokens(address user) external view returns (uint256[] memory) {
        uint256 total = nextTokenId;
        uint256 count = 0;
        // First pass: count
        for (uint256 i = 1; i < total; i++) {
            if (tokens[i].creator == user) count++;
        }
        uint256[] memory ids = new uint256[](count);
        if (count == 0) return ids;
        uint256 idx = 0;
        for (uint256 i = 1; i < total; i++) {
            if (tokens[i].creator == user) {
                ids[idx++] = i;
            }
        }
        return ids;
    }

    /// @notice Returns a summary for tokens created by user: (createdCount, totalSupplySum, availableSum, totalConsumedInputs)
    function getUserCreatedSummary(address user)
        external
        view
        returns (
            uint256 createdCount,
            uint256 totalSupplySum,
            uint256 availableSum,
            uint256 totalConsumedInputs
        )
    {
        uint256 total = nextTokenId;
        for (uint256 i = 1; i < total; i++) {
            Token storage t = tokens[i];
            if (t.creator == user) {
                createdCount++;
                totalSupplySum += t.totalSupply;
                availableSum += t.availableSupply;
                // Sum inputs consumed to create token i
                Component[] storage comps = tokenInputs[i];
                for (uint256 k = 0; k < comps.length; k++) {
                    totalConsumedInputs += comps[k].amount;
                }
            }
        }
        return (createdCount, totalSupplySum, availableSum, totalConsumedInputs);
    }

    /// @notice Returns ids with non-zero balance for a user and their balances.
    function getUserBalancesNonZero(address user)
        external
        view
        returns (uint256[] memory ids, uint256[] memory balances)
    {
        uint256[] storage all = userTokens[user];
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            uint256 id = all[i];
            if (tokens[id].balance[user] > 0) count++;
        }
        ids = new uint256[](count);
        balances = new uint256[](count);
        if (count == 0) return (ids, balances);
        uint256 idx = 0;
        for (uint256 i = 0; i < all.length; i++) {
            uint256 id = all[i];
            uint256 bal = tokens[id].balance[user];
            if (bal > 0) {
                ids[idx] = id;
                balances[idx] = bal;
                idx++;
            }
        }
    }
}
