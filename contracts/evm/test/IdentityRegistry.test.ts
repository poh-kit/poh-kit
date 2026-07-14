// SPDX-License-Identifier: MIT OR Apache-2.0
import { expect } from "chai";
import { ethers } from "hardhat";

describe("IdentityRegistry", () => {
  async function deploy() {
    const [admin, relayer, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory("IdentityRegistry");
    const reg = await F.deploy(admin.address);
    const RELAYER_ROLE = await reg.RELAYER_ROLE();
    await reg.connect(admin).grantRole(RELAYER_ROLE, relayer.address);
    return { reg, admin, relayer, other };
  }
  const UID = ethers.keccak256(ethers.toUtf8Bytes("uid-123"));

  it("relayer upserts and the account reads back", async () => {
    const { reg, relayer } = await deploy();
    await reg.connect(relayer).setVoterAccount(UID, [1, 376], [0x892db04d66bffffn]);
    const [pops, cells, exists] = await reg.getVoterAccount(UID);
    expect(pops.map(Number)).to.deep.equal([1, 376]);
    expect(cells[0]).to.equal(0x892db04d66bffffn);
    expect(exists).to.equal(true);
  });
  it("upsert overwrites", async () => {
    const { reg, relayer } = await deploy();
    await reg.connect(relayer).setVoterAccount(UID, [1], []);
    await reg.connect(relayer).setVoterAccount(UID, [840], []);
    const [pops] = await reg.getVoterAccount(UID);
    expect(pops.map(Number)).to.deep.equal([840]);
  });
  it("unknown uid reads as not-exists", async () => {
    const { reg } = await deploy();
    const [, , exists] = await reg.getVoterAccount(ethers.keccak256(ethers.toUtf8Bytes("nope")));
    expect(exists).to.equal(false);
  });
  it("non-relayer cannot write", async () => {
    const { reg, other } = await deploy();
    await expect(reg.connect(other).setVoterAccount(UID, [1], [])).to.be.reverted;
  });
});