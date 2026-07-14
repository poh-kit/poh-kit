// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// VoterAccount store: population codes (UN-M49) + H3 cells, keyed by an opaque
/// bytes32 uid — e.g. keccak256 of the caller's user id, or bytes32(uint160(userAddress)).
/// The key is opaque; the caller chooses a consistent derivation.
contract IdentityRegistry is AccessControl, IIdentityRegistry {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    struct VoterAccount { uint32[] populations; uint64[] h3Cells; bool exists; }
    mapping(bytes32 => VoterAccount) private _accounts;

    event VoterAccountSet(bytes32 indexed uid, uint32[] populations, uint64[] h3Cells);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setVoterAccount(bytes32 uid, uint32[] calldata populations, uint64[] calldata h3Cells)
        external onlyRole(RELAYER_ROLE) {
        _accounts[uid] = VoterAccount(populations, h3Cells, true);
        emit VoterAccountSet(uid, populations, h3Cells);
    }

    function getVoterAccount(bytes32 uid)
        external view returns (uint32[] memory populations, uint64[] memory h3Cells, bool exists) {
        VoterAccount storage a = _accounts[uid];
        return (a.populations, a.h3Cells, a.exists);
    }
}
