// SPDX-License-Identifier: MIT OR Apache-2.0
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Attestations", () => {
  async function deploy() {
    const [admin, relayer, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory("Attestations");
    const a = await F.deploy(admin.address);
    await a.connect(admin).grantRole(await a.RELAYER_ROLE(), relayer.address);
    return { a, relayer, other };
  }
  const HOLDER = "0x000000000000000000000000000000000000bEEF";
  const CTX = ethers.keccak256(ethers.toUtf8Bytes("proposal-addr"));
  const VOTED = 1;

  it("issue → hasAttestation true + Issued event; duplicate reverts AlreadyExists", async () => {
    const { a, relayer } = await deploy();
    await expect(a.connect(relayer).issue(HOLDER, VOTED, CTX)).to.emit(a, "Issued");
    expect(await a.hasAttestation(HOLDER, VOTED, CTX)).to.equal(true);
    await expect(a.connect(relayer).issue(HOLDER, VOTED, CTX)).to.be.revertedWithCustomError(a, "AlreadyExists");
  });

  it("revoke flips hasAttestation to false (authority-only)", async () => {
    const { a, relayer, other } = await deploy();
    await a.connect(relayer).issue(HOLDER, VOTED, CTX);
    await expect(a.connect(other).revoke(HOLDER, VOTED, CTX)).to.be.reverted;
    await expect(a.connect(relayer).revoke(HOLDER, VOTED, CTX)).to.emit(a, "Revoked");
    expect(await a.hasAttestation(HOLDER, VOTED, CTX)).to.equal(false);
  });

  it("there are no transfer functions (soulbound by construction)", async () => {
    const { a } = await deploy();
    expect((a as any).transferFrom).to.equal(undefined);
    expect((a as any).safeTransferFrom).to.equal(undefined);
  });
});