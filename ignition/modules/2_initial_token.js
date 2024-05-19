const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const INITIAL_SUPPLY = 1_000n;
module.exports = buildModule("TokenModule", (m) => {
    const token = m.contract("MyToken", [INITIAL_SUPPLY]);
    return { token };
});
