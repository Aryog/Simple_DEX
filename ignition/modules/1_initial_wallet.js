const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");


module.exports = buildModule("WalletModule", (m) => {

    const wallet = m.contract("Wallet");

    return { wallet };
});
