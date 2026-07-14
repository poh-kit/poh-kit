// SPDX-License-Identifier: MIT OR Apache-2.0
import { expect } from "chai";
import { ethers } from "hardhat";

describe("IdentityCommitments", () => {
  async function deploy() {
    const [admin, relayer, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory("IdentityCommitments");
    const c = await F.deploy(admin.address);
    await c.connect(admin).grantRole(await c.RELAYER_ROLE(), relayer.address);
    return { c, relayer, other };
  }
  const UID = ethers.keccak256(ethers.toUtf8Bytes("uid-9"));
  const COMMIT = ethers.keccak256(ethers.toUtf8Bytes("commitment"));

  it("anchor stores the commitment; second anchor reverts AlreadyExists", async () => {
    const { c, relayer } = await deploy();
    await expect(c.connect(relayer).anchor(UID, COMMIT)).to.emit(c, "Anchored").withArgs(UID, COMMIT);
    expect(await c.getCommitment(UID)).to.equal(COMMIT);
    await expect(c.connect(relayer).anchor(UID, COMMIT)).to.be.revertedWithCustomError(c, "AlreadyExists");
  });
  it("non-relayer cannot anchor", async () => {
    const { c, other } = await deploy();
    await expect(c.connect(other).anchor(UID, COMMIT)).to.be.reverted;
  });
});